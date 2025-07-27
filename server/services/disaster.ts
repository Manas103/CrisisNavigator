import { storage } from "../storage";
import { type InsertDisaster } from "@shared/schema";

interface EONETEvent {
  id: string;
  title: string;
  description: string;
  categories: Array<{ id: string; title: string }>;
  geometry: Array<{
    coordinates: [number, number];
    date: string;
  }>;
  sources: Array<{ url: string }>;
}

interface EONETResponse {
  events: EONETEvent[];
}

export class DisasterService {
  private isProcessing = false;

  async ingestNASAData(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      console.log("Fetching NASA EONET data...");
      const response = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events");
      
      if (!response.ok) {
        throw new Error(`NASA API error: ${response.status}`);
      }

      const data: EONETResponse = await response.json();
      console.log(`Received ${data.events.length} events from NASA EONET`);

      let newEvents = 0;
      for (const event of data.events) {
        if (!event.geometry || event.geometry.length === 0) continue;

        const geometry = event.geometry[0];
        if (!geometry.coordinates || geometry.coordinates.length !== 2) continue;

        const existingDisasters = await storage.getDisasters();
        const exists = existingDisasters.some(d => 
          d.title === event.title && 
          Math.abs(d.latitude - geometry.coordinates[1]) < 0.001 &&
          Math.abs(d.longitude - geometry.coordinates[0]) < 0.001
        );
        
        if (exists) continue;

        const disaster: InsertDisaster = {
          type: event.categories[0]?.title || "Unknown",
          latitude: geometry.coordinates[1],
          longitude: geometry.coordinates[0],
          title: event.title,
          description: event.description || "",
          timestamp: new Date(geometry.date),
          processed: false,
          severity: null,
          analysis: null,
          rawData: event,
        };

        await storage.createDisaster(disaster);
        newEvents++;
      }

      await storage.createActivity({
        type: "data_ingestion",
        message: `NASA EONET data sync complete - ${newEvents} new events ingested`,
        severity: "info",
      });

      console.log(`Ingested ${newEvents} new disasters`);
    } catch (error) {
      console.error("Error ingesting NASA data:", error);
      await storage.createActivity({
        type: "data_ingestion",
        message: `NASA EONET data sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: "error",
      });
    } finally {
      this.isProcessing = false;
    }
  }

  async startPeriodicIngestion(intervalMs: number = 600000): Promise<void> {
    await this.ingestNASAData();

    setInterval(async () => {
      await this.ingestNASAData();
    }, intervalMs);
  }
}

export const disasterService = new DisasterService();

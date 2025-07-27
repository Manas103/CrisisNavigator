import { type Disaster, type InsertDisaster, type Activity, type InsertActivity, type SystemStats } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Disaster methods
  getDisasters(): Promise<Disaster[]>;
  getDisaster(id: string): Promise<Disaster | undefined>;
  createDisaster(disaster: InsertDisaster): Promise<Disaster>;
  updateDisaster(id: string, updates: Partial<Disaster>): Promise<Disaster | undefined>;
  getUnprocessedDisasters(): Promise<Disaster[]>;
  
  // Stats methods
  getStats(): Promise<SystemStats>;
  updateStats(stats: Partial<SystemStats>): Promise<SystemStats>;
  
  // Activity methods
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class MemStorage implements IStorage {
  private disasters: Map<string, Disaster>;
  private activities: Map<string, Activity>;
  private stats: SystemStats;

  constructor() {
    this.disasters = new Map();
    this.activities = new Map();
    this.stats = {
      id: randomUUID(),
      totalEvents: 0,
      processedEvents: 0,
      highSeverityEvents: 0,
      lastUpdated: new Date(),
    };
  }

  async getDisasters(): Promise<Disaster[]> {
    // Prioritize processed disasters with high severity for better user experience
    return Array.from(this.disasters.values()).sort((a, b) => {
      // First sort by processed status (processed first)
      if (a.processed !== b.processed) {
        return (b.processed ? 1 : 0) - (a.processed ? 1 : 0);
      }
      // Then by severity (high first)
      if (a.severity !== b.severity) {
        return (b.severity || 0) - (a.severity || 0);
      }
      // Finally by creation time (newest first)
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }

  async getDisaster(id: string): Promise<Disaster | undefined> {
    return this.disasters.get(id);
  }

  async createDisaster(insertDisaster: InsertDisaster): Promise<Disaster> {
    const id = randomUUID();
    const now = new Date();
    const disaster: Disaster = {
      ...insertDisaster,
      id,
      createdAt: now,
      updatedAt: now,
      title: insertDisaster.title ?? null,
      severity: insertDisaster.severity ?? null,
      description: insertDisaster.description ?? null,
      processed: insertDisaster.processed ?? null,
      analysis: insertDisaster.analysis ?? null,
      rawData: insertDisaster.rawData ?? null,
    };
    this.disasters.set(id, disaster);
    
    // Update stats
    await this.updateStats({
      totalEvents: (this.stats.totalEvents ?? 0) + 1,
      processedEvents: disaster.processed ? (this.stats.processedEvents ?? 0) + 1 : (this.stats.processedEvents ?? 0),
      highSeverityEvents: (disaster.severity && disaster.severity >= 7) ? (this.stats.highSeverityEvents ?? 0) + 1 : (this.stats.highSeverityEvents ?? 0),
    });
    
    return disaster;
  }

  async updateDisaster(id: string, updates: Partial<Disaster>): Promise<Disaster | undefined> {
    const disaster = this.disasters.get(id);
    if (!disaster) return undefined;

    const updatedDisaster = {
      ...disaster,
      ...updates,
      updatedAt: new Date(),
    };
    this.disasters.set(id, updatedDisaster);

    // Update stats if processing status or severity changed
    if (updates.processed !== undefined || updates.severity !== undefined) {
      const allDisasters = Array.from(this.disasters.values());
      const processedCount = allDisasters.filter(d => d.processed).length;
      const highSeverityCount = allDisasters.filter(d => d.severity && d.severity >= 7).length;
      
      await this.updateStats({
        processedEvents: processedCount,
        highSeverityEvents: highSeverityCount,
      });
    }

    return updatedDisaster;
  }

  async getUnprocessedDisasters(): Promise<Disaster[]> {
    return Array.from(this.disasters.values()).filter(d => !d.processed);
  }

  async getStats(): Promise<SystemStats> {
    return { ...this.stats, lastUpdated: new Date() };
  }

  async updateStats(updates: Partial<SystemStats>): Promise<SystemStats> {
    this.stats = {
      ...this.stats,
      ...updates,
      lastUpdated: new Date(),
    };
    return this.stats;
  }

  async getActivities(limit: number = 20): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = {
      ...insertActivity,
      id,
      timestamp: new Date(),
    };
    this.activities.set(id, activity);
    return activity;
  }
}

export const storage = new MemStorage();

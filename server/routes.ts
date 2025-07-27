import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { disasterService } from "./services/disaster";
import { geminiService } from "./services/gemini";

export async function registerRoutes(app: Express): Promise<Server> {
  // Disaster endpoints
  app.get("/api/disasters", async (_req, res) => {
    try {
      const disasters = await storage.getDisasters();
      res.json(disasters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch disasters" });
    }
  });

  app.get("/api/disasters/:id", async (req, res) => {
    try {
      const disaster = await storage.getDisaster(req.params.id);
      if (!disaster) {
        return res.status(404).json({ error: "Disaster not found" });
      }
      res.json(disaster);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch disaster" });
    }
  });

  // Stats endpoint
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Activities endpoint
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const activities = await storage.getActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Manual data ingestion endpoint
  app.post("/api/ingest", async (_req, res) => {
    try {
      await disasterService.ingestNASAData();
      res.json({ success: true, message: "Data ingestion initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start data ingestion" });
    }
  });

  // Manual analysis trigger
  app.post("/api/analyze", async (_req, res) => {
    try {
      await geminiService.processUnanalyzedDisasters();
      res.json({ success: true, message: "Analysis processing initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  // Bulk process all unprocessed disasters
  app.post("/api/process-all", async (req, res) => {
    try {
      const unprocessedDisasters = await storage.getUnprocessedDisasters();
      const count = unprocessedDisasters.length;
      
      if (count === 0) {
        return res.json({ message: "No unprocessed disasters found", count: 0 });
      }

      // Process disasters in larger batches for bulk operation
      const BATCH_SIZE = 10;
      let processed = 0;
      
      for (let i = 0; i < unprocessedDisasters.length; i += BATCH_SIZE) {
        const batch = unprocessedDisasters.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const promises = batch.map(async (disaster) => {
          try {
            const analysis = await geminiService.analyzeDisaster(disaster);
            if (analysis) {
              await storage.updateDisaster(disaster.id, {
                processed: true,
                severity: analysis.severity,
                analysis: analysis.fullAnalysis,
              });
              processed++;

              // Create activity for high severity disasters
              if (analysis.severity >= 7) {
                await storage.createActivity({
                  type: 'ai_analysis',
                  message: `High severity ${disaster.type.toLowerCase()} analyzed - ${disaster.title}`,
                  severity: 'error',
                });
              }
            }
          } catch (error) {
            console.error(`Error processing disaster ${disaster.id}:`, error);
          }
        });

        await Promise.all(promises);
        
        // Brief pause between batches to avoid overwhelming the API
        if (i + BATCH_SIZE < unprocessedDisasters.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      await storage.createActivity({
        type: 'system',
        message: `Bulk processing completed: ${processed}/${count} disasters analyzed`,
        severity: 'info',
      });

      res.json({ 
        message: `Successfully processed ${processed} disasters`, 
        count: processed,
        total: count 
      });
    } catch (error) {
      console.error("Error in bulk processing:", error);
      res.status(500).json({ error: "Failed to process disasters" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Send initial data
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to AI Crisis Navigator'
    }));

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Broadcast updates to all connected clients
  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({ type, data, timestamp: new Date() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Start background services
  console.log("Starting disaster ingestion service...");
  await disasterService.startPeriodicIngestion();
  
  console.log("Starting AI analysis service...");
  await geminiService.startPeriodicProcessing();

  // Set up periodic broadcasts
  setInterval(async () => {
    try {
      const [stats, activities] = await Promise.all([
        storage.getStats(),
        storage.getActivities(5)
      ]);

      broadcastUpdate('stats', stats);
      broadcastUpdate('activities', activities);
      
      // Always broadcast the latest disasters with processed ones prioritized
      const allDisasters = await storage.getDisasters();
      broadcastUpdate('disasters', allDisasters.slice(0, 100));
    } catch (error) {
      console.error('Error broadcasting updates:', error);
    }
  }, 15000); // Every 15 seconds for more responsive updates

  return httpServer;
}

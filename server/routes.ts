import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { disasterService } from "./services/disaster";
import { geminiService } from "./services/gemini";
import { ingestReliefWeb } from "./services/reliefweb";
import { ingestGDACS } from "./services/gdacs";

const MAX_AGE_DAYS = parseInt(process.env.DISASTER_MAX_AGE_DAYS || "30", 10);
const cutoffDate = () =>
  new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/disasters", async (_req, res) => {
    try {
      const disasters = await storage.getDisasters();
      const recent = disasters.filter(d => new Date(d.timestamp) >= cutoffDate());
      res.json(recent);
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

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const activities = await storage.getActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/ingest", async (_req, res) => {
    try {
      await disasterService.ingestNASAData();
      res.json({ success: true, message: "Data ingestion initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start data ingestion" });
    }
  });

  app.post("/api/analyze", async (_req, res) => {
    try {
      await geminiService.processUnanalyzedDisasters();
      res.json({ success: true, message: "Analysis processing initiated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  if (process.env.ENABLE_RELIEFWEB === "1") {
    (async () => {
      try {
        const n = await ingestReliefWeb();
        if (n > 0) console.log(`ReliefWeb ingested ${n} items`);
      } catch (e) {
        console.error("ReliefWeb initial error:", e);
      }
    })();

    setInterval(async () => {
      try {
        const n = await ingestReliefWeb();
        if (n > 0) console.log(`ReliefWeb added ${n} new items`);
      } catch (e) {
        console.error("ReliefWeb refresh error:", e);
      }
    }, 15 * 60 * 1000);
  }

  if (process.env.ENABLE_GDACS === "1") {
    (async () => {
      try {
        const days = parseInt(process.env.GDACS_DAYS || "30", 10);
        const n = await ingestGDACS(days);
        if (n > 0) console.log(`GDACS ingested ${n} items`);
      } catch (e) {
        console.error("GDACS error:", e);
      }
    })();

    setInterval(async () => {
      try {
        const days = parseInt(process.env.GDACS_DAYS || "30", 10);
        const n = await ingestGDACS(days);
        if (n > 0) console.log(`GDACS added ${n} new items`);
      } catch (e) {
        console.error("GDACS refresh error:", e);
      }
    }, 15 * 60 * 1000);
  }

  app.post("/api/process-all", async (req, res) => {
    try {
      const unprocessedDisasters = await storage.getUnprocessedDisasters();
      const count = unprocessedDisasters.length;
      
      if (count === 0) {
        return res.json({ message: "No unprocessed disasters found", count: 0 });
      }

      const BATCH_SIZE = 10;
      let processed = 0;
      
      for (let i = 0; i < unprocessedDisasters.length; i += BATCH_SIZE) {
        const batch = unprocessedDisasters.slice(i, i + BATCH_SIZE);
        
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

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to AI Crisis Navigator'
    }));

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({ type, data, timestamp: new Date() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  console.log("Starting disaster ingestion service...");
  await disasterService.startPeriodicIngestion();
  
  console.log("Starting AI analysis service...");
  await geminiService.startPeriodicProcessing();

  setInterval(async () => {
    try {
      const [stats, activities] = await Promise.all([
        storage.getStats(),
        storage.getActivities(5)
      ]);

      broadcastUpdate('stats', stats);
      broadcastUpdate('activities', activities);
      
      const allDisasters = await storage.getDisasters();
      const recentDisasters = allDisasters
        .filter(d => new Date(d.timestamp) >= cutoffDate())
        .sort((a, b) =>
          Number(b.processed) - Number(a.processed) ||
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      broadcastUpdate('disasters', recentDisasters.slice(0, 100));
    } catch (error) {
      console.error('Error broadcasting updates:', error);
    }
  }, 15000);

  return httpServer;
}

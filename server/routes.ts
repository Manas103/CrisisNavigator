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
      const [stats, activities, disasters] = await Promise.all([
        storage.getStats(),
        storage.getActivities(5),
        storage.getDisasters()
      ]);

      broadcastUpdate('stats', stats);
      broadcastUpdate('activities', activities);
      broadcastUpdate('disasters', disasters.slice(0, 100)); // Limit to 100 for performance
    } catch (error) {
      console.error('Error broadcasting updates:', error);
    }
  }, 30000); // Every 30 seconds

  return httpServer;
}

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { type Disaster } from "@shared/schema";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "" 
});

interface DisasterAnalysis {
  severity: number;
  risks: string[];
  immediateActions: string[];
  evacuationGuidance: string[];
  resourcePriorities: {
    water: number;
    medical: number;
    shelters: number;
  };
  fullAnalysis: string;
}

export class GeminiService {
  private isProcessing = false;

  async analyzeDisaster(disaster: Disaster): Promise<DisasterAnalysis | null> {
    try {
      const prompt = `
DISASTER ANALYSIS REQUEST:
**Event**: ${disaster.title}
**Description**: ${disaster.description}
**Type**: ${disaster.type}
**Location**: ${disaster.latitude}, ${disaster.longitude}
**Date**: ${disaster.timestamp}

Please provide a comprehensive disaster analysis in JSON format with the following structure:
{
  "severity": number (1-10 scale),
  "risks": ["risk1", "risk2", "risk3"],
  "immediateActions": ["action1", "action2", "action3"],
  "evacuationGuidance": ["guidance1", "guidance2", "guidance3"],
  "resourcePriorities": {
    "water": number (gallons needed),
    "medical": number (medical kits needed),
    "shelters": number (shelters needed)
  },
  "fullAnalysis": "detailed text analysis of the disaster situation"
}

Focus on practical, actionable advice for emergency response teams.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              severity: { type: "number" },
              risks: { type: "array", items: { type: "string" } },
              immediateActions: { type: "array", items: { type: "string" } },
              evacuationGuidance: { type: "array", items: { type: "string" } },
              resourcePriorities: {
                type: "object",
                properties: {
                  water: { type: "number" },
                  medical: { type: "number" },
                  shelters: { type: "number" }
                }
              },
              fullAnalysis: { type: "string" }
            },
            required: ["severity", "risks", "immediateActions", "evacuationGuidance", "resourcePriorities", "fullAnalysis"]
          }
        },
        contents: prompt,
      });

      const analysisText = response.text;
      if (!analysisText) return null;

      const analysis: DisasterAnalysis = JSON.parse(analysisText);
      
      // Validate severity is within range
      if (analysis.severity < 1 || analysis.severity > 10) {
        analysis.severity = Math.max(1, Math.min(10, analysis.severity));
      }

      return analysis;
    } catch (error) {
      console.error("Gemini analysis error:", error);
      return null;
    }
  }

  async processUnanalyzedDisasters(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const unprocessed = await storage.getUnprocessedDisasters();
      console.log(`Processing ${unprocessed.length} unanalyzed disasters`);

      // Process in parallel batches of 5 to respect rate limits but improve speed
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < Math.min(unprocessed.length, 50); i += batchSize) {
        batches.push(unprocessed.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        // Process batch in parallel
        const promises = batch.map(async (disaster) => {
          try {
            const analysis = await this.analyzeDisaster(disaster);
            
            if (analysis) {
              await storage.updateDisaster(disaster.id, {
                severity: analysis.severity,
                analysis: analysis.fullAnalysis,
                processed: true,
              });

              const severityText = analysis.severity >= 7 ? "High" : analysis.severity >= 4 ? "Medium" : "Low";
              await storage.createActivity({
                type: "ai_analysis",
                message: `${severityText} severity ${disaster.type.toLowerCase()} analyzed - ${disaster.title}`,
                severity: analysis.severity >= 7 ? "error" : analysis.severity >= 4 ? "warning" : "success",
              });
              
              return { success: true, severity: analysis.severity };
            } else {
              await storage.updateDisaster(disaster.id, { processed: true });
              return { success: false };
            }
          } catch (error) {
            console.error(`Error analyzing disaster ${disaster.id}:`, error);
            await storage.updateDisaster(disaster.id, { processed: true });
            return { success: false };
          }
        });

        // Wait for batch to complete
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        const highSeverityCount = results.filter(r => r.success && r.severity && r.severity >= 7).length;
        
        console.log(`Batch completed: ${successCount}/${batch.length} analyzed, ${highSeverityCount} high severity`);
        
        // Brief pause between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("Error processing disasters:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  async startPeriodicProcessing(intervalMs: number = 30000): Promise<void> {
    // Process immediately on startup
    setTimeout(async () => {
      await this.processUnanalyzedDisasters();
    }, 5000); // Wait 5 seconds for server to stabilize
    
    // Then process every 30 seconds
    setInterval(async () => {
      await this.processUnanalyzedDisasters();
    }, intervalMs);
  }
}

export const geminiService = new GeminiService();

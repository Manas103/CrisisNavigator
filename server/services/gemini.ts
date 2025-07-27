import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { type Disaster } from "@shared/schema";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
});

type Band = "low" | "medium" | "high";

interface Evidence {
  fatalities?: number;
  injuries?: number;
  displaced?: number;
  economicLossUSD?: number;
  emergencyDeclared?: boolean;     // any government emergency declaration
  regionalEmergency?: boolean;     // declared at regional/local level
  internationalAid?: boolean;      // international aid mobilized
  crossBorderImpact?: boolean;     // crosses states / national borders
  majorInfraDisruption?: boolean;  // power/water/health/comm/transport widely disrupted
  environmentalHazard?: boolean;   // toxic spill, radiation, etc.
  rapidEscalation?: boolean;       // worsening / unpredictable / out of control
}

interface DisasterAnalysis {
  severity: number;
  criteriaMet?: number;    // number of HIGH triggers matched
  evidence?: Evidence;
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

/* ---------------- helpers ---------------- */

function countHighTriggers(e?: Evidence): number {
  if (!e) return 0;
  let c = 0;
  if ((e.fatalities ?? 0) >= 1) c++;
  if ((e.displaced ?? 0) >= 1000) c++;
  if (e.majorInfraDisruption) c++;
  if (e.crossBorderImpact) c++;
  if (e.emergencyDeclared) c++;
  if (e.internationalAid) c++;
  if (e.rapidEscalation) c++;
  if ((e.economicLossUSD ?? 0) >= 100_000_000) c++;
  return c;
}

function hasModerateEvidence(e?: Evidence): boolean {
  if (!e) return false;
  if ((e.injuries ?? 0) > 0) return true;
  const disp = e.displaced ?? 0;
  if (disp >= 100 && disp < 1000) return true;
  if ((e.economicLossUSD ?? 0) >= 5_000_000) return true;
  if (e.regionalEmergency) return true;
  return false;
}

function bandFromNumeric(n: number): Band {
  if (n >= 7) return "high";
  if (n >= 4) return "medium";
  return "low";
}

function clampToBand(n: number, band: Band): number {
  if (band === "low") return Math.min(3, Math.max(1, Math.round(n || 2)));
  if (band === "medium") return Math.min(6, Math.max(4, Math.round(n || 5)));
  return Math.min(10, Math.max(7, Math.round(n || 8)));
}

function midpointForBand(band: Band): number {
  return band === "low" ? 2 : band === "medium" ? 5 : 8;
}

function parseNarrative(full: string | undefined): { label?: Band; num?: number } {
  if (!full) return {};
  const text = full.toLowerCase();

  // label detection
  let label: Band | undefined;
  if (/\bhigh severity\b|\bclassified as high\b|\boverall severity:\s*high\b/i.test(full)) label = "high";
  else if (/\bmedium severity\b|\bclassified as medium\b|\boverall severity:\s*medium\b/i.test(full)) label = "medium";
  else if (/\blow severity\b|\bclassified as low\b|\boverall severity:\s*low\b/i.test(full)) label = "low";

  // numeric detection: 7/10, 7 out of 10, severity 7/10
  const m =
    /(?:severity|score|rated)?\s*:?\s*(\d{1,2})\s*(?:\/\s*10|out of\s*10)/i.exec(full) ||
    /(?:severity|score|rated)[^\d]{0,10}(\d{1,2})/i.exec(full);
  const num = m ? Math.min(10, Math.max(1, parseInt(m[1], 10))) : undefined;

  return { label, num };
}

/* ---------------- service ---------------- */

export class GeminiService {
  private isProcessing = false;

  async analyzeDisaster(disaster: Disaster): Promise<DisasterAnalysis | null> {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              severity: { type: "number" },
              criteriaMet: { type: "integer" },
              evidence: {
                type: "object",
                properties: {
                  fatalities: { type: "integer" },
                  injuries: { type: "integer" },
                  displaced: { type: "integer" },
                  economicLossUSD: { type: "number" },
                  emergencyDeclared: { type: "boolean" },
                  regionalEmergency: { type: "boolean" },
                  internationalAid: { type: "boolean" },
                  crossBorderImpact: { type: "boolean" },
                  majorInfraDisruption: { type: "boolean" },
                  environmentalHazard: { type: "boolean" },
                  rapidEscalation: { type: "boolean" }
                }
              },
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
            required: [
              "severity",
              "criteriaMet",
              "evidence",
              "fullAnalysis",
              "risks",
              "immediateActions",
              "evacuationGuidance",
              "resourcePriorities"
            ]
          }
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
Write a detailed, paragraph-based disaster situation report designed for a public-facing dashboard or humanitarian onitoring system. 
Do not use bullet points or markdown field labels. Instead, write a continuous, cohesive narrative (approximately 100–250 words) that blends confirmed data with situational awareness.

Apply the following rubric to assign severity level:

**LOW SEVERITY (1–3):**
Assign this when the event is relatively small, localized, and **does not currently threaten life or key systems**:
For **small, localized, non-lethal events** with minimal disruption:
- No confirmed deaths or injuries
- Displacement < 50 people
- No significant infrastructure or health impact
- Contained, declining, or static event
- Local response is sufficient and no escalation expected

**MEDIUM SEVERITY (4–6):**
Use for disasters with **measurable, concerning impact**, but **under control or responsive**:
- Evacuations or **displacement in the 50–999 range**
- **Some infrastructure impact** (e.g. localized outages, minor road closures, strain on responders)
- Smoke, disease, or other public health risks that are **monitored but not widespread**
- Fire/disease/event is spreading but **within expected limits**m
- **State-level emergency** declared, but no federal/international aid required
- Local agencies remain **functioning and engaged**
This range captures most wildfires, floods, disease clusters, or civil events that are being actively contained.

**HIGH SEVERITY (7–10):**
Assign only if **2 or more** of the following are confirmed:
- At least **1 confirmed fatality**
- More than **1,000 people displaced**
- **Severe, ongoing infrastructure failure**, such as grid collapse, hospital overload, destroyed homes, etc.
- **State of emergency + external aid** (e.g., federal or international assistance)
- **Fast, uncontrolled escalation** combined with clear response breakdown
- **High public health threat** (toxic exposure, mass illness, waterborne outbreaks)
- **Economic loss estimate > $100M USD**
Only disasters that are **active, highly destructive, and overwhelming local capacity** should reach 7+.

Always err toward **Medium** if you’re unsure, but explain your reasoning clearly. Your paragraph must read as if written by a human crisis analyst.

Tone: Factual but empathetic. Like a field analyst summarizing the situation for intelligent readers who want to understand the evolving human, logistical, and strategic impact of the event.

Structure the paragraph around:
- The **location and event type**
- The **known or likely cause**
- The **scale and type of human impact** (fatalities, injuries, displacement, mental trauma, etc.)
- The **infrastructure damage** (power, transport, housing, communications, etc.)
- The **public health implications** (smoke, water quality, disease risk, hospital strain, etc.)
- The **response so far** (local, regional, international, emergency declarations)
- The **short-term outlook (next 24–72 hours)** in terms of risk, containment, or possible escalation
- End with a clear **severity classification (High, Medium, or Low)** and a brief justification

If certain data (like number of displaced people or infrastructure damage) is not available, explain *why* (e.g. remote location, early-stage, conflicting reports). Prioritize **clarity, realism, and urgency** over formality.

---

Return only this JSON object:
{
  "fullAnalysis": "<your final paragraph here>"
}

Event:
Title: ${disaster.title ?? ""}
Description: ${disaster.description ?? ""}
Category: ${disaster.type}
Location: (${disaster.latitude}, ${disaster.longitude})
Time: ${new Date(disaster.timestamp).toISOString()}
                `.trim()
              }
            ]
          }
        ]
      });

      const analysisText = response.text;
      if (!analysisText) return null;

      const analysis: DisasterAnalysis = JSON.parse(analysisText);

      // Clamp numeric to [1,10] if present
      if (typeof analysis.severity !== "number" || Number.isNaN(analysis.severity)) {
        analysis.severity = 3; // conservative default
      } else {
        analysis.severity = Math.max(1, Math.min(10, Math.round(analysis.severity)));
      }

      // Compute desired band from evidence
      const highCount = countHighTriggers(analysis.evidence);
      const moderate = hasModerateEvidence(analysis.evidence);
      let computedBand: Band;
      if (highCount >= 2) computedBand = "high";
      else if (highCount === 1 || moderate) computedBand = "medium";
      else computedBand = "low";

      // Parse narrative for stated label / score
      const { label: narrativeLabel, num: narrativeNum } = parseNarrative(analysis.fullAnalysis);

      // Choose final band: prefer narrative label if present, else computed
      const finalBand: Band = narrativeLabel ?? computedBand;

      // Choose base number: prefer narrative number if present; else current number
      let finalNum = typeof narrativeNum === "number" ? narrativeNum : analysis.severity;

      // Clamp number to the final band
      finalNum = clampToBand(finalNum, finalBand);

      // Record back
      analysis.criteriaMet = highCount;
      analysis.severity = finalNum;

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

      const batchSize = 5;
      const batches: Disaster[][] = [];
      for (let i = 0; i < Math.min(unprocessed.length, 50); i += batchSize) {
        batches.push(unprocessed.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (disaster) => {
            try {
              const analysis = await this.analyzeDisaster(disaster);
              if (analysis) {
                await storage.updateDisaster(disaster.id, {
                  severity: analysis.severity,
                  analysis: analysis.fullAnalysis,
                  processed: true,
                });

                const severityText =
                  analysis.severity >= 7 ? "High" :
                  analysis.severity >= 4 ? "Medium" : "Low";

                await storage.createActivity({
                  type: "ai_analysis",
                  message: `${severityText} severity ${disaster.type.toLowerCase()} analyzed - ${disaster.title}`,
                  severity:
                    analysis.severity >= 7 ? "error" :
                    analysis.severity >= 4 ? "warning" : "success",
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
          })
        );

        const successCount = results.filter(r => r.success).length;
        const highSeverityCount = results.filter(r => r.success && r.severity && r.severity >= 7).length;
        console.log(`Batch completed: ${successCount}/${batch.length} analyzed, ${highSeverityCount} high severity`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error("Error processing disasters:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  async startPeriodicProcessing(intervalMs: number = 30000): Promise<void> {
    setTimeout(async () => {
      await this.processUnanalyzedDisasters();
    }, 5000);
    setInterval(async () => {
      await this.processUnanalyzedDisasters();
    }, intervalMs);
  }
}

export const geminiService = new GeminiService();

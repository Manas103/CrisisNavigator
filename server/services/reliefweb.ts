import { storage } from "../storage";
import type { InsertDisaster, Disaster } from "@shared/schema";

const RW_BASE = "https://api.reliefweb.int/v2";
const APP = process.env.RELIEFWEB_APPNAME || "crisis-navigator-demo/0.1";
const RW_DAYS = parseInt(process.env.RELIEFWEB_DAYS || "30", 10);

// --- helpers ---------------------------------------------------------------

// 2025-07-27T00:00:00+00:00
function cutoffISO() {
  const d = new Date(Date.now() - RW_DAYS * 24 * 60 * 60 * 1000);
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
  return iso.replace(".000Z", "+00:00");
}

// dedupe: same title+country within ±1 day
async function existsSimilar(title: string, country: string, when: Date) {
  const all: Disaster[] = await storage.getDisasters();
  const t = when.getTime();
  const day = 24 * 60 * 60 * 1000;
  const key = (s: string) => s.trim().toLowerCase();
  return all.some(d =>
    key(d.title || "") === key(title) &&
    key((d as any).country || "") === key(country) && // not stored—so we key via title suffix below
    Math.abs(new Date(d.timestamp).getTime() - t) < day
  );
}

// small, deterministic jitter so markers don't stack (±0.25°)
function hashInt(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function jitter(lat: number, lon: number, key: string) {
  const h = hashInt(key);
  const dLat = ((h % 2000) / 2000 - 0.5) * 0.5; // ±0.25°
  const dLonRaw = ((((h / 2000) | 0) % 2000) / 2000 - 0.5) * 0.5;
  const cos = Math.max(0.5, Math.cos((lat * Math.PI) / 180));
  const dLon = dLonRaw / cos;
  return { lat: lat + dLat, lon: lon + dLon };
}

// country centroids (extend as needed)
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  Sudan: [30.2176, 12.8628],
  Haiti: [-72.336, 18.971],
  Ukraine: [31.1656, 48.3794],
  "Syrian Arab Republic": [38.9968, 34.8021],
  Lebanon: [35.8623, 33.8547],
  Gaza: [34.3088, 31.3547],
  Yemen: [47.4793, 15.5527],
  Ethiopia: [40.4897, 9.145],
  "Democratic Republic of the Congo": [21.7587, -4.0383],
  Kenya: [37.9062, -0.0236],
  Uganda: [32.2903, 1.3733],
  Afghanistan: [67.7099, 33.9391],
  India: [78.9629, 20.5937],
  Nigeria: [8.6753, 9.082],
  // ...
};

function extractCountryNames(item: any): string[] {
  const names = new Set<string>();
  const f = item?.fields ?? {};
  const arr1: any[] = f.country || [];
  for (const c of arr1) if (c?.name) names.add(c.name);
  const pc = f.primary_country;
  if (pc?.name) names.add(pc.name);
  return Array.from(names);
}

function coordsForCountry(name: string): { lat: number; lon: number } | null {
  const hit = COUNTRY_CENTROIDS[name];
  if (!hit) return null;
  const [lon, lat] = hit;
  return { lat, lon };
}

// --- main ------------------------------------------------------------------

export async function ingestReliefWeb(): Promise<number> {
  const url = `${RW_BASE}/reports?appname=${encodeURIComponent(APP)}`;

  const body = {
    query: {
      value:
        'conflict OR war OR "armed clashes" OR "civil unrest" OR protest OR riot OR "food insecurity" OR famine OR displacement OR refugee OR epidemic OR cholera OR measles OR ebola',
      operator: "OR",
      fields: ["title", "body", "disaster", "country", "theme", "format"],
    },
    filter: {
      operator: "AND",
      conditions: [
        { field: "status", value: "published" },
        { field: "date.created", value: { from: cutoffISO() } },
      ],
    },
    sort: ["date:desc"],
    limit: 100,
    fields: {
      include: [
        "title",
        "url",
        "date",
        "country",
        "primary_country",
        "disaster",
        "theme",
        "format",
        "status",
      ],
    },
    preset: "latest",
    slim: 1,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ReliefWeb ${res.status}: ${text}`);
  }

  const json: any = await res.json();
  let created = 0;

  for (const item of json?.data || []) {
    const f = item.fields || {};
    const title: string = f.title || "ReliefWeb report";
    const dateCreated: string = f.date?.created || f.date?.original || new Date().toISOString();
    const when = new Date(dateCreated);

    // country list (limit to avoid explosion)
    const countries = extractCountryNames(item).slice(0, 5);
    if (!countries.length) {
      // No location -> skip to avoid (0,0) ocean stacks
      continue;
    }

    // Disaster types
    const types = (f.disaster || []).map((d: any) => d?.name).filter(Boolean);
    const type = types[0] || "Crisis";

    // Create one record per country, with jitter
    for (const country of countries) {
      const base = coordsForCountry(country);
      if (!base) {
        // skip unknown countries rather than dropping at (0,0)
        continue;
      }
      const key = `${title}|${country}`;
      const { lat, lon } = jitter(base.lat, base.lon, key);

      const titled = `${title} — ${country}`; // keeps items distinct
      // dedupe by title+country within ±1 day
      if (await existsSimilar(titled, country, when)) continue;

      const rec: InsertDisaster = {
        type,
        severity: 3, // Gemini will rescore
        latitude: lat,
        longitude: lon,
        title: titled,
        description: `Source: ReliefWeb. Country: ${country}. Types: ${types.join(", ")}`,
        timestamp: when,
        processed: false,
        analysis: null,
      };

      await storage.createDisaster(rec);
      created++;
    }
  }

  return created;
}

const GDACS_URL = (fromISO: string) =>
  `https://www.gdacs.org/gdacsapi/api/events/geteventlist/v2?fromdate=${encodeURIComponent(fromISO)}`;

import { storage } from "../storage";
import type { InsertDisaster, Disaster } from "@shared/schema";

function cutoffISO(days = 30) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ---- anti-stacking: deterministic jitter ---------------------------------
function hashInt(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function jitter(lat: number, lon: number, key: string) {
  // ±0.25° jitter, scaled for longitude by latitude
  const h = hashInt(key);
  const dLat = ((h % 2000) / 2000 - 0.5) * 0.5; // ±0.25
  const dLonRaw = ((((h / 2000) | 0) % 2000) / 2000 - 0.5) * 0.5;
  const cos = Math.max(0.5, Math.cos((lat * Math.PI) / 180));
  const dLon = dLonRaw / cos;
  return { lat: lat + dLat, lon: lon + dLon };
}
function jitterIfNeeded(lat: number, lon: number, key: string) {
  return jitter(lat, lon, key);
}

// ---- light dedupe: same title within ±1 day --------------------------------
async function existsSimilar(title: string, when: Date) {
  const all: Disaster[] = await storage.getDisasters();
  const t = when.getTime();
  const day = 24 * 60 * 60 * 1000;
  return all.some(
    (d) =>
      d.title === title &&
      Math.abs(new Date(d.timestamp).getTime() - t) < day
  );
}

// ---- main ------------------------------------------------------------------
export async function ingestGDACS(days = 30): Promise<number> {
  const res = await fetch(GDACS_URL(cutoffISO(days)));
  if (!res.ok) throw new Error(`GDACS ${res.status}`);
  const json: any = await res.json();

  let created = 0;
  for (const ev of json?.features || []) {
    const p = ev.properties || {};
    const g = ev.geometry || {};
    const coords = g.coordinates || [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const title: string = p.eventname || `${p.eventtype} ${p.eventid}`;
    const t: string = p.updated || p.fromdate || new Date().toISOString();
    const when = new Date(t);
    if (await existsSimilar(title, when)) continue;

    const type = String(p.eventtype || "Hazard");

    // jitter to prevent overlapping markers at same coordinates
    const j = jitterIfNeeded(lat, lon, `${title}|${type}|${t}`);

    const rec: InsertDisaster = {
      type,
      severity: 3, // AI will rescore
      latitude: j.lat,
      longitude: j.lon,
      title,
      description: `GDACS ${type} | alertlevel=${p.alertlevel ?? "n/a"} | population=${p.population ?? "n/a"}`,
      timestamp: when,
      processed: false,
      analysis: null,
    };

    await storage.createDisaster(rec);
    created++;
  }
  return created;
}

import { lonLatToLocal } from "@saturn/geometry";
import type { Site } from "@saturn/model";

/**
 * Context provider: OpenStreetMap via Overpass (key-free). Returns buildings and streets in local metres.
 * Replaceable by Mapbox/Overture providers later (same output shape).
 */
export interface ContextResult { buildings: Site["context_buildings"]; streets: Site["streets"]; source: string }

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

function parseHeight(tags: Record<string, string>): { h: number; src: "data" | "levels" | "estimated" } {
  const h = parseFloat(tags["height"] ?? ""); if (!isNaN(h) && h > 0) return { h, src: "data" };
  const lv = parseFloat(tags["building:levels"] ?? ""); if (!isNaN(lv) && lv > 0) return { h: lv * 3.2, src: "levels" };
  return { h: 9, src: "estimated" };
}

const STREET_CLASS: Record<string, Site["streets"][number]["class"]> = {
  motorway: "motorway", trunk: "motorway", primary: "primary", secondary: "secondary", tertiary: "tertiary",
  residential: "residential", living_street: "residential", unclassified: "residential", service: "service",
  footway: "path", path: "path", cycleway: "path", pedestrian: "path",
};
const SPEED: Record<string, number> = { motorway: 100, primary: 60, secondary: 50, tertiary: 50, residential: 30, service: 20, path: 0, other: 30 };
const AADT: Record<string, number> = { motorway: 40000, primary: 15000, secondary: 8000, tertiary: 4000, residential: 1000, service: 200, path: 0, other: 1000 };
const WIDTH: Record<string, number> = { motorway: 24, primary: 16, secondary: 12, tertiary: 10, residential: 8, service: 5, path: 3, other: 8 };

export async function fetchOsmContext(origin: { lat: number; lon: number }, radius_m: number, signal?: AbortSignal): Promise<ContextResult> {
  const q = `[out:json][timeout:25];(way["building"](around:${radius_m},${origin.lat},${origin.lon});way["highway"](around:${radius_m},${origin.lat},${origin.lon}););out body geom;`;
  let lastErr: unknown;
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json() as { elements: Array<{ type: string; id: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }> };
      const buildings: ContextResult["buildings"] = []; const streets: ContextResult["streets"] = [];
      for (const el of json.elements) {
        if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
        const tags = el.tags ?? {};
        const pts = el.geometry.map((g) => lonLatToLocal(origin, g.lon, g.lat));
        if (tags["building"]) {
          const ring = pts.slice(0, -1); if (ring.length < 3) continue;
          const { h, src } = parseHeight(tags);
          buildings.push({ id: `osm-${el.id}`, footprint: ring, height_m: h, height_source: src, name: tags["name"] });
        } else if (tags["highway"]) {
          const cls = STREET_CLASS[tags["highway"]] ?? "other";
          const ms = parseFloat(tags["maxspeed"] ?? "");
          streets.push({ id: `osm-${el.id}`, centreline: pts, class: cls, name: tags["name"], width_m: WIDTH[cls] ?? 8,
            traffic: { speed_kmh: !isNaN(ms) ? ms : SPEED[cls] ?? 30, aadt: AADT[cls] ?? 1000, heavy_pct: cls === "motorway" || cls === "primary" ? 10 : 5 } });
        }
      }
      return { buildings, streets, source: "OpenStreetMap (Overpass)" };
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Context fetch failed");
}

export async function geocode(query: string, signal?: AbortSignal): Promise<Array<{ label: string; lat: number; lon: number }>> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const j = await res.json() as Array<{ display_name: string; lat: string; lon: string }>;
  return j.map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
}

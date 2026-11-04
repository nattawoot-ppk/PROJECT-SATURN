import { ringArea, offsetPolygon, difference, polygonArea, type Ring } from "@saturn/geometry";
import type { Building } from "./schema";

/** Gross area per stall including aisles and ramps (m²). */
export const M2_PER_STALL = { surface: 25, basement: 30, podium: 30 } as const;

export interface ParkingPlan { type: "surface" | "basement" | "podium"; polygon: Ring; levels: number; stalls: number; note: string }

/** Basement parking under the footprint, as many levels as needed (max 4). */
export function planBasement(b: Building, required: number, maxLevels = 4): ParkingPlan {
  const a = ringArea(b.footprint); const per = Math.floor((a * 0.85) / M2_PER_STALL.basement);
  const levels = per > 0 ? Math.min(maxLevels, Math.max(1, Math.ceil(required / per))) : 1;
  return { type: "basement", polygon: b.footprint, levels, stalls: per * levels, note: `${per} stalls per level × ${levels} level${levels > 1 ? "s" : ""}` };
}

/** Surface parking on the remaining buildable area (envelope minus building footprints with a 3 m clearance). */
export function planSurface(envelope: Ring[], footprints: Ring[], required: number): ParkingPlan | null {
  if (!envelope.length) return null;
  const clearance = footprints.flatMap((f) => offsetPolygon({ outer: f, holes: [] }, 3));
  let free = difference(envelope.map((e) => ({ outer: e, holes: [] })), clearance);
  free = free.filter((p) => polygonArea(p) > 60).sort((a, b) => polygonArea(b) - polygonArea(a));
  const best = free[0]; if (!best) return null;
  const area = polygonArea(best); const cap = Math.floor((area * 0.9) / M2_PER_STALL.surface);
  const stalls = Math.min(cap, Math.max(required, 0) || cap);
  // if the required count fits in a fraction of the area, shrink by offsetting inward to approximate used area
  return { type: "surface", polygon: best.outer, levels: 1, stalls, note: `${Math.round(area)} m² available, capacity ${cap}` };
}

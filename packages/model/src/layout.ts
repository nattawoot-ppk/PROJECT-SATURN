import { ensureCCW, rotateRing, bounds, intersect, polygonArea, ringArea, type Ring } from "@saturn/geometry";
import type { Building, Storey, UnitType, Unit } from "./schema";

export type ResidentialType = "studio" | "1br" | "2br" | "3br" | "4br";
export const RES_TYPES: ResidentialType[] = ["studio", "1br", "2br", "3br", "4br"];

export interface UnitMixTarget { pct: Partial<Record<ResidentialType, number>>; area_m2: Partial<Record<ResidentialType, number>> }
export const DEFAULT_MIX: UnitMixTarget = { pct: { studio: 10, "1br": 30, "2br": 40, "3br": 20, "4br": 0 }, area_m2: { studio: 35, "1br": 50, "2br": 70, "3br": 95, "4br": 120 } };

export interface LayoutParams {
  mix: UnitMixTarget;
  corridor_m: number;         // corridor width for double-loaded plans
  core_m: number;             // core length along corridor
  max_travel_m: number;       // max distance between cores
  single_loaded_max_depth_m: number; // depth below which a single-loaded plan is used
  min_unit_width_m: number;
  /** area scale multiplier for optimisation runs */
  scale?: number;
}
export const DEFAULT_LAYOUT: LayoutParams = { mix: DEFAULT_MIX, corridor_m: 1.8, core_m: 6, max_travel_m: 30, single_loaded_max_depth_m: 13, min_unit_width_m: 4.5 };

export interface LayoutResult { units: Unit[]; cores: Ring[]; corridor?: Ring; mix: Record<string, number>; count: number; efficiency: number; deviation: number }

function dominantAngle(ring: Ring): number {
  let best = 0, bl = -1;
  for (let i = 0; i < ring.length; i++) { const a = ring[i]!, b = ring[(i + 1) % ring.length]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
  return best;
}

/** Greedy sequence of unit types that tracks the target mix. */
function pickSequence(lengthAvail: number, depth: number, mix: UnitMixTarget, minWidth: number, scale: number): Array<{ type: ResidentialType; width: number }> {
  const seq: Array<{ type: ResidentialType; width: number }> = [];
  const counts: Record<string, number> = {};
  const types = RES_TYPES.filter((t) => (mix.pct[t] ?? 0) > 0);
  if (!types.length) return seq;
  const totalPct = types.reduce((a, t) => a + (mix.pct[t] ?? 0), 0);
  let remaining = lengthAvail;
  for (let guard = 0; guard < 500; guard++) {
    const total = seq.length;
    // type furthest below its target share
    let best: ResidentialType | null = null, bestGap = -Infinity;
    for (const t of types) {
      const w = Math.max(minWidth, ((mix.area_m2[t] ?? 60) * scale) / depth);
      if (w > remaining + 1e-6) continue;
      const gap = (mix.pct[t] ?? 0) / totalPct - (total ? (counts[t] ?? 0) / total : 0);
      if (gap > bestGap) { bestGap = gap; best = t; }
    }
    if (!best) break;
    const w = Math.max(minWidth, ((mix.area_m2[best] ?? 60) * scale) / depth);
    seq.push({ type: best, width: w }); counts[best] = (counts[best] ?? 0) + 1; remaining -= w;
  }
  // distribute leftover length across units (stretch) if small
  if (seq.length && remaining > 0) { const add = remaining / seq.length; for (const u of seq) u.width += add; }
  return seq;
}

/**
 * Lay out apartments on one storey footprint using a corridor strip model.
 * Works on the dominant-edge aligned bounding box; each rectangle is clipped to the footprint.
 */
export function layoutStorey(footprintIn: Ring, params: LayoutParams, idPrefix: string): LayoutResult {
  const p = { ...DEFAULT_LAYOUT, ...params }; const scale = p.scale ?? 1;
  const fp = ensureCCW(footprintIn); const ang = dominantAngle(fp);
  const r = rotateRing(fp, -ang); const bb = bounds([r]);
  const L = bb.maxX - bb.minX, D = bb.maxY - bb.minY;
  const poly = [{ outer: r, holes: [] as Ring[] }];
  const units: Unit[] = []; const cores: Ring[] = []; let corridor: Ring | undefined;
  const clip = (rect: Ring): Ring | null => { const parts = intersect([{ outer: rect, holes: [] }], poly).sort((a, b) => polygonArea(b) - polygonArea(a)); const q = parts[0]; return q && q.outer.length >= 3 && !q.holes.length ? q.outer : null; };
  const double = D > p.single_loaded_max_depth_m;
  const unitDepth = double ? (D - p.corridor_m) / 2 : Math.min(D, 12);
  // corridor band (y range) and unit bands
  const bands: Array<{ y0: number; y1: number }> = double
    ? [{ y0: bb.minY, y1: bb.minY + unitDepth }, { y0: bb.maxY - unitDepth, y1: bb.maxY }]
    : [{ y0: bb.minY, y1: bb.minY + unitDepth }];
  if (double) corridor = [[bb.minX, bb.minY + unitDepth], [bb.maxX, bb.minY + unitDepth], [bb.maxX, bb.maxY - unitDepth], [bb.minX, bb.maxY - unitDepth]];
  // cores along the length
  const nCores = Math.max(1, Math.ceil(L / p.max_travel_m));
  const corePos: Array<[number, number]> = [];
  for (let i = 0; i < nCores; i++) { const cx = bb.minX + ((i + 0.5) / nCores) * L; corePos.push([cx - p.core_m / 2, cx + p.core_m / 2]); }
  // cores occupy the first band depth (and corridor side); draw as rectangles in band 0
  const b0 = bands[0]!;
  for (const [x0, x1] of corePos) { const c = clip([[x0, b0.y0], [x1, b0.y0], [x1, b0.y1], [x0, b0.y1]]); if (c) cores.push(rotateRing(c, ang)); }
  let n = 0; const mixCount: Record<string, number> = {};
  bands.forEach((band, bi) => {
    const depth = band.y1 - band.y0;
    // segments between cores (cores only in band 0)
    const segs: Array<[number, number]> = [];
    if (bi === 0) { let x = bb.minX; for (const [x0, x1] of corePos) { if (x0 - x > p.min_unit_width_m) segs.push([x, x0]); x = x1; } if (bb.maxX - x > p.min_unit_width_m) segs.push([x, bb.maxX]); }
    else segs.push([bb.minX, bb.maxX]);
    for (const [sx0, sx1] of segs) {
      const seq = pickSequence(sx1 - sx0, depth, p.mix, p.min_unit_width_m, scale);
      let x = sx0;
      for (const u of seq) {
        const rect: Ring = [[x, band.y0], [x + u.width, band.y0], [x + u.width, band.y1], [x, band.y1]];
        const c = clip(rect); x += u.width;
        if (!c) continue;
        const a = ringArea(c);
        const target = (p.mix.area_m2[u.type] ?? 60) * scale;
        if (a < 0.55 * target || a < 18) continue;
        units.push({ id: `${idPrefix}-u${n++}`, type: u.type as UnitType, polygon: rotateRing(c, ang), area_m2: a });
        mixCount[u.type] = (mixCount[u.type] ?? 0) + 1;
      }
    }
  });
  const count = units.length;
  const totalPct = RES_TYPES.reduce((a, t) => a + (p.mix.pct[t] ?? 0), 0) || 1;
  const deviation = count ? RES_TYPES.reduce((a, t) => a + Math.abs((p.mix.pct[t] ?? 0) / totalPct - (mixCount[t] ?? 0) / count), 0) / 2 : 1;
  const unitArea = units.reduce((a, u) => a + (u.area_m2 ?? 0), 0);
  const mix: Record<string, number> = {}; for (const t of RES_TYPES) if (mixCount[t]) mix[t] = (100 * mixCount[t]!) / count;
  return { units, cores, corridor, mix, count, efficiency: ringArea(fp) ? unitArea / ringArea(fp) : 0, deviation };
}

/**
 * Unit-mix optimiser: tries area scales and corridor settings, maximising unit count while keeping mix deviation low.
 * Returns the best params found.
 */
export function optimiseLayout(footprint: Ring, base: LayoutParams, maxDeviation = 0.08): { params: LayoutParams; result: LayoutResult } {
  let best: { params: LayoutParams; result: LayoutResult; score: number } | null = null;
  for (const scale of [0.9, 0.95, 1, 1.05, 1.1, 1.15]) for (const travel of [24, 30, 36]) {
    const params = { ...base, scale, max_travel_m: travel };
    const r = layoutStorey(footprint, params, "opt");
    const score = r.count * (r.deviation <= maxDeviation ? 1 : Math.max(0.2, 1 - (r.deviation - maxDeviation) * 4)) + r.efficiency * 2;
    if (!best || score > best.score) best = { params, result: r, score };
  }
  return { params: best!.params, result: best!.result };
}

/** Apply layouts to all residential storeys of a building (ground floor kept if its use is not residential). */
export function applyLayoutToBuilding(b: Building, params: LayoutParams, optimise = true): { building: Building; summary: { count: number; mix: Record<string, number>; efficiency: number } } {
  const nb: Building = JSON.parse(JSON.stringify(b));
  const chosen = optimise ? optimiseLayout(b.footprint, params).params : params;
  let count = 0; const mixCount: Record<string, number> = {}; let unitArea = 0, floorArea = 0;
  nb.storeys = nb.storeys.map((s: Storey) => {
    if (s.use !== "residential" && s.use !== "mixed") return { ...s, units: [], cores: [] };
    const fp = s.footprint ?? nb.footprint;
    const r = layoutStorey(fp, chosen, `${nb.id}-s${s.level}`);
    count += r.count; unitArea += r.units.reduce((a, u) => a + (u.area_m2 ?? 0), 0); floorArea += ringArea(fp);
    for (const u of r.units) mixCount[u.type] = (mixCount[u.type] ?? 0) + 1;
    return { ...s, units: r.units, cores: r.cores };
  });
  const mix: Record<string, number> = {}; for (const t of RES_TYPES) if (mixCount[t]) mix[t] = (100 * mixCount[t]!) / Math.max(1, count);
  return { building: nb, summary: { count, mix, efficiency: floorArea ? unitArea / floorArea : 0 } };
}

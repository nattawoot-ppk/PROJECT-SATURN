import { stormwater, averageDaylightFactor, skyAngleFromVsc, simulateThermal, syntheticClimate, DEFAULT_THERMAL, type Hourly, type ThermalInputs, type ThermalResult, type SurfaceArea } from "@saturn/analyses";
import { ringArea, perimeter, ensureCCW, distPointSegment, type Ring } from "@saturn/geometry";
import type { Project, Building } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { activeOption } from "@/lib/store";
import type { DaylightResult } from "./daylight";

export function siteSurfaces(project: Project, pavedShareOfOpen = 0.3): SurfaceArea[] {
  const opt = activeOption(project); const parcel = project.site.parcel ? ringArea(project.site.parcel) : 0;
  const roof = (opt?.buildings ?? []).reduce((a, b) => a + ringArea(b.footprint), 0);
  const surfaceLots = (opt?.buildings ?? []).reduce((a, b) => a + b.parking.filter((p) => p.type === "surface").reduce((s, p) => s + ringArea(p.polygon), 0), 0);
  const open = Math.max(0, parcel - roof - surfaceLots);
  return [{ type: "roof", area_m2: roof }, { type: "paved", area_m2: surfaceLots + open * pavedShareOfOpen }, { type: "green", area_m2: open * (1 - pavedShareOfOpen) }];
}
export { stormwater };

export interface UnitDf { building: string; level: number; unit: string; type: string; area_m2: number; df_pct: number; window_m2: number; theta_deg: number }

/**
 * Per-unit average daylight factor using façade VSC near each unit's exterior edges, an assumed glazing ratio of the
 * exterior wall, and the BRE formula. Units without exterior edges get 0.
 */
export function unitDaylightFactors(project: Project, dl: DaylightResult, glazingRatio = 0.3, T = 0.6, R = 0.5): UnitDf[] {
  const opt = activeOption(project); const out: UnitDf[] = [];
  for (const b of opt?.buildings ?? []) {
    let z = 0;
    b.storeys.forEach((s, si) => {
      const fp = ensureCCW(s.footprint ?? b.footprint); const zmid = z + s.height_m / 2;
      const samplesNear = (p: [number, number]) => dl.facade.samples.map((x, i) => ({ x, v: dl.facade.vsc[i]! })).filter(({ x }) => x.owner === b.id && Math.abs(x.p[2] - zmid) < s.height_m && Math.hypot(x.p[0] - p[0], x.p[1] - p[1]) < 4);
      for (const u of s.units) {
        if (["core", "corridor", "other"].includes(u.type)) continue;
        const ur = ensureCCW(u.polygon); let extLen = 0; let vscSum = 0, vscN = 0;
        for (let i = 0; i < ur.length; i++) {
          const a = ur[i]!, c = ur[(i + 1) % ur.length]!; const mid: [number, number] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
          // exterior if the edge midpoint lies on the footprint boundary
          let onBoundary = false; for (let k = 0; k < fp.length; k++) if (distPointSegment(mid, fp[k]!, fp[(k + 1) % fp.length]!) < 0.05) { onBoundary = true; break; }
          if (!onBoundary) continue;
          const len = Math.hypot(c[0] - a[0], c[1] - a[1]); extLen += len;
          for (const { v } of samplesNear(mid)) { vscSum += v * len; vscN += len; }
        }
        const area = u.area_m2 ?? ringArea(ur); const window = extLen * s.height_m * glazingRatio;
        const vsc = vscN ? vscSum / vscN : 0; const theta = skyAngleFromVsc(vsc);
        const surfaces = 2 * area + perimeter(ur) * s.height_m;
        out.push({ building: b.name, level: si + 1, unit: u.id, type: u.type, area_m2: area, df_pct: extLen > 0 ? averageDaylightFactor(window, theta, surfaces, T, R) : 0, window_m2: window, theta_deg: theta });
      }
      z += s.height_m;
    });
  }
  return out;
}

export function thermalInputsFor(b: Building, glazing = 0.3, overrides: Partial<ThermalInputs> = {}): ThermalInputs {
  const floor = b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0);
  const facade = b.storeys.reduce((a, s) => a + perimeter(s.footprint ?? b.footprint) * s.height_m, 0);
  return { ...DEFAULT_THERMAL, floor_m2: floor, height_m: b.storeys[0]?.height_m ?? 3.2, facade_m2: facade, roof_m2: ringArea(b.footprint), glazing_ratio: glazing, ...overrides };
}

export function runThermal(b: Building, weather: Hourly | null, lat: number, glazing: number, overrides: Partial<ThermalInputs> = {}): { result: ThermalResult; weather: Hourly } {
  const w = weather ?? syntheticClimate(lat);
  return { result: simulateThermal(w, thermalInputsFor(b, glazing, overrides)), weather: w };
}
export function monthlyMeans(series: number[]): number[] { const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; const out: number[] = []; let h = 0; for (const d of days) { let s = 0; for (let i = 0; i < d * 24; i++) s += series[h++] ?? 0; out.push(s / (d * 24)); } return out; }
export { buildingHeight };
export type { Ring };

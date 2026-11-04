import { computeNoise, facadeSamples, groundSamples, NOISE_LIMITS, type Receiver, type Blocker, type Sample } from "@saturn/analyses";
import type { Project } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { activeOption } from "@/lib/store";

export interface NoiseAnalysis {
  limitKey: string;
  facade: { samples: Sample[]; lden: Float32Array; lnight: Float32Array };
  ground: { cols: number; rows: number; minX: number; minY: number; cell: number; lden: Float32Array };
  stats: { facade_avg: number; facade_max: number; pct_over_limit: number; pct_bedroom_ok: number; buildings_with_quiet_side: number; buildings: number; roads: number; ms: number };
}

export function computeTrafficNoise(project: Project, limitKey = "WHO", groundCell = 4): NoiseAnalysis {
  const t0 = performance.now();
  const lim = NOISE_LIMITS[limitKey] ?? NOISE_LIMITS.WHO!;
  const roads = project.site.streets.filter((s) => s.class !== "path" && s.traffic.aadt > 0).map((s) => ({ id: s.id, pts: s.centreline, aadt: s.traffic.aadt, heavy_pct: s.traffic.heavy_pct, speed_kmh: s.traffic.speed_kmh }));
  const opt = activeOption(project);
  const blockers: Blocker[] = [...(opt?.buildings ?? []).map((b) => ({ ring: b.footprint, height: buildingHeight(b) })), ...project.site.context_buildings.map((c) => ({ ring: c.footprint, height: c.height_m }))];
  // façade receivers: one row per storey at mid-height, 4 m spacing
  const fs: Sample[] = []; const recs: Receiver[] = []; const owner: string[] = [];
  for (const b of opt?.buildings ?? []) {
    let z = 0;
    b.storeys.forEach((s, si) => { const row = facadeSamples(s.footprint ?? b.footprint, z, z + s.height_m, 4, b.id).filter((x) => Math.abs(x.p[2] - (z + s.height_m / 2)) < s.height_m / 2 + 0.01); const mid = row.filter((x, i, arr) => arr.findIndex((y) => y.p[0] === x.p[0] && y.p[1] === x.p[1]) === i); for (const x of mid) { x.p[2] = z + s.height_m / 2; fs.push(x); recs.push({ p: x.p, n: x.n, facade: true, owner: b.id, storey: si }); owner.push(b.id); } z += s.height_m; });
  }
  const g = groundSamples(project.site.parcel, (opt?.buildings ?? []).map((b) => b.footprint), groundCell, 20);
  const gRecs: Receiver[] = g.samples.map((s) => ({ p: [s.p[0], s.p[1], 1.5], facade: false }));
  const rf = computeNoise(roads, recs, blockers); const rg = computeNoise(roads, gRecs, blockers);
  const gl = new Float32Array(g.samples.length); g.samples.forEach((s, i) => { gl[i] = s.p[2] < 0 ? -1 : rg.lden[i]!; });
  const f = Array.from(rf.lden);
  // quiet side per building: any façade receiver with Lden <= quiet limit
  const quiet = new Set<string>(); owner.forEach((o, i) => { if (rf.lden[i]! <= lim.lden_quiet) quiet.add(o); });
  const res: NoiseAnalysis = {
    limitKey,
    facade: { samples: fs, lden: rf.lden, lnight: rf.lnight },
    ground: { cols: g.cols, rows: g.rows, minX: g.minX, minY: g.minY, cell: g.cell, lden: gl },
    stats: { facade_avg: f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0, facade_max: f.length ? Math.max(...f) : 0,
      pct_over_limit: f.length ? (100 * f.filter((v) => v > lim.lden_facade_max).length) / f.length : 0,
      pct_bedroom_ok: f.length ? (100 * Array.from(rf.lnight).filter((v) => v <= lim.lnight_bedroom).length) / f.length : 0,
      buildings_with_quiet_side: quiet.size, buildings: opt?.buildings.length ?? 0, roads: roads.length, ms: Math.round(performance.now() - t0) },
  };
  return res;
}

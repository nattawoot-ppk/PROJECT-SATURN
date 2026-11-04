import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { tregenzaPatches, vsc, facadeSamples, type Sample } from "@saturn/analyses";
import type { Project } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { activeOption } from "@/lib/store";
import { buildOccluderGeometry } from "./sunhours";

export interface DaylightResult {
  facade: { samples: Sample[]; vsc: Float32Array };
  context: { samples: Sample[]; vsc: Float32Array };
  stats: { facade_avg: number; facade_min: number; pct_below_27: number; context_avg: number; samples: number; ms: number };
}

/** Façade daylight potential: Vertical Sky Component per façade sample (design buildings and nearby context). */
export function computeDaylight(project: Project, spacing = 3, contextRadius = 80): DaylightResult {
  const t0 = performance.now();
  const patches = tregenzaPatches();
  const geo = buildOccluderGeometry(project, true);
  const bvh = geo ? new MeshBVH(geo) : null;
  const opt = activeOption(project);
  const fs: Sample[] = [];
  for (const b of opt?.buildings ?? []) fs.push(...facadeSamples(b.footprint, 0, buildingHeight(b), spacing, b.id));
  // context façades near the parcel (neighbour impact)
  const cs: Sample[] = [];
  const parcel = project.site.parcel;
  if (parcel) {
    const cx = parcel.reduce((a, p) => a + p[0], 0) / parcel.length, cy = parcel.reduce((a, p) => a + p[1], 0) / parcel.length;
    for (const c of project.site.context_buildings) {
      const near = c.footprint.some(([x, y]) => Math.hypot(x - cx, y - cy) < contextRadius);
      if (near) cs.push(...facadeSamples(c.footprint, 0, c.height_m, spacing * 1.5, c.id));
    }
  }
  const ray = new THREE.Ray(); const vis = new Uint8Array(patches.length);
  const evalSample = (s: Sample): number => {
    for (let i = 0; i < patches.length; i++) {
      const d = patches[i]!.dir;
      const cosN = s.n[0] * d[0] + s.n[1] * d[1] + s.n[2] * d[2];
      if (cosN <= 0) { vis[i] = 0; continue; }
      if (!bvh) { vis[i] = 1; continue; }
      ray.origin.set(s.p[0], s.p[1], s.p[2]); ray.direction.set(d[0], d[1], d[2]);
      vis[i] = bvh.raycastFirst(ray, THREE.FrontSide) ? 0 : 1;
    }
    return vsc(s.n, patches, vis);
  };
  const fv = new Float32Array(fs.length); fs.forEach((s, i) => { fv[i] = evalSample(s); });
  const cv = new Float32Array(cs.length); cs.forEach((s, i) => { cv[i] = evalSample(s); });
  const f = Array.from(fv);
  const res: DaylightResult = {
    facade: { samples: fs, vsc: fv }, context: { samples: cs, vsc: cv },
    stats: { facade_avg: f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0, facade_min: f.length ? Math.min(...f) : 0,
      pct_below_27: f.length ? (100 * f.filter((v) => v < 27).length) / f.length : 0,
      context_avg: cv.length ? Array.from(cv).reduce((a, b) => a + b, 0) / cv.length : 0, samples: fs.length + cs.length, ms: Math.round(performance.now() - t0) },
  };
  geo?.dispose();
  return res;
}

import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { facadeSamples, type Sample } from "@saturn/analyses";
import type { Project } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { activeOption } from "@/lib/store";
import { buildOccluderGeometry } from "./sunhours";

export interface ViewsResult { facade: { samples: Sample[]; openness: Float32Array }; stats: { avg: number; min: number; pct_poor: number; ms: number } }

/** View openness: share of the horizon band (−5°…+25° altitude) in front of a façade sample that is unobstructed within 300 m. */
export function computeViews(project: Project, spacing = 3, maxDist = 300): ViewsResult {
  const t0 = performance.now();
  const geo = buildOccluderGeometry(project, true);
  const bvh = geo ? new MeshBVH(geo) : null;
  const opt = activeOption(project);
  const fs: Sample[] = [];
  for (const b of opt?.buildings ?? []) fs.push(...facadeSamples(b.footprint, 0, buildingHeight(b), spacing, b.id));
  const alts = [-5, 2, 9, 16, 23]; const azs = Array.from({ length: 19 }, (_, i) => -90 + i * 10);
  const ray = new THREE.Ray(); const rad = (d: number) => (d * Math.PI) / 180;
  const out = new Float32Array(fs.length);
  fs.forEach((s, i) => {
    const base = Math.atan2(s.n[0], s.n[1]); let open = 0, total = 0;
    for (const alt of alts) for (const dz of azs) {
      const az = base + rad(dz); const ca = Math.cos(rad(alt));
      const d = [ca * Math.sin(az), ca * Math.cos(az), Math.sin(rad(alt))];
      const w = Math.cos(rad(dz)) + 0.2; total += w;
      if (!bvh) { open += w; continue; }
      ray.origin.set(s.p[0], s.p[1], s.p[2]); ray.direction.set(d[0]!, d[1]!, d[2]!);
      const hit = bvh.raycastFirst(ray, THREE.FrontSide);
      if (!hit || hit.distance > maxDist) open += w; else open += (w * Math.min(1, hit.distance / maxDist)) * 0.5;
    }
    out[i] = (100 * open) / total;
  });
  const arr = Array.from(out);
  geo?.dispose();
  return { facade: { samples: fs, openness: out }, stats: { avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0, min: arr.length ? Math.min(...arr) : 0, pct_poor: arr.length ? (100 * arr.filter((v) => v < 40).length) / arr.length : 0, ms: Math.round(performance.now() - t0) } };
}

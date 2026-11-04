import * as THREE from "three";
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sunVectorsForDay, groundSamples, facadeSamples, type Sample } from "@saturn/analyses";
import type { Project } from "@saturn/model";
import { activeOption } from "@/lib/store";
import { extrudeRing } from "@/lib/extrude";
import { buildingHeight } from "@saturn/model";

THREE.Mesh.prototype.raycast = acceleratedRaycast;
(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree = disposeBoundsTree;

export interface SunHoursResult {
  date: string; step_min: number; total_possible_h: number;
  ground: { cols: number; rows: number; minX: number; minY: number; cell: number; hours: Float32Array };
  facade: { samples: Sample[]; hours: Float32Array };
  stats: { ground_avg_h: number; ground_min_h: number; facade_avg_h: number; samples: number; ms: number };
}

export function buildOccluderGeometry(project: Project, includeContext = true): THREE.BufferGeometry | null {
  const opt = activeOption(project); const geoms: THREE.BufferGeometry[] = [];
  for (const b of opt?.buildings ?? []) { let z = 0; for (const s of b.storeys) { geoms.push(extrudeRing(s.footprint ?? b.footprint, z, z + s.height_m)); z += s.height_m; } }
  if (includeContext) for (const c of project.site.context_buildings) geoms.push(extrudeRing(c.footprint, 0, c.height_m));
  if (!geoms.length) return null;
  const merged = mergeGeometries(geoms.map((g) => g.index ? g.toNonIndexed() : g), false);
  geoms.forEach((g) => g.dispose());
  return merged;
}

/** CPU sun-hours: for each sample and each sun vector, cast a ray against the BVH; count unoccluded steps. */
export function computeSunHours(project: Project, date: string, stepMin = 20, groundCell = 2, facadeSpacing = 3): SunHoursResult {
  const t0 = performance.now();
  const { lat, lon } = project.site.origin;
  const suns = sunVectorsForDay(date, lat, lon, stepMin);
  const geo = buildOccluderGeometry(project, true);
  const bvh = geo ? new MeshBVH(geo) : null;
  const opt = activeOption(project);
  const footprints = (opt?.buildings ?? []).map((b) => b.footprint);
  const g = groundSamples(project.site.parcel, footprints, groundCell, 15);
  const fs: Sample[] = [];
  for (const b of opt?.buildings ?? []) fs.push(...facadeSamples(b.footprint, 0, buildingHeight(b), facadeSpacing, b.id));

  const ray = new THREE.Ray();
  const hoursFor = (s: Sample): number => {
    if (s.p[2] < 0) return -1;
    let n = 0;
    for (const { pos } of suns) {
      const v = pos.vector;
      const facing = s.n[0] * v[0] + s.n[1] * v[1] + s.n[2] * v[2];
      if (facing <= 0) continue;
      if (!bvh) { n++; continue; }
      ray.origin.set(s.p[0], s.p[1], s.p[2]); ray.direction.set(v[0], v[1], v[2]);
      const hit = bvh.raycastFirst(ray, THREE.FrontSide);
      if (!hit) n++;
    }
    return (n * stepMin) / 60;
  };
  const gh = new Float32Array(g.samples.length); g.samples.forEach((s, i) => { gh[i] = hoursFor(s); });
  const fh = new Float32Array(fs.length); fs.forEach((s, i) => { fh[i] = hoursFor(s); });
  const valid = Array.from(gh).filter((h) => h >= 0);
  const res: SunHoursResult = {
    date, step_min: stepMin, total_possible_h: (suns.length * stepMin) / 60,
    ground: { cols: g.cols, rows: g.rows, minX: g.minX, minY: g.minY, cell: g.cell, hours: gh },
    facade: { samples: fs, hours: fh },
    stats: { ground_avg_h: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0, ground_min_h: valid.length ? Math.min(...valid) : 0,
      facade_avg_h: fh.length ? Array.from(fh).reduce((a, b) => a + b, 0) / fh.length : 0, samples: valid.length + fs.length, ms: Math.round(performance.now() - t0) },
  };
  geo?.dispose();
  return res;
}

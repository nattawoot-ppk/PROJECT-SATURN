import type { Project, DesignOption } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { ensureCCW, triangulate, type Ring } from "@saturn/geometry";

interface BimMesh { mesh_id: number; coordinates: number[]; indices: number[] }
interface BimElement { mesh_id: number; vector: { x: number; y: number; z: number }; rotation: { qx: number; qy: number; qz: number; qw: number }; guid: string; type: string; color: { r: number; g: number; b: number; a: number }; info: Record<string, string> }

function prismMesh(id: number, ring: Ring, z0: number, z1: number): BimMesh {
  const r = ensureCCW(ring); const n = r.length; const coords: number[] = []; const idx: number[] = [];
  for (const [x, y] of r) coords.push(x, y, z0); for (const [x, y] of r) coords.push(x, y, z1);
  const { indices } = triangulate({ outer: r, holes: [] });
  for (let i = 0; i < indices.length; i += 3) { idx.push(n + indices[i]!, n + indices[i + 1]!, n + indices[i + 2]!); idx.push(indices[i + 2]!, indices[i + 1]!, indices[i]!); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + j, i, n + j, n + i); }
  return { mesh_id: id, coordinates: coords, indices: idx };
}
const guid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const hex = (h: string) => { const v = parseInt(h.replace("#", ""), 16); return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 255 }; };

/** dotbim (.bim) JSON export: one mesh per storey/context building, metadata in info. */
export function exportDotbim(project: Project, opt: DesignOption, includeContext = true): string {
  const meshes: BimMesh[] = []; const elements: BimElement[] = []; let id = 0;
  const rot = { qx: 0, qy: 0, qz: 0, qw: 1 }; const vec = { x: 0, y: 0, z: 0 };
  for (const b of opt.buildings) {
    let z = 0;
    b.storeys.forEach((s, i) => {
      const m = prismMesh(id++, s.footprint ?? b.footprint, z, z + s.height_m); meshes.push(m);
      elements.push({ mesh_id: m.mesh_id, vector: vec, rotation: rot, guid: guid(), type: "Storey", color: hex(b.color ?? "#d9dde3"), info: { Building: b.name, Level: String(i + 1), Use: s.use, Height: `${s.height_m} m`, BuildingHeight: `${buildingHeight(b).toFixed(1)} m` } });
      for (const u of s.units) { const um = prismMesh(id++, u.polygon, z + 0.01, z + s.height_m - 0.01); meshes.push(um); elements.push({ mesh_id: um.mesh_id, vector: vec, rotation: rot, guid: guid(), type: "Space", color: { r: 255, g: 159, b: 67, a: 90 }, info: { Building: b.name, Level: String(i + 1), UnitType: u.type, Area: `${Math.round(u.area_m2 ?? 0)} m²` } }); }
      z += s.height_m;
    });
  }
  if (includeContext) for (const c of project.site.context_buildings) { const m = prismMesh(id++, c.footprint, 0, c.height_m); meshes.push(m); elements.push({ mesh_id: m.mesh_id, vector: vec, rotation: rot, guid: guid(), type: "Context", color: { r: 120, g: 125, b: 132, a: 255 }, info: { Name: c.name ?? "", Height: `${c.height_m} m`, Source: c.height_source } }); }
  return JSON.stringify({ schema_version: "1.1.0", meshes, elements, info: { Name: project.name, Option: opt.name, Author: "SATRN", Origin: `${project.site.origin.lat}, ${project.site.origin.lon}` } });
}

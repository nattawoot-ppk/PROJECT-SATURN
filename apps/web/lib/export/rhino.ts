import rhino3dm from "rhino3dm";
import type { Project, DesignOption } from "@saturn/model";
import { buildingHeight } from "@saturn/model";
import { ensureCCW, triangulate, type Ring } from "@saturn/geometry";

type Rhino = Awaited<ReturnType<typeof rhino3dm>>;
let rhinoPromise: Promise<Rhino> | null = null;
// the wasm is copied to /public by the prebuild/predev scripts
const getRhino = () => (rhinoPromise ??= rhino3dm({ locateFile: (f: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${f}` } as Parameters<typeof rhino3dm>[0]));

function prism(rh: Rhino, ring: Ring, z0: number, z1: number) {
  const r = ensureCCW(ring); const n = r.length; const mesh = new rh.Mesh();
  for (const [x, y] of r) mesh.vertices().add(x, y, z0);
  for (const [x, y] of r) mesh.vertices().add(x, y, z1);
  const { indices } = triangulate({ outer: r, holes: [] });
  for (let i = 0; i < indices.length; i += 3) { mesh.faces().addTriFace(n + indices[i]!, n + indices[i + 1]!, n + indices[i + 2]!); mesh.faces().addTriFace(indices[i + 2]!, indices[i + 1]!, indices[i]!); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; mesh.faces().addQuadFace(i, j, n + j, n + i); }
  mesh.normals().computeNormals(); mesh.compact();
  return mesh;
}
function polyline(rh: Rhino, ring: Ring, z: number, closed = true) {
  const pts = ring.map(([x, y]) => [x, y, z]); if (closed) pts.push(pts[0]!);
  const pl = new rh.Polyline(pts.length); for (const p of pts) pl.add(p[0]!, p[1]!, p[2]!);
  return pl.toPolylineCurve();
}

/** Rhino 3DM export: one layer per building (meshes per storey), units as sub-layer, context and site layers; metres. */
export async function exportRhino3dm(project: Project, opt: DesignOption, includeContext = true): Promise<Uint8Array> {
  const rh = await getRhino(); const file = new rh.File3dm();
  file.settings().modelUnitSystem = rh.UnitSystem.Meters;
  const addLayer = (name: string, color: [number, number, number], parent?: string) => { const l = new rh.Layer(); l.name = name; l.color = { r: color[0], g: color[1], b: color[2], a: 255 }; if (parent) l.parentLayerId = parent; const idx = file.layers().add(l); return { idx, id: file.layers().get(idx).id }; };
  const site = addLayer("Site", [255, 255, 255]); const ctxL = addLayer("Context", [110, 115, 125]); const dsg = addLayer("Design", [230, 230, 230]);
  const attr = (layerIndex: number, name: string, userText: Record<string, string>) => { const a = new rh.ObjectAttributes(); a.layerIndex = layerIndex; a.name = name; for (const [k, v] of Object.entries(userText)) a.setUserString(k, v); return a; };
  if (project.site.parcel) file.objects().add(polyline(rh, project.site.parcel, 0), attr(site.idx, "Parcel", { area_m2: String(Math.round(0)) }));
  for (const b of opt.buildings) {
    const bl = addLayer(b.name, [200, 205, 212], dsg.id); const ul = addLayer("Units", [255, 159, 67], bl.id);
    let z = 0;
    b.storeys.forEach((s, i) => {
      const m = prism(rh, s.footprint ?? b.footprint, z, z + s.height_m);
      file.objects().add(m, attr(bl.idx, `${b.name} L${i + 1}`, { building: b.name, level: String(i + 1), use: s.use, height_m: String(buildingHeight(b)) }));
      for (const u of s.units) file.objects().add(polyline(rh, u.polygon, z + 0.01), attr(ul.idx, `${u.type} ${Math.round(u.area_m2 ?? 0)} m2`, { level: String(i + 1), type: u.type }));
      z += s.height_m;
    });
  }
  if (includeContext) for (const c of project.site.context_buildings) file.objects().add(prism(rh, c.footprint, 0, c.height_m), attr(ctxL.idx, c.name ?? "Context", { height_m: String(c.height_m), source: c.height_source }));
  for (const s of project.site.streets) file.objects().add(polyline(rh, s.centreline, 0, false), attr(site.idx, s.name ?? s.class, { class: s.class, width_m: String(s.width_m) }));
  return file.toByteArray();
}

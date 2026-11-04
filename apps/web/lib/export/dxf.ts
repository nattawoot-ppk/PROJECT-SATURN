import type { DesignOption, Site } from "@saturn/model";
import { ensureCCW, type Ring } from "@saturn/geometry";

/** Minimal DXF (R12-compatible) writer: LWPOLYLINE footprints per layer + 3DFACE prisms. */
export function exportDxf(option: DesignOption, site: Site, includeContext: boolean): string {
  const out: string[] = [];
  const w = (code: number, val: string | number) => { out.push(String(code), String(val)); };
  w(0, "SECTION"); w(2, "HEADER"); w(9, "$INSUNITS"); w(70, 6); w(0, "ENDSEC");
  w(0, "SECTION"); w(2, "ENTITIES");
  const poly = (ring: Ring, layer: string, z = 0) => {
    w(0, "POLYLINE"); w(8, layer); w(66, 1); w(70, 1);
    for (const [x, y] of ring) { w(0, "VERTEX"); w(8, layer); w(10, x.toFixed(3)); w(20, y.toFixed(3)); w(30, z.toFixed(3)); }
    w(0, "SEQEND");
  };
  const face = (layer: string, p: number[][]) => { w(0, "3DFACE"); w(8, layer); p.forEach((v, i) => { w(10 + i, v[0]!.toFixed(3)); w(20 + i, v[1]!.toFixed(3)); w(30 + i, v[2]!.toFixed(3)); }); if (p.length === 3) { const v = p[2]!; w(13, v[0]!.toFixed(3)); w(23, v[1]!.toFixed(3)); w(33, v[2]!.toFixed(3)); } };
  const prism = (ring: Ring, z0: number, z1: number, layer: string) => {
    const r = ensureCCW(ring); const n = r.length;
    for (let i = 0; i < n; i++) { const a = r[i]!, b = r[(i + 1) % n]!; face(layer, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); }
    poly(r, layer, z1);
  };
  if (site.parcel) poly(ensureCCW(site.parcel), "SITE-PARCEL");
  for (const b of option.buildings) {
    const layer = `BLDG-${b.name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
    let z = 0;
    for (const s of b.storeys) { prism(s.footprint ?? b.footprint, z, z + s.height_m, layer); z += s.height_m; }
    poly(ensureCCW(b.footprint), "FOOTPRINTS");
  }
  if (includeContext) for (const c of site.context_buildings) prism(c.footprint, 0, c.height_m, "CONTEXT");
  for (const s of site.streets) { w(0, "POLYLINE"); w(8, "STREETS"); w(66, 1); w(70, 0); for (const [x, y] of s.centreline) { w(0, "VERTEX"); w(8, "STREETS"); w(10, x.toFixed(3)); w(20, y.toFixed(3)); w(30, 0); } w(0, "SEQEND"); }
  w(0, "ENDSEC"); w(0, "EOF");
  return out.join("\n") + "\n";
}

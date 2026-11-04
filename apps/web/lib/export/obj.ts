import type { DesignOption, Site } from "@saturn/model";
import { ensureCCW, triangulate, type Ring } from "@saturn/geometry";

function prism(lines: string[], ring: Ring, z0: number, z1: number, vOff: number): number {
  const r = ensureCCW(ring); const n = r.length;
  for (const [x, y] of r) lines.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z0.toFixed(3)}`);
  for (const [x, y] of r) lines.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z1.toFixed(3)}`);
  const { indices } = triangulate({ outer: r, holes: [] });
  for (let i = 0; i < indices.length; i += 3) {
    lines.push(`f ${vOff + n + indices[i]! + 1} ${vOff + n + indices[i + 1]! + 1} ${vOff + n + indices[i + 2]! + 1}`);
    lines.push(`f ${vOff + indices[i + 2]! + 1} ${vOff + indices[i + 1]! + 1} ${vOff + indices[i]! + 1}`);
  }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; lines.push(`f ${vOff + i + 1} ${vOff + j + 1} ${vOff + n + j + 1} ${vOff + n + i + 1}`); }
  return vOff + 2 * n;
}

export function exportObj(option: DesignOption, site: Site, includeContext: boolean): string {
  const lines: string[] = ["# Saturn export (metres, Z up)", `o ${option.name.replace(/\s+/g, "_")}`];
  let v = 0;
  for (const b of option.buildings) {
    lines.push(`g ${b.name.replace(/\s+/g, "_")}`);
    let z = 0;
    for (const s of b.storeys) { v = prism(lines, s.footprint ?? b.footprint, z, z + s.height_m, v); z += s.height_m; }
  }
  if (includeContext) {
    lines.push("g context");
    for (const c of site.context_buildings) v = prism(lines, c.footprint, 0, c.height_m, v);
  }
  if (site.parcel) { lines.push("g parcel"); const r = ensureCCW(site.parcel); for (const [x, y] of r) lines.push(`v ${x.toFixed(3)} ${y.toFixed(3)} 0`); lines.push("l " + r.map((_, i) => v + i + 1).concat(v + 1).join(" ")); v += r.length; }
  return lines.join("\n") + "\n";
}

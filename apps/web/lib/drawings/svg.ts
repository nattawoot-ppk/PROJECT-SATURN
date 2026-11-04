import type { Project, DesignOption, Building } from "@saturn/model";
import { computeEnvelope, computeKpis, buildingHeight } from "@saturn/model";
import { bounds, ensureCCW, rotateRing, ringArea, type Ring, type Vec2 } from "@saturn/geometry";

/** A3 landscape in mm. */
export const SHEET = { w: 420, h: 297, margin: 12, titleH: 28 };

export interface Sheet { id: string; title: string; subtitle: string; svg: string; scale: number }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (n: number) => Math.round(n).toLocaleString();

/** World (m) → paper (mm) transform for a given scale and viewport. */
function makeXf(bb: { minX: number; minY: number; maxX: number; maxY: number }, box: { x: number; y: number; w: number; h: number }) {
  const sx = box.w / (bb.maxX - bb.minX || 1), sy = box.h / (bb.maxY - bb.minY || 1);
  const k = Math.min(sx, sy) * 0.92; // mm per m
  const scale = 1000 / k; // 1 : scale
  const nice = [100, 200, 250, 500, 1000, 2000, 2500, 5000].find((s) => s >= scale) ?? 5000;
  const kk = 1000 / nice;
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  const px = box.x + box.w / 2, py = box.y + box.h / 2;
  const X = (x: number) => px + (x - cx) * kk; const Y = (y: number) => py - (y - cy) * kk;
  return { X, Y, k: kk, scale: nice };
}

function pathOf(ring: Ring, X: (x: number) => number, Y: (y: number) => number) {
  return ring.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(2)} ${Y(y).toFixed(2)}`).join(" ") + " Z";
}

function titleBlock(project: Project, opt: DesignOption, title: string, subtitle: string, scale: number): string {
  const k = computeKpis(opt, project.site, project.settings);
  const y = SHEET.h - SHEET.margin - SHEET.titleH; const x = SHEET.margin; const w = SHEET.w - 2 * SHEET.margin;
  const cells = [["Project", project.name], ["Option", opt.name], ["Sheet", title], ["Scale", `1 : ${scale} @ A3`], ["GFA", `${fmt(k.gfa_m2)} m²`], ["FAR", k.far.toFixed(2)], ["Coverage", `${k.coverage_pct.toFixed(0)} %`], ["Units", String(k.unit_count)], ["Max height", `${k.max_height_m.toFixed(1)} m`], ["Date", new Date().toISOString().slice(0, 10)]];
  const cw = w / cells.length;
  return `<g font-family="Helvetica, Arial, sans-serif"><rect x="${x}" y="${y}" width="${w}" height="${SHEET.titleH}" fill="none" stroke="#000" stroke-width="0.4"/>` +
    cells.map(([l, v], i) => `<line x1="${x + i * cw}" y1="${y}" x2="${x + i * cw}" y2="${y + SHEET.titleH}" stroke="#000" stroke-width="0.2"/><text x="${x + i * cw + 2}" y="${y + 7}" font-size="2.6" fill="#555">${esc(l!.toUpperCase())}</text><text x="${x + i * cw + 2}" y="${y + 17}" font-size="4.2" font-weight="bold" fill="#000">${esc(v!)}</text>`).join("") +
    `<text x="${x + w - 2}" y="${y + SHEET.titleH - 3}" font-size="2.4" text-anchor="end" fill="#777">${esc(subtitle)} · Saturn early-phase model · not for construction</text></g>`;
}

function frame(inner: string, project: Project, opt: DesignOption, title: string, subtitle: string, scale: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}" font-family="Helvetica, Arial, sans-serif"><rect width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/><rect x="${SHEET.margin}" y="${SHEET.margin}" width="${SHEET.w - 2 * SHEET.margin}" height="${SHEET.h - 2 * SHEET.margin}" fill="none" stroke="#000" stroke-width="0.5"/>${inner}${titleBlock(project, opt, title, subtitle, scale)}</svg>`;
}

function viewBox() { return { x: SHEET.margin + 4, y: SHEET.margin + 4, w: SHEET.w - 2 * SHEET.margin - 8, h: SHEET.h - 2 * SHEET.margin - SHEET.titleH - 10 }; }

function northAndScale(X: (x: number) => number, Y: (y: number) => number, k: number, scale: number): string {
  const box = viewBox(); const bx = box.x + box.w - 20, by = box.y + 18;
  const len = scale <= 250 ? 10 : scale <= 1000 ? 20 : 50; // metres
  return `<g><circle cx="${bx}" cy="${by}" r="6" fill="none" stroke="#000" stroke-width="0.4"/><path d="M${bx} ${by - 5} L${bx + 2.5} ${by + 3} L${bx} ${by + 1} L${bx - 2.5} ${by + 3} Z" fill="#000"/><text x="${bx}" y="${by + 11}" font-size="3" text-anchor="middle">N</text>` +
    `<rect x="${box.x + 4}" y="${box.y + box.h - 6}" width="${len * k}" height="1.5" fill="#000"/><text x="${box.x + 4}" y="${box.y + box.h - 7.5}" font-size="2.6">0</text><text x="${box.x + 4 + len * k}" y="${box.y + box.h - 7.5}" font-size="2.6" text-anchor="end">${len} m</text></g>`;
}

function dims(ring: Ring, X: (x: number) => number, Y: (y: number) => number): string {
  const bb = bounds([ring]); const off = 6;
  const y = Y(bb.minY) + off; const x = X(bb.maxX) + off;
  return `<g stroke="#000" stroke-width="0.25" font-size="2.6" fill="#000">` +
    `<line x1="${X(bb.minX)}" y1="${y}" x2="${X(bb.maxX)}" y2="${y}"/><line x1="${X(bb.minX)}" y1="${y - 2}" x2="${X(bb.minX)}" y2="${y + 2}"/><line x1="${X(bb.maxX)}" y1="${y - 2}" x2="${X(bb.maxX)}" y2="${y + 2}"/><text x="${(X(bb.minX) + X(bb.maxX)) / 2}" y="${y - 1}" text-anchor="middle" stroke="none">${(bb.maxX - bb.minX).toFixed(1)} m</text>` +
    `<line x1="${x}" y1="${Y(bb.minY)}" x2="${x}" y2="${Y(bb.maxY)}"/><line x1="${x - 2}" y1="${Y(bb.minY)}" x2="${x + 2}" y2="${Y(bb.minY)}"/><line x1="${x - 2}" y1="${Y(bb.maxY)}" x2="${x + 2}" y2="${Y(bb.maxY)}"/><text x="${x + 1.5}" y="${(Y(bb.minY) + Y(bb.maxY)) / 2}" font-size="2.6" stroke="none" transform="rotate(-90 ${x + 1.5} ${(Y(bb.minY) + Y(bb.maxY)) / 2})" text-anchor="middle">${(bb.maxY - bb.minY).toFixed(1)} m</text></g>`;
}

/** Floor plan at a storey level (0-based); level -1 = site plan (ground, all footprints, context). */
export function planSheet(project: Project, opt: DesignOption, level: number): Sheet {
  const site = project.site; const parcel = site.parcel;
  const rings: Ring[] = [...(parcel ? [parcel] : []), ...opt.buildings.map((b) => b.footprint)];
  if (!rings.length) rings.push([[-50, -50], [50, -50], [50, 50], [-50, 50]]);
  const bb0 = bounds(rings); const pad = level < 0 ? 40 : 8;
  const bb = { minX: bb0.minX - pad, minY: bb0.minY - pad, maxX: bb0.maxX + pad, maxY: bb0.maxY + pad };
  const { X, Y, k, scale } = makeXf(bb, viewBox());
  const env = computeEnvelope(site);
  let g = "";
  if (level < 0) {
    for (const c of site.context_buildings) g += `<path d="${pathOf(c.footprint, X, Y)}" fill="#e6e6e6" stroke="#999" stroke-width="0.2"/>`;
    for (const s of site.streets) g += `<polyline points="${s.centreline.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}" fill="none" stroke="#bbb" stroke-width="${Math.max(0.3, s.width_m * k * 0.9)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (parcel) g += `<path d="${pathOf(parcel, X, Y)}" fill="none" stroke="#000" stroke-width="0.6" stroke-dasharray="3 1.5 0.6 1.5"/>`;
  for (const e of env) g += `<path d="${pathOf(e.outer, X, Y)}" fill="none" stroke="#2a9" stroke-width="0.3" stroke-dasharray="1.5 1"/>`;
  for (const b of opt.buildings) {
    const s = level >= 0 ? b.storeys[level] : b.storeys[0];
    if (!s) { if (level >= 0) continue; }
    const fp = s?.footprint ?? b.footprint;
    if (level < 0) {
      g += `<path d="${pathOf(fp, X, Y)}" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
      const c = centroidOf(fp); g += `<text x="${X(c[0])}" y="${Y(c[1])}" font-size="3" text-anchor="middle">${esc(b.name)}</text><text x="${X(c[0])}" y="${Y(c[1]) + 4}" font-size="2.4" text-anchor="middle" fill="#444">${b.storeys.length} storeys · ${buildingHeight(b).toFixed(1)} m</text>`;
    } else {
      // walls: exterior as thick line, units thin, cores hatched
      g += `<path d="${pathOf(fp, X, Y)}" fill="#fff" stroke="#000" stroke-width="1.0"/>`;
      for (const u of s!.units) { const c = centroidOf(u.polygon); g += `<path d="${pathOf(u.polygon, X, Y)}" fill="${u.type === "core" ? "#ddd" : "#fafafa"}" stroke="#333" stroke-width="0.35"/><text x="${X(c[0])}" y="${Y(c[1])}" font-size="2.2" text-anchor="middle">${esc(u.type)}</text><text x="${X(c[0])}" y="${Y(c[1]) + 2.6}" font-size="1.9" text-anchor="middle" fill="#555">${Math.round(u.area_m2 ?? ringArea(u.polygon))} m²</text>`; }
      for (const c of s!.cores) g += `<path d="${pathOf(c, X, Y)}" fill="url(#hatch)" stroke="#000" stroke-width="0.4"/>`;
      g += dims(fp, X, Y);
    }
  }
  if (level < 0 && parcel) g += dims(parcel, X, Y);
  const defs = `<defs><pattern id="hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.2" stroke="#000" stroke-width="0.25"/></pattern></defs>`;
  const title = level < 0 ? "Site plan" : `Floor plan · Level ${level + 1}`;
  const subtitle = level < 0 ? `Parcel ${parcel ? fmt(ringArea(parcel)) : "—"} m² · context from OpenStreetMap` : `Storey ${level + 1} · units and cores from layout generator`;
  return { id: level < 0 ? "site" : `plan-${level}`, title, subtitle, scale, svg: frame(defs + g + northAndScale(X, Y, k, scale), project, opt, title, subtitle, scale) };
}

function centroidOf(r: Ring): Vec2 { return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; }

/**
 * Elevation / section along a direction. `angle` = direction of the view plane's horizontal axis (radians).
 * Elevation: every building projected (silhouette); section: only geometry cut by the plane through `through`.
 */
export function elevationSheet(project: Project, opt: DesignOption, angle: number, label: string, section?: { through: Vec2 }): Sheet {
  const bld = opt.buildings; if (!bld.length) return { id: label, title: label, subtitle: "no buildings", scale: 500, svg: frame("", project, opt, label, "no buildings", 500) };
  // rotate world so the view axis is +x; depth along +y (viewer looks toward +y)
  const rot = (r: Ring) => rotateRing(r, -angle);
  const items: Array<{ x0: number; x1: number; z0: number; z1: number; depth: number; fill: string; stroke: string; name?: string }> = [];
  const parcelR = project.site.parcel ? rot(project.site.parcel) : undefined;
  const through = section ? rotateRing([section.through], -angle)[0]! : null;
  const add = (ring: Ring, z0: number, z1: number, fill: string, stroke: string, name?: string) => {
    const r = rot(ensureCCW(ring)); const b = bounds([r]);
    if (through) {
      // cut: find x-extent of polygon at y = through[1]
      const xs: number[] = []; for (let i = 0; i < r.length; i++) { const a = r[i]!, c = r[(i + 1) % r.length]!; if ((a[1] <= through[1]) !== (c[1] <= through[1])) { const t = (through[1] - a[1]) / (c[1] - a[1]); xs.push(a[0] + t * (c[0] - a[0])); } }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) items.push({ x0: xs[i]!, x1: xs[i + 1]!, z0, z1, depth: 0, fill, stroke, name });
    } else items.push({ x0: b.minX, x1: b.maxX, z0, z1, depth: b.minY, fill, stroke, name });
  };
  for (const b of bld) { let z = 0; for (const s of b.storeys) { add(s.footprint ?? b.footprint, z, z + s.height_m, "#fff", "#000", b.name); z += s.height_m; } }
  if (!section) for (const c of project.site.context_buildings) { const r = rot(c.footprint); const bb = bounds([r]); const pb = parcelR ? bounds([parcelR]) : null; if (pb && (bb.maxX < pb.minX - 60 || bb.minX > pb.maxX + 60)) continue; add(c.footprint, 0, c.height_m, "#eee", "#999"); }
  const xs = items.flatMap((i) => [i.x0, i.x1]); const zmax = Math.max(...items.map((i) => i.z1), 10);
  const bb = { minX: Math.min(...xs) - 10, maxX: Math.max(...xs) + 10, minY: -4, maxY: zmax + 6 };
  const { X, Y, k, scale } = makeXf(bb, viewBox());
  items.sort((a, b) => b.depth - a.depth); // far first
  let g = `<line x1="${X(bb.minX)}" y1="${Y(0)}" x2="${X(bb.maxX)}" y2="${Y(0)}" stroke="#000" stroke-width="0.8"/>`;
  for (const it of items) g += `<rect x="${X(it.x0)}" y="${Y(it.z1)}" width="${(it.x1 - it.x0) * k}" height="${(it.z1 - it.z0) * k}" fill="${it.fill}" stroke="${it.stroke}" stroke-width="${it.fill === "#fff" ? 0.5 : 0.25}"/>`;
  // storey datums and height dims on the tallest building
  const tallest = bld.reduce((a, b) => (buildingHeight(b) > buildingHeight(a) ? b : a), bld[0]!);
  const tr = bounds([rot(tallest.footprint)]); let z = 0; const dx = X(tr.maxX) + 6;
  for (const s of tallest.storeys) { z += s.height_m; g += `<line x1="${dx - 2}" y1="${Y(z)}" x2="${dx + 2}" y2="${Y(z)}" stroke="#000" stroke-width="0.25"/><text x="${dx + 3}" y="${Y(z) + 1}" font-size="2.2">+${z.toFixed(2)}</text>`; }
  g += `<line x1="${dx}" y1="${Y(0)}" x2="${dx}" y2="${Y(z)}" stroke="#000" stroke-width="0.25"/><text x="${dx + 3}" y="${Y(0) + 1}" font-size="2.2">±0.00</text>`;
  if (through) g += `<text x="${X(bb.minX) + 2}" y="${Y(bb.maxY) + 5}" font-size="3">${esc(label)} — cut through ${section!.through[0].toFixed(0)}, ${section!.through[1].toFixed(0)}</text>`;
  const subtitle = section ? "Section: cut geometry only" : "Elevation: silhouettes, context in grey";
  return { id: label.toLowerCase().replace(/\s+/g, "-"), title: label, subtitle, scale, svg: frame(g + `<rect x="${viewBox().x + 4}" y="${viewBox().y + viewBox().h - 6}" width="${(scale <= 250 ? 10 : 20) * k}" height="1.5"/><text x="${viewBox().x + 4}" y="${viewBox().y + viewBox().h - 7.5}" font-size="2.6">0 – ${scale <= 250 ? 10 : 20} m</text>`, project, opt, label, subtitle, scale) };
}

export function allSheets(project: Project, opt: DesignOption): Sheet[] {
  const sheets: Sheet[] = [planSheet(project, opt, -1)];
  const maxLv = Math.max(0, ...opt.buildings.map((b) => b.storeys.length));
  const levels = maxLv <= 4 ? Array.from({ length: maxLv }, (_, i) => i) : [0, 1, maxLv - 1];
  for (const l of levels) sheets.push(planSheet(project, opt, l));
  const parcel = project.site.parcel; const c: Vec2 = parcel ? centroidOf(parcel) : [0, 0];
  sheets.push(elevationSheet(project, opt, 0, "South elevation"));
  sheets.push(elevationSheet(project, opt, Math.PI / 2, "East elevation"));
  sheets.push(elevationSheet(project, opt, 0, "Section A-A", { through: c }));
  sheets.push(elevationSheet(project, opt, Math.PI / 2, "Section B-B", { through: c }));
  return sheets;
}

export function buildingsOf(opt: DesignOption): Building[] { return opt.buildings; }

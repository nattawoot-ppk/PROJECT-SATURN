import { nanoid } from "nanoid";
import { computeEnvelope, computeKpis, evaluateRules, getRulePack, buildingHeight, type Project, type DesignOption, type Building } from "@saturn/model";
import { intersect, offsetPolygon, difference, polygonArea, bounds, rotateRing, ensureCCW, type Polygon, type Ring } from "@saturn/geometry";

export interface GenerateParams { target_gfa_m2: number; depth_m: number; gap_m: number; typologies: Array<"bars" | "perimeter" | "l-block">; max_options: number }

const palette = ["#4f8cff", "#ff9f43", "#2ed573", "#a55eea", "#ff6b81", "#1dd1a1", "#feca57"];

function mkBuilding(name: string, fp: Ring, storeys: number, sh: number, color: string): Building {
  const id = nanoid(8);
  return { id, name, category: "residential", tags: ["generated"], footprint: fp, efficiency: 0.82, parking: [], color,
    roof: { type: "flat", pitch_deg: 0, height_m: 0 },
    storeys: Array.from({ length: storeys }, (_, i) => ({ id: `${id}-s${i}`, level: i, height_m: sh, use: "residential", units: [], cores: [] })) };
}

/** Longest parcel edge angle (radians) to align bars with the site. */
function dominantAngle(ring: Ring): number {
  let best = 0, bl = -1;
  for (let i = 0; i < ring.length; i++) { const a = ring[i]!, b = ring[(i + 1) % ring.length]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
  return best;
}

function barsIn(env: Polygon[], angle: number, depth: number, gap: number): Ring[] {
  const out: Ring[] = [];
  const env0 = env.map((p) => ({ outer: rotateRing(p.outer, -angle), holes: p.holes.map((h) => rotateRing(h, -angle)) }));
  const bb = bounds(env0.map((p) => p.outer));
  const bx = bb.maxX - bb.minX + 2 * depth, cx = (bb.minX + bb.maxX) / 2;
  for (let y = bb.minY + depth / 2; y + depth / 2 <= bb.maxY + 1e-6; y += depth + gap) {
    const strip: Ring = [[cx - bx, y - depth / 2], [cx + bx, y - depth / 2], [cx + bx, y + depth / 2], [cx - bx, y + depth / 2]];
    for (const piece of intersect([{ outer: strip, holes: [] }], env0)) {
      const pb = bounds([piece.outer]);
      if (polygonArea(piece) >= 150 && pb.maxX - pb.minX >= 12) out.push(rotateRing(piece.outer, angle));
    }
  }
  return out;
}

function perimeterBlock(env: Polygon[], depth: number): Ring[] {
  const out: Ring[] = [];
  for (const p of env) {
    const inner = offsetPolygon(p, -depth);
    if (!inner.length) { out.push(p.outer); continue; }
    const ring = difference([p], inner);
    // keep as single polygon with a hole: represent via outer ring + we emulate hole by using ring pieces
    for (const r of ring) if (polygonArea(r) >= 150) out.push(r.outer);
    // if the result is a ring with a hole, our Building schema has no holes: split into 4 strips instead
    if (ring.length === 1 && ring[0]!.holes.length) {
      out.pop();
      const r = ring[0]!; const bb = bounds([r.outer]); const hb = bounds(r.holes);
      const strips: Ring[] = [
        [[bb.minX, bb.minY], [bb.maxX, bb.minY], [bb.maxX, hb.minY], [bb.minX, hb.minY]],
        [[bb.minX, hb.maxY], [bb.maxX, hb.maxY], [bb.maxX, bb.maxY], [bb.minX, bb.maxY]],
        [[bb.minX, hb.minY], [hb.minX, hb.minY], [hb.minX, hb.maxY], [bb.minX, hb.maxY]],
        [[hb.maxX, hb.minY], [bb.maxX, hb.minY], [bb.maxX, hb.maxY], [hb.maxX, hb.maxY]],
      ];
      for (const s of strips) for (const piece of intersect([{ outer: s, holes: [] }], [r])) if (polygonArea(piece) >= 100 && !piece.holes.length) out.push(piece.outer);
    }
  }
  return out;
}

function lBlock(env: Polygon[], angle: number, depth: number): Ring[] {
  const out: Ring[] = [];
  const env0 = env.map((p) => ({ outer: rotateRing(p.outer, -angle), holes: [] as Ring[] }));
  const bb = bounds(env0.map((p) => p.outer));
  const south: Ring = [[bb.minX, bb.minY], [bb.maxX, bb.minY], [bb.maxX, bb.minY + depth], [bb.minX, bb.minY + depth]];
  const west: Ring = [[bb.minX, bb.minY + depth], [bb.minX + depth, bb.minY + depth], [bb.minX + depth, bb.maxY], [bb.minX, bb.maxY]];
  for (const s of [south, west]) for (const piece of intersect([{ outer: s, holes: [] }], env0)) if (polygonArea(piece) >= 150 && !piece.holes.length) out.push(rotateRing(piece.outer, angle));
  return out;
}

export function generateOptions(project: Project, params: GenerateParams): DesignOption[] {
  const env = computeEnvelope(project.site);
  if (!env.length || !project.site.parcel) return [];
  const z = project.site.zoning; const sh = project.settings.storey_height_m;
  const maxStoreys = Math.max(1, Math.min(z.max_storeys ?? 999, z.max_height_m ? Math.floor(z.max_height_m / sh + 1e-6) : 999));
  const angle = dominantAngle(ensureCCW(project.site.parcel));
  const candidates: Array<{ name: string; fps: Ring[] }> = [];
  for (const t of params.typologies) {
    if (t === "bars") {
      candidates.push({ name: "Bars (aligned)", fps: barsIn(env, angle, params.depth_m, params.gap_m) });
      candidates.push({ name: "Bars (rotated)", fps: barsIn(env, angle + Math.PI / 2, params.depth_m, params.gap_m) });
    }
    if (t === "perimeter") candidates.push({ name: "Perimeter block", fps: perimeterBlock(env, params.depth_m) });
    if (t === "l-block") candidates.push({ name: "L-block", fps: lBlock(env, angle, params.depth_m) });
  }
  const pack = getRulePack(project.settings.rule_pack_id);
  const now = new Date().toISOString();
  const options: Array<DesignOption & { score: number }> = [];
  for (const c of candidates) {
    if (!c.fps.length) continue;
    const fpArea = c.fps.reduce((a, r) => a + polygonArea({ outer: r, holes: [] }), 0);
    let storeys = Math.max(1, Math.min(maxStoreys, Math.ceil(params.target_gfa_m2 / fpArea)));
    const mk = (n: number): DesignOption => ({ id: nanoid(8), name: c.name, created_at: now, updated_at: now,
      buildings: c.fps.map((fp, i) => mkBuilding(`${c.name.split(" ")[0]} ${i + 1}`, fp, n, sh, palette[i % palette.length]!)) });
    let opt = mk(storeys);
    // reduce storeys until FAR / coverage rules pass (height/storeys already bounded)
    for (let guard = 0; guard < 50; guard++) {
      const k = computeKpis(opt, project.site, project.settings);
      const r = evaluateRules(pack, opt, project.site, project.settings, k);
      if (r.errors === 0 || storeys <= 1) break;
      storeys -= 1; opt = mk(storeys);
    }
    const k = computeKpis(opt, project.site, project.settings);
    const r = evaluateRules(pack, opt, project.site, project.settings, k);
    const gfaScore = 1 - Math.min(1, Math.abs(k.gfa_m2 - params.target_gfa_m2) / Math.max(1, params.target_gfa_m2));
    const compact = 1 / (1 + k.envelope_ratio);
    const score = (r.errors ? 0 : 1) * (0.7 * gfaScore + 0.3 * compact);
    opt.notes = `Generated: ${c.name}. GFA ${Math.round(k.gfa_m2)} m², ${storeys} storeys, max height ${opt.buildings.reduce((h, b) => Math.max(h, buildingHeight(b)), 0).toFixed(1)} m, ${r.errors} errors.`;
    options.push({ ...opt, score });
  }
  return options.sort((a, b) => b.score - a.score).slice(0, params.max_options).map((o) => { const { score: _score, ...rest } = o; void _score; return rest; });
}

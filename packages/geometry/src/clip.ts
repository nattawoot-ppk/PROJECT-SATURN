/// <reference path="./clipper-lib.d.ts" />
import ClipperLib from "clipper-lib";
import type { Ring, Polygon } from "./types";
import { cleanRing, ensureCCW, signedArea } from "./polygon";

const SCALE = 1000; // 1 mm integer precision

function toPath(ring: Ring): ClipperLib.Path {
  return ring.map(([x, y]) => new ClipperLib.IntPoint(Math.round(x * SCALE), Math.round(y * SCALE)));
}
function fromPath(path: ClipperLib.Path): Ring {
  return cleanRing(path.map((p) => [p.X / SCALE, p.Y / SCALE] as [number, number]));
}

/** Convert clipper output paths into polygons (outer CCW, holes CW by orientation). */
function pathsToPolygons(paths: ClipperLib.Paths): Polygon[] {
  const rings = paths.map(fromPath).filter((r) => r.length >= 3);
  const outers = rings.filter((r) => signedArea(r) > 0);
  const holes = rings.filter((r) => signedArea(r) < 0);
  return outers.map((outer) => ({
    outer,
    holes: holes.filter((h) => {
      const p = h[0]!;
      return pointInRingLocal(p, outer);
    }),
  }));
}
function pointInRingLocal([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Uniform inward (negative) / outward (positive) offset of a polygon. Mitre joins. */
export function offsetPolygon(p: Polygon, delta: number, miterLimit = 4): Polygon[] {
  const co = new ClipperLib.ClipperOffset(miterLimit, 0.25 * SCALE);
  co.AddPath(toPath(ensureCCW(p.outer)), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  for (const h of p.holes) {
    co.AddPath(toPath([...ensureCCW(h)].reverse()), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  }
  const out: ClipperLib.Paths = [];
  co.Execute(out, delta * SCALE);
  return pathsToPolygons(out);
}

export function offsetRing(ring: Ring, delta: number): Ring[] {
  return offsetPolygon({ outer: ring, holes: [] }, delta).map((p) => p.outer);
}

function boolOp(a: Polygon[], b: Polygon[], ct: ClipperLib.ClipType): Polygon[] {
  const c = new ClipperLib.Clipper();
  for (const p of a) {
    c.AddPath(toPath(ensureCCW(p.outer)), ClipperLib.PolyType.ptSubject, true);
    for (const h of p.holes) c.AddPath(toPath([...ensureCCW(h)].reverse()), ClipperLib.PolyType.ptSubject, true);
  }
  for (const p of b) {
    c.AddPath(toPath(ensureCCW(p.outer)), ClipperLib.PolyType.ptClip, true);
    for (const h of p.holes) c.AddPath(toPath([...ensureCCW(h)].reverse()), ClipperLib.PolyType.ptClip, true);
  }
  const out: ClipperLib.Paths = [];
  c.Execute(ct, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return pathsToPolygons(out);
}

export const intersect = (a: Polygon[], b: Polygon[]) => boolOp(a, b, ClipperLib.ClipType.ctIntersection);
export const union = (a: Polygon[], b: Polygon[]) => boolOp(a, b, ClipperLib.ClipType.ctUnion);
export const difference = (a: Polygon[], b: Polygon[]) => boolOp(a, b, ClipperLib.ClipType.ctDifference);

export function unionAll(polys: Polygon[]): Polygon[] {
  if (polys.length === 0) return [];
  return boolOp(polys, [], ClipperLib.ClipType.ctUnion);
}

/**
 * Buildable envelope: parcel shrunk by a per-edge setback.
 * Edge i runs from parcel[i] to parcel[i+1]; setbacks[i] is applied to that edge.
 * Implemented as intersection of the parcel with half-planes shifted inward.
 */
export function envelopeWithEdgeSetbacks(parcel: Ring, setbacks: number[]): Polygon[] {
  const ring = ensureCCW(parcel);
  let result: Polygon[] = [{ outer: ring, holes: [] }];
  const n = ring.length;
  const BIG = 1e5;
  for (let i = 0; i < n; i++) {
    const s = setbacks[i] ?? setbacks[0] ?? 0;
    if (s <= 0) continue;
    const a = ring[i]!, b = ring[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // inward normal for CCW ring is to the left of direction: (-dy, dx)
    const nx = -dy / len, ny = dx / len;
    // half-plane polygon: the side of the shifted edge that contains the interior
    const ax = a[0] + nx * s, ay = a[1] + ny * s;
    const bx = b[0] + nx * s, by = b[1] + ny * s;
    const ex = dx / len * BIG, ey = dy / len * BIG;
    const half: Ring = [
      [ax - ex, ay - ey],
      [bx + ex, by + ey],
      [bx + ex + nx * BIG, by + ey + ny * BIG],
      [ax - ex + nx * BIG, ay - ey + ny * BIG],
    ];
    result = intersect(result, [{ outer: half, holes: [] }]);
    if (result.length === 0) break;
  }
  return result;
}

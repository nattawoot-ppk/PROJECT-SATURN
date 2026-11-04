import type { Vec2, Ring } from "./types";

/** Offset an open polyline by `d` metres (positive = left of travel direction) with mitre joins (limited). */
export function offsetPolyline(pts: Vec2[], d: number, miterLimit = 3): Vec2[] {
  const n = pts.length; if (n < 2) return pts.slice();
  const out: Vec2[] = [];
  const dir = (i: number): Vec2 => { const a = pts[i]!, b = pts[i + 1]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  for (let i = 0; i < n; i++) {
    const d0 = i > 0 ? dir(i - 1) : dir(0); const d1 = i < n - 1 ? dir(i) : dir(n - 2);
    const n0: Vec2 = [-d0[1], d0[0]], n1: Vec2 = [-d1[1], d1[0]];
    let mx = n0[0] + n1[0], my = n0[1] + n1[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const cosHalf = mx * n1[0] + my * n1[1];
    let scale = cosHalf > 1e-6 ? 1 / cosHalf : miterLimit;
    if (scale > miterLimit) scale = miterLimit;
    out.push([pts[i]![0] + mx * d * scale, pts[i]![1] + my * d * scale]);
  }
  return out;
}

/** Strip polygon between lateral offsets a and b (a < b, left-positive) of a polyline. */
export function polylineStrip(pts: Vec2[], a: number, b: number): Ring {
  const left = offsetPolyline(pts, b); const right = offsetPolyline(pts, a);
  return [...right, ...left.reverse()];
}

export function polylineLength(pts: Vec2[]): number {
  let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]); return l;
}

/** Minimum distance from a point to a polyline. */
export function distPointPolyline(p: Vec2, pts: Vec2[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!; const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
    d = Math.min(d, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return d;
}

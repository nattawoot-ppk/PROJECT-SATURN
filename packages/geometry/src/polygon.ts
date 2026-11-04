import type { Vec2, Ring, Polygon, Bounds } from "./types";

/** Signed area; positive = counter-clockwise. */
export function signedArea(ring: Ring): number {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % n]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function ringArea(ring: Ring): number {
  return Math.abs(signedArea(ring));
}

export function polygonArea(p: Polygon): number {
  return ringArea(p.outer) - p.holes.reduce((s, h) => s + ringArea(h), 0);
}

export function isCCW(ring: Ring): boolean {
  return signedArea(ring) > 0;
}

export function ensureCCW(ring: Ring): Ring {
  return isCCW(ring) ? ring : [...ring].reverse();
}

export function centroid(ring: Ring): Vec2 {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-12) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0, cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % n]!;
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function bounds(rings: Ring[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function perimeter(ring: Ring): number {
  let l = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    l += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return l;
}

/** Ray-casting point-in-ring test. */
export function pointInRing(pt: Vec2, ring: Ring): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(pt: Vec2, p: Polygon): boolean {
  if (!pointInRing(pt, p.outer)) return false;
  return !p.holes.some((h) => pointInRing(pt, h));
}

/** Distance from point to segment ab. */
export function distPointSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Minimum distance from a point to a ring boundary. */
export function distPointRing(p: Vec2, ring: Ring): number {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) {
    d = Math.min(d, distPointSegment(p, ring[i]!, ring[(i + 1) % ring.length]!));
  }
  return d;
}

/** Minimum distance from the vertices of ring A to edge i of ring B (edge from B[i] to B[i+1]). */
export function minDistRingToEdge(a: Ring, b: Ring, i: number): number {
  const p = b[i]!, q = b[(i + 1) % b.length]!;
  let d = Infinity;
  for (const v of a) d = Math.min(d, distPointSegment(v, p, q));
  return d;
}

/** Does every vertex of `inner` lie inside `outer` (with tolerance in metres)? */
export function ringInsideRing(inner: Ring, outer: Ring, tol = 1e-3): boolean {
  return inner.every((v) => pointInRing(v, outer) || distPointRing(v, outer) <= tol);
}

export function translateRing(ring: Ring, dx: number, dy: number): Ring {
  return ring.map(([x, y]) => [x + dx, y + dy]);
}

export function rotateRing(ring: Ring, angleRad: number, about: Vec2 = [0, 0]): Ring {
  const c = Math.cos(angleRad), s = Math.sin(angleRad);
  return ring.map(([x, y]) => {
    const px = x - about[0], py = y - about[1];
    return [about[0] + px * c - py * s, about[1] + px * s + py * c];
  });
}

export function rectRing(cx: number, cy: number, w: number, d: number, angleRad = 0): Ring {
  const hw = w / 2, hd = d / 2;
  const r: Ring = [[cx - hw, cy - hd], [cx + hw, cy - hd], [cx + hw, cy + hd], [cx - hw, cy + hd]];
  return angleRad ? rotateRing(r, angleRad, [cx, cy]) : r;
}

/** Remove consecutive duplicate points and a trailing point equal to the first. */
export function cleanRing(ring: Ring, eps = 1e-6): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > eps) out.push(p);
  }
  if (out.length > 1) {
    const f = out[0]!, l = out[out.length - 1]!;
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) <= eps) out.pop();
  }
  return out;
}

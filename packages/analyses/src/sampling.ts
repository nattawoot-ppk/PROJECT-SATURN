import { bounds, pointInRing, ensureCCW, type Ring } from "@saturn/geometry";

export interface Sample { p: [number, number, number]; n: [number, number, number]; kind: "ground" | "facade" | "roof"; owner?: string }

/** Ground grid over the parcel (or bounds of rings) plus a margin. */
export function groundSamples(region: Ring | undefined, extraRings: Ring[], cell = 2, margin = 15): { samples: Sample[]; cols: number; rows: number; minX: number; minY: number; cell: number } {
  const rings = region ? [region] : extraRings;
  if (!rings.length) return { samples: [], cols: 0, rows: 0, minX: 0, minY: 0, cell };
  const b = bounds(rings);
  const minX = Math.floor((b.minX - margin) / cell) * cell, minY = Math.floor((b.minY - margin) / cell) * cell;
  const cols = Math.ceil((b.maxX + margin - minX) / cell), rows = Math.ceil((b.maxY + margin - minY) / cell);
  const samples: Sample[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = minX + (i + 0.5) * cell, y = minY + (j + 0.5) * cell;
    if (extraRings.some((r) => pointInRing([x, y], r))) { samples.push({ p: [x, y, -1], n: [0, 0, 1], kind: "ground" }); continue; } // inside a building: mark invalid (z=-1)
    samples.push({ p: [x, y, 0.1], n: [0, 0, 1], kind: "ground" });
  }
  return { samples, cols, rows, minX, minY, cell };
}

/** Façade samples on the vertical walls of a prism, spaced `s` metres, offset 0.15 m outward. */
export function facadeSamples(ring: Ring, z0: number, z1: number, s = 2, owner?: string): Sample[] {
  const r = ensureCCW(ring); const out: Sample[] = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!, b = r[(i + 1) % r.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy); if (len < 0.5) continue;
    const nx = dy / len, ny = -dx / len; // outward for CCW
    const nu = Math.max(1, Math.round(len / s)), nv = Math.max(1, Math.round((z1 - z0) / s));
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) {
      const t = (u + 0.5) / nu; const z = z0 + ((v + 0.5) / nv) * (z1 - z0);
      out.push({ p: [a[0] + dx * t + nx * 0.15, a[1] + dy * t + ny * 0.15, z], n: [nx, ny, 0], kind: "facade", owner });
    }
  }
  return out;
}

/** Colour ramp for sun hours (0 → dark blue, mid → yellow, high → red). Returns [r,g,b] 0..1. */
export function heatColor(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const stops: Array<[number, [number, number, number]]> = [[0, [0.12, 0.2, 0.45]], [0.35, [0.1, 0.6, 0.75]], [0.6, [0.95, 0.85, 0.2]], [1, [0.9, 0.2, 0.1]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]!, [t1, c1] = stops[i + 1]!;
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k]; }
  }
  return stops[stops.length - 1]![1];
}

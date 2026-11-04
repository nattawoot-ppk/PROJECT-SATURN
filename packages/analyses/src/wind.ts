/**
 * Pedestrian-level wind, comparative method: 2D lattice-Boltzmann (D2Q9, BGK) on a uniform grid with buildings as
 * bounce-back obstacles, run for each wind direction; results as speed ratio U/U_ref and Lawson LDDC comfort classes.
 * A 2D model ignores flow over roofs and vertical mixing; use for comparing options, not for certification.
 */
export interface WindOptions { cell_m: number; steps: number; tau: number; uIn: number }
export const DEFAULT_WIND: WindOptions = { cell_m: 4, steps: 2500, tau: 0.56, uIn: 0.1 };

const cx = [0, 1, 0, -1, 0, 1, -1, -1, 1], cy = [0, 0, 1, 0, -1, 1, 1, -1, -1], w = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const opp = [0, 3, 4, 1, 2, 7, 8, 5, 6];

export interface LbmResult { speedRatio: Float32Array; ux: Float32Array; uy: Float32Array }

/** Run LBM for wind blowing FROM compass azimuth `fromDeg` (0 = north, 90 = east) on an obstacle mask (1 = solid). */
export function runLbm(mask: Uint8Array, nx: number, ny: number, fromDeg: number, o: WindOptions = DEFAULT_WIND, onProgress?: (p: number) => void): LbmResult {
  const rad = ((fromDeg + 180) * Math.PI) / 180; // flow direction = opposite of where it comes from; y up = north
  const dirX = Math.sin(rad), dirY = Math.cos(rad);
  const U = o.uIn; const ux0 = U * dirX, uy0 = U * dirY;
  const n = nx * ny; let f = new Float32Array(n * 9), f2 = new Float32Array(n * 9);
  const eq = (rho: number, ux: number, uy: number, k: number) => { const cu = 3 * (cx[k]! * ux + cy[k]! * uy); const u2 = 1.5 * (ux * ux + uy * uy); return w[k]! * rho * (1 + cu + 0.5 * cu * cu - u2); };
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) f[i * 9 + k] = eq(1, ux0, uy0, k);
  const omega = 1 / o.tau;
  const ux = new Float32Array(n), uy = new Float32Array(n);
  const inflowX = dirX > 0.3 ? 0 : dirX < -0.3 ? nx - 1 : -1, inflowY = dirY > 0.3 ? 0 : dirY < -0.3 ? ny - 1 : -1;
  for (let step = 0; step < o.steps; step++) {
    // collision
    for (let i = 0; i < n; i++) {
      if (mask[i]) continue;
      let rho = 0, mx = 0, my = 0;
      for (let k = 0; k < 9; k++) { const v = f[i * 9 + k]!; rho += v; mx += v * cx[k]!; my += v * cy[k]!; }
      const vx = mx / rho, vy = my / rho; ux[i] = vx; uy[i] = vy;
      for (let k = 0; k < 9; k++) f[i * 9 + k] = f[i * 9 + k]! * (1 - omega) + omega * eq(rho, vx, vy, k);
    }
    // streaming with bounce-back
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x; if (mask[i]) continue;
      for (let k = 0; k < 9; k++) {
        const xx = x + cx[k]!, yy = y + cy[k]!;
        if (xx < 0 || xx >= nx || yy < 0 || yy >= ny) continue;
        const j = yy * nx + xx;
        if (mask[j]) f2[i * 9 + opp[k]!] = f[i * 9 + k]!; else f2[j * 9 + k] = f[i * 9 + k]!;
      }
    }
    // boundaries (equilibrium scheme): inlet = velocity U with neighbour density; outlet = density 1 with neighbour
    // velocity; lateral edges = neighbour macroscopic state (free slip). Stable and adequate for comparative studies.
    const macro = (j: number) => { let rho = 0, mx = 0, my = 0; for (let k = 0; k < 9; k++) { const v = f2[j * 9 + k]!; rho += v; mx += v * cx[k]!; my += v * cy[k]!; } return [rho, mx / rho, my / rho] as const; };
    const setEq = (i: number, rho: number, vx: number, vy: number) => { for (let k = 0; k < 9; k++) f2[i * 9 + k] = eq(rho, vx, vy, k); };
    const edge = (i: number, j: number, isIn: boolean, isOut: boolean) => {
      if (mask[i] || mask[j]) { setEq(i, 1, 0, 0); return; }
      const [rho, vx, vy] = macro(j);
      if (isIn) setEq(i, rho, ux0, uy0); else if (isOut) setEq(i, 1, vx, vy); else setEq(i, rho, vx, vy);
    };
    for (let y = 0; y < ny; y++) { edge(y * nx, y * nx + 1, inflowX === 0, dirX > 0.3); edge(y * nx + nx - 1, y * nx + nx - 2, inflowX === nx - 1, dirX < -0.3); }
    for (let x = 0; x < nx; x++) { edge(x, nx + x, inflowY === 0, dirY > 0.3); edge((ny - 1) * nx + x, (ny - 2) * nx + x, inflowY === ny - 1, dirY < -0.3); }
    const t = f; f = f2; f2 = t;
    if (onProgress && step % 100 === 0) onProgress(step / o.steps);
  }
  const speedRatio = new Float32Array(n);
  for (let i = 0; i < n; i++) speedRatio[i] = mask[i] ? -1 : Math.hypot(ux[i]!, uy[i]!) / U;
  return { speedRatio, ux, uy };
}

/** Lawson LDDC comfort classes from the mean pedestrian wind speed (m/s). */
export const LAWSON = [
  { max: 4, label: "Sitting", color: "#1f3373" },
  { max: 6, label: "Standing", color: "#1a99bf" },
  { max: 8, label: "Strolling", color: "#19e6c1" },
  { max: 10, label: "Walking", color: "#f2d933" },
  { max: Infinity, label: "Uncomfortable", color: "#e6331a" },
];
export function lawsonClass(speed: number): number { return LAWSON.findIndex((c) => speed <= c.max); }

/** Weighted mean speed ratio across directions given a wind rose (frequency per direction, sums to 1). */
export function combineDirections(results: Float32Array[], freq: number[]): Float32Array {
  const n = results[0]?.length ?? 0; const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, masked = false; results.forEach((r, k) => { if (r[i]! < 0) masked = true; else s += r[i]! * (freq[k] ?? 0); }); out[i] = masked ? -1 : s; }
  return out;
}

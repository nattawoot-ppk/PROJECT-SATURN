/**
 * AIJ pedestrian-wind benchmark harness for the SATRN 2D lattice-Boltzmann solver.
 *
 * The Architectural Institute of Japan publishes wind-tunnel measurements for standard cases
 * (https://www.aij.or.jp/jpn/publish/cfdguide/index_e.htm). Case A is a single 2:1:1 high-rise block (H = 2b),
 * Case B a block within a low-rise array; measurement points are at pedestrian height (z ≈ 0.125 H / 2 m full scale),
 * reported as the speed ratio U/U_ref at the same height in the undisturbed flow.
 *
 * Put the measured points in validation/data/<case>.json as [{ "x": m, "y": m, "ratio": number }] with the
 * block centred at the origin and wind blowing from −x (azimuth 270°); x, y in metres at the scale given by `scale`.
 * Run: pnpm --filter @saturn/analyses validate:aij
 *
 * Score: hit rate within ±30 % of measured ratio (the tolerance used in the AIJ guideline and by Spacio), plus the
 * mean bias. Without data files the harness prints the simulated ratios on the AIJ-style sampling lines so the
 * qualitative pattern (corner acceleration, upstream slow-down, wake) can be checked.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runLbm, DEFAULT_WIND } from "../src/wind";

const here = dirname(fileURLToPath(import.meta.url));
interface Point { x: number; y: number; ratio: number }

export function caseGeometry(id: "A" | "B", scale = 1) {
  // Case A: block b × b × 2b with b = 20 m (full-scale interpretation 1:1 of the 0.08 m model at 1:250 → 20 m)
  const b = 20 * scale;
  const blocks: Array<{ x0: number; y0: number; x1: number; y1: number }> = [{ x0: -b / 2, y0: -b / 2, x1: b / 2, y1: b / 2 }];
  if (id === "B") { for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (!(i === 0 && j === 0)) blocks.push({ x0: i * 2 * b - b / 2, y0: j * 2 * b - b / 2, x1: i * 2 * b + b / 2, y1: j * 2 * b + b / 2 }); }
  return { b, blocks };
}

export function runCase(id: "A" | "B", cell = 2, steps = 4000) {
  const { b, blocks } = caseGeometry(id);
  const half = id === "A" ? 8 * b : 9 * b; const nx = Math.ceil((2 * half) / cell), ny = nx; const minX = -half, minY = -half;
  const mask = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = minX + (i + 0.5) * cell, y = minY + (j + 0.5) * cell; if (blocks.some((k) => x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1)) mask[j * nx + i] = 1; }
  const r = runLbm(mask, nx, ny, 270, { ...DEFAULT_WIND, cell_m: cell, steps });
  const at = (x: number, y: number) => { const i = Math.floor((x - minX) / cell), j = Math.floor((y - minY) / cell); return r.speedRatio[j * nx + i] ?? -1; };
  return { at, b, nx, ny, cell };
}

export function score(sim: (x: number, y: number) => number, pts: Point[]) {
  let hits = 0, n = 0, bias = 0;
  for (const p of pts) { const s = sim(p.x, p.y); if (s < 0) continue; n++; bias += s - p.ratio; if (Math.abs(s - p.ratio) <= 0.3 * Math.max(0.05, p.ratio)) hits++; }
  return { n, hit_rate: n ? hits / n : 0, bias: n ? bias / n : 0 };
}

if (process.argv[1] && process.argv[1].endsWith("aij.ts")) {
  for (const id of ["A", "B"] as const) {
    const file = join(here, "data", `${id}.json`);
    const { at, b } = runCase(id);
    if (existsSync(file)) {
      const pts = JSON.parse(readFileSync(file, "utf8")) as Point[];
      const s = score(at, pts);
      console.log(`Case ${id}: ${s.n} points, hit rate within ±30 %: ${(100 * s.hit_rate).toFixed(0)} %, mean bias ${s.bias.toFixed(2)}`);
    } else {
      console.log(`Case ${id}: no measured data at ${file}. Simulated U/U_ref along y = 0 (upstream → wake) and along x = 0 (side):`);
      console.log("  y=0  :", [-3, -2, -1.5, -1, -0.75, 0.75, 1, 1.5, 2, 3, 4].map((k) => `${k}b=${at(k * b, 0).toFixed(2)}`).join(" "));
      console.log("  x=0  :", [0.75, 1, 1.5, 2, 3].map((k) => `${k}b=${at(0, k * b).toFixed(2)}`).join(" "));
      console.log("  corner (x=-0.5b, y=0.75b):", at(-0.5 * b, 0.75 * b).toFixed(2));
    }
  }
}

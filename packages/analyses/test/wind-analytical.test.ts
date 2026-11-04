import { describe, it, expect } from "vitest";
import { runLbm } from "../src";

/**
 * Quantitative validation of the lattice-Boltzmann kernel against closed-form solutions.
 * 1. Plane Poiseuille flow between two no-slip walls: u(y) = u_max (1 − (2y/H)²); the simulated profile must match
 *    within a few percent (L2 error) once converged.
 * 2. Potential-flow-like speed-up at the flanks of a bluff body: the inviscid limit is 2.0 for a cylinder; at the
 *    moderate Reynolds number of the solver we require a speed-up between 1.2 and 2.0 at the shoulder.
 */
describe("wind solver analytical validation", () => {
  it("Poiseuille profile within 5 % L2 error", () => {
    const nx = 60, ny = 42; const mask = new Uint8Array(nx * ny);
    for (let x = 0; x < nx; x++) { mask[x] = 1; mask[(ny - 1) * nx + x] = 1; } // walls at y = 0 and y = ny−1
    const r = runLbm(mask, nx, ny, 270, { cell_m: 1, steps: 6000, tau: 0.8, uIn: 0.05 });
    const xs = 45; const H = ny - 2; const prof: number[] = []; for (let y = 1; y < ny - 1; y++) prof.push(Math.hypot(r.ux[y * nx + xs]!, r.uy[y * nx + xs]!));
    const umax = Math.max(...prof); let num = 0, den = 0;
    prof.forEach((u, i) => { const yc = i + 0.5 - H / 2; const ua = umax * (1 - Math.pow((2 * yc) / H, 2)); num += (u - ua) ** 2; den += ua ** 2; });
    const l2 = Math.sqrt(num / den);
    expect(l2).toBeLessThan(0.05);
    // symmetry about the channel centre
    expect(Math.abs(prof[2]! - prof[prof.length - 3]!) / umax).toBeLessThan(0.05);
  }, 120000);
  it("flank speed-up around a square block lies between 1.2 and 2.0 of the free stream", () => {
    const nx = 120, ny = 90; const mask = new Uint8Array(nx * ny);
    for (let y = 37; y < 53; y++) for (let x = 50; x < 66; x++) mask[y * nx + x] = 1;
    const r = runLbm(mask, nx, ny, 270, { cell_m: 2, steps: 3500, tau: 0.56, uIn: 0.1 });
    const free = r.speedRatio[45 * nx + 10]!;
    let peak = 0; for (let y = 54; y < 62; y++) for (let x = 48; x < 70; x++) peak = Math.max(peak, r.speedRatio[y * nx + x]! / free);
    expect(peak).toBeGreaterThan(1.2); expect(peak).toBeLessThan(2.0);
  }, 120000);
});

import { describe, it, expect } from "vitest";
import { runLbm, combineDirections, lawsonClass } from "../src";

describe("wind LBM", () => {
  it("open field keeps speed ratio near 1 and stays stable", () => {
    const nx = 40, ny = 30; const mask = new Uint8Array(nx * ny);
    const r = runLbm(mask, nx, ny, 270, { cell_m: 3, steps: 600, tau: 0.56, uIn: 0.1 });
    const mid = r.speedRatio[15 * nx + 20]!;
    expect(mid).toBeGreaterThan(0.8); expect(mid).toBeLessThan(1.2);
    expect(Array.from(r.speedRatio).every((v) => Number.isFinite(v))).toBe(true);
  });
  it("a block creates a wake (slower) behind it and acceleration at its corners", () => {
    const nx = 80, ny = 60; const mask = new Uint8Array(nx * ny);
    for (let y = 22; y < 38; y++) for (let x = 30; x < 40; x++) mask[y * nx + x] = 1;
    const r = runLbm(mask, nx, ny, 270, { cell_m: 3, steps: 3000, tau: 0.56, uIn: 0.1 }); // wind from west → flows +x
    const wake = r.speedRatio[30 * nx + 44]!; const corner = r.speedRatio[42 * nx + 30]!; const upstream = r.speedRatio[30 * nx + 5]!;
    expect(wake).toBeLessThan(upstream * 0.8);
    expect(corner).toBeGreaterThan(upstream * 1.05);
    expect(r.speedRatio[30 * nx + 35]).toBe(-1);
  });
  it("combines directions with a rose and classifies Lawson", () => {
    const c = combineDirections([new Float32Array([1, -1]), new Float32Array([0.5, 0.5])], [0.5, 0.5]);
    expect(c[0]).toBeCloseTo(0.75); expect(c[1]).toBe(-1);
    expect(lawsonClass(3)).toBe(0); expect(lawsonClass(9)).toBe(3); expect(lawsonClass(12)).toBe(4);
  });
});

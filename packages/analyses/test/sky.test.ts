import { describe, it, expect } from "vitest";
import { tregenzaPatches, vsc } from "../src";

describe("sky patches and VSC", () => {
  const patches = tregenzaPatches();
  it("has 145 patches covering ~2π sr", () => {
    expect(patches.length).toBe(145);
    const total = patches.reduce((a, p) => a + p.solid_angle, 0);
    expect(total).toBeCloseTo(2 * Math.PI, 1);
  });
  it("unobstructed vertical surface gives VSC ≈ 39–40 %, horizontal 100 %", () => {
    const all = new Uint8Array(patches.length).fill(1);
    const v = vsc([0, 1, 0], patches, all);
    expect(v).toBeGreaterThan(38); expect(v).toBeLessThan(41);
    expect(vsc([0, 0, 1], patches, all)).toBeCloseTo(100, 5);
  });
  it("blocking the lower half of the sky reduces VSC", () => {
    const vis = new Uint8Array(patches.length).map((_, i) => (patches[i]!.altitude_deg > 30 ? 1 : 0));
    expect(vsc([0, 1, 0], patches, vis)).toBeLessThan(25);
  });
});

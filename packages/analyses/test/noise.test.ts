import { describe, it, expect } from "vitest";
import { rls90Emission, maekawa, screening, computeNoise } from "../src";

describe("traffic noise", () => {
  it("RLS-90 emission increases with flow and heavy share", () => {
    const a = rls90Emission(600, 5, 50, 50), b = rls90Emission(1200, 5, 50, 50), c = rls90Emission(600, 20, 50, 50);
    expect(b - a).toBeCloseTo(3.01, 1);
    expect(c).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(55); expect(a).toBeLessThan(75);
  });
  it("Maekawa attenuation grows with path difference and caps at 20", () => {
    expect(maekawa(0)).toBe(0); expect(maekawa(0.5)).toBeGreaterThan(10); expect(maekawa(50)).toBe(20);
  });
  it("a tall building between source and receiver screens, a low one does not", () => {
    const blk = [{ ring: [[4, -5], [6, -5], [6, 5], [4, 5]] as Array<[number, number]>, height: 12 }];
    expect(screening([0, 0, 0.5], [10, 0, 1.5], blk)).toBeGreaterThan(8);
    expect(screening([0, 0, 0.5], [10, 0, 1.5], [{ ...blk[0]!, height: 0.8 }])).toBe(0);
  });
  it("level falls ~3 dB per doubling of distance from a long straight road", () => {
    const road = { id: "r", pts: [[-500, 0], [500, 0]] as Array<[number, number]>, aadt: 10000, heavy_pct: 8, speed_kmh: 50 };
    const r = computeNoise([road], [{ p: [0, 25, 1.5], facade: false }, { p: [0, 50, 1.5], facade: false }, { p: [0, 100, 1.5], facade: false }], []);
    expect(r.lden[0]! - r.lden[1]!).toBeGreaterThan(2.5); expect(r.lden[0]! - r.lden[1]!).toBeLessThan(4);
    expect(r.lden[0]).toBeGreaterThan(55); expect(r.lden[0]).toBeLessThan(75);
    expect(r.lnight[0]).toBeLessThan(r.lden[0]!);
  });
  it("façade behind a building is quieter", () => {
    const road = { id: "r", pts: [[-500, 0], [500, 0]] as Array<[number, number]>, aadt: 10000, heavy_pct: 8, speed_kmh: 50 };
    const bld = { ring: [[-20, 20], [20, 20], [20, 34], [-20, 34]] as Array<[number, number]>, height: 18 };
    const r = computeNoise([road], [{ p: [0, 19.5, 4], n: [0, -1, 0], facade: true }, { p: [0, 34.5, 4], n: [0, 1, 0], facade: true }], [bld]);
    expect(r.lden[0]! - r.lden[1]!).toBeGreaterThan(10);
  });
});

import { describe, it, expect } from "vitest";
import { stormwater, averageDaylightFactor, skyAngleFromVsc } from "../src";

describe("stormwater", () => {
  it("roofs and paving are impervious; detention grows with intensity", () => {
    const r = stormwater([{ type: "roof", area_m2: 1000 }, { type: "paved", area_m2: 500 }, { type: "green", area_m2: 500 }], 120, 15, 20);
    expect(r.impervious_pct).toBeCloseTo(75);
    expect(r.weighted_c).toBeCloseTo((0.95 * 1000 + 0.9 * 500 + 0.25 * 500) / 2000, 6);
    const r2 = stormwater([{ type: "roof", area_m2: 1000 }, { type: "paved", area_m2: 500 }, { type: "green", area_m2: 500 }], 200, 15, 20);
    expect(r2.detention_m3).toBeGreaterThan(r.detention_m3);
    expect(r.peak_runoff_m3_s).toBeCloseTo(((0.95 * 1000 + 0.9 * 500 + 0.25 * 500) / 2000) * (120 / 1000 / 3600) * 2000, 6);
  });
});
describe("daylight factor", () => {
  it("typical room gives ~2 % DF", () => {
    // 4×5 m room, 2.7 m high: surfaces = 2·20 + 2·(4+5)·2.7 = 88.6; window 3 m², θ = 65°
    const df = averageDaylightFactor(3, 65, 88.6, 0.6, 0.5);
    expect(df).toBeGreaterThan(1.3); expect(df).toBeLessThan(2.2);
    expect(skyAngleFromVsc(39.6)).toBeCloseTo(90); expect(skyAngleFromVsc(20)).toBeCloseTo(45.45, 1);
  });
});

import { describe, it, expect } from "vitest";
import { sunPosition, sunVectorsForDay } from "../src";

describe("solar position", () => {
  it("Bangkok, equinox solar noon: sun nearly overhead, slightly south", () => {
    // 2026-03-20 ~05:17 UTC is solar noon at lon 100.5 (noon local 12:00 ICT ≈ 05:00 UTC; eq. of time ≈ -7 min)
    const p = sunPosition(new Date(Date.UTC(2026, 2, 20, 5, 25, 0)), 13.7563, 100.5018);
    expect(p.altitude_deg).toBeGreaterThan(75);
    expect(p.altitude_deg).toBeLessThan(77.5);
    expect(p.azimuth_deg).toBeGreaterThan(165);
    expect(p.azimuth_deg).toBeLessThan(195);
  });
  it("Oslo, winter solstice noon: low sun in the south", () => {
    const p = sunPosition(new Date(Date.UTC(2026, 11, 21, 11, 20, 0)), 59.91, 10.75);
    expect(p.altitude_deg).toBeGreaterThan(6);
    expect(p.altitude_deg).toBeLessThan(8);
    expect(Math.abs(p.azimuth_deg - 180)).toBeLessThan(10);
  });
  it("morning sun is in the east, vector points up", () => {
    const p = sunPosition(new Date(Date.UTC(2026, 5, 21, 1, 0, 0)), 13.75, 100.5); // 08:00 ICT
    expect(p.azimuth_deg).toBeGreaterThan(50);
    expect(p.azimuth_deg).toBeLessThan(90);
    expect(p.vector[0]).toBeGreaterThan(0); // east
    expect(p.vector[2]).toBeGreaterThan(0);
  });
  it("day sampling gives ~12 h of sun at the equator-ish site", () => {
    const v = sunVectorsForDay("2026-03-20", 13.75, 100.5, 15);
    expect(v.length * 0.25).toBeGreaterThan(11.5);
    expect(v.length * 0.25).toBeLessThan(12.8);
  });
});

import { describe, it, expect } from "vitest";
import { syntheticClimate, simulateThermal, DEFAULT_THERMAL, comfortBand, parseEpw } from "../src";

describe("comfort & energy", () => {
  it("synthetic climate has 8760 hours and plausible ranges", () => {
    const c = syntheticClimate(13.75); expect(c.t_out.length).toBe(8760);
    const mean = c.t_out.reduce((a, b) => a + b, 0) / 8760; expect(mean).toBeGreaterThan(18); expect(mean).toBeLessThan(30);
    expect(Math.max(...c.ghi)).toBeGreaterThan(700); expect(Math.min(...c.ghi)).toBe(0);
  });
  it("tropical climate needs cooling, cold climate needs heating", () => {
    const hot = simulateThermal(syntheticClimate(13.75), DEFAULT_THERMAL); const cold = simulateThermal(syntheticClimate(60), DEFAULT_THERMAL);
    expect(hot.cooling_kwh_m2).toBeGreaterThan(hot.heating_kwh_m2);
    expect(cold.heating_kwh_m2).toBeGreaterThan(cold.cooling_kwh_m2);
    expect(hot.comfort_pct).toBeGreaterThan(0); expect(hot.comfort_pct).toBeLessThanOrEqual(100);
    expect(hot.free_t.every((t) => Number.isFinite(t) && t > -20 && t < 60)).toBe(true);
  });
  it("more glazing in a hot climate increases cooling", () => {
    const a = simulateThermal(syntheticClimate(13.75), { ...DEFAULT_THERMAL, glazing_ratio: 0.2 }); const b = simulateThermal(syntheticClimate(13.75), { ...DEFAULT_THERMAL, glazing_ratio: 0.6 });
    expect(b.cooling_kwh_m2).toBeGreaterThan(a.cooling_kwh_m2);
  });
  it("comfort band and EPW parsing", () => {
    expect(comfortBand(20)[0]).toBeCloseTo(22.4); expect(comfortBand(20)[1]).toBeCloseTo(28.4);
    const rows = Array.from({ length: 8760 }, (_, h) => `2020,${1 + Math.floor(h / 744) % 12},1,${(h % 24) + 1},0,A,25.0,20,70,101325,0,0,350,${h % 24 > 6 && h % 24 < 18 ? 600 : 0},500,200,0,0,0,0,180,3.0,0,0,10,77777,9,999999999,0,0,0,0,0,0,0`);
    const epw = parseEpw(["LOCATION,Test,,,,,,13.75,100.5,7,10", "DESIGN CONDITIONS,0", "TYPICAL/EXTREME PERIODS,0", "GROUND TEMPERATURES,0", "HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0", "COMMENTS 1", "COMMENTS 2", "DATA PERIODS,1,1,Data,Sunday, 1/ 1,12/31", ...rows].join("\n"));
    expect(epw.t_out.length).toBe(8760); expect(epw.t_out[0]).toBe(25); expect(epw.wind[0]).toBe(3);
  });
});

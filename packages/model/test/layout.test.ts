import { describe, it, expect } from "vitest";
import { layoutStorey, DEFAULT_LAYOUT, optimiseLayout, applyLayoutToBuilding, makeBuilding, planBasement, computeKpis, sampleProject } from "../src";
import { rectRing, ringArea } from "@saturn/geometry";

describe("unit layout", () => {
  it("double-loaded bar 60x16 yields units on both sides with cores", () => {
    const r = layoutStorey(rectRing(0, 0, 60, 16), DEFAULT_LAYOUT, "t");
    expect(r.count).toBeGreaterThan(10);
    expect(r.cores.length).toBe(2);
    expect(r.corridor).toBeDefined();
    expect(r.efficiency).toBeGreaterThan(0.7);
    expect(r.deviation).toBeLessThan(0.2);
    // all units inside the footprint
    for (const u of r.units) { for (const [x, y] of u.polygon) { expect(Math.abs(x)).toBeLessThanOrEqual(30.01); expect(Math.abs(y)).toBeLessThanOrEqual(8.01); } }
  });
  it("single-loaded on a 40x11 bar", () => {
    const r = layoutStorey(rectRing(0, 0, 40, 11), DEFAULT_LAYOUT, "t");
    expect(r.corridor).toBeUndefined();
    expect(r.count).toBeGreaterThanOrEqual(4);
  });
  it("rotated footprint is handled", () => {
    const fp = rectRing(0, 0, 50, 15, Math.PI / 6);
    const r = layoutStorey(fp, DEFAULT_LAYOUT, "t");
    expect(r.count).toBeGreaterThan(8);
    const area = r.units.reduce((a, u) => a + ringArea(u.polygon), 0);
    expect(area).toBeLessThan(ringArea(fp));
  });
  it("optimiser never does worse than default", () => {
    const fp = rectRing(0, 0, 60, 16);
    const base = layoutStorey(fp, DEFAULT_LAYOUT, "t");
    const o = optimiseLayout(fp, DEFAULT_LAYOUT);
    expect(o.result.count).toBeGreaterThanOrEqual(base.count - 1);
  });
  it("applies to a building and KPIs count drawn units", () => {
    const b = makeBuilding("b", "B", rectRing(0, 0, 60, 16), 5);
    const { building, summary } = applyLayoutToBuilding(b, DEFAULT_LAYOUT);
    expect(summary.count).toBeGreaterThan(50);
    const p = sampleProject(); p.options[0]!.buildings = [building];
    const k = computeKpis(p.options[0]!, p.site, p.settings);
    expect(k.unit_count).toBe(summary.count);
    expect(Object.keys(k.unit_mix).length).toBeGreaterThan(1);
  });
});

describe("parking", () => {
  it("basement levels scale with demand", () => {
    const b = makeBuilding("b", "B", rectRing(0, 0, 40, 16), 5);
    const p1 = planBasement(b, 10); const p2 = planBasement(b, 60);
    expect(p1.levels).toBe(1); expect(p2.levels).toBeGreaterThan(p1.levels); expect(p2.stalls).toBeGreaterThanOrEqual(60);
  });
});

import { describe, it, expect } from "vitest";
import { computeKpis, evaluate, evaluateRules, GENERIC_PACK, sampleProject, parseProject, makeBuilding } from "../src";
import { rectRing } from "@saturn/geometry";

describe("schema", () => {
  it("parses the sample project", () => {
    const p = parseProject(sampleProject());
    expect(p.options[0]!.buildings.length).toBe(2);
  });
});

describe("expr", () => {
  it("evaluates arithmetic and comparisons", () => {
    expect(evaluate("1 + 2 * 3", {})).toBe(7);
    expect(evaluate("kpi.far <= zoning.far_max", { kpi: { far: 2 }, zoning: { far_max: 2.5 } })).toBe(true);
    expect(evaluate("!(a > 1) && b == 2 || false", { a: 0, b: 2 })).toBe(true);
    expect(evaluate("max(1, min(5, 3)) + abs(-2)", {})).toBe(5);
  });
  it("blocks prototype access", () => {
    expect(evaluate("a.constructor", { a: {} })).toBeUndefined();
    expect(evaluate("a.__proto__", { a: {} })).toBeUndefined();
  });
});

describe("kpis", () => {
  it("computes areas for the sample project", () => {
    const p = sampleProject();
    const k = computeKpis(p.options[0]!, p.site, p.settings);
    expect(k.parcel_area_m2).toBeCloseTo(4800);
    // bar 40x14=560 x6 = 3360 ; point 16x16=256 x7 = 1792
    expect(k.gfa_m2).toBeCloseTo(5152, 3);
    expect(k.footprint_area_m2).toBeCloseTo(816, 3);
    expect(k.coverage_pct).toBeCloseTo(17, 3);
    expect(k.far).toBeCloseTo(5152 / 4800, 6);
    expect(k.max_height_m).toBeCloseTo(22.4, 6);
    expect(k.max_storeys).toBe(7);
    // units: residential NIA = 5152*0.82 = 4224.64 / 70 = 60
    expect(k.unit_count).toBe(60);
    expect(k.parking_required).toBe(60);
  });
  it("merges overlapping footprints", () => {
    const p = sampleProject();
    p.options[0]!.buildings = [makeBuilding("a", "A", rectRing(0, 0, 10, 10), 1), makeBuilding("b", "B", rectRing(5, 0, 10, 10), 1)];
    const k = computeKpis(p.options[0]!, p.site, p.settings);
    expect(k.footprint_area_m2).toBeCloseTo(150, 3);
    expect(k.gfa_m2).toBeCloseTo(200, 3);
  });
});

describe("rules", () => {
  it("passes a compliant scheme except parking", () => {
    const p = sampleProject();
    const r = evaluateRules(GENERIC_PACK, p.options[0]!, p.site, p.settings);
    const ids = r.findings.map((f) => f.rule_id);
    expect(ids).toContain("parking.required");
    expect(r.errors).toBe(0);
  });
  it("flags height, storeys, setback, FAR", () => {
    const p = sampleProject();
    p.site.zoning.max_height_m = 10;
    p.site.zoning.max_storeys = 3;
    p.site.zoning.far_max = 0.5;
    p.options[0]!.buildings.push(makeBuilding("b3", "Edge", rectRing(37, 0, 10, 10), 2)); // crosses setback (parcel edge at x=40, setback 6)
    const r = evaluateRules(GENERIC_PACK, p.options[0]!, p.site, p.settings);
    const ids = new Set(r.findings.map((f) => f.rule_id));
    expect(ids.has("height.max")).toBe(true);
    expect(ids.has("storeys.max")).toBe(true);
    expect(ids.has("far.max")).toBe(true);
    const sb = r.findings.find((f) => f.rule_id === "setback");
    expect(sb?.building_id).toBe("b3");
    expect(sb?.message).toMatch(/Edge crosses the setback line/);
    expect(r.envelope.length).toBe(1);
  });
});

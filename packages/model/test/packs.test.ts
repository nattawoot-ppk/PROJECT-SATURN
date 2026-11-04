import { describe, it, expect } from "vitest";
import { evaluateRules, NORWAY_PACK, THAILAND_PACK, sampleProject, makeBuilding } from "../src";
import { rectRing } from "@saturn/geometry";

describe("Norway pack", () => {
  it("applies plan-silent defaults (9 m height, 4 m boundary) and flags a 7-storey block", () => {
    const p = sampleProject(); p.site.zoning = { source: "manual", setbacks: [], default_setback_m: 0, custom: {} } as typeof p.site.zoning;
    const r = evaluateRules(NORWAY_PACK, p.options[0]!, p.site, p.settings);
    const ids = new Set(r.findings.map((f) => f.rule_id));
    expect(ids.has("no.gesims")).toBe(true);
    expect(r.findings.find((f) => f.rule_id === "no.gesims")?.message).toMatch(/limit 9 m/);
    expect(r.envelope.length).toBe(1); // 4 m default setback envelope
  });
});

describe("Thailand pack", () => {
  it("2× road width height rule and EIA threshold", () => {
    const p = sampleProject(); p.site.zoning.max_height_m = undefined; p.site.zoning.custom = { road_width_m: 6, front_setback_m: 3 };
    p.options[0]!.buildings = [makeBuilding("t", "Tower", rectRing(0, 0, 30, 30), 10)]; // 32 m > 2×(6+3)=18
    const r = evaluateRules(THAILAND_PACK, p.options[0]!, p.site, p.settings);
    const ids = new Set(r.findings.map((f) => f.rule_id));
    expect(ids.has("th.height_road")).toBe(true);
    expect(ids.has("th.highrise_road")).toBe(true); // > 23 m needs ≥ 10 m road
  });
  it("passes a modest block on a wide road and reports EIA for large schemes", () => {
    const p = sampleProject(); p.site.zoning.custom = { road_width_m: 16, front_setback_m: 6 };
    const r = evaluateRules(THAILAND_PACK, p.options[0]!, p.site, p.settings);
    expect(r.errors).toBe(0);
    expect(r.findings.some((f) => f.rule_id === "th.large_building")).toBe(true);
    p.options[0]!.buildings[0]!.storeys = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, level: i, height_m: 3.2, use: "residential" as const, units: [], cores: [] }));
    p.settings.avg_unit_area_m2 = 40; // → > 80 units
    const r2 = evaluateRules(THAILAND_PACK, p.options[0]!, p.site, p.settings);
    expect(r2.findings.some((f) => f.rule_id === "th.eia")).toBe(true);
  });
});

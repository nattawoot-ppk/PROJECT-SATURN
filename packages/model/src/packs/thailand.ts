import type { RulePack } from "../rules";

/**
 * Thailand (Bangkok) pack: Building Control Act B.E. 2522 and Ministerial Regulation No. 55 (B.E. 2543), with FAR/OSR
 * from the Bangkok Comprehensive Plan entered per zone. Road width and front setback are entered in zoning.custom.
 * Early-stage guidance; verify with the local authority (สำนักการโยธา / เทศบาล).
 */
export const THAILAND_PACK: RulePack = {
  id: "th-bangkok",
  name: "Thailand · Bangkok (กฎกระทรวง ฉบับที่ 55)",
  version: "0.1.0",
  jurisdiction: "TH-BKK",
  description: "FAR/OSR by comprehensive-plan zone, 2× road-width height rule, large and high-rise building setbacks, road access, open space, window distances, parking and EIA thresholds.",
  defaults: { osr_pct_min: 0, custom: { road_width_m: 12, front_setback_m: 6 } },
  rules: [
    { id: "th.far", title: "FAR (อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน)", severity: "error", when: "zoning.far_max > 0 && kpi.parcel_area_m2 > 0", expr: "kpi.far <= zoning.far_max + 0.0001", message: "FAR is {kpi.far}; the comprehensive-plan zone {zoning.zone_code} allows {zoning.far_max}.", reference: "ผังเมืองรวมกรุงเทพมหานคร" },
    { id: "th.osr", title: "OSR (อัตราส่วนพื้นที่ว่างต่อพื้นที่อาคารรวม)", severity: "error", when: "zoning.osr_pct_min > 0 && kpi.gfa_m2 > 0", expr: "kpi.osr_pct >= zoning.osr_pct_min - 0.01", message: "OSR is {kpi.osr_pct} %; the zone requires at least {zoning.osr_pct_min} %.", reference: "ผังเมืองรวมกรุงเทพมหานคร" },
    { id: "th.open_space", title: "ที่ว่าง ≥ 30 % (อาคารอยู่อาศัย)", severity: "error", when: "kpi.parcel_area_m2 > 0", expr: "kpi.coverage_pct <= 70.01", message: "Coverage is {kpi.coverage_pct} %; residential buildings must keep ≥ 30 % of the plot as open space (≥ 10 % for other uses).", reference: "กฎกระทรวง ฉบับที่ 55 ข้อ 33" },
    { id: "th.height_road", title: "ความสูง ≤ 2 × (ความกว้างถนน + ระยะร่น)", severity: "error", scope: "building", when: "zoning.custom.road_width_m > 0", expr: "building.height_m <= 2 * (zoning.custom.road_width_m + zoning.custom.front_setback_m) + 0.001", message: "{building.name} is {building.height_m} m; with a {zoning.custom.road_width_m} m road and {zoning.custom.front_setback_m} m front setback the limit is 2 × ({zoning.custom.road_width_m} + {zoning.custom.front_setback_m}) m.", autofix: "clamp_height", reference: "กฎกระทรวง ฉบับที่ 55 ข้อ 44" },
    { id: "th.highrise_road", title: "อาคารสูง/ใหญ่พิเศษ ต้องติดถนนกว้าง ≥ 10 / 18 m", severity: "error", scope: "building", when: "building.height_m > 23 || building.gfa_m2 >= 10000", expr: "(building.gfa_m2 >= 30000 && zoning.custom.road_width_m >= 18) || (building.gfa_m2 < 30000 && zoning.custom.road_width_m >= 10)", message: "{building.name} is a high-rise (>23 m) or extra-large building; it must front a public road ≥ 10 m wide (≥ 18 m when GFA ≥ 30,000 m²). Road entered: {zoning.custom.road_width_m} m.", reference: "กฎกระทรวง ฉบับที่ 33 ข้อ 2" },
    { id: "th.highrise_setback", title: "อาคารสูง/ใหญ่พิเศษ ระยะร่น 6 m รอบอาคาร", severity: "warning", scope: "building", when: "building.height_m > 23 || building.gfa_m2 >= 10000", expr: "zoning.default_setback_m >= 6", message: "{building.name} is high-rise or extra-large: keep ≥ 6 m clear to every plot boundary (fire access road ≥ 6 m). Default setback entered: {zoning.default_setback_m} m.", reference: "กฎกระทรวง ฉบับที่ 33 ข้อ 4" },
    { id: "th.setback", title: "แนวอาคารร่นจากเขตที่ดิน", severity: "error", builtin: "setback", message: "{building.name} crosses the setback line on edge {edge} ({actual} m, required {limit} m).", autofix: "trim_to_envelope" },
    { id: "th.window_distance", title: "ระยะผนังมีช่องเปิดถึงเขตที่ดิน", severity: "info", scope: "building", expr: "(building.height_m <= 9 && zoning.default_setback_m >= 2) || (building.height_m > 9 && building.height_m <= 23 && zoning.default_setback_m >= 3) || building.height_m > 23", message: "Walls with windows need ≥ 2 m to the boundary for buildings ≤ 9 m and ≥ 3 m for 9–23 m; {building.name} is {building.height_m} m with a {zoning.default_setback_m} m setback.", reference: "กฎกระทรวง ฉบับที่ 55 ข้อ 50" },
    { id: "th.parking", title: "ที่จอดรถ", severity: "warning", builtin: "parking_required", message: "{kpi.parking_stalls} stalls provided; {kpi.parking_required} required (Bangkok: 1 per 120 m² of unit floor area for condominiums, set the ratio in Zoning)." },
    { id: "th.eia", title: "EIA (รายงานผลกระทบสิ่งแวดล้อม)", severity: "info", when: "kpi.unit_count >= 80 || kpi.gfa_m2 >= 4000", expr: "false", message: "{kpi.unit_count} units / {kpi.gfa_m2} m² GFA: a condominium with ≥ 80 units or ≥ 4,000 m² needs an EIA before the building permit.", reference: "ประกาศกระทรวงทรัพยากรธรรมชาติฯ" },
    { id: "th.large_building", title: "อาคารขนาดใหญ่", severity: "info", scope: "building", when: "building.gfa_m2 >= 2000 || building.height_m >= 15", expr: "false", message: "{building.name} ({building.gfa_m2} m², {building.height_m} m) is a large building: fire-safety and structural engineer sign-off apply.", reference: "กฎกระทรวง ฉบับที่ 55" },
    { id: "th.use", title: "ประเภทการใช้ที่ดิน", severity: "error", builtin: "allowed_use", message: "{building.name} contains '{use}', not permitted in zone {zoning.zone_code}." },
  ],
};

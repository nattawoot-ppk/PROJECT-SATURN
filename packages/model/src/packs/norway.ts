import type { RulePack } from "../rules";

/**
 * Norway reference pack (plan- og bygningsloven, TEK17, grad-av-utnytting veileder). Parameters: %-BYA as coverage,
 * %-BRA as FAR×100, heights as gesims/møne. Defaults apply when the local plan is silent (pbl § 29-4).
 */
export const NORWAY_PACK: RulePack = {
  id: "no-reference",
  name: "Norway reference (pbl / TEK17)",
  version: "0.1.0",
  jurisdiction: "NO",
  description: "%-BYA, %-BRA, gesims/møne heights, 4 m boundary distance, TEK17 room height and daylight, parking from the local plan. Verify against the applicable reguleringsplan.",
  defaults: { default_setback_m: 4, max_height_m: 9, daylight_factor_min_pct: 2, min_unit_area_m2: 30 },
  rules: [
    { id: "no.bya", title: "%-BYA (bebygd areal)", severity: "error", when: "zoning.coverage_pct_max > 0 && kpi.parcel_area_m2 > 0", expr: "kpi.coverage_pct <= zoning.coverage_pct_max + 0.01", message: "Coverage is {kpi.coverage_pct} %-BYA; the plan allows {zoning.coverage_pct_max} %-BYA (parking counted at 18 m² per stall in the veileder).", reference: "Veileder grad av utnytting T-1459" },
    { id: "no.bra", title: "%-BRA (bruksareal)", severity: "error", when: "zoning.far_max > 0 && kpi.parcel_area_m2 > 0", expr: "kpi.far <= zoning.far_max + 0.0001", message: "%-BRA is {kpi.far} × 100; the plan allows {zoning.far_max} × 100.", reference: "NS 3940" },
    { id: "no.gesims", title: "Gesims-/mønehøyde", severity: "error", scope: "building", when: "zoning.max_height_m > 0", expr: "building.height_m <= zoning.max_height_m + 0.001", message: "{building.name} is {building.height_m} m; limit {zoning.max_height_m} m (pbl § 29-4 default gesims 8 m / møne 9 m when the plan is silent).", autofix: "clamp_height", reference: "pbl § 29-4" },
    { id: "no.boundary", title: "Avstand til nabogrense (4 m)", severity: "error", builtin: "setback", message: "{building.name} is {actual} m from parcel edge {edge}; pbl § 29-4 requires {limit} m unless the plan or the neighbour allows otherwise.", autofix: "trim_to_envelope", reference: "pbl § 29-4" },
    { id: "no.storey_height", title: "TEK17 romhøyde", severity: "warning", scope: "building", expr: "building.height_m / building.storeys >= 2.7", message: "{building.name} averages {building.height_m} m / {building.storeys} storeys; TEK17 § 12-7 needs 2.4 m clear height, so plan ≥ 2.7 m storey height for slabs.", reference: "TEK17 § 12-7" },
    { id: "no.daylight", title: "TEK17 dagslys", severity: "info", when: "zoning.daylight_factor_min_pct > 0", expr: "false", message: "Rooms for lasting stay need daylight: average DF ≥ {zoning.daylight_factor_min_pct} % or glass area ≥ 10 % of floor area (TEK17 § 13-7). Run Daylight VSC and the Performance panel to check per unit." },
    { id: "no.parking", title: "Parkeringskrav", severity: "warning", builtin: "parking_required", message: "{kpi.parking_stalls} stalls provided; the plan's norm gives {kpi.parking_required}." },
    { id: "no.unit_min", title: "Minste boenhet", severity: "warning", builtin: "min_unit_area", message: "Unit {unit} is {actual} m²; municipal norms (e.g. Oslo 35 m²) typically require {limit} m²." },
    { id: "no.use", title: "Arealformål", severity: "error", builtin: "allowed_use", message: "{building.name} contains '{use}', not permitted under the plan's arealformål {zoning.zone_code}." },
  ],
};

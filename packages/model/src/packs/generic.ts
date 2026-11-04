import type { RulePack } from "../rules";

/** Generic international pack: works anywhere with manually entered zoning parameters. */
export const GENERIC_PACK: RulePack = {
  id: "generic-international",
  name: "Generic international",
  version: "0.1.0",
  jurisdiction: "generic",
  description: "Height, storeys, setbacks, FAR, coverage, open-space ratio, use, parking and minimum unit size from user-entered zoning parameters.",
  rules: [
    { id: "height.max", title: "Maximum building height", severity: "error", scope: "building", when: "zoning.max_height_m > 0",
      expr: "building.height_m <= zoning.max_height_m + 0.001", message: "{building.name} is {building.height_m} m; limit is {zoning.max_height_m} m.", autofix: "clamp_height" },
    { id: "storeys.max", title: "Maximum storeys", severity: "error", scope: "building", when: "zoning.max_storeys > 0",
      expr: "building.storeys <= zoning.max_storeys", message: "{building.name} has {building.storeys} storeys; limit is {zoning.max_storeys}.", autofix: "clamp_storeys" },
    { id: "setback", title: "Setbacks", severity: "error", builtin: "setback",
      message: "{building.name} crosses the setback line on parcel edge {edge} ({actual} m, required {limit} m).", autofix: "trim_to_envelope" },
    { id: "far.max", title: "Floor area ratio", severity: "error", when: "zoning.far_max > 0 && kpi.parcel_area_m2 > 0",
      expr: "kpi.far <= zoning.far_max + 0.0001", message: "FAR is {kpi.far}; limit is {zoning.far_max}." },
    { id: "coverage.max", title: "Site coverage", severity: "error", when: "zoning.coverage_pct_max > 0 && kpi.parcel_area_m2 > 0",
      expr: "kpi.coverage_pct <= zoning.coverage_pct_max + 0.01", message: "Coverage is {kpi.coverage_pct} %; limit is {zoning.coverage_pct_max} %." },
    { id: "osr.min", title: "Open space ratio", severity: "error", when: "zoning.osr_pct_min > 0 && kpi.gfa_m2 > 0",
      expr: "kpi.osr_pct >= zoning.osr_pct_min - 0.01", message: "OSR is {kpi.osr_pct} %; minimum is {zoning.osr_pct_min} %." },
    { id: "use.allowed", title: "Allowed uses", severity: "error", builtin: "allowed_use", message: "{building.name} contains use '{use}' which is not allowed in zone {zoning.zone_code}." },
    { id: "parking.required", title: "Parking provision", severity: "warning", builtin: "parking_required", scope: "site",
      message: "{kpi.parking_stalls} stalls provided; {kpi.parking_required} required." },
    { id: "unit.min_area", title: "Minimum unit area", severity: "warning", builtin: "min_unit_area", message: "Unit {unit} is {actual} m²; minimum is {limit} m²." },
    { id: "parcel.missing", title: "No parcel defined", severity: "info", when: "!site.has_parcel", expr: "false", message: "Draw or import a parcel to enable coverage, FAR and setback checks." },
    { id: "compactness", title: "Envelope compactness", severity: "info", when: "kpi.gfa_m2 > 0",
      expr: "kpi.envelope_ratio <= 1.2", message: "Façade / GFA is {kpi.envelope_ratio}; above 1.2 suggests an inefficient envelope." },
  ],
};

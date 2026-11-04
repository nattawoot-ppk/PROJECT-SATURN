import * as XLSX from "xlsx";
import { computeKpis, evaluateRules, getRulePack, KPI_DEFS, kpiValue, buildingHeight, type Project } from "@saturn/model";
import { ringArea } from "@saturn/geometry";

export function exportExcel(project: Project): Blob {
  const wb = XLSX.utils.book_new();
  const pack = getRulePack(project.settings.rule_pack_id);
  const kpiRows: unknown[][] = [["KPI", "Unit", ...project.options.map((o) => o.name)]];
  const perOpt = project.options.map((o) => computeKpis(o, project.site, project.settings));
  for (const d of KPI_DEFS) kpiRows.push([d.label, d.unit, ...perOpt.map((k) => Math.round(kpiValue(k, d.id) * 100) / 100)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), "KPIs");

  const bRows: unknown[][] = [["Option", "Building", "Category", "Tags", "Footprint m²", "Storeys", "Height m", "GFA m²", "NIA m²"]];
  const sRows: unknown[][] = [["Option", "Building", "Level", "Use", "Height m", "Area m²"]];
  for (const o of project.options) for (const b of o.buildings) {
    const gfa = b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0);
    bRows.push([o.name, b.name, b.category, b.tags.join(", "), Math.round(ringArea(b.footprint)), b.storeys.length, +buildingHeight(b).toFixed(2), Math.round(gfa), Math.round(gfa * b.efficiency)]);
    for (const s of b.storeys) sRows.push([o.name, b.name, s.level + 1, s.use, s.height_m, Math.round(ringArea(s.footprint ?? b.footprint))]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), "Buildings");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sRows), "Storeys");

  const cRows: unknown[][] = [["Option", "Severity", "Rule", "Building", "Message"]];
  project.options.forEach((o, i) => { for (const f of evaluateRules(pack, o, project.site, project.settings, perOpt[i]).findings) cRows.push([o.name, f.severity, f.title, o.buildings.find((b) => b.id === f.building_id)?.name ?? "", f.message]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), "Compliance");

  const z = project.site.zoning;
  const zRows: unknown[][] = [["Parameter", "Value"], ["Rule pack", `${pack.name} ${pack.version}`], ["Zone", z.zone_code ?? ""], ["Max height m", z.max_height_m ?? ""], ["Max storeys", z.max_storeys ?? ""], ["FAR max", z.far_max ?? ""], ["Coverage % max", z.coverage_pct_max ?? ""], ["OSR % min", z.osr_pct_min ?? ""], ["Default setback m", z.default_setback_m], ["Parking per unit", z.parking_per_unit ?? ""], ["Origin", `${project.site.origin.lat}, ${project.site.origin.lon}`]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zRows), "Zoning");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

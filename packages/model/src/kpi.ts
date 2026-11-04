import { ringArea, unionAll, polygonArea, perimeter } from "@saturn/geometry";
import type { Building, DesignOption, Site, ProjectSettings, UseClass, Storey } from "./schema";

export interface KpiDef { id: string; label: string; unit: string; description: string }

export const KPI_DEFS: KpiDef[] = [
  { id: "parcel_area_m2", label: "Parcel area", unit: "m²", description: "Area of the site parcel polygon" },
  { id: "footprint_area_m2", label: "Footprint", unit: "m²", description: "Union of all building ground footprints" },
  { id: "coverage_pct", label: "Site coverage", unit: "%", description: "Footprint / parcel area (BYA %)" },
  { id: "gfa_m2", label: "GFA", unit: "m²", description: "Gross floor area, sum of storey areas incl. above-ground parking" },
  { id: "gia_m2", label: "NIA / GIA", unit: "m²", description: "Net internal area: drawn units or GFA × efficiency" },
  { id: "far", label: "FAR", unit: "×", description: "GFA / parcel area (plot ratio, %-BRA/100)" },
  { id: "osr_pct", label: "Open space ratio", unit: "%", description: "(parcel − footprint) / GFA × 100 (Thai OSR definition)" },
  { id: "max_height_m", label: "Max height", unit: "m", description: "Tallest building incl. roof" },
  { id: "max_storeys", label: "Max storeys", unit: "", description: "Most storeys in any building" },
  { id: "building_count", label: "Buildings", unit: "", description: "Number of design buildings" },
  { id: "unit_count", label: "Units", unit: "", description: "Drawn units, or estimated from residential NIA / avg unit area" },
  { id: "avg_unit_area_m2", label: "Avg unit area", unit: "m²", description: "Residential NIA / unit count" },
  { id: "residents_est", label: "Residents (est.)", unit: "", description: "Units × residents per unit" },
  { id: "parking_stalls", label: "Parking stalls", unit: "", description: "Sum of parking object stalls" },
  { id: "parking_required", label: "Parking required", unit: "", description: "From zoning ratio per unit / per 100 m²" },
  { id: "parking_ratio", label: "Parking ratio", unit: "per unit", description: "Stalls / units" },
  { id: "facade_area_m2", label: "Façade area", unit: "m²", description: "Sum of storey perimeter × storey height" },
  { id: "envelope_ratio", label: "Façade / GFA", unit: "", description: "Façade area / GFA; lower is more compact" },
  { id: "open_space_m2", label: "Open space", unit: "m²", description: "Parcel − footprint" },
  { id: "yield_value", label: "Indicative value", unit: "", description: "NIA × sale price per m² (if provided)" },
];

export interface Kpis {
  parcel_area_m2: number; footprint_area_m2: number; coverage_pct: number; gfa_m2: number; gia_m2: number;
  far: number; osr_pct: number; max_height_m: number; max_storeys: number; building_count: number;
  unit_count: number; avg_unit_area_m2: number; residents_est: number; parking_stalls: number;
  parking_required: number; parking_ratio: number; facade_area_m2: number; envelope_ratio: number;
  open_space_m2: number; yield_value: number;
  gfa_by_use: Record<string, number>; unit_mix: Record<string, number>;
}
export function kpiValue(k: Kpis, id: string): number {
  const v = (k as unknown as Record<string, unknown>)[id];
  return typeof v === "number" ? v : 0;
}

export function storeyFootprint(b: Building, s: Storey) {
  return s.footprint ?? b.footprint;
}

export function buildingHeight(b: Building): number {
  return b.storeys.reduce((h, s) => h + s.height_m, 0) + (b.roof?.height_m ?? 0);
}

export function buildingGfa(b: Building): number {
  return b.storeys.reduce((a, s) => a + ringArea(storeyFootprint(b, s)), 0);
}

export function computeKpis(option: DesignOption, site: Site, settings: ProjectSettings): Kpis {
  const parcelArea = site.parcel ? ringArea(site.parcel) : 0;
  const buildings = option.buildings;

  const footprints = buildings.map((b) => ({ outer: b.footprint, holes: [] as [number, number][][] }));
  const fpUnion = unionAll(footprints);
  const footprintArea = fpUnion.reduce((a, p) => a + polygonArea(p), 0);

  const gfaByUse: Record<string, number> = {};
  let gfa = 0, gia = 0, facade = 0, unitsDrawn = 0, resNia = 0, drawnResArea = 0;
  const unitMix: Record<string, number> = {};

  for (const b of buildings) {
    for (const s of b.storeys) {
      const fp = storeyFootprint(b, s);
      const a = ringArea(fp);
      gfa += a;
      gfaByUse[s.use] = (gfaByUse[s.use] ?? 0) + a;
      facade += perimeter(fp) * s.height_m;
      if (s.units.length) {
        for (const u of s.units) {
          const ua = u.area_m2 ?? ringArea(u.polygon);
          if (["core", "corridor", "other"].includes(u.type)) continue;
          gia += ua;
          if (["studio", "1br", "2br", "3br", "4br"].includes(u.type)) {
            unitsDrawn += 1;
            drawnResArea += ua;
            unitMix[u.type] = (unitMix[u.type] ?? 0) + 1;
          }
        }
      } else {
        gia += a * b.efficiency;
        if (s.use === "residential" || s.use === "mixed") resNia += a * b.efficiency;
      }
    }
  }
  const resNiaTotal = resNia + drawnResArea;
  const unitsEst = resNia > 0 ? Math.floor(resNia / settings.avg_unit_area_m2) : 0;
  const unitCount = unitsDrawn + unitsEst;

  const parkingStalls = buildings.reduce((n, b) => n + b.parking.reduce((m, p) => m + p.stalls, 0), 0);
  const z = site.zoning;
  let parkingRequired = 0;
  if (z.parking_per_unit) parkingRequired += z.parking_per_unit * unitCount;
  if (z.parking_per_100m2) parkingRequired += (z.parking_per_100m2 * gfa) / 100;
  parkingRequired = Math.ceil(parkingRequired);

  const maxHeight = buildings.reduce((h, b) => Math.max(h, buildingHeight(b)), 0);
  const maxStoreys = buildings.reduce((n, b) => Math.max(n, b.storeys.length), 0);
  const openSpace = Math.max(0, parcelArea - footprintArea);

  const kpis: Kpis = {
    parcel_area_m2: parcelArea,
    footprint_area_m2: footprintArea,
    coverage_pct: parcelArea > 0 ? (footprintArea / parcelArea) * 100 : 0,
    gfa_m2: gfa,
    gia_m2: gia,
    far: parcelArea > 0 ? gfa / parcelArea : 0,
    osr_pct: gfa > 0 ? (openSpace / gfa) * 100 : 0,
    max_height_m: maxHeight,
    max_storeys: maxStoreys,
    building_count: buildings.length,
    unit_count: unitCount,
    avg_unit_area_m2: unitCount > 0 ? resNiaTotal / unitCount : 0,
    residents_est: unitCount * settings.residents_per_unit,
    parking_stalls: parkingStalls,
    parking_required: parkingRequired,
    parking_ratio: unitCount > 0 ? parkingStalls / unitCount : 0,
    facade_area_m2: facade,
    envelope_ratio: gfa > 0 ? facade / gfa : 0,
    open_space_m2: openSpace,
    yield_value: settings.sale_price_per_m2 ? gia * settings.sale_price_per_m2 : 0,
    gfa_by_use: gfaByUse,
    unit_mix: unitMix,
  };
  return kpis;
}

export function formatKpi(id: string, value: number): string {
  const def = KPI_DEFS.find((d) => d.id === id);
  if (!def) return String(value);
  if (def.unit === "%" ) return `${value.toFixed(1)} %`;
  if (def.unit === "m²") return `${Math.round(value).toLocaleString()} m²`;
  if (def.unit === "m") return `${value.toFixed(1)} m`;
  if (def.unit === "×") return `${value.toFixed(2)}`;
  if (def.id === "envelope_ratio" || def.id === "parking_ratio") return value.toFixed(2);
  if (def.id === "yield_value") return value ? Math.round(value).toLocaleString() : "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const USE_CLASSES: UseClass[] = ["residential", "office", "retail", "hotel", "industrial", "parking", "community", "mixed", "other"];

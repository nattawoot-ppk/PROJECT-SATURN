import type { Project, Building } from "./schema";
import { rectRing } from "@saturn/geometry";

export function makeBuilding(id: string, name: string, footprint: [number, number][], storeys: number, storeyHeight = 3.2, use: Building["category"] = "residential"): Building {
  return {
    id, name, category: use, tags: [], footprint, efficiency: 0.82, parking: [],
    roof: { type: "flat", pitch_deg: 0, height_m: 0 },
    storeys: Array.from({ length: storeys }, (_, i) => ({ id: `${id}-s${i}`, level: i, height_m: storeyHeight, use, units: [], cores: [] })),
  };
}

export function sampleProject(): Project {
  const now = new Date().toISOString();
  return {
    id: "sample", schema_version: 1, name: "Sample bar + L", jurisdiction: "generic", tags: [],
    site: {
      origin: { lat: 13.7563, lon: 100.5018 },
      context_radius_m: 300,
      parcel: [[-40, -30], [40, -30], [40, 30], [-40, 30]],
      parcel_source: "drawn",
      context_buildings: [{ id: "c1", footprint: rectRing(70, 0, 20, 40), height_m: 18, height_source: "estimated" }],
      streets: [],
      zoning: { source: "manual", max_height_m: 24, max_storeys: 7, far_max: 2.5, coverage_pct_max: 40, setbacks: [], default_setback_m: 6, parking_per_unit: 1, custom: {} },
    },
    options: [{
      id: "opt1", name: "Option A", created_at: now, updated_at: now,
      buildings: [
        makeBuilding("b1", "Bar", rectRing(-10, 0, 40, 14), 6),
        makeBuilding("b2", "Point", rectRing(22, 10, 16, 16), 7),
      ],
    }],
    active_option_id: "opt1",
    settings: { avg_unit_area_m2: 70, residents_per_unit: 2.2, storey_height_m: 3.2, currency: "EUR", rule_pack_id: "generic-international" },
    created_at: now, updated_at: now,
  };
}

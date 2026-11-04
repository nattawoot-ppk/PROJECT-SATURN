import { z } from "zod";

export const Vec2Schema = z.tuple([z.number(), z.number()]);
export const RingSchema = z.array(Vec2Schema).min(3);
export const PolygonSchema = z.object({ outer: RingSchema, holes: z.array(RingSchema).default([]) });

export const UseClass = z.enum(["residential", "office", "retail", "hotel", "industrial", "parking", "community", "mixed", "other"]);
export type UseClass = z.infer<typeof UseClass>;

export const UnitType = z.enum(["studio", "1br", "2br", "3br", "4br", "retail", "office", "core", "corridor", "other"]);
export type UnitType = z.infer<typeof UnitType>;

export const RoofType = z.enum(["flat", "gable", "hip", "mono"]);

export const SetbackSchema = z.object({
  /** Parcel edge index this setback applies to; omitted = default for all edges */
  edge: z.number().int().nonnegative().optional(),
  distance_m: z.number().nonnegative(),
  label: z.string().optional(),
});

/** Zoning / local-plan parameters. Everything optional; absent = not regulated. */
export const ZoningParamsSchema = z.object({
  source: z.enum(["manual", "auto", "pack"]).default("manual"),
  zone_code: z.string().optional(),
  allowed_uses: z.array(UseClass).optional(),
  max_height_m: z.number().positive().optional(),
  max_storeys: z.number().int().positive().optional(),
  /** Floor area ratio cap (GFA / parcel area), e.g. 2.5 */
  far_max: z.number().positive().optional(),
  /** Site coverage cap in percent (footprint / parcel), e.g. 40 */
  coverage_pct_max: z.number().positive().max(100).optional(),
  /** Open space ratio minimum in percent (Thai-style OSR) */
  osr_pct_min: z.number().nonnegative().optional(),
  setbacks: z.array(SetbackSchema).default([]),
  default_setback_m: z.number().nonnegative().default(0),
  parking_per_unit: z.number().nonnegative().optional(),
  parking_per_100m2: z.number().nonnegative().optional(),
  min_unit_area_m2: z.number().positive().optional(),
  daylight_factor_min_pct: z.number().nonnegative().optional(),
  custom: z.record(z.string(), z.number()).default({}),
});
export type ZoningParams = z.infer<typeof ZoningParamsSchema>;

export const ContextBuildingSchema = z.object({
  id: z.string(),
  footprint: RingSchema,
  height_m: z.number().positive(),
  height_source: z.enum(["data", "levels", "estimated"]).default("estimated"),
  name: z.string().optional(),
});

export const StreetSchema = z.object({
  id: z.string(),
  centreline: z.array(Vec2Schema).min(2),
  class: z.enum(["motorway", "primary", "secondary", "tertiary", "residential", "service", "path", "other"]).default("other"),
  name: z.string().optional(),
  width_m: z.number().positive().default(8),
  section_id: z.string().optional(),
  traffic: z.object({
    speed_kmh: z.number().positive().default(50),
    aadt: z.number().nonnegative().default(2000),
    heavy_pct: z.number().min(0).max(100).default(5),
  }).default({}),
});

export const StreetBandType = z.enum(["pavement", "roadway", "bike_lane", "planting", "parking", "median", "safety_zone", "plot_setback"]);
export type StreetBandType = z.infer<typeof StreetBandType>;
export const StreetSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Ordered left → right across the street */
  bands: z.array(z.object({ type: StreetBandType, width_m: z.number().positive() })).min(1),
});
export type StreetSection = z.infer<typeof StreetSectionSchema>;

export const UnderlaySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** data URL or blob URL of the image */
  src: z.string(),
  /** placement: centre in local metres, width in metres, rotation in degrees */
  centre: Vec2Schema,
  width_m: z.number().positive(),
  rotation_deg: z.number().default(0),
  opacity: z.number().min(0).max(1).default(0.6),
  aspect: z.number().positive().default(1),
});
export type Underlay = z.infer<typeof UnderlaySchema>;

export const SiteSchema = z.object({
  origin: z.object({ lat: z.number(), lon: z.number() }),
  context_radius_m: z.number().positive().default(300),
  parcel: RingSchema.optional(),
  parcel_source: z.enum(["drawn", "cadastre"]).default("drawn"),
  terrain: z.object({
    /** Row-major grid of elevations, metres, relative to origin elevation */
    grid: z.array(z.number()),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    cell_m: z.number().positive(),
    minX: z.number(),
    minY: z.number(),
  }).optional(),
  context_buildings: z.array(ContextBuildingSchema).default([]),
  streets: z.array(StreetSchema).default([]),
  street_sections: z.array(StreetSectionSchema).default([]),
  underlays: z.array(UnderlaySchema).default([]),
  zoning: ZoningParamsSchema.default({}),
});
export type Site = z.infer<typeof SiteSchema>;

export const UnitSchema = z.object({
  id: z.string(),
  type: UnitType,
  polygon: RingSchema,
  area_m2: z.number().nonnegative().optional(),
});

export const StoreySchema = z.object({
  id: z.string(),
  level: z.number().int(),
  height_m: z.number().positive().default(3.2),
  use: UseClass.default("residential"),
  /** Per-storey footprint override (for setbacks on upper floors). If absent, uses building footprint. */
  footprint: RingSchema.optional(),
  units: z.array(UnitSchema).default([]),
  cores: z.array(RingSchema).default([]),
});
export type Storey = z.infer<typeof StoreySchema>;

export const ParkingSchema = z.object({
  id: z.string(),
  type: z.enum(["surface", "basement", "podium"]),
  polygon: RingSchema,
  levels: z.number().int().positive().default(1),
  stalls: z.number().int().nonnegative(),
});

export const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: UseClass.default("residential"),
  tags: z.array(z.string()).default([]),
  footprint: RingSchema,
  storeys: z.array(StoreySchema).min(1),
  roof: z.object({ type: RoofType.default("flat"), pitch_deg: z.number().nonnegative().default(0), height_m: z.number().nonnegative().default(0) }).default({}),
  parking: z.array(ParkingSchema).default([]),
  /** Net-to-gross efficiency used when no units are drawn */
  efficiency: z.number().min(0.3).max(1).default(0.82),
  color: z.string().optional(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const DesignOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().optional(),
  buildings: z.array(BuildingSchema).default([]),
  notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DesignOption = z.infer<typeof DesignOptionSchema>;

export const ProjectSettingsSchema = z.object({
  avg_unit_area_m2: z.number().positive().default(70),
  residents_per_unit: z.number().positive().default(2.2),
  storey_height_m: z.number().positive().default(3.2),
  sale_price_per_m2: z.number().nonnegative().optional(),
  currency: z.string().default("EUR"),
  rule_pack_id: z.string().default("generic-international"),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  schema_version: z.literal(1).default(1),
  name: z.string(),
  jurisdiction: z.string().default("generic"),
  tags: z.array(z.string()).default([]),
  site: SiteSchema,
  options: z.array(DesignOptionSchema).min(1),
  active_option_id: z.string(),
  settings: ProjectSettingsSchema.default({}),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export function parseProject(input: unknown): Project {
  return ProjectSchema.parse(input);
}

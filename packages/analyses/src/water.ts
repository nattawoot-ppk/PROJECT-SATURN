/** Stormwater (rational method) and per-room daylight factor (BRE average DF formula). */
export interface SurfaceArea { type: "roof" | "paved" | "green" | "water" | "green_roof"; area_m2: number }
export const RUNOFF_C: Record<SurfaceArea["type"], number> = { roof: 0.95, paved: 0.9, green: 0.25, water: 1, green_roof: 0.5 };

export interface StormwaterResult { impervious_pct: number; weighted_c: number; peak_runoff_m3_s: number; detention_m3: number; annual_runoff_m3: number }

/**
 * @param intensity_mm_h design storm intensity (e.g. 10-year, 15-min)
 * @param duration_min storm duration used for detention volume
 * @param allowed_release_l_s_ha allowable discharge to the sewer per hectare
 */
export function stormwater(surfaces: SurfaceArea[], intensity_mm_h = 120, duration_min = 15, allowed_release_l_s_ha = 20, annual_rain_mm = 1500): StormwaterResult {
  const total = surfaces.reduce((a, s) => a + s.area_m2, 0) || 1;
  const weighted = surfaces.reduce((a, s) => a + RUNOFF_C[s.type] * s.area_m2, 0) / total;
  const impervious = surfaces.filter((s) => s.type === "roof" || s.type === "paved").reduce((a, s) => a + s.area_m2, 0);
  const i_m_s = intensity_mm_h / 1000 / 3600;
  const peak = weighted * i_m_s * total; // m³/s
  const allowed = (allowed_release_l_s_ha / 1000) * (total / 10000); // m³/s
  const detention = Math.max(0, (peak - allowed) * duration_min * 60);
  return { impervious_pct: (100 * impervious) / total, weighted_c: weighted, peak_runoff_m3_s: peak, detention_m3: detention, annual_runoff_m3: (weighted * annual_rain_mm * total) / 1000 };
}

/**
 * BRE average daylight factor: DF = T · Aw · θ / (A · (1 − R²)) in percent.
 * @param window_m2 glazed area, @param theta_deg visible sky angle from the window centre (0–90),
 * @param total_surface_m2 total interior surface area (floor + ceiling + walls), @param T glazing transmittance incl. frame/dirt,
 * @param R area-weighted mean interior reflectance.
 */
export function averageDaylightFactor(window_m2: number, theta_deg: number, total_surface_m2: number, T = 0.6, R = 0.5): number {
  if (total_surface_m2 <= 0) return 0;
  return (100 * T * window_m2 * theta_deg) / (total_surface_m2 * (1 - R * R)) / 100; // θ in degrees, formula gives percent directly: DF% = T·Aw·θ / (A·(1−R²))
}

/** Sky angle (degrees) estimated from a vertical sky component in percent (39.6 % ≈ unobstructed 90°). */
export function skyAngleFromVsc(vsc_pct: number): number { return Math.max(0, Math.min(90, (90 * vsc_pct) / 39.6)); }

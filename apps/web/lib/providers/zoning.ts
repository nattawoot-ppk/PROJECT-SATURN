import type { ZoningParams, UseClass } from "@saturn/model";
import { lonLatToLocal, pointInRing, type Ring } from "@saturn/geometry";

/**
 * Zoning auto-lookup. Providers run in order and the first that returns data wins; every result carries its source.
 * 1. Jurisdiction services (configurable endpoints): Norway Geonorge plan WMS (GetFeatureInfo), Bangkok city-planning
 *    ArcGIS REST (identify). 2. OpenStreetMap landuse via Overpass (key-free, worldwide) mapped to allowed uses.
 * Parameters always stay editable; packs supply defaults for anything a service does not provide.
 */
export interface ZoningLookup { zone_code?: string; zone_name?: string; allowed_uses?: UseClass[]; far_max?: number; coverage_pct_max?: number; osr_pct_min?: number; max_height_m?: number; max_storeys?: number; source: string; confidence: "service" | "landuse" | "table"; notes?: string }
export interface ZoningProvider { id: string; label: string; appliesTo: (jurisdiction: string) => boolean; lookup: (origin: { lat: number; lon: number }, parcel: Ring | undefined, signal?: AbortSignal) => Promise<ZoningLookup | null> }

/** Bangkok Comprehensive Plan B.E. 2556 FAR / OSR by zone code. Verify against the edition in force before relying on it. */
export const BANGKOK_ZONES: Record<string, { name: string; far: number; osr: number; uses: UseClass[] }> = {
  "ย.1": { name: "Low-density residential", far: 1, osr: 30, uses: ["residential"] }, "ย.2": { name: "Low-density residential", far: 1.5, osr: 20, uses: ["residential"] },
  "ย.3": { name: "Low-density residential", far: 2.5, osr: 12.5, uses: ["residential"] }, "ย.4": { name: "Low-density residential", far: 3, osr: 10, uses: ["residential"] },
  "ย.5": { name: "Medium-density residential", far: 3.5, osr: 8.5, uses: ["residential", "retail"] }, "ย.6": { name: "Medium-density residential", far: 4, osr: 7.5, uses: ["residential", "retail"] },
  "ย.7": { name: "Medium-density residential", far: 4.5, osr: 7, uses: ["residential", "retail"] }, "ย.8": { name: "High-density residential", far: 5, osr: 6.5, uses: ["residential", "retail", "office"] },
  "ย.9": { name: "High-density residential", far: 6, osr: 6, uses: ["residential", "retail", "office"] }, "ย.10": { name: "High-density residential", far: 7, osr: 5.5, uses: ["residential", "retail", "office", "hotel"] },
  "พ.1": { name: "Commercial", far: 5, osr: 6, uses: ["residential", "retail", "office", "hotel", "mixed"] }, "พ.2": { name: "Commercial", far: 6, osr: 5.5, uses: ["residential", "retail", "office", "hotel", "mixed"] },
  "พ.3": { name: "Commercial", far: 7, osr: 4.5, uses: ["residential", "retail", "office", "hotel", "mixed"] }, "พ.4": { name: "Commercial", far: 8, osr: 4, uses: ["residential", "retail", "office", "hotel", "mixed"] },
  "พ.5": { name: "Commercial (CBD)", far: 10, osr: 3, uses: ["residential", "retail", "office", "hotel", "mixed"] },
  "อ.1": { name: "Industrial", far: 3, osr: 10, uses: ["industrial", "office"] }, "อ.2": { name: "Warehouse", far: 2.5, osr: 10, uses: ["industrial"] },
  "ก.1": { name: "Rural / agricultural conservation", far: 0.5, osr: 50, uses: ["residential"] }, "ก.2": { name: "Rural / agricultural", far: 1, osr: 30, uses: ["residential"] },
  "ศ.": { name: "Institutions", far: 4, osr: 7.5, uses: ["community", "office"] },
};

const LANDUSE_USES: Record<string, UseClass[]> = { residential: ["residential"], commercial: ["retail", "office", "hotel", "mixed", "residential"], retail: ["retail", "mixed", "residential"], industrial: ["industrial"], institutional: ["community"], education: ["community"], mixed: ["mixed", "residential", "retail", "office"] };

const osmLanduse: ZoningProvider = {
  id: "osm-landuse", label: "OpenStreetMap landuse", appliesTo: () => true,
  async lookup(origin, parcel, signal) {
    const q = `[out:json][timeout:20];(way["landuse"](around:60,${origin.lat},${origin.lon});relation["landuse"](around:60,${origin.lat},${origin.lon});way["zoning"](around:60,${origin.lat},${origin.lon}););out tags geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal });
    if (!res.ok) return null;
    const j = await res.json() as { elements: Array<{ tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }> };
    const c: [number, number] = parcel ? [parcel.reduce((a, p) => a + p[0], 0) / parcel.length, parcel.reduce((a, p) => a + p[1], 0) / parcel.length] : [0, 0];
    // prefer the polygon containing the parcel centroid
    let best: { tags: Record<string, string> } | null = null;
    for (const el of j.elements) { if (!el.tags) continue; const ring = el.geometry?.map((g) => lonLatToLocal(origin, g.lon, g.lat)) as Ring | undefined; if (ring && ring.length > 3 && pointInRing(c, ring)) { best = { tags: el.tags }; break; } best ??= { tags: el.tags }; }
    if (!best) return null;
    const lu = best.tags["zoning"] ?? best.tags["landuse"] ?? ""; const uses = LANDUSE_USES[lu];
    return { zone_code: lu, zone_name: best.tags["name"], allowed_uses: uses, source: "OpenStreetMap landuse (Overpass)", confidence: "landuse", notes: uses ? "Allowed uses inferred from landuse; density parameters must come from the local plan." : `landuse '${lu}' has no use mapping.` };
  },
};

/** Norway: Geonorge reguleringsplan WMS GetFeatureInfo (endpoint configurable). */
const geonorge: ZoningProvider = {
  id: "no-geonorge", label: "Geonorge plan WMS", appliesTo: (j) => j.startsWith("NO") || j === "no-reference",
  async lookup(origin, _parcel, signal) {
    const base = process.env.NEXT_PUBLIC_NO_PLAN_WMS ?? "https://wms.geonorge.no/skwms1/wms.reguleringsplaner";
    const d = 0.0005; const bbox = `${origin.lon - d},${origin.lat - d},${origin.lon + d},${origin.lat + d}`;
    const url = `${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=Reguleringsplaner&QUERY_LAYERS=Reguleringsplaner&CRS=CRS:84&BBOX=${bbox}&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=application/json`;
    const res = await fetch(url, { signal }); if (!res.ok) return null;
    const j = await res.json().catch(() => null) as { features?: Array<{ properties?: Record<string, string | number> }> } | null;
    const f = j?.features?.[0]?.properties; if (!f) return null;
    const num = (k: string) => { const v = f[k]; const n = typeof v === "number" ? v : parseFloat(String(v ?? "")); return isNaN(n) ? undefined : n; };
    return { zone_code: String(f["arealformal"] ?? f["feltnavn"] ?? ""), zone_name: String(f["plannavn"] ?? ""), coverage_pct_max: num("bya") ?? num("prosentBYA"), far_max: (num("bra") ?? num("prosentBRA")) !== undefined ? (num("bra") ?? num("prosentBRA"))! / 100 : undefined, max_height_m: num("gesimshoyde") ?? num("monehoyde"), source: "Geonorge reguleringsplaner WMS", confidence: "service", notes: "Field names vary by municipality; check the plan document." };
  },
};

/** Bangkok: city-planning ArcGIS REST identify (endpoint configurable), then the zone-code table. */
const bangkok: ZoningProvider = {
  id: "th-bangkok-cpd", label: "Bangkok comprehensive plan", appliesTo: (j) => j.startsWith("TH") || j === "th-bangkok",
  async lookup(origin, _parcel, signal) {
    const base = process.env.NEXT_PUBLIC_TH_PLAN_ARCGIS; let code: string | undefined;
    if (base) {
      const url = `${base}/identify?f=json&geometryType=esriGeometryPoint&geometry=${origin.lon},${origin.lat}&sr=4326&tolerance=2&mapExtent=${origin.lon - 0.01},${origin.lat - 0.01},${origin.lon + 0.01},${origin.lat + 0.01}&imageDisplay=400,400,96&layers=all&returnGeometry=false`;
      const res = await fetch(url, { signal }); if (res.ok) { const j = await res.json().catch(() => null) as { results?: Array<{ attributes?: Record<string, string> }> } | null; const a = j?.results?.[0]?.attributes; code = a?.["ZONE_CODE"] ?? a?.["zone"] ?? a?.["CODE"]; }
    }
    if (!code) return null;
    const key = Object.keys(BANGKOK_ZONES).find((k) => code!.startsWith(k)); const z = key ? BANGKOK_ZONES[key]! : undefined;
    return { zone_code: code, zone_name: z?.name, far_max: z?.far, osr_pct_min: z?.osr, allowed_uses: z?.uses, source: "Bangkok City Planning Department ArcGIS", confidence: z ? "table" : "service", notes: "FAR/OSR from the B.E. 2556 plan table; verify against the edition in force." };
  },
};

export const ZONING_PROVIDERS: ZoningProvider[] = [geonorge, bangkok, osmLanduse];

export async function lookupZoning(jurisdiction: string, origin: { lat: number; lon: number }, parcel: Ring | undefined): Promise<ZoningLookup | null> {
  for (const p of ZONING_PROVIDERS) {
    if (!p.appliesTo(jurisdiction)) continue;
    try { const r = await p.lookup(origin, parcel, AbortSignal.timeout(15000)); if (r) return r; } catch { /* try next provider */ }
  }
  return null;
}

/** Apply a lookup onto zoning params without overwriting values the user entered by hand. */
export function applyLookup(z: ZoningParams, r: ZoningLookup, overwrite = false): ZoningParams {
  const set = <K extends keyof ZoningParams>(k: K, v: ZoningParams[K] | undefined) => { if (v !== undefined && (overwrite || z[k] === undefined || z.source !== "manual")) (z as Record<string, unknown>)[k as string] = v; };
  set("zone_code", r.zone_code); set("allowed_uses", r.allowed_uses); set("far_max", r.far_max); set("coverage_pct_max", r.coverage_pct_max); set("osr_pct_min", r.osr_pct_min); set("max_height_m", r.max_height_m); set("max_storeys", r.max_storeys);
  z.source = "auto"; return z;
}

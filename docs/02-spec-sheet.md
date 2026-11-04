# PROJECT SATRN — Technical Specification Sheet

*Working codename: SATRN. Feature parity target: spacio.ai (see `01-spacio-research.md`). Draft v0.1, 2026-11-04. For review before any code is written.*

---

## 1. Product definition

Browser-based early-phase building design platform. A user picks a site on a map, gets terrain + context + zoning parameters, sketches or generates massing, sees live KPIs and code compliance, runs environmental analyses (sun, daylight, views, wind, noise, comfort/energy, stormwater), gets automatic drawings, and exports a typed BIM model (IFC and friends) to continue in Revit/ArchiCAD.

**Non-goals (v1):** construction documentation, MEP/structural design, rendering-quality visuals, generative-image AI, cost estimating beyond simple area-based yield.

---

## 2. Module map

| # | Module | Runs where | Priority |
|---|---|---|---|
| M1 | Accounts, organisations, licences, billing | Server | P0 |
| M2 | Project dashboard & document store | Server + client | P0 |
| M3 | Site builder (map pick → parcel, terrain, context, streets, zoning) | Server job + client | P0 |
| M4 | 3D editor & structured building model | Client | P0 |
| M5 | Parametric generators (massing, storeys, units, cores, parking, street sections) | Client | P0 (massing/storeys), P1 (units/parking/streets) |
| M6 | Live KPI engine | Client | P0 |
| M7 | Compliance rule engine + jurisdiction rule packs | Client (eval) + server (packs) | P0 |
| M8 | Fast analyses: sun hours, shadows, facade sky exposure/daylight heatmap, views | Client (GPU/BVH) | P0 |
| M9 | Heavy analyses: wind, traffic noise, comfort & energy, stormwater, daylight factor per room | Server workers | P1 (wind, noise), P2 (comfort/energy, DF, stormwater) |
| M10 | Drawing generator (plans, sections, elevations, site plan) | Server | P1 |
| M11 | Import/export (IFC, 3DM, DXF, OBJ, dotBIM, Excel, images) | Server | P0 (OBJ/DXF/Excel/images), P1 (IFC/3DM), P2 (dotBIM) |
| M12 | Collaboration (share, roles, realtime presence, comments) | Server + client | P1 |
| M13 | Presentation (snapshots, diagrams, VR via WebXR) | Client | P2 |
| M14 | Admin, analytics, observability | Server | P0 |

---

## 3. Structured building model (core data model)

All geometry is stored as a document of typed objects, never as loose meshes. Units: metres, degrees; project CRS is a local ENU frame anchored at the site origin (lat/lon stored), with WGS84 ↔ local conversions via proj4.

```
Organisation
 └─ Project (id, name, origin lat/lon, CRS, jurisdiction, tags, settings)
     ├─ Site
     │   ├─ Parcel (polygon, area, source: cadastre|drawn)
     │   ├─ Terrain (heightmap grid or TIN, source, extent)
     │   ├─ ContextBuildings[] (footprint, height, source)
     │   ├─ Streets[] (centreline, class, width, section_id, traffic: speed/AADT/heavy%)
     │   ├─ StreetSections[] (ordered bands: type, width)
     │   ├─ Underlays[] (image, georef transform, opacity)
     │   └─ ZoningParams (max_height, max_storeys, far|bya|osr, setbacks[], use_classes[], parking_ratio, min_unit_area, daylight_min, custom[])
     ├─ DesignOption[] (name, parent_option, created_by)   ← versions/alternatives
     │   └─ Building[] (name, category: residential|office|retail|mixed, tags[])
     │       ├─ Footprint (polygon, may be multi-polygon)
     │       ├─ Storey[] (level, height, use, floor_polygon, offsets)
     │       │   ├─ Zone/Unit[] (type: 1BR|2BR|…|retail|core, polygon, area)
     │       │   ├─ Core[] (polygon, type: stair|lift)
     │       │   └─ Opening[] (wall_ref, width, height, sill)   ← for IFC typing & DF
     │       ├─ Roof (type: flat|gable|hip|mono, pitch, overhang)
     │       └─ Parking[] (type: surface|basement|podium, polygon, levels, stall count)
     ├─ AnalysisRun[] (type, option_id, params, status, result_ref, created_at)
     ├─ Drawing[] (type, option_id, scale, sheet, file_ref)
     ├─ Export[] (format, option_id, file_ref)
     └─ Comment[] (anchor: object_id|point, thread, author)
```

Persistence: one JSON document per DesignOption (CRDT-ready), plus relational metadata. Analysis results are stored as binary grids/meshes in object storage with a small JSON summary in the database.

---

## 4. Module specifications

### M3 Site builder

| Input | Processing | Output |
|---|---|---|
| Map click or address search, radius (default 300 m, "extended" up to 1 km) | Fetch buildings + streets (vector tiles or Overture/OSM), DEM tiles → TIN, parcel lookup (cadastre WFS if available, else user draws), zoning lookup (municipal WFS if available, else form) | Site object populated; context extruded from footprints × height (fallback height = levels × 3 m, else 9 m) |

- Data providers behind a provider interface: `MapboxProvider`, `OvertureProvider`, `NationalProvider<jurisdiction>`.
- Terrain: 1–2 m grid near parcel, 10 m beyond; draped context footprints.
- Street attributes defaults from road class (speed, AADT, heavy %) editable per street.
- Street sections: ordered bands with 8 band types (pavement, roadway, bike lane, planting, parking, median, safety zone, plot setback); sweep along centreline to produce 3D; sections shared by reference.
- Image underlay: upload PNG/JPG/PDF page, 2-point georeference, opacity.

### M4 3D editor

- Renderer: Three.js (WebGL2, WebGPU when stable) via React Three Fiber; instanced context; BVH (three-mesh-bvh) for picking and ray queries.
- Tools: draw footprint (polyline/rect, snapping to parcel/setback/context), push-pull faces, move/rotate/copy, storey count ± , per-storey offset/setback, split building, roof type, orbit/pan/zoom, section plane, 2D plan view, measure.
- Geometry ops: 2D via `polygon-clipping`/`clipper2-wasm` (offset for setbacks, boolean), 3D via `manifold-3d` (WASM) for exact booleans; triangulation via earcut.
- Undo/redo: command pattern on the document; autosave debounce 1 s; offline-tolerant queue.
- Performance targets: 60 fps with 2,000 context buildings + 20 design buildings on a 2020 laptop GPU; KPI recompute < 16 ms for typical models.

### M5 Parametric generators

| Generator | Inputs | Algorithm | Output |
|---|---|---|---|
| Massing from envelope | parcel, setbacks, max height/storeys, FAR/BYA cap, target GFA, typology (bar, L, U, courtyard, point tower, podium+tower) | Build buildable envelope (parcel ⊖ setbacks × height); place typology templates; grid/greedy search over depth (10–18 m), orientation, storeys; score by target GFA, daylight proxy, compliance | 3–12 DesignOptions |
| Storey subdivision | building, depth, corridor type (single/double-loaded, point access) | Core placement by max travel distance (e.g. ≤ 30 m) and façade access | cores, corridor polygon |
| Unit layout | storey polygon, unit mix targets (% by type), min/max areas, min width | Strip-packing along façade with corridor; dual-aspect preference at corners; repair pass; optimiser: weighted score (mix deviation, unit count, area efficiency, dual-aspect share) via local search / simple GA | Units[] per storey |
| Parking | required stalls (ratio × units/GFA), type, polygon | Surface: aisle+stall grid (5.0×2.5 m, 6 m aisles, 90°); basement: levels under footprint with ramp allowance; podium | Parking[] + stall count |
| Street section sweep | section, centreline | offset bands, extrude, kerb heights | 3D meshes |

### M6 Live KPI engine

Computed synchronously on every document change:
GFA, GIA/NIA (configurable efficiency), per-use GFA, storey count, height (max/avg), footprint area, site coverage % (BYA %), FAR/plot ratio (%-BRA / %-BYA for Norway-style packs), open space ratio, unit count and mix %, average unit area, parking stalls and ratio, bike parking, dual-aspect share, façade area, envelope-to-floor ratio, estimated residents, simple yield (GFA × €/m² if provided). Each KPI has an id, unit, formula reference, and jurisdiction overrides.

### M7 Compliance rule engine

- **Rule pack** = versioned JSON per jurisdiction (`country/region/municipality/zone`), containing parameters and rules.
- **Rule** = `{ id, title, severity: error|warning|info, scope: site|building|storey|unit, expr, message, autofix? }` where `expr` is a sandboxed expression over KPIs and geometry predicates (e.g. `building.height_m <= zoning.max_height_m`, `distance(building, parcel.edge[i]) >= zoning.setback[i]`, `kpi.bya_pct <= zoning.bya_pct_max`, `unit.area >= pack.min_unit_area[unit.type]`).
- Evaluation: client-side on each change, < 50 ms; results panel with jump-to-object; coloured overlays (red faces for height/setback breaches).
- **Autofix**: clamp height to max, trim footprint to setback envelope, reduce storeys — applied only on explicit click.
- **Custom rules**: user-editable in a form (parameter) or expression editor (advanced) saved to project (built: `settings.custom_rules`, Zoning panel editor); organisation-level shared packs (pending).
- Starter packs: (1) generic international (height/setback/FAR/coverage/parking/min unit), (2) launch jurisdiction pack (to be decided, see PRD open questions), (3) Norway reference pack (BYA/BRA, TEK17 daylight/ceiling/fire-distance basics) for parity testing.

### M8 Fast in-browser analyses

| Analysis | Method | Resolution | Target time |
|---|---|---|---|
| Sun hours | NREL SPA sun vectors at 10-min steps for chosen date(s) (default equinox + summer/winter solstice); ray cast from sample points vs BVH of design+context+terrain | 1 m grid on ground/roofs, 1 m on façades | < 3 s |
| Shadows | Real-time shadow map for selected date/time + animated day | — | realtime |
| Façade sky exposure / daylight potential | Vertical Sky Component: Tregenza 145-patch sky, ray cast per façade sample, cosine-weighted; map to "daylight potential" heatmap; optional climate-based weighting with EPW sky luminance (Perez) | 1 m façade grid | < 5 s |
| Views | From façade samples: openness (% unobstructed hemisphere) and view-to-target (user-placed targets: sea, park) | 1 m | < 3 s |
| Blocked light on context | Same VSC on context façades before/after → delta map (for neighbour impact) | 1 m | < 5 s |

GPU path: compute shaders where WebGPU available; fallback to BVH ray casting in a Web Worker pool.

### M9 Server-side analyses

| Analysis | Method | Inputs | Outputs | Validation |
|---|---|---|---|---|
| Wind (pedestrian comfort) | Fast 3D solver on voxel grid: Lattice-Boltzmann (D3Q19, LES) in Rust/CUDA or coarse RANS via OpenFOAM in batch; 12 directions; ABL inlet profile; weather-frequency weighting from EPW → Lawson LDDC comfort classes at 1.5 m | design + context + terrain, EPW | speed-ratio grids per direction, comfort class map, per-façade gust flags | AIJ cases A–F; publish error stats like Spacio |
| Traffic noise | CNOSSOS-EU road source (speed, flow, heavy %, surface) + propagation (ISO 9613-2-style with CNOSSOS corrections, diffraction over edges, ground effect); Lden/Lnight at façade receivers (per storey) and ground grid; reference implementation: NoiseModelling (LGPL, Java) | streets with traffic, geometry | façade levels, quiet-side flag (Lden ≤ 55 / Lnight ≤ 50 default, per-jurisdiction), bedroom-suitable façade map | compare with consultant models / NoiseModelling |
| Comfort & energy (free-running) | Hourly simplified thermal model (ISO 52016-1 hourly or 5R1C) per building zone with EPW; adaptive comfort EN 16798-1 Cat II band; thermal autonomy %; heating/cooling demand with and without mechanical | massing, glazing ratio, construction preset, EPW | thermal autonomy %, overheating hours, kWh/m²·yr heating/cooling | cross-check vs EnergyPlus on 3 test boxes |
| Daylight factor per room | Radiance (via ladybug-tools/honeybee-radiance) with CIE overcast sky; or BRE average DF formula as fast proxy | units with openings | DF% per room, pass/fail vs pack threshold (e.g. 2%) | vs Radiance reference |
| Stormwater | Rational method: runoff = Σ(C_i × A_i) × rainfall intensity (jurisdiction IDF); green/blue roof credits | surfaces by type | peak runoff, impervious %, required detention volume | formula check |

Jobs: queued (BullMQ/Redis), executed in containerised workers, progress streamed via WebSocket; results cached by hash(option geometry + params).

### M10 Drawing generator

- Inputs: DesignOption, sheet template, scale (1:200/1:500 site, 1:100 plans).
- Plans: horizontal section at storey level + 1.2 m, walls as unit boundaries (thin), cores, openings, room labels and areas, north arrow, dimension strings on outer edges.
- Sections/elevations: user-placed section lines; elevations per façade with terrain line and storey datums.
- Site plan: parcel, setbacks, footprints, context, streets, north, key KPIs table.
- Output: SVG → PDF (vector), and DXF layers; sheet title block with project/org, option name, KPI table.

### M11 Import / export

| Format | Library | Mapping |
|---|---|---|
| IFC 4 (export) | IfcOpenShell (Python) | IfcSite/IfcBuilding/IfcBuildingStorey/IfcSpace (units), IfcWall (unit boundaries as typed walls from library), IfcSlab (floors), IfcRoof, IfcWindow/IfcDoor (openings), IfcPropertySets with KPIs; georeferencing via IfcMapConversion |
| IFC (import) | web-ifc / IfcOpenShell | context or design massing |
| Rhino 3DM | rhino3dm (JS/Python) | layers per building/storey; breps/meshes |
| DXF | ezdxf (Python) | 2D plans and 3D faces, layered |
| OBJ | custom | meshes with groups |
| dotBIM | custom JSON | meshes + metadata |
| Excel | SheetJS/openpyxl | Area schedule, unit schedule, parking, KPI sheet, compliance report, analysis summaries |
| Images | browser | PNG/JPG/PDF-page underlays |
| glTF | three | for VR/presentation |

Export gating by plan (see PRD).

### M12 Collaboration

- Roles: owner, editor, commenter, viewer; project share links.
- Realtime: Yjs CRDT over WebSocket (y-websocket or Hocuspocus) for the DesignOption document; presence cursors; conflict-free offline edits.
- Comments anchored to objects or 3D points; resolve/unresolve; email notifications.

### M13 Presentation

- Snapshots (camera + option + overlay) saved as images and as shareable viewer links (read-only web viewer).
- Diagram mode (white model, coloured by use/tag/analysis).
- VR: WebXR immersive session from the viewer; glTF export for headsets.

### M1 / M14 Platform

- Auth: email magic link + OAuth (Google, Microsoft); SSO (SAML) for Business later.
- Organisations with floating seats: concurrency counter per org (Redis); seat released on idle 30 min.
- Billing: Stripe subscriptions (Free/Starter/Pro/Business), export day-pass as one-off; invoice for Business.
- Analytics: PostHog (EU); error tracking Sentry; logs/metrics OpenTelemetry.
- Data residency: configurable region (EU default; Asia-Pacific region if launch market is Thailand).

---

## 5. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js 15 (React 19, TypeScript), Tailwind, shadcn/ui | Mature, fast iteration, SSR for marketing/dashboard |
| 3D | Three.js + React Three Fiber, three-mesh-bvh, drei | Largest ecosystem, WebXR support |
| Map | MapLibre GL (with Mapbox or self-hosted tiles) | Vendor-flexible |
| Geometry | manifold-3d (WASM), clipper2-wasm, earcut, turf.js, proj4 | Robust booleans/offsets, geo ops |
| State | Zustand + Yjs | Local speed + CRDT sync |
| API | NestJS (TypeScript) with tRPC or REST + OpenAPI | Typed end-to-end |
| Workers | Python 3.12 (FastAPI control, numpy, IfcOpenShell, ezdxf, rhino3dm, ladybug-tools, pvlib) + Rust for wind solver | Right tool per engine |
| Queue | Redis + BullMQ | Simple, reliable |
| DB | PostgreSQL 16 + PostGIS | Spatial queries for parcels/context |
| Storage | S3-compatible (AWS S3 / Cloudflare R2) | Results, exports, assets |
| Auth | Auth.js or Clerk | Magic link + OAuth fast |
| Billing | Stripe | Standard |
| Infra | Docker, Kubernetes or Fly.io; GitHub Actions CI | Scalable workers with GPU option |
| Observability | Sentry, OpenTelemetry, PostHog EU | Product + reliability |

Monorepo (pnpm + Turborepo): `apps/web`, `apps/api`, `apps/viewer`, `services/sim-wind` (Rust), `services/sim-python`, `packages/model` (schema + KPIs + rule engine, shared TS), `packages/geometry`, `packages/rule-packs`, `packages/ui`.

---

## 6. External services and estimated running cost (early stage)

| Service | Purpose | Est. monthly |
|---|---|---|
| Mapbox (or MapTiler) | Tiles, terrain, geocoding | USD 0–200 |
| Cloud compute (API + 2 CPU workers) | Core | USD 150–400 |
| GPU worker (on-demand) | Wind | USD 50–300 (spot) |
| Postgres + Redis managed | Data | USD 50–150 |
| Object storage | Files | USD 10–50 |
| Stripe, PostHog, Sentry | SaaS | USD 0–100 |
| EPW weather data, Overture/OSM, Copernicus DEM | Data | Free |

---

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Editor 60 fps target; KPIs < 16 ms; fast analyses < 5 s; wind ≤ 3 min per option (12 dirs); noise ≤ 1 min; drawings ≤ 30 s; IFC export ≤ 60 s |
| Scale | 10k projects, 500 concurrent editors in year 1 |
| Reliability | 99.5% uptime; autosave; no data loss on disconnect |
| Security | OWASP ASVS L2; org-scoped authorisation on every object; signed URLs for files; rate limits |
| Privacy | GDPR/PDPA compliance; data residency per region; consent-gated analytics |
| Accessibility | Keyboard-operable panels; WCAG AA for non-3D UI |
| Browser support | Last 2 versions Chrome/Edge/Firefox/Safari; WebGL2 required; WebGPU optional |
| Localisation | i18n framework from day 1; EN first; TH/NO packs as needed; metric units; imperial display toggle later |
| Honesty of analyses | Every analysis result shows method, resolution, validation status and "comparative, not certified" label |

---

## 8. API surface (outline)

```
POST   /projects                         create (origin, jurisdiction)
POST   /projects/:id/site/build          job: fetch context/terrain/zoning
GET    /projects/:id/options/:oid        document (also via WS/Yjs)
POST   /projects/:id/options/:oid/generate   massing/unit/parking generators (server fallback)
POST   /analyses                         {type, option, params} → job id
GET    /analyses/:jobId                  status/result refs
POST   /drawings                         {option, set} → job
POST   /exports                          {option, format} → job → signed URL
GET    /rule-packs?jurisdiction=…        packs + versions
POST   /orgs/:id/seats/acquire|release   floating licence
POST   /billing/checkout, /billing/portal
```

---

## 9. Acceptance test ideas (per engine)

- Geometry: 100 random footprints → offsets/booleans produce valid, non-self-intersecting polygons.
- KPIs: hand-calculated reference models (bar, L, courtyard) match to 0.5%.
- Sun hours: compare against Ladybug on 3 reference sites, MAE < 0.5 h.
- VSC: compare against Radiance on test façades, MAE < 2 points.
- Wind: AIJ case A/B/C/E; report hit rate within ±30% speed ratio, like published studies.
- Noise: compare with NoiseModelling on 3 street scenarios, within 3 dB.
- Comfort/energy: 3 BESTEST-like boxes vs EnergyPlus, within 15% annual demand.
- IFC: opens in BlenderBIM, Revit, ArchiCAD with correct storeys, spaces, typed walls.
- Drawings: PDF/DXF opens in AutoCAD; dimensions match model.

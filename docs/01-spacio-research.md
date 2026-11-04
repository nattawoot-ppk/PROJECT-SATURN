# Spacio.ai — Deep Research Teardown

*Prepared 2026-11-04 for PROJECT-SATRN. Research-and-planning session only; nothing has been built.*

---

## 0. How this research was done, and what it could not reach

This cloud session's network policy blocks direct access to `spacio.ai`, `app.spacio.ai`, `test.spacio.ai`, LinkedIn, YouTube, the Wayback Machine and every third-party review site. Everything below was assembled from:

- Search-engine index snippets of Spacio's own pages (homepage, `/pricing`, `/developers`, `/terms`, `/privacy`, `/blog/*`, FAQ text, the `www.test.spacio.ai` staging mirror).
- Spacio's LinkedIn company updates and founder posts (via index snippets).
- Spacio's YouTube channel and "Spacio Basics" playlist video titles/descriptions.
- Third-party coverage: AEC Magazine AI directory, aec+tech, illustrarch, archinatorai, futurebuiltai, archsupply, ENGtechnica (which re-reports Spacio blog posts), Crunchbase / CB Insights / PitchBook / Tracxn, vekstifredrikstad.no.

Each claim is tagged with a confidence level:

| Tag | Meaning |
|---|---|
| **[V]** | Stated by Spacio itself (site, FAQ, blog, LinkedIn, YouTube) |
| **[T]** | Reported by a third party, not confirmed by Spacio |
| **[I]** | Inferred by me from evidence; needs verification in a trial account |

**Before building, someone should open a free Spacio account and verify the [I] and [T] items.** A checklist is in section 9.

### Name collision warning

Three unrelated products share the name. The target is the first one.

| Product | What it is | Not our target? |
|---|---|---|
| **spacio.ai** (Spacio AS, Oslo) | Browser-based AI building design / feasibility tool for architects | **This is the target** |
| spac.io (Lone Wolf Spacio) | Real-estate open-house sign-in software | Ignore |
| "Spacio AI: AI Interior Design" (iOS) | Photo-based room redesign app | Ignore |

---

## 1. Company snapshot

| Item | Detail | Conf. |
|---|---|---|
| Legal entity | Spacio AS, Oslo, Norway | [T] |
| Founded | 2022 | [T] |
| Founders | Franz Forsberg (CEO; studied architecture + engineering in Japan, ex building-performance analyst in Scandinavia), Stian André Haugrim (CTO), André Agi (CPO) | [T] |
| Funding | Accelerator-stage: XPRENEURS / UnternehmerTUM (Munich). No priced VC round found. | [T] |
| Team size | 1–10 (Crunchbase) to ~15 (Tracxn, mid-2026) | [T] |
| Product status | "Beta" label on code checking and on the product in directories; free tier, no card required | [V]/[T] |
| Claimed customers | Snøhetta, Oslo Works, Norconsult, HLM Architects, Betonmast, Griff | [V] (vendor claim) |
| Mission statement | "Democratise access to design intelligence" | [V] |
| Public case study | Oslo Works: faster competition prep, VR walkthroughs from the model, visualisation packages, issues fixed "overnight" | [V] (vendor blog) |
| Ratings | Site structured data: 4.8 from 150 ratings; illustrarch: 4.1/5 | [T] |

Market context: Oslo also produced Spacemaker (acquired by Autodesk for USD 240M in 2020, now Autodesk Forma). Spacio is, in effect, a lean "post-Spacemaker" team competing on simplicity, price and a Nordic-first compliance focus.

---

## 2. Positioning and target users

**One-line pitch [V]:** "Building design software for the early phase — from site analysis to building permit." Positioned *between the napkin sketch and the detailed BIM model* in Revit/ArchiCAD.

**Claimed outcome [V]:** ~75% reduction in early-stage feasibility work; `/developers` page claims "qualify land 5x faster" and a 15-minute buildable envelope.

**Audiences:**

| Audience | Jobs Spacio sells to them | Conf. |
|---|---|---|
| Architects (SMB to large) | Feasibility studies, competition prep, massing options, client presentations, permit drawings | [V] |
| Property developers | Land qualification, pre-validated volumes to brief architects, 3D visuals to differentiate purchase offers; roadmap: predictive land-value / regulatory-tension models | [V] |
| Engineers / consultants | Early environmental analyses without separate consultants | [V] |
| Municipalities / planners | Site potential evaluation | [T] |
| Students | Free tier | [T] |

**Scope limit [V]/[T]:** residential-first, early-phase only. Spacio states it is not a replacement for Revit/ArchiCAD; after permit, export and continue there.

---

## 3. Complete feature inventory

### 3.1 Project and account

| Feature | Detail | Conf. |
|---|---|---|
| Browser-only, no install | `app.spacio.ai`; login by email (passwordless) with ToS/Privacy consent | [V] |
| Main dashboard | Project list, start new project ("Spacio Basics: Main dashboard features", "Starting your first project") | [V] |
| Project ownership | Personal plans: user-owned. Business: organisation-owned, floating concurrent licences | [V] |
| Collaboration | "Collaboration" listed on all paid tiers; teams work together in the browser | [V] (details unknown: realtime? comments?) |
| Categories & Tags | Categorise buildings for mixed-use projects; tags track stages/designations | [V] |
| Property system | Per-object properties/attributes panel (video title only) | [V] (contents unknown) |
| Billing | Stripe; Business can pay by invoice; plan change anytime; €30 export day-pass | [V] |
| Analytics/privacy | PostHog, EU-hosted, consent-gated; all personal data in EEA | [V] |

### 3.2 Site setup and context

| Feature | Detail | Conf. |
|---|---|---|
| One-click site import | Click a map location → buildings, streets, terrain pulled from **Mapbox**, "anywhere in the world" | [V] |
| Terrain | Basic terrain on Free; "extended terrain area" on Starter+ | [V] |
| Zoning info | "Auto-generates geo-located site context and zoning info for any location worldwide"; depth varies by country/municipality | [V]/[T] |
| Cadastral / regulatory parameter entry | Developer flow: enter cadastral data + regulatory parameters → buildable envelope | [V] |
| Image import | Import image files (site plans, sketches) as underlays | [V] |
| File import | DXF, IFC, OBJ, Rhino 3DM import on paid tiers ("all file imports") | [V] |
| Street sections | Sections built from ordered lateral bands; 8 band types: pavement, roadway, bike lane, planting, parking, median, safety zone, plot setback. Stored per project, assigned to streets, swept along centreline into 3D; editing a shared section updates all streets using it. No regulatory check, no traffic capacity | [V] |

### 3.3 Modelling

| Feature | Detail | Conf. |
|---|---|---|
| Free-form massing | Push/pull massing directly in the 3D model | [V] |
| Storeys / setbacks / layouts | "Storeys, setbacks and layouts change in seconds, so you can compare options" | [V] |
| Roof planning | Roof configuration mentioned in Oslo Works case | [V] |
| Structured building model | Output is a "properly structured building model" (buildings → storeys → units), not loose geometry | [V] |
| Parametric engine | "Parametric algorithms behind a simple visual interface, no coding or Grasshopper required" | [V] |

### 3.4 Generative / automatic design

| Feature | Detail | Conf. |
|---|---|---|
| Massing generated against constraints | Founder demo: "massing generated against constraints" after a map click | [V] |
| Automatic floor plans + unit mix | "Floor plans and unit mix produced automatically" | [V] |
| Unit-mix optimiser | "Optimise layouts for target ratios and maximum unit count" | [V] |
| Parking layouts | "Metrics, unit mixes, parking layouts and KPIs handled automatically" | [V] |
| "Generative AI" | Marketing phrase. No evidence of LLM/diffusion; behaviour matches rule-based parametric generation + optimisation | [I] |

### 3.5 Metrics / KPIs (live on every edit)

GFA, GIA [V]; floor areas, building height, site coverage, floor-area ratio [T]; unit counts [V]; parking counts [V]; KPIs "update as you work" [V]. Norwegian BYA / %-BYA / BRA are almost certainly among them given the market [I].

### 3.6 Code compliance (labelled Beta)

| Feature | Detail | Conf. |
|---|---|---|
| Live code checks | Checks massing against local building codes as you work and flags issues immediately | [V] |
| Checked parameters seen | Height, setbacks (founder demo) | [V] |
| Auto-positioning | "Automatically positions elements to ensure compliance" | [V] |
| Zoning validation | "Validate against local zoning regulations and continuously update as codes change" | [V] |
| Custom code rules | Editable custom rules exist (a review complains tutorials gloss over "custom code rule editing") | [T] |
| Coverage | Norway-first; depth varies per municipality | [T] |

### 3.7 Simulations / analyses

| Analysis | What is known | Conf. |
|---|---|---|
| Sun hours | Available on Free tier; facade & ground | [V] |
| Views | Available on Free tier | [V] |
| Facade daylight heatmap | Instant heatmap of daylight access on facades, also on context to detect blocked light; recalculates in real time | [V] |
| Daylight metrics | Facade sky exposure, sun hours, solar radiation, shading during massing; favours **climate-based daylight modelling**; names DA, sDA, ASE, UDI | [V] |
| Daylight factor per room | Announced "very soon" (status unknown) | [V] |
| Wind | 12 wind directions, weather records, grid refined near pedestrian level at ~1.5 m, benchmarked against 4 AIJ wind-tunnel cases; good at corner acceleration/shelter; over-predicts sheltered spots, under-predicts dense streets; explicitly "comparative, not certified" | [V] |
| Traffic noise (beta) | CNOSSOS-EU method; inputs per street: speed, daily traffic volume, heavy-vehicle share; outputs: quiet side, bedroom-suitable facades, night-time open-window check; national guidance NO/SE/DK, WHO elsewhere; within ~3 dB of consultant models; no aircraft/industrial, no Lmax | [V] |
| Stormwater | Listed as a real-time analysis | [T] |
| Comfort & energy (beta) | "Free running first": thermal autonomy against EN 16798-1 adaptive comfort band; aim: show how little mechanical equipment is needed | [V] |
| All simulations | Unlocked on Starter and above | [V] |

### 3.8 Drawings and presentation

| Feature | Detail | Conf. |
|---|---|---|
| Automatic permit drawings | Floor plans, elevations, sections "in minutes" (site plans per a review) | [V]/[T] |
| Diagrams / visualisation package | Clean diagrams from the same source model | [V] |
| VR walkthroughs | Generated directly from the Spacio model for in-meeting walkthroughs | [V] |
| Facade daylight video tutorial | "Spacio Basics: Daylight Simulation" | [V] |

### 3.9 Import / export

| Format | Direction | Notes | Conf. |
|---|---|---|---|
| IFC | Export (+import) | Tested into ArchiCAD, Revit, BIMcollab (2023 announcement) | [V] |
| Rhino 3DM | Both | | [V] |
| DXF | Both | | [V] |
| OBJ | Both | | [V] |
| dotBIM (.bim) | Export | Listed on site | [V] |
| Excel | Export | Area schedules / KPIs (contents unknown) | [V] |
| Images | Import | Free tier allows image import only | [V]/[T] |
| "BIM-ready" claim | Export includes wall types, window families, roof structures, floor assemblies, not just masses | [V] (FAQ; verify quality) |
| Gating | Free: no export. Starter: €30/day export pass. Pro/Business: all exports | [V] |

### 3.10 Pricing (official page, EUR)

| Tier | Price | Includes |
|---|---|---|
| Free | €0 | Limited usage, 1 user, 3 projects (some sources say 1), basic terrain, sun + views analysis, image import, no export |
| Starter (personal) | €21/mo or €250/yr | Unlimited usage, 1 fixed user, 10 projects, extended terrain, all simulations, all file imports, collaboration, export via €30 day pass |
| Pro (personal) | €79/mo or €948/yr | Starter + unlimited projects + all file exports |
| Business | from €3,995/yr | 2+ floating (concurrent) licences, organisation-owned projects, collaboration, invoice payment |

---

## 4. What is "behind it" — the engine

### 4.1 Hard evidence

| Evidence | Implication |
|---|---|
| Runs entirely in browser, no install, free-form 3D push/pull, instant heatmaps | WebGL (or WebGPU) renderer; most likely Three.js or a custom WebGL layer; TypeScript front end |
| "Parametric algorithms behind a simple visual interface" | Rule-based parametric generators, not ML image generation |
| Mapbox named as site-data source | Mapbox Streets/Buildings vector tiles + Terrain-RGB/DEM |
| Wind: grid, 12 directions, 1.5 m refinement, AIJ validation, known bias patterns | In-house fast CFD-style solver (likely coarse-grid RANS/LBM or potential-flow approximation), *not* a neural surrogate like Forma's "rapid wind" |
| Noise: CNOSSOS-EU, street attributes, ±3 dB vs consultants | Own implementation of CNOSSOS-EU road source + propagation |
| Daylight: climate-based, sky exposure, solar radiation | Sky-patch (Tregenza/Reinhart) ray casting against massing; EPW weather |
| Comfort/energy: EN 16798-1 adaptive band, "free running" | Simplified hourly thermal model (ISO 52016 / 5R1C class) with EPW weather |
| IFC export with wall/window/roof/floor types | Server-side IFC writer (IfcOpenShell-class) mapping the structured model to IfcWall/IfcWindow/IfcSlab/IfcRoof |
| `www.test.spacio.ai` mirrors the marketing site | Marketing site likely on Webflow/Framer; app is separate at `app.spacio.ai` |
| PostHog EU, Stripe, EEA hosting | Standard SaaS stack; cloud vendor unnamed (EU region) |

### 4.2 Inferred architecture [I]

```
Browser (TypeScript, WebGL)
 ├─ Map/site picker (Mapbox GL)
 ├─ 3D editor: structured model (Site → Buildings → Storeys → Units/Zones → Openings)
 ├─ Parametric generators (massing, storeys, unit layouts, parking, street sections)
 ├─ Live KPI engine (areas, FAR, counts) — client-side, synchronous
 ├─ Rule engine (code checks) — client-side, synchronous, rule packs per jurisdiction
 ├─ Fast analyses in-browser (sun hours, facade sky exposure/daylight heatmap, views)
 └─ Collaboration + autosave (project document sync)

API / workers (EU cloud)
 ├─ Site builder: Mapbox buildings + streets + terrain → site context model; zoning lookup
 ├─ Heavy analyses as jobs: wind (12 dirs), noise (CNOSSOS-EU), comfort/energy (hourly), stormwater
 ├─ Drawing generator (plans/sections/elevations → vector/PDF)
 ├─ Exporters: IFC, 3DM, DXF, OBJ, dotBIM, Excel
 ├─ Auth (email magic link), orgs, floating licences, Stripe billing
 └─ Storage: project documents, analysis results, assets
```

### 4.3 The "AI" question

No evidence of generative ML models in the product. "AI-powered" in Spacio's marketing means (a) parametric generation + optimisation of massing/unit mix, (b) automated analyses that replace consultants. The roadmap mentions predictive land-value models [V], which would be ML, but it is not shipped. **For our build this is good news: the whole product is deterministic geometry, physics approximations and rules, which we can build and validate.**

---

## 5. Data Spacio needs (and we will need)

| Data category | Used for | Spacio's source | Our candidate sources |
|---|---|---|---|
| Base map, buildings (footprints + heights), streets | Site context, shading, wind, noise | Mapbox | Mapbox (paid), or Overture Maps / OpenStreetMap + open height datasets (free); national 3D city models (e.g. Norway FKB, Thailand DPT data) |
| Terrain / DEM | 3D terrain, sections, stormwater | Mapbox Terrain | Mapbox Terrain-RGB, Copernicus GLO-30 (free, 30 m), national LiDAR DEM where available |
| Cadastre / parcels | Site boundary, setbacks, area | Manual entry + map | National cadastre WFS (Norway Kartverket; Thailand DOL where accessible); manual polygon draw as fallback |
| Zoning / local plan parameters | Code checks (FAR/BYA, height, setbacks, use) | "Zoning info worldwide" (quality varies) + user-entered parameters | Municipal plan WMS/WFS + **user-entered parameters as the reliable baseline**; curated rule packs per jurisdiction |
| Building code rules | Compliance engine | Nordic codes (TEK17 etc.) | Jurisdiction rule packs (declarative) |
| Weather (hourly) | Daylight (climate-based), wind frequencies, comfort/energy | Weather records | EPW files (climate.onebuilding.org, free), ERA5 reanalysis |
| Sun position | Sun hours, shading | Computed | Solar Position Algorithm (NREL SPA) |
| Traffic data | Noise | User-entered per street (speed, AADT, heavy %) | Same, plus defaults by road class from OSM tags; national traffic counts where open |
| Noise guidance thresholds | Noise verdicts | NO/SE/DK national + WHO | Per-jurisdiction tables |
| Daylight standards | Daylight verdicts | Norway DF, EN 17037 | Per-jurisdiction tables |
| Wind comfort criteria | Wind verdicts | Lawson / NEN 8100-type | Lawson LDDC criteria |
| Parking norms, unit size minimums | Unit mix + parking | Code packs | Per-jurisdiction tables |
| Materials / assemblies | IFC export typing | Internal library | Small internal library of wall/slab/roof/window types |

---

## 6. Competitive landscape

| Tool | Owner / origin | Core strength | Price signal | Relevance to our build |
|---|---|---|---|---|
| **Autodesk Forma** (ex Spacemaker) | Autodesk, Oslo | Deepest analyses: sun, daylight potential (VSC), solar energy, wind (rapid ML + detailed CFD), noise (road+rail), microclimate, embodied carbon, operational energy; Revit round-trip | ~USD 185/mo or in AEC Collection | The benchmark Spacio undercuts on price/simplicity |
| **TestFit** | Dallas, US | Site solver, unit mix, parking generator, yield + cost pro forma; generative design, 3D terrain/soil | ~USD 250/mo to USD 15k/yr | Reference for developer/yield features |
| **Giraffe** | Australia | Map-first collaborative feasibility, data overlays, land-residual | Mid | Reference for map-native UX |
| **Archistar** | Australia | Planning rules + permit fast-track, generative massing on AU parcels | Enterprise | Reference for rule-pack approach |
| **Deepblocks** | US | Zoning data + pro forma | Mid | Zoning data model reference |
| **Rayon** | Paris | Collaborative 2D CAD in browser | Low | UX reference for browser CAD |
| **Finch 3D** | Stockholm | Floor-plan optimisation inside Revit/Rhino | Mid | Complement, not competitor |
| **Snaptrude** | India/US | Browser BIM, Revit sync | Mid | Reference for browser BIM + export |
| **Hypar** | US | Generative building systems, API | Dev-oriented | Reference for generators |
| **Digital Blue Foam** | Singapore | Generative urban massing + analyses | Mid | Closest Asian competitor |
| **Architechtures** | Spain | AI residential building generator (plans, units) | Mid | Reference for unit-layout generation |
| **cove.tool** | US | Energy/daylight/carbon analysis | Mid | Reference for analysis UX |

**Where Spacio differentiates:** very low price, free tier, browser-only, Nordic compliance depth, "structured model" that exports typed IFC, permit drawings from the same model, honest validation posts (AIJ, consultant comparisons).

**Where it is weak (opportunities for us):** zoning data outside the Nordics is thin; no pro forma / financial feasibility; no embodied carbon; drawings and "BIM-ready" claims are unverified; small team.

---

## 7. Strategic implications for our build

1. The product is **deterministic**: geometry kernel + parametric generators + rule engine + physics approximations. No model training is required for v1.
2. The single hardest dependency is **jurisdiction data** (zoning parameters + building-code rules). Spacio solved it for Norway first. We must choose a launch jurisdiction and ship a curated rule pack plus manual-entry fallback.
3. Four analyses are "table stakes" and cheap to build in-browser: sun hours, facade sky exposure, views, shadow. Three are heavy and go server-side: wind, noise, comfort/energy.
4. **Typed IFC export** and **auto drawings** are the credibility features for architects. They are also the most engineering-intensive; plan them as their own phase.
5. Wind is the riskiest engine. Ship a well-labelled comparative solver and validate on the AIJ cases, exactly as Spacio did.

---

## 8. Open questions only a trial account can answer

- [ ] Exact free-tier limits (1 vs 3 projects) and whether image import is the only import.
- [ ] Is "collaboration" real-time multi-cursor, or share + comment?
- [ ] What the Property System panel contains (object attributes, materials, use types?).
- [ ] How custom code rules are authored (UI? JSON?).
- [ ] Which countries have real zoning auto-lookup vs manual parameter entry.
- [ ] Unit-layout generator: does it draw actual apartment plans with rooms, or unit boundaries only?
- [ ] Drawing output format (PDF? DXF? on-screen only?) and quality.
- [ ] IFC export: real typed elements vs IfcBuildingElementProxy masses.
- [ ] Daylight factor per room: shipped or not.
- [ ] Stormwater analysis: what inputs/outputs.
- [ ] VR: WebXR in browser or exported scene.
- [ ] Rendering engine (check for `three` in bundle, WebGPU usage).

---

## 9. Sources

Official (via index snippets): spacio.ai, spacio.ai/pricing, spacio.ai/developers, spacio.ai/terms, spacio.ai/privacy, spacio.ai/blog/osloworks-case-study, spacio.ai/blog/buildings-that-know-where-they-are, test.spacio.ai (home/about/blog), app.spacio.ai/welcome, LinkedIn company page `spacioapp`, Stian Haugrim LinkedIn, YouTube `@SpacioApp` and "Spacio Basics" playlist.

Third party: aidirectory.aecmag.com/entry/spacio, aecplustech.com/tools/spacio, illustrarch.com Spacio AI review, archinatorai.com/spacio, futurebuiltai.com/tools/spacio, download.archsupply.com/spacio, engtechnica.com (wind, traffic noise, street sections, daylight articles), crunchbase.com/organization/spacio-4545, cbinsights.com/company/spacio, pitchbook.com/profiles/company/496687-78, tracxn.com Spacio profile, vekstifredrikstad.no/spacio, autodesk.com Forma environmental analysis pages, support.testfit.io release notes.

# PROJECT SATRN — Product Requirements Document

*Draft v0.1, 2026-11-04. Status: for review. Owner: Nattawoot (lineweight.design). Author: Claude (research & planning session).*

Companion documents: `01-spacio-research.md` (what Spacio is and how it works), `02-spec-sheet.md` (how we would build it), `04-build-plan.md` (phases, effort, decisions).

---

## 1. Summary

SATRN is a browser-based early-phase building design platform with full feature parity to spacio.ai: site setup from a map click, structured 3D massing with generators, live KPIs and building-code compliance, environmental analyses (sun, daylight, views, wind, noise, comfort/energy, stormwater), automatic permit drawings, collaboration, and typed BIM export. It targets architects and property developers who need to answer "what can be built here, and is it any good?" in minutes rather than weeks.

---

## 2. Problem

Early feasibility today is slow and fragmented: a designer draws masses in SketchUp/Rhino, a second person tallies areas in Excel, a planner checks the zoning PDF by hand, and consultants are hired for sun, wind, noise and daylight studies that arrive after the massing is frozen. Decisions that most affect value, comfort and permit risk are made with the least information. Existing tools either cost too much for small studios (Autodesk Forma), focus on US developer yield (TestFit), or stop at pretty pictures (image-AI apps).

---

## 3. Goals and success metrics

| Goal | Metric (12 months after launch) |
|---|---|
| Replace the first week of a feasibility study | Median time from new project to first compliant option with KPIs < 30 min (instrumented) |
| Be trusted for comparison | ≥ 80% of surveyed users rate analyses "useful for comparing options"; published validation page |
| Convert | Free → paid conversion ≥ 5%; 200 paying seats |
| Retain | Monthly active paying users retention ≥ 70% at month 3 |
| Reach parity | 100% of Spacio's verified features (section 3 of research doc) shipped by end of Phase 4 |

### Non-goals (v1)
Detailed BIM authoring, structural/MEP, photoreal rendering, cost estimating beyond area × rate, construction scheduling, image-generation AI, mobile editing (view-only mobile is fine).

---

## 4. Users and personas

| Persona | Needs | Current tools | Pains |
|---|---|---|---|
| **Studio architect (5–50 people)** doing feasibility & competitions | Fast options, live areas, early daylight/wind/noise, nice diagrams, export to Rhino/ArchiCAD | Rhino/Grasshopper, SketchUp, Excel, ArchiCAD | Manual area counting, no environmental feedback until late, Grasshopper expertise bottleneck |
| **Property developer / land acquisition** | Buildable envelope and yield in minutes; visuals to win a land deal; brief architects with validated volumes | Excel, broker PDFs, asking an architect | Days to get a volume; low confidence in zoning read |
| **Large firm computational lead** | Org-wide tool with shared rule packs, floating seats, IFC that opens in Revit | In-house GH scripts, Forma | Scripts don't scale, Forma licensing cost |
| **Municipal planner / consultant** | Check proposals against plan rules, neighbour impact (blocked light, shadows) | GIS, PDFs | Nothing interactive |
| **Student** | Learn massing and analysis for free | SketchUp | Cost |

Primary persona for v1: **studio architect**. Secondary: **developer** (the `/developers` flow).

---

## 5. Scope: feature requirements

Priority: **P0** = required for first paid launch, **P1** = required for Spacio parity, **P2** = parity-plus or later.

### F1 Accounts, organisations, plans (P0)
- Email magic-link and Google/Microsoft sign-in; ToS/privacy consent.
- Personal workspace; organisations with roles (owner/admin/member).
- Plans: Free, Starter, Pro, Business with floating concurrent seats; export day pass. Stripe checkout and customer portal; invoice option for Business.
- Plan limits enforced server-side (project count, imports, exports, simulations).

### F2 Project dashboard (P0)
- Create/rename/duplicate/archive projects; thumbnails; last edited; search; tags.
- Project settings: jurisdiction, units, default analysis dates.

### F3 Site setup (P0)
- Address search / map click sets site origin.
- Auto-build context: terrain, surrounding buildings with heights, streets with class, within radius (basic 300 m; extended 1 km on paid).
- Parcel: auto from cadastre where available; otherwise draw/edit polygon; show area.
- Zoning parameters panel: auto-filled where data exists; always user-editable; source attribution shown.
- Image underlay import with two-point georeferencing.
- Street sections: 8 band types, shared sections assigned to streets, 3D sweep.
- Import 3D context from DXF/OBJ/IFC/3DM (paid).

### F4 Modelling (P0)
- Draw footprint with snapping to parcel, setback envelope and context; rectangles, polygons, courtyards (holes).
- Push/pull faces; set storey count and storey heights; per-storey setbacks/offsets; roof types.
- Multiple buildings; categories (use) and tags (stage/designation).
- Properties panel for every selected object.
- Design options (alternatives) with duplicate and compare side-by-side.
- Undo/redo, autosave, keyboard shortcuts, 2D plan/3D toggle, section plane, measure.

### F5 Generators (P0 massing; P1 units, parking, cores)
- "Generate options" from envelope + targets (GFA, storeys, typology set) → ranked options with KPIs.
- Automatic storey subdivision with cores and corridors.
- Unit layout and **unit-mix optimiser** with target ratios and max unit count.
- Parking generator (surface/basement/podium) with stall counts vs required ratio.
- All generator output stays editable.

### F6 Live KPIs (P0)
- GFA, GIA/NIA, per-use areas, footprint, coverage %, FAR/%-BRA/%-BYA, height, storeys, units & mix, avg unit area, parking & ratio, open space, façade area, dual-aspect share, residents estimate, simple yield if €/m² given.
- KPI panel always visible; per-option comparison table; definitions on hover.

### F7 Compliance (P0 generic + launch jurisdiction; P1 Norway reference pack; P2 more)
- Live rule evaluation on every edit with error/warning/info and jump-to-object.
- Visual overlays for height and setback breaches; envelope ghost.
- Jurisdiction rule packs, versioned, with change notes; organisation custom packs; per-project overrides; expression editor for advanced users.
- One-click autofix for height/setback/storeys (explicit action, undoable).
- Compliance report export (PDF/Excel).

### F8 Fast analyses (P0)
- Sun hours on ground/roofs/façades for selectable dates; shadow animation.
- Façade daylight potential heatmap (VSC-based, climate-weighted option); blocked-light delta on neighbours.
- Views: openness and user-defined view targets.
- Results update automatically on edit (debounced) with a visible "stale" state.

### F9 Heavy analyses (P1 wind & noise; P2 comfort/energy, DF per room, stormwater)
- Wind: 12 directions, pedestrian comfort classes, per-direction speed maps, weather-weighted; method and validation stats shown.
- Traffic noise: CNOSSOS-EU; per-street traffic inputs with defaults; façade Lden/Lnight per storey; quiet side and bedroom-suitability flags; jurisdiction thresholds.
- Comfort & energy (free-running): thermal autonomy vs EN 16798-1, overheating hours, heating/cooling demand.
- Daylight factor per room with pass/fail vs threshold.
- Stormwater: impervious share, peak runoff, detention volume.
- All run as background jobs with progress; results cached per option version.

### F10 Drawings (P1)
- Auto floor plans per storey, sections at user-placed lines, elevations per façade, site plan; title block with KPIs.
- Export PDF (vector) and DXF; print scale presets.

### F11 Import/export (P0 OBJ, DXF, Excel, images; P1 IFC, 3DM; P2 dotBIM, glTF)
- IFC 4 with site/building/storey/space hierarchy and typed walls/slabs/roofs/openings from a small assembly library; verified opening in Revit, ArchiCAD, BlenderBIM.
- Excel: area schedule, unit schedule, parking, KPIs, compliance, analysis summaries.
- Export gating by plan; day pass for Starter.

### F12 Collaboration (P1)
- Share project with roles; realtime co-editing with presence; comments anchored to objects/points; activity log.
- Organisation-owned projects on Business.

### F13 Presentation (P2)
- Snapshots and read-only share viewer; diagram styles; WebXR VR walkthrough; glTF export.

### F14 Platform (P0)
- Product analytics (consent-gated), error tracking, admin console for plans/packs, status page, audit log for Business.

---

## 6. Key user stories with acceptance criteria

1. **Map-click to context.** As an architect, I click a location and within 30 s see terrain, surrounding buildings with heights, and streets, so I can start massing in context. *AC:* context appears within 30 s for a 300 m radius; building heights populated for ≥ 70% of footprints or flagged as estimated.
2. **Zoning parameters.** I see max height, setbacks, FAR/coverage for my parcel, can edit them, and the source is shown. *AC:* every parameter has a source tag (auto/manual) and the envelope ghost updates immediately on edit.
3. **Draw and push/pull.** I draw a footprint snapped to the setback line and pull it to 6 storeys; KPIs and compliance update as I drag. *AC:* KPI update ≤ 16 ms per frame on reference laptop; breach overlay appears before mouse release.
4. **Generate options.** I set target GFA and typologies and get ≥ 3 compliant options in ≤ 20 s with KPI comparison. *AC:* all options pass P0 rules; options differ in typology or orientation.
5. **Unit mix.** I set 30/50/20 for 1/2/3-bed and get a layout within ±5% of mix with max unit count. *AC:* deviation and count shown; layout editable.
6. **Sun & daylight.** I run sun hours and façade daylight and see heatmaps with legends within 5 s and a "comparative" method note. *AC:* results match Ladybug reference within tolerances in spec.
7. **Wind.** I run wind and get a comfort map in ≤ 3 min with method/validation info. *AC:* AIJ validation page exists; job progress visible.
8. **Noise.** I enter traffic on two streets and see which façades are quiet. *AC:* façade levels per storey; quiet-side flag; thresholds per jurisdiction.
9. **Drawings.** I click "Drawings" and get PDF plans/sections/elevations in ≤ 30 s. *AC:* opens in Acrobat and AutoCAD (DXF); dimensions match model.
10. **IFC export.** I export IFC and open it in Revit/ArchiCAD with storeys and spaces intact. *AC:* verified on both; walls typed, spaces named with areas.
11. **Collaboration.** A colleague edits the same option and I see their cursor and changes live. *AC:* no lost edits in a 10-minute concurrent test; offline edits merge.
12. **Developer flow.** As a developer, I enter parcel + rules and get a buildable envelope and yield summary in ≤ 15 min, plus a shareable 3D snapshot. *AC:* share link renders in viewer without login.

---

## 7. UX principles

- Map first, model second, numbers always visible.
- One screen: left tool rail, centre 3D/2D canvas, right properties/KPI/compliance tabs, bottom analysis bar.
- Every analysis result carries method, resolution, date and a trust label ("comparative, not certified").
- Generated things are editable things. No black-box outputs.
- Progressive disclosure: defaults that work; advanced panels for traffic inputs, custom rules, sky models.

---

## 8. Jurisdiction strategy (decision needed)

Compliance and zoning data are jurisdiction-specific and are the hardest part of the product. Proposed approach:

1. **Generic pack** (works anywhere with manual inputs): height, storeys, setbacks, FAR, coverage, parking ratio, min unit area, daylight threshold.
2. **Launch jurisdiction pack**: to be chosen by the owner. If the primary market is Thailand (Bangkok), the pack would encode the Building Control Act ministerial regulations (setbacks by road width and height, FAR/OSR by Bangkok Comprehensive Plan zone, building height vs road width, fire-separation distances, parking per unit/area, EIA thresholds). If Norway/EU, mirror Spacio's TEK17/BYA/BRA pack.
3. **Norway reference pack** for parity testing against Spacio.
4. Data adapters: cadastre and zoning providers per jurisdiction, with manual entry as the universal fallback.

---

## 9. Business model (parity with Spacio, EUR-equivalent pricing to be localised)

| Tier | Monthly | Yearly | Includes |
|---|---|---|---|
| Free | 0 | 0 | 1 user, 3 projects, basic terrain, sun + views, image import, no export |
| Starter | ~€21 | ~€250 | 10 projects, extended terrain, all analyses, all imports, collaboration, export via day pass |
| Pro | ~€79 | ~€948 | Unlimited projects, all exports |
| Business | — | from ~€3,995 | 2+ floating seats, org ownership, invoice, SSO (later), custom rule packs |

---

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Zoning data unavailable or wrong for launch market | Users distrust compliance | Manual-first parameters with source tags; curated pack reviewed by a local architect; disclaimers |
| Wind solver accuracy | Reputational | Validate on AIJ cases before release; label comparative; offer "detailed CFD" as later paid tier |
| IFC quality in Revit/ArchiCAD | Architects reject tool | Dedicated phase with round-trip tests; start with spaces + typed walls only |
| Browser performance on large contexts | Churn | Instancing, LOD, worker threads, limit radius by plan |
| Map/tile cost at scale | Margin | MapLibre + self-hosted Overture/OSM tiles fallback |
| Scope creep toward full BIM | Delay | Non-goals enforced; export instead of author |
| Small team vs 14 modules | Delay | Phased plan; P0 only to first paid launch |

---

## 11. Open questions for the owner

*Build note (2026-11-04): questions 1, 4 and 5 were answered by shipping pluggable options: rule packs for generic, Norway and Thailand (Bangkok); an in-house 2D lattice-Boltzmann wind solver with an AIJ harness; a key-free MapLibre/OpenStreetMap/AWS-terrain stack with Mapbox switchable by environment variable. Pricing, hosting region, team and product name remain the owner's decisions.*

1. **Launch jurisdiction and language**: Thailand (Bangkok) first, Norway/EU first, or generic international? This decides the first rule pack, data providers and hosting region.
2. **Primary persona**: architects first (Spacio's path) or developers first (yield/visual offers)?
3. **Pricing currency and levels**: mirror Spacio in EUR, or local pricing?
4. **Build vs buy for wind**: in-house LBM solver (effort, control) vs OpenFOAM batch (slower, proven) vs third-party CFD API.
5. **Map provider**: Mapbox (fast start, cost) vs MapLibre + Overture (free, more setup).
6. **Team and timeline**: who builds? Target for first paid launch?
7. **Brand/name** for the product (SATRN is a codename).
8. **Trial of Spacio**: can someone open a free account to close the [I]/[T] verification list in the research doc?

# Build status

*Updated 2026-11-04.*

## Done

**Platform**
- pnpm monorepo: `apps/web` (Next.js 15, React Three Fiber, MapLibre), `packages/geometry`, `packages/model`, `packages/analyses`. 49 unit tests.
- Design system after the reference boards: dark dotted field, frosted glass panels, orange accent with teal data colours, stat tiles, pill toolbars, callouts on the model, red highlight for code violations.

**Site**
- Map-based project creation (address search, origin click, parcel outline), OpenStreetMap context (buildings with heights, streets with traffic defaults), terrain from AWS Terrain Tiles (buildings placed on ground level), image underlays with placement, street sections (8 band types, presets, swept along streets).

**Model and design**
- Structured model (site → options → buildings → storeys → units/cores, parking). Draw polygon/rectangle buildings with snapping, drag to move, storey handle, undo/redo, options with duplicate and compare.
- Massing generator (aligned/rotated bars, perimeter, L-block) that reduces storeys until rules pass.
- Unit layout generator (corridor strip model, cores by travel distance) with unit-mix optimiser; basement and surface parking planners.

**KPIs and compliance**
- 20 live KPIs; rule engine with safe expressions and geometric checks; generic international pack (height, storeys, setbacks per edge, FAR, coverage, OSR, uses, parking, minimum unit area); autofix actions.

**Analyses** (see `06-analysis-methods.md`)
- Shadows, sun hours, façade daylight potential (VSC), views, traffic noise (Lden/Lnight, quiet side), wind comfort (2D LBM, Lawson classes), daylight factor per unit, stormwater, free-running comfort and energy (5R1C with EPW or synthetic climate).

**Outputs**
- Drawings: site plan, floor plans with units, elevations, sections (A3 SVG/PDF with title block and KPIs).
- Exports: IFC4 (validated with IfcOpenShell: 0 schema errors), dotBIM, glTF, OBJ, DXF, Excel, project JSON, PNG snapshot.
- Read-only share link (project compressed into the URL; no server needed).

## Not yet (needs a backend deployment)

Accounts and organisations, billing and floating seats, cloud project storage, real-time collaboration and comments, SSO. The schema and UI are ready for these; see `02-spec-sheet.md` M1/M12 and `04-build-plan.md` Phase 2/4. Rhino 3DM export (use OBJ/IFC meanwhile) and WebXR VR (use the glTF export in a headset browser) are also pending.

## Verification

Headless Playwright runs exercise: sample load, draw, storey change, generate options, unit layout, parking, sun hours, daylight, views, noise, wind, thermal run, drawings preview, IFC/dotBIM/glTF/PDF download. No console errors. The live map and OSM/terrain fetches could not be exercised from the build sandbox (network policy) and should be tried in a normal browser.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Tests: `pnpm test`. Typecheck: `pnpm typecheck`.

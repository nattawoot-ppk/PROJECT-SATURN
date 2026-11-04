# Build status

*Updated 2026-11-04.*

## Done (Phase 0 + Phase 1 core)

- Monorepo: pnpm workspaces, shared TypeScript config, vitest.
- `packages/geometry`: polygon maths, Clipper-based offsets/booleans, per-edge setback envelope, geo conversions, triangulation. 8 tests.
- `packages/model`: zod project schema (site, zoning, options, buildings, storeys, units, parking), KPI engine (20 KPIs), safe expression evaluator, rule engine with built-in geometric checks, generic international rule pack. 7 tests.
- `apps/web` (Next.js 15, React Three Fiber, MapLibre):
  - Dashboard with browser-stored projects, sample project, JSON import/export.
  - New project: address search, map click for origin, parcel drawn on the map, OpenStreetMap context (buildings with heights, streets with traffic defaults).
  - 3D editor: draw polygon/rectangle buildings with snapping, select/move by dragging, storey handle, keyboard shortcuts, undo/redo, design options.
  - Live KPIs, zoning parameter panel with per-edge setbacks, compliance panel with autofix (clamp height/storeys, trim to envelope), buildable envelope overlay.
  - Massing generator: aligned/rotated bars, perimeter block, L-block, auto-reduced to pass rules, ranked by target GFA and compactness.
  - Exports: OBJ, DXF, Excel (KPIs per option, building and storey schedules, compliance, zoning), project JSON.
- Verified by a headless Playwright run: sample load, draw, storey change, generate, export, no console errors.

## Not yet (see `04-build-plan.md`)

Terrain, image underlays, street sections, unit layouts and parking generator, sun/daylight/wind/noise analyses, drawings, IFC/3DM, accounts, billing, collaboration.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Tests: `pnpm test`. Typecheck: `pnpm typecheck`.

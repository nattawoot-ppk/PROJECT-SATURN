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

**Cloud (apps/api, Fastify + Prisma)**
- Passwordless email sign-in (magic link; dev mode returns the link), JWT session cookie/bearer.
- Organisations with roles, floating seat leases (business plan), plan limits (free: 3 personal projects).
- Cloud projects with optimistic locking (409 conflict returns the newer document; the editor offers load-theirs or overwrite), share tokens, comments anchored to buildings/options.
- Billing: plan catalogue, Stripe Checkout session creation and webhook handler (active once keys are configured; returns 501 otherwise).
- SQLite for development, Postgres for production (change the Prisma datasource provider). 2 integration tests cover the whole flow.
- Web: sign-in pages, Cloud panel (upload/save, conflict handling, comments), cloud project list on the dashboard. Enabled by `NEXT_PUBLIC_API_URL`.

## Not yet

Real-time multi-cursor co-editing (CRDT): the model is JSON-document based and ready for Yjs, but the sync server is not built; collaboration today is save-with-locking plus comments. SSO (SAML), email delivery provider for magic links (dev mode prints the link), Rhino 3DM export (use OBJ/IFC meanwhile), WebXR VR (use the glTF export in a headset browser), jurisdiction-specific rule packs and zoning auto-lookup beyond the generic pack, wind validation against AIJ cases.

## Verification

Headless Playwright runs exercise: sample load, draw, storey change, generate options, unit layout, parking, sun hours, daylight, views, noise, wind, thermal run, drawings preview, IFC/dotBIM/glTF/PDF download. No console errors. The live map and OSM/terrain fetches could not be exercised from the build sandbox (network policy) and should be tried in a normal browser.

## Run locally

```bash
pnpm install
pnpm dev                # web on http://localhost:3000 (browser-only mode)
```

With the cloud API:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:push            # creates the SQLite dev database
pnpm dev:api            # API on http://localhost:4000
pnpm dev
```

Tests: `pnpm test` (51 unit and integration tests). Typecheck: `pnpm typecheck`. Lint: `pnpm lint`.

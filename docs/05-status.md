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
- Billing: plan catalogue, Stripe Checkout subscriptions and the €30 Starter export day pass (one-off payment), webhook handler, entitlements endpoint; the web app locks exports for Free/Starter users once the cloud is configured and offers the day pass (active once keys are configured; 501 otherwise).
- SQLite for development, Postgres for production (change the Prisma datasource provider). 2 integration tests cover the whole flow.
- Optional product analytics with PostHog (EU host, loads only with a key, respects a local opt-out).
- Web: sign-in pages, Cloud panel (upload/save, conflict handling, comments), cloud project list on the dashboard. Enabled by `NEXT_PUBLIC_API_URL`.
- **Real-time co-editing**: Yjs rooms served by the API over WebSocket (y-websocket protocol); per-building merge of concurrent edits, presence with coloured outlines and name tags on the model, autosave of the merged document every 5 s. Shared mapping lives in `packages/realtime` (tests cover round-trip, concurrent merge and deletion); an API integration test syncs two clients and checks persistence.
- **Email delivery** for magic links: Resend or a generic webhook (first configured wins); dev mode returns the link.
- **Single sign-on**: OpenID Connect authorization-code flow (Google Workspace, Microsoft Entra, Okta, Auth0, Keycloak) with JWKS-verified ID tokens, optional allowed domains and auto-join of an organisation.

**Custom rules**: project-level rules written as expressions over KPIs, zoning and building figures (with example templates and live evaluation), merged with the active pack on every edit.

**Rule packs**: generic international, Norway reference (pbl/TEK17: %-BYA, %-BRA, gesims/møne, 4 m boundary, room height, daylight, parking) and Thailand · Bangkok (Ministerial Regulation 55/33: FAR/OSR per zone, 2× road-width height rule, high-rise and extra-large building road access and setbacks, open space, window distances, parking, EIA threshold). Switch in the Zoning panel.

**More outputs**: Rhino 3DM export (layers per building, unit polylines, context, streets, user text), WebXR button for VR headsets and AR phones (appears when the browser supports immersive sessions).

**Wind validation harness**: `packages/analyses/validation/aij.ts` builds AIJ cases A and B, scores the solver against measured points when the datasets are supplied, and checks the qualitative pattern in a test.

## Remaining

- Quantitative AIJ scoring needs the measured datasets (not redistributable); the harness and qualitative test are in place.
- Zoning auto-lookup from municipal services (parameters are entered manually; packs supply defaults and rules).
- SAML (OIDC covers the common identity providers).
- Production deployment: Postgres datasource, Stripe keys and webhook signature verification, an email provider key.

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

Tests: `pnpm test` (63 unit and integration tests). Typecheck: `pnpm typecheck`. Lint: `pnpm lint`.

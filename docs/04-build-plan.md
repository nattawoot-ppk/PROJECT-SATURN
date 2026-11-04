# PROJECT SATURN — Build Plan

*Draft v0.1, 2026-11-04. Phased delivery to reach spacio.ai parity. Effort assumes 2–3 full-stack engineers plus one simulation/geometry engineer, with the owner as product/architecture lead. Adjust after decisions in PRD section 11.*

---

## Phase 0 — Decisions and setup (1–2 weeks)

- Resolve PRD open questions (jurisdiction, persona, map provider, wind approach, hosting region).
- Open a Spacio free account; complete the verification checklist in `01-spacio-research.md` section 8; capture screenshots of each screen for UX reference.
- Create monorepo skeleton (pnpm + Turborepo), CI, environments (dev/staging), design tokens, UI kit.
- Write the shared `packages/model` schema (TypeScript + JSON Schema) from `02-spec-sheet.md` section 3. Everything else depends on it.

**Exit:** schema approved; empty app deploys; decisions logged in `docs/decisions/`.

## Phase 1 — Site + editor + KPIs (6–8 weeks) → internal alpha

- Auth, orgs, projects dashboard (F1, F2 minimal, no billing yet).
- Site builder: map pick, terrain, context buildings, streets, parcel draw, zoning parameter form (F3 minus street sections/underlays).
- 3D editor: draw footprint, push/pull, storeys, roofs, categories/tags, properties, options, undo/autosave (F4).
- Live KPI engine (F6) and generic rule pack with overlays and autofix (F7 generic).
- Exports: OBJ, DXF (3D faces), Excel KPI sheet; image underlay import (F11 P0).

**Exit:** an architect can model a compliant scheme on a real site and export areas in under 30 minutes.

## Phase 2 — Fast analyses + generators + billing (6–8 weeks) → private beta

- Sun hours, shadows, façade daylight potential, views, blocked-light delta (F8), GPU/worker pipeline.
- Massing generator with typologies and ranking; storey subdivision with cores (F5 P0 part).
- Street sections and underlays (rest of F3).
- Stripe plans, limits, day pass (F1 complete); analytics and error tracking (F14).
- Launch-jurisdiction rule pack v1, reviewed by a local practitioner.

**Exit:** 10 external beta users; validation page for sun/VSC vs Ladybug/Radiance.

## Phase 3 — Heavy analyses + drawings + IFC (8–10 weeks) → public launch (paid)

- Job infrastructure (queue, workers, progress, caching).
- Wind solver (chosen approach) with AIJ validation report; traffic noise (CNOSSOS-EU) with threshold packs (F9 P1).
- Drawing generator PDF/DXF (F10).
- IFC 4 export with typed elements, Rhino 3DM export; IFC/3DM import (F11 P1); round-trip tests in Revit, ArchiCAD, BlenderBIM.
- Unit layout + unit-mix optimiser + parking generator (F5 P1).

**Exit:** parity with Spacio's P0/P1 feature set; public pricing live.

## Phase 4 — Collaboration + remaining parity (6–8 weeks)

- Realtime co-editing (Yjs), roles, comments, org-owned projects, floating seats (F12).
- Comfort & energy free-running, daylight factor per room, stormwater (F9 P2).
- dotBIM and glTF export; snapshots and read-only viewer; WebXR VR (F13).
- Norway reference pack for side-by-side parity testing against Spacio.

**Exit:** 100% of verified Spacio features shipped.

## Phase 5 — Beyond parity (ongoing)

Candidates where Spacio is weak: financial pro forma / land residual, embodied carbon, more jurisdiction packs with auto-lookup, detailed CFD tier, Revit plugin for live sync, API for enterprise, ML land-value signals.

---

## Indicative effort summary

| Phase | Calendar | Engineer-weeks (approx.) |
|---|---|---|
| 0 | 1–2 wks | 4 |
| 1 | 6–8 wks | 24 |
| 2 | 6–8 wks | 24 |
| 3 | 8–10 wks | 36 |
| 4 | 6–8 wks | 24 |
| **Total to parity** | **~7–9 months** | **~110** |

Solo-builder note: with one strong engineer plus AI-assisted coding, expect roughly 2× the calendar time; the critical path is geometry robustness (Phase 1), the wind solver and IFC typing (Phase 3).

---

## Proposed repository layout

```
PROJECT-SATURN/
├─ apps/
│  ├─ web/            Next.js app: dashboard, editor, viewer
│  └─ api/            NestJS API, jobs, billing, auth
├─ services/
│  ├─ sim-python/     FastAPI workers: daylight (Radiance), noise, comfort/energy, exports (IFC/DXF/3DM/Excel), drawings
│  └─ sim-wind/       Rust LBM/RANS solver (or OpenFOAM wrapper)
├─ packages/
│  ├─ model/          schema, KPI formulas, rule engine (shared TS)
│  ├─ geometry/       2D/3D ops wrappers (clipper2, manifold, earcut, turf)
│  ├─ rule-packs/     jurisdiction packs (JSON) + tests
│  ├─ analyses/       in-browser sun/VSC/views kernels (TS + WGSL)
│  └─ ui/             design system
├─ data/              EPW index, test sites, validation datasets (AIJ)
├─ docs/              this folder; ADRs in docs/decisions/
└─ infra/             Docker, k8s/fly manifests, CI
```

---

## First-sprint backlog (if the plan is approved as-is)

1. Monorepo + CI + deploy skeleton.
2. `packages/model`: schema, validators, sample fixtures (bar, L, courtyard).
3. KPI engine with unit tests against hand calcs.
4. Map pick → site origin → terrain tiles → context extrusion (Mapbox or Overture spike, pick one).
5. Editor: parcel draw, footprint draw with snapping, push/pull, storeys.
6. Generic rule pack + overlays.
7. Excel/OBJ/DXF export.

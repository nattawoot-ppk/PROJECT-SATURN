# ADR 0001 — Assumptions taken to start building (2026-11-04)

The owner asked to start building before the PRD open questions were answered. These defaults were chosen so that nothing blocks; each is reversible.

| Question | Assumption | Reversal cost |
|---|---|---|
| Launch jurisdiction | Generic international rule pack with manual zoning parameters; jurisdiction packs are plug-in JSON | Low: add a pack |
| Primary persona | Architect-first (Spacio's path) | Low |
| Map provider | Key-free stack: MapLibre GL + OpenFreeMap style tiles, OpenStreetMap Overpass for context buildings/streets, AWS Terrain Tiles for elevation. Mapbox can be enabled by env var later | Low: provider interface |
| Wind solver | Deferred to Phase 3; interface stubbed | None yet |
| Hosting region | Undecided; code is region-agnostic | None yet |
| Stack | pnpm monorepo, TypeScript, Next.js (App Router), React Three Fiber, zod, vitest | Medium |
| Persistence in Phase 1 | Browser localStorage for projects; server DB arrives with auth in Phase 2 | Low: same document schema |
| Codename | "SATRN" until a product name is chosen | None |

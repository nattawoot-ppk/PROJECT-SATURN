# PROJECT SATURN

Early-phase building design platform (feature-parity target: spacio.ai). Phase 1 build in progress; see `docs/05-status.md`.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test
```

| Doc | Purpose |
|---|---|
| [docs/01-spacio-research.md](docs/01-spacio-research.md) | Deep teardown of spacio.ai: company, features (with confidence tags), engine, data, competitors |
| [docs/02-spec-sheet.md](docs/02-spec-sheet.md) | Technical specification: modules, data model, engines, stack, NFRs, API |
| [docs/03-prd.md](docs/03-prd.md) | Product requirements: goals, personas, prioritised features, user stories, risks, open questions |
| [docs/04-build-plan.md](docs/04-build-plan.md) | Phased delivery plan, effort, repo layout, first sprint |
| [docs/05-status.md](docs/05-status.md) | What is built, what is not, how to run |
| [docs/decisions/](docs/decisions/) | Architecture decision records |

Layout: `apps/web` (Next.js editor), `packages/model` (schema, KPIs, rules), `packages/geometry` (polygon ops).

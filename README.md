# PROJECT SATURN

Early-phase building design platform (feature-parity target: spacio.ai). Feature-complete against the Spacio.ai parity list, including real-time co-editing; see `docs/05-status.md` for what is built, how it is verified and how to run it.

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
| [docs/06-analysis-methods.md](docs/06-analysis-methods.md) | Method, inputs, validation status and limits of every analysis |
| [docs/07-deployment.md](docs/07-deployment.md) | Docker Compose stack, secrets table, hosting notes, CI |
| [docs/decisions/](docs/decisions/) | Architecture decision records |

Layout: `apps/web` (Next.js editor), `apps/api` (Fastify + Prisma cloud API), `packages/model` (schema, KPIs, rules, generators), `packages/geometry` (polygon and terrain ops), `packages/analyses` (solar, sky, noise, wind, energy, water).

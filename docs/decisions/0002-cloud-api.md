# ADR 0002 — Cloud API shape (2026-11-04)

**Decision.** A small Fastify + Prisma service (`apps/api`) owns accounts, organisations, projects, comments and billing. The web app keeps working without it (browser storage + URL share links) and switches to cloud mode when `NEXT_PUBLIC_API_URL` is set.

**Why.** Spacio's collaboration tier is organisation ownership, floating seats and shared projects; those need a database and sessions, not a real-time engine. Shipping save-with-optimistic-locking plus comments first gives teams a working shared source of truth. Real-time CRDT editing (Yjs) is additive: the project document is already a single JSON value per option.

**Consequences.**
- SQLite in development, Postgres in production (one-line datasource change).
- Magic-link sign-in has no email provider yet; development mode returns the link in the response.
- Billing uses Stripe's REST API directly so the service runs without keys; webhook signature verification must be enabled in deployment.
- Plan limits are enforced server-side for project counts; export/simulation gating by plan is enforced in the web app and should be mirrored in the API when exports move server-side.

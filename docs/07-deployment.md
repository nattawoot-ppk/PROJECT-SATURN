# Deployment guide

SATRN runs as three processes: Postgres, the API (REST + WebSocket rooms) and the Next.js web app. Everything below is in `infra/` and the two Dockerfiles.

## 1. One-command stack (Docker Compose)

```bash
cp infra/.env.example infra/.env     # fill secrets
docker compose -f infra/docker-compose.yml up --build
```

The API container pushes the Prisma schema (`apps/api/prisma/schema.postgres.prisma`) on start. Web is built with `NEXT_PUBLIC_API_URL` pointing at the API origin.

## 2. Secrets and services

| Variable | Purpose | Where to get it |
|---|---|---|
| `JWT_SECRET` | signs sessions | any long random string |
| `RESEND_API_KEY` or `EMAIL_WEBHOOK_URL` | magic-link email | resend.com, or your own mailer webhook |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET` | subscriptions and the day pass | Stripe dashboard: products for Starter, Pro, Business, Day pass; webhook on `checkout.session.completed` to `/billing/webhook` |
| `OIDC_*` | Google Workspace, Entra ID, Okta, Auth0, Keycloak | the identity provider's app registration; redirect URI `API_ORIGIN/auth/sso/callback` |
| `SAML_*` | enterprise SAML | the IdP; give it `API_ORIGIN/auth/saml/metadata` |
| `NEXT_PUBLIC_MAP_STYLE` | Mapbox or other tiles | optional; OpenFreeMap is used otherwise |
| `NEXT_PUBLIC_NO_PLAN_WMS`, `NEXT_PUBLIC_TH_PLAN_ARCGIS` | zoning auto-lookup services | Geonorge WMS / Bangkok CPD ArcGIS endpoints |

## 2b. Single-origin mode (one port)

The web app can proxy the API under its own origin: build with `NEXT_PUBLIC_API_URL=/api` and run with `API_PROXY=http://localhost:4000`. Every REST call then goes through the web server, which is convenient behind one tunnel or preview URL. Real-time rooms need a direct WebSocket to the API, so expose port 4000 as well for co-editing.

## 2c. Static hosting (no server)

`NEXT_STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/satrn pnpm --filter web build` writes a fully static site to `apps/web/out` (14 MB) that runs browser-only on any CDN or static host; cloud features stay off unless `NEXT_PUBLIC_API_URL` points at a reachable API.

## 3. Managed hosting

- Web: any Node host (Vercel, Fly, Render). Build env: `NEXT_PUBLIC_API_URL`.
- API: a long-running Node service with WebSocket support (Fly, Render, Railway, ECS). Not serverless: real-time rooms keep connections open.
- Database: managed Postgres; set `DATABASE_URL` and run `npx prisma db push --schema prisma/schema.postgres.prisma` once.

## 4. Webhook verification

`/billing/webhook` must sit behind Stripe signature verification in production. Terminate it with the Stripe CLI or SDK in your edge/proxy, or put the raw-body signature check in front of the route (`STRIPE_WEBHOOK_SECRET` is already in the environment template).

## 5. Continuous integration

`.github/workflows/ci.yml` runs typecheck, tests, lint and the web build on every push, and builds both Docker images on `main`.

## 6. Wind validation data

On a machine with internet access run `node packages/analyses/validation/fetch-aij.mjs`, then `pnpm --filter @saturn/analyses validate:aij` and record the hit rate in `docs/06-analysis-methods.md`.

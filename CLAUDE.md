# CLAUDE.md — SermonSmith

Multi-platform sermon-prep app. npm-workspaces monorepo. Auto-generated map.

## Tech stack
React 18 + Vite 6 + TS + Tailwind + Radix + TanStack Query (web) · Express + Prisma + PostgreSQL (api) · JWT via httpOnly cookies · OpenAI (GPT-4o-mini) · Stripe · Electron (desktop) · Capacitor (mobile) · Deploy: Vercel (web) + Railway (api+PG).

## Monorepo layout
- `apps/web` — React/Vite, → Vercel
- `apps/desktop` — Electron wrapper (CommonJS `main.cjs`/`preload.cjs`)
- `apps/mobile` — Capacitor, wraps built web
- `services/api` — Express + Prisma, → Railway
- `packages/shared` — shared utils (minimal)

## Run / build / test
```bash
npm run dev               # web @ :5173
npm run dev:api           # api @ :3001 (--watch)
npm run build             # build:web + check:api
npm run test              # api vitest
npm run db:migrate        # Prisma dev migrate
npm run db:migrate:deploy # prod
npm run db:seed
npm run electron:dev
npm run cap:sync
npm run release:check
```

## Entry points
- Web: `apps/web/src/main.jsx` → `App.jsx` (Router + pagesConfig + AuthProvider); `apps/web/src/api/apiClient.js` (fetch wrapper, resolves API base: Electron config → `VITE_API_URL` → origin)
- API: `services/api/src/index.js` → `buildApp()` (helmet, compression, CORS, rate-limiters, 5 route groups)
- Desktop: `apps/desktop/electron/main.cjs`

## Directory map
- `apps/web/src/` — ai/ (Larry sermon builder, Arlynn series builder), api/, components/, hooks/, lib/ (AuthContext, query-client), pages/
- `services/api/src/` — config/env.js (Zod, hard-fails in prod), middleware/ (auth, rateLimitStore), routes/ (auth, entities, ai, functions, community), services/email.js
- `services/api/prisma/schema.prisma` — User, Entity (JSON blobs, type-indexed), PasswordReset

## Where things live
| Feature | Location |
|---|---|
| Auth | `services/api/src/routes/auth.js`, `middleware/auth.js`, `apps/web/src/lib/AuthContext.jsx` (httpOnly cookies) |
| DB / migrations | `services/api/prisma/` (`schema.prisma`, `migrations/`) |
| Env vars | `services/api/.env.example` + `src/config/env.js` (Zod) |
| API client | `apps/web/src/api/apiClient.js` |
| AI | `apps/web/src/ai/` + `routes/ai.js` (OpenAI, `OPENAI_MODEL`) |
| Billing | `routes/functions.js` webhook `/api/stripe/webhook` (raw body, idempotent) |
| Email | `services/api/src/services/email.js` (Resend) |
| Rate limits | `middleware/rateLimitStore.js` (auth 20/15m, register 10/1h, reset 5/15m, ai 30/1m, public 60/1m) |

## Gotchas
- **Deploys:** web → Vercel (GitHub integration, builds from repo root → `apps/web/dist`) is genuinely automatic. API → Railway's GitHub source was found disconnected on 2026-07-05 (`sermonsmith-api` service had no repo linked — every past "auto-deploy" was actually a manual `railway up`, confirmed by a 13.5-hour gap with zero deploy activity across a merged PR). Reconnected via Railway's GraphQL `serviceConnect` mutation (repo `buckeye7066/sermonsmith`, branch `main`) — auto-deploy on merge to main should now work going forward, but after any high-stakes merge, still check `railway status --json` (service `source.repo` should read `buckeye7066/sermonsmith`) or deployment timestamps before assuming it fired, since this has silently regressed before. Do not re-add a deploy GitHub Action: a prior no-op "Deploy API (Railway)" workflow was removed because it reported a green check while doing nothing.
- **httpOnly cookie auth:** frontend never touches the JWT; Electron resolves API base at runtime via `window.electron.getApiUrl()`.
- **Electron files MUST stay `.cjs`** (`main.cjs`/`preload.cjs`) while rest of desktop is ESM — renaming to `.js` breaks startup.
- **Password reset tokens** SHA-256-hashed at rest; `tokenVersion` bump invalidates all old JWTs on password change.
- **Stripe webhook** needs raw-body mount for signature verification; idempotent.
- **Feature flags** `DISABLE_AI`/`DISABLE_BILLING`/`DISABLE_PASSWORD_RESET` skip env validation of their secrets in dev/test.
- **CORS** `CORS_ORIGIN` allowlist + `COOKIE_SAMESITE` ("none" cross-domain Railway/Vercel, "lax" same-domain); `COOKIE_DOMAIN` for subdomain sharing.
- Entity table = JSON blobs keyed by `(type, userId)`.

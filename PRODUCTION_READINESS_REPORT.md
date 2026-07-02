# SermonSmith Production Readiness Report — 2026-07-01

Full fresh pass over code quality, security, tests, and configuration.
Scope: npm-workspaces monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `services/api`, `packages/shared`).
Deploys are automatic on merge to `main`: Vercel (web, repo root → `apps/web/dist`) and Railway (API, native GitHub integration).

## 1. System map (verified)

- **Web** (`apps/web`): React 18 + Vite 6, JSX with `tsc -p jsconfig.json` typecheck (checkJs off — syntax/JSX-level checking), Tailwind + Radix, TanStack Query, react-router-dom **7.18.0** (RCE advisory long since cleared). Tests: Vitest + Testing Library (10 files) + Playwright e2e smoke (3 tests, backend-independent).
- **API** (`services/api`): Express 4 + Prisma 6 + PostgreSQL. Entry `src/index.js` → `buildApp()`. Middleware: helmet, compression, CORS allowlist, origin-based CSRF guard for cookie-authenticated state changes, per-route rate limiters (auth 20/15m, register 10/1h, reset 5/15m, AI 30/1m, public Bible 60/1m, client-error 20/1m), 2 MB JSON limit, request-id, sanitized final error handler (500 internals hidden), graceful shutdown + prisma disconnect, unhandledRejection/uncaughtException reporting.
- **Auth**: JWT (HS256, 1-day TTL, `tokenVersion` revocation) in httpOnly session cookie; Bearer fallback for native clients. Ban + soft-delete enforced at both login and per-request token validation. Admin allowlist only via `ADMIN_EMAILS` env.
- **Env validation**: `src/config/env.js` (Zod) hard-fails in production on missing/weak secrets; feature flags `DISABLE_AI`/`DISABLE_BILLING`/`DISABLE_PASSWORD_RESET` relax only their own keys. `.env.example` files exist for api + web and are current.
- **Billing**: Stripe checkout/portal/webhook (raw-body signature verification, DB-backed idempotency via `stripe_events`, premium sync on subscription lifecycle).
- **AI**: OpenAI via `routes/ai.js`; per-user daily usage in `ai_usage` table; model allowlist; token ceilings; audit log (`ai_audit_logs`).
- **DB**: `prisma/schema.prisma` — 20+ typed models (migrated off the generic Entity blob for core content), 8 migrations, `prisma validate` passes.
- **CI** (`.github/workflows/ci.yml`): 6 jobs — lint+typecheck, unit tests, integration tests against real Postgres 16 service (with `prisma migrate deploy`, no db-push fallback), web production build (artifact), Playwright e2e, production dependency audit.

Prior-audit traps re-verified:
- "Shallow typecheck" — **no longer true**: web runs full `tsc` over src; API runs `scripts/typecheck.mjs` which `node --check`s all 32 source files.
- "apps/web has zero tests" — **no longer true**: 70 unit tests in 10 files + 3 e2e smoke tests.
- coerceToSchema AI shape-drift guard (PR#32) — intact; coverage verified in section 3.
- Inert deploy workflow — confirmed removed (PR#40); only `ci.yml` remains.

## 2. Baseline verification (all run locally 2026-07-01, Node 24.18.0 / npm 11.16.0)

| Command | Result |
|---|---|
| `npm ci` | PASS (no lock drift; 0 vulnerabilities; some install scripts gated by local allow-scripts policy — local-only, not a repo issue) |
| `npm run db:generate` | PASS (Prisma client generated) |
| `npm run lint` | PASS — 0 errors, 1 pre-existing warning (`Reader.jsx:515` exhaustive-deps) |
| `npm run typecheck` | PASS — web `tsc` clean; API 32/32 files parse |
| API tests (`vitest run`) | PASS — 155 tests / 15 files |
| Web tests (`vitest run`) | PASS — 70 tests / 10 files |
| `npm run build:web` | PASS — production bundle built in ~41 s |
| API boot w/o live DB | PASS — `buildApp()` constructs cleanly with test env (DB only needed at request time / `readyz`) |
| `npx prisma validate` | PASS (requires any syntactically valid `DATABASE_URL` present, as expected) |
| Migration review (read-only) | 8 migrations, linear, `migration_lock.toml` = postgresql. Not executed against any real DB. |
| `npx playwright test` (e2e) | PASS — 3/3 |
| `npm audit` (full + `--omit=dev`) | PASS — **0 vulnerabilities** |

Integration tests (`RUN_INTEGRATION=1`) not run locally (no local Postgres); covered by CI's dedicated job with a real Postgres 16 service.

Note: local Node is 24.x while `engines` declares `>=20 <23`; CI pins Node 20. Everything passes on 24 — engines range widened in this pass (see fixes).

## 3. Deep audit findings

Two focused sub-audits (web app; API routes/services) plus direct review of `index.js`, `middleware/auth.js`, `config/env.js`, `routes/auth.js`, `routes/functions.js`.

### HIGH
- **IDOR — forged SharedLink reads another user's private entity.** `routes/community.js` `GET /share/:slug` loaded the target row purely from `link.data.resourceId` with no check that the link's creator owned it. The legitimate mint path (`createShareableLink`) enforces ownership, but `SharedLink` was also in the generic entity write allowlist, so any authenticated user could `POST /api/entities/SharedLink` with a victim's `resourceId` and then read it via the slug. **FIXED** (see §5).

### MEDIUM
- **Stored-XSS in sermon print/export.** `apps/web/src/pages/MySermons.jsx` `handlePrint` interpolated `sermon.title/topic/anchor_passage/big_idea/points[].title/content` into `printWindow.document.write(...)` with no escaping. Sermons can be forked/shared from other users, so a crafted field yields same-origin script execution in the print window. **FIXED**.
- **`/ai/image` prompt/size unvalidated.** `routes/ai.js` read `req.body.prompt/size` with only a truthy check (unlike `/invoke`), passing `size` straight to OpenAI. Premium-gated + quota-counted so blast radius is small, but it was an unbounded input path. **FIXED** with a zod schema.

### LOW
- **StreamLLM had no idle timeout.** `apps/web/src/api/apiClient.js` streaming reader could hang forever on a stalled upstream (no AbortController, unlike `apiFetch`). **FIXED** with a 60s idle-reset timeout.
- **`typedContent.listTypedContent` tenant scope overridable.** `where: { userId, ...options.where }` let a caller-supplied `options.where.userId` override the scope. Dormant (helper not yet wired to a route) but a footgun. **FIXED** (pin `userId` last).
- **`engines` blocked Node 24.** Was `>=20 <23`; local + modern runtimes are 24. **FIXED** → `>=20` (CI still pins 20).
- **Reader.jsx:515 exhaustive-deps warning** — pre-existing, cosmetic, non-blocking. Left as-is (touching it risks a render-loop regression; out of scope for a hardening pass).

### Reviewed and INTENTIONAL (no change)
- **errorReporter default recipient `dr.johnwhite@axiombiolabs.org`.** Flagged by the audit as a "third-party" fallback, but this is the owner's own configured default alert address (owner Error→Owner Email Alerts design). Left intact; `ERROR_REPORT_EMAIL`/`ADMIN_EMAILS` still override it.
- **Password reset via public proxy** — intentional Axiom app-links design.
- **Public Bible endpoints use `optionalAuth`** — intentional; rate-limited (60/min) and capped to the licensed translation registry.
- **Community `is_ai_response` / `is_accepted_answer`** — LOW cosmetic spoofing (a user can style their own reply as "AI Assistant" or self-accept). Not a data/security risk; left for a product decision rather than changing community behavior in a hardening pass.
- **`Entity.data` `.passthrough()`** — storage-abuse only, already bounded by the 2MB body limit and 200-item bulk cap.

### Verified SOLID (coverage confirmed)
- **coerceToSchema AI shape-drift guard intact** and coverage complete: all schema-bearing `InvokeLLM` calls coerce at the `apiClient` boundary; both `StreamLLM` callers (`SermonBuilder`, `BibleStudy`) normalize partial + final output. Schema-less calls return plain strings rendered as text.
- **No secrets committed** anywhere in tracked src/public/config (only `.env.example` placeholders and doc templates).
- **No JWT in localStorage** — httpOnly cookie only; `credentials: 'include'`.
- **API auth/authorization**: every AI/entities/community/functions route requires `authenticateToken`; admin routes wrapped in `requireAdmin`; entity CRUD scopes by `req.userId`/ownership; `User` type admin-gated with role/premium/email/password stripped on the generic update path; client `user_id/userId/id` stripped on create/bulk. No dynamic `prisma[type]` model access.
- **AI abuse controls**: per-tier model allowlist, prompt/system/schema length caps, token + temperature clamps, DB-backed atomic per-user/day quota with refund-on-transient-failure, bounded 90s timeout, retry only on 429/5xx (not 504).
- **No SSRF**: Bible/premium upstream hosts are fixed constants; only path segments are user-influenced (encoded/coerced/registry-resolved).
- **Stripe webhook**: raw-body signature verification, DB idempotency (record-after-success), no PII logging.
- **CSRF**: origin-allowlist guard on cookie-authenticated state changes.
- **Error handler** hides 500 internals; no stack traces / raw Prisma errors to clients.
- **Email/errorReporter** HTML-escape all interpolated fields; subjects CRLF-stripped.

## 4. Fix plan (smallest-first, behavior-preserving)

1. MySermons print XSS → add `escapeHtml` helper, escape all interpolated fields.
2. `/ai/image` → add `imageRequestSchema` (bounded prompt, size allowlist).
3. `typedContent` → pin `userId` last in the where clause.
4. Community IDOR → enforce `resource.userId === link.userId` in `/share/:slug`; plus defense-in-depth: block `SharedLink` from the generic entity create/bulk path (`SERVER_MANAGED_TYPES`).
5. StreamLLM → add idle-timeout AbortController.
6. `engines` → widen to `>=20`.
7. Tests: forged-link IDOR (allow + deny), SharedLink generic-create block (single + bulk), image schema validation.

## 5. Fixes implemented

| File | Change |
|---|---|
| `apps/web/src/pages/MySermons.jsx` | Added `escapeHtml`; escaped every user field interpolated into the print HTML (Medium XSS fix). |
| `services/api/src/routes/ai.js` | Added `imageRequestSchema` (prompt ≤4000, `size` enum); `/ai/image` now validates via it; exported for tests. |
| `services/api/src/services/typedContent.js` | `listTypedContent` pins `userId` after `options.where` so tenant scope can't be overridden. |
| `services/api/src/routes/community.js` | `/share/:slug` now 404s unless `resource.userId === link.userId` (IDOR fix). |
| `services/api/src/routes/entities.js` | Added `SERVER_MANAGED_TYPES` = {SharedLink}; generic create + bulk reject it (defense-in-depth). |
| `apps/web/src/api/apiClient.js` | `StreamLLM` gets a 60s idle-reset AbortController so a stalled stream can't hang the builder. |
| `package.json` | `engines.node` `>=20 <23` → `>=20`. |
| `services/api/src/__tests__/community.test.js` | +2 tests: share serves owner's resource; forged link 404s. |
| `services/api/src/__tests__/entities.test.js` | +2 tests: SharedLink generic create + bulk both 403. |
| `services/api/src/__tests__/ai.test.js` | +1 test: image schema bounds prompt + allowlists size. |

## 6. Final verification (re-run after all fixes, 2026-07-01)

| Command | Result |
|---|---|
| `npm run lint` | PASS — 0 errors, 1 pre-existing warning |
| `npm run typecheck` | PASS — web clean; API 32/32 |
| API `vitest run` | PASS — **160** tests / 15 files (was 155; +5 new) |
| Web `vitest run` | PASS — 70 tests / 10 files |
| `npm run build:web` | PASS |
| `npx playwright test` | PASS — 3/3 |

## 7. Remaining risks / requires human approval

- **Branch protection is OFF on `main`** (`gh api .../branches/main/protection` → 404 "not protected"). CI runs on push/PR and is green, but nothing *blocks* a merge on red CI. Recommend the owner enable required status checks (CI jobs) on `main`. Not changed here — repo-admin action, and enabling it could block the very PR that documents it.
- **Integration tests** (`RUN_INTEGRATION=1`, real Postgres) not runnable locally (no local DB); covered by CI's dedicated Postgres-16 job.
- **Live prod config** (real `DATABASE_URL`, Stripe live keys, Resend, OpenAI, Vercel/Railway env) not verifiable from here — `env.js` hard-fails in prod on missing/weak/ placeholder secrets, which is the correct guardrail.
- **Community `is_ai_response`/`is_accepted_answer` spoofing** (LOW): a product decision, left unchanged.
- Migrations reviewed read-only; none executed against a real DB.

## 8. Manual checks still required (owner)
- Enable branch protection + required CI checks on `main`.
- Confirm production env vars are set on Railway (`DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `CORS_ORIGIN`, plus `OPENAI_API_KEY`/Stripe/Resend unless the matching `DISABLE_*` flag is set).
- Confirm `ERROR_REPORT_EMAIL` / `ADMIN_EMAILS` point where the owner wants error alerts delivered.
- Smoke-test a live Stripe checkout + webhook and a password-reset email end-to-end in production.

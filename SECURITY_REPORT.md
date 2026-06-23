# SermonSmith — Security Report

**Date:** 2026-06-23 · **Scope:** `services/api` + `apps/web` working tree
**Overall posture:** Solid for a production SaaS. Auth uses httpOnly-cookie JWTs with `tokenVersion` revocation,
SHA-256-hashed reset tokens, Zod input validation, helmet, per-route rate limits, CSRF Origin/Referer checks,
and an idempotent raw-body Stripe webhook. Findings below are hardening + one dependency-RCE that is now fixed.

Each finding: **Severity | Likelihood | Impact | Fix | Verification Status**.

---

## FIXED THIS PASS

### S1 — react-router-dom ≤7.14.1 multiple CVEs (incl. RCE)
- **Severity:** High · **Likelihood:** Medium (public advisories, internet-facing) · **Impact:** Unauth RCE via
  turbo-stream `TYPE_ERROR` deserialization; stored/reflected XSS; open redirect; CSRF; DoS.
- **Fix:** `npm audit fix` bumped react-router-dom within v7 to a patched release.
- **Verification:** ✅ `npm audit --omit=dev --audit-level=high` → 0 vulnerabilities; web build + tests green.

### S2 — uuid <11.1.1 (via resend → svix) buffer bounds
- **Severity:** Moderate · **Likelihood:** Low · **Impact:** Missing buffer bounds check in uuid v3/v5/v6.
- **Fix:** `npm audit fix` bumped the resend/svix/uuid chain.
- **Verification:** ✅ 0 vulnerabilities post-fix.

### S3 — Unbounded admin user enumeration (memory/PII exposure)
- **Location:** `services/api/src/routes/auth.js` `GET /users`; `routes/functions.js` `POST /listUsers`
- **Severity:** Medium · **Likelihood:** Low (admin-only) · **Impact:** `findMany` with no limit loads every
  user's PII into one response/heap as the table grows (DoS-on-self / large PII surface).
- **Fix:** Added bounded `take` (default 100, max 500) + `skip` from `?limit/offset` (auth) and body (functions).
- **Verification:** ✅ API tests green; logic clamps via `Math.min/Math.max`.

---

## IDENTIFIED — RECOMMENDED (not applied; need owner decision / migration)

> **UPDATE 2026-06-23 (part 2):** S4 is now **FIXED** — `User.stripeCustomerId @unique` added
> (migration `20260518_user_stripe_customer_and_soft_delete`), captured on `checkout.session.completed`;
> the cancellation webhook downgrades by customer id with email fallback for legacy accounts. The
> **soft-delete** recommendation from `DATABASE_REPORT.md` D4 also shipped: admin delete sets `deletedAt`
> + bumps `tokenVersion` (no cascade wipe); login and `authenticateToken` reject soft-deleted users.

### S4 — Stripe cancellation keys off `customer.email`, not a stored customer id
- **Location:** `services/api/src/routes/functions.js` ~L763–772 (`customer.subscription.deleted/canceled`)
- **Severity:** Medium · **Likelihood:** Low · **Impact:** Downgrade is matched by email via `updateMany`. Email
  is `@unique` so blast radius is ≤1 row, but if a user changes their account email *after* subscribing, a later
  cancellation will not downgrade them (stale premium). Fragile linkage.
- **Note:** The `checkout.session.completed` path is **safe** — `metadata.userId` is set server-side from the
  authenticated session at L263, not attacker-controllable.
- **Fix:** Add `stripeCustomerId String? @unique` to `User`, persist `session.customer` on checkout completion,
  and update by `stripeCustomerId` in the webhook. (Schema change + migration + backfill.)
- **Verification:** ⏳ Not applied (requires migration).

### S5 — Prompt-injection / JSON-schema interpolation
- **Location:** `routes/ai.js` (schema appended to message content); `apps/web` SermonBuilder/SeriesBuilder
  interpolate user topic/theme/passage into prompts.
- **Severity:** Low–Medium · **Likelihood:** Medium · **Impact:** A user can attempt to override system
  instructions in *their own* generation (no cross-tenant leakage — prompts are per-user). Worst case is a
  user making their own sermon ignore guardrails / wasting their own quota.
- **Fix:** Cap user-field lengths; fence user content in a clearly delimited user message; present the JSON
  schema inside a fenced block rather than raw-appending stringified JSON.
- **Verification:** ⏳ Not applied.

### S6 — AI error messages surfaced verbatim to UI
- **Location:** `apps/web/src/pages/SermonBuilder.jsx` (shows `error.message`).
- **Severity:** Low · **Impact:** Leaks backend phrasing / partial model output to the user; poor UX on 429.
- **Fix:** Map status→friendly copy (429 "daily limit", 502 "retry", 5xx generic); log full error server-side only.
- **Verification:** ⏳ Not applied.

### S7 — Admin allowlist resolved per-request
- **Location:** `routes/auth.js` calls `adminEmails()` on each auth action.
- **Severity:** Low · **Impact:** Minor; redundant work, and live env reloads change admin set without redeploy.
- **Fix:** Resolve once at boot via `env` and reuse.
- **Verification:** ⏳ Not applied.

---

## VERIFIED-SAFE (commonly flagged, no action needed)
- **Stripe webhook signature** — 503 if `STRIPE_WEBHOOK_SECRET` missing; `constructEvent` verifies; body never
  logged; idempotency row written only after success (Stripe retries on non-2xx). ✔
- **Entity JSON-path filters** (`entities.js`) — Prisma treats `data.path` as literal traversal, not an
  expression; no injection. ✔
- **PATCH /me** — reserved keys stripped, response re-sanitised via `sanitizeUser`. ✔
- **Password reset** — plaintext token never stored; SHA-256 hash at rest; single-use. ✔

---

## DevOps / CI notes
- `.github/workflows` runs the same gate chain as `release:check`. No secrets are echoed to logs.
- The API `typecheck` (`node --check src/index.js`) gives false confidence — a type/ref error in any other API
  file won't fail CI. Recommend widening to all `src/**/*.js` or adopting `tsc --noEmit` with `checkJs`.

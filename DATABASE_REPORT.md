# SermonSmith — Database Report

**Date:** 2026-06-23 · **Engine:** PostgreSQL via Prisma
**Models:** User, Entity, PasswordReset, StripeEvent, AiUsage, BibleChapterCache · **Migrations:** 5 (sequential, clean)

Each finding: **Severity | Likelihood | Impact | Fix | Verification Status**.

---

## Schema summary
- `Entity` is a generic JSON-blob store keyed by `(type, userId)` with cascade-delete from `User`. Indexes:
  `[type,userId]`, `[type]`, `[userId]`, `[createdAt]`.
- `PasswordReset` cascade-deletes from `User`; `tokenHash @unique`.
- `AiUsage` compound-unique `(userId, bucket)` for atomic per-day upsert — good.
- `BibleChapterCache` unique `(translation, book, chapter)` + index `[translation, book]` — matches its new
  migration `20260517_add_bible_chapter_cache` exactly (verified). No FK to User (cache is global), acceptable.

---

## FIXED THIS PASS

### D1 — Unbounded `findMany` on user listings
- **Severity:** Medium · **Likelihood:** Low (admin) · **Impact:** Full-table load into one response as users grow.
- **Fix:** Added `take`/`skip` pagination to `GET /auth/users` and `POST /functions/listUsers`.
- **Verification:** ✅ API tests green.

---

## IDENTIFIED — RECOMMENDED

### D2 — Redundant index `@@index([type])` on Entity
- **Severity:** Low · **Impact:** Wasted write/storage. With composite `[type,userId]`, a `type`-only query already
  uses the **leftmost prefix**, so `[type]` is redundant. **`[userId]` is NOT redundant** (userId is the second
  column, not a usable prefix) — keep it.
- **Fix:** Drop only `@@index([type])` (needs a migration). Deferred to avoid migration churn for marginal gain.
- **Verification:** ⏳ Not applied. *(Corrects an auditor claim that both were redundant — `[userId]` must stay.)*

### D3 — Bible import: nested upstream fetch loops without concurrency cap
- **Location:** `routes/functions.js` full-Bible / Scripture-API import handlers (admin-only batch).
- **Severity:** Medium (was flagged High; admin-gated lowers it) · **Likelihood:** Low · **Impact:** 66 books ×
  chapters of sequential/parallel `fetch` → long-running request, possible upstream rate-limit / socket pressure.
- **Fix:** Bound concurrency (e.g. `p-limit`/manual pool of 3–5) and validate verse payloads with Zod before
  `entity.create`. Or move to a queued background job.
- **Verification:** ⏳ Not applied.

> **UPDATE 2026-06-23 (part 2): D4 FIXED.** Added `User.deletedAt` (migration `20260518_…`). Admin
> `DELETE /users/:id` now soft-deletes (sets `deletedAt`, bumps `tokenVersion`) instead of hard cascade;
> auth/login reject soft-deleted users; admin listings filter `deletedAt: null`. Also added
> `User.stripeCustomerId @unique` (see SECURITY S4). Entities are preserved/recoverable.

### D4 — Hard cascade deletes with no audit trail
- **Location:** `schema.prisma` User→Entity / User→PasswordReset `onDelete: Cascade`.
- **Severity:** Medium · **Impact:** Deleting a User hard-deletes all their sermons/notes irrecoverably — no
  soft-delete or audit log. Risky for a paid SaaS / data-retention needs.
- **Fix:** Add `deleted_at` soft-delete + a 90-day purge job, or an append-only `audit_log` written pre-cascade.
- **Verification:** ⏳ Not applied (product decision).

### D5 — Missing null-guards after `findUnique` in Stripe routes
- **Location:** `functions.js` `createCheckoutSession` / `createBillingPortal` use `user.email` without checking
  `user` is non-null (post-auth it shouldn't be, but defense-in-depth).
- **Severity:** Low · **Fix:** `if (!user) return 404`. · **Verification:** ⏳ Not applied.

---

## VERIFIED-SAFE
- New `BibleChapterCache` migration is idempotent-safe and matches schema. ✔
- Email lookups hit the `@unique` (indexed) column. ✔
- `AiUsage` upsert is atomic on the compound unique. ✔
- N+1 scan of route handlers found no per-row query loops in the hot request paths (only the admin batch import). ✔

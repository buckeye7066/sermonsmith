# SermonSmith — Test Report

**Date:** 2026-06-23
**Current state:** `services/api` Vitest — **6 files, 59 passing, 4 skipped**. Web app: **0 automated tests**.

Each item: **Severity | Likelihood | Impact | Recommended Fix | Verification Status**.

---

## What is covered (API)
Auth flows, AI route guards (incl. the `/ai/email` reject-400 policy), env validation, Stripe webhook
idempotency, and entity CRUD have unit/integration coverage. These passed before and after this pass.

**Verification of this pass:** ✅ re-ran `npm test` after every code change (dep removal, AI retry, pagination) —
59 pass / 4 skip throughout.

---

## UPDATE 2026-06-23 (part 2) — web suite added
- **T1 (web had no tests): ADDRESSED.** Vitest stood up in `apps/web` (`vitest.config.js`); **17 specs** —
  `scriptureRefs.test.js` (valid / invalid_book / out_of_range incl. "John 99:99" + alias + single-chapter books)
  and `aiStructured.test.js` (coercion, case-insensitive dedupe, malformed-payload normalization, series clamp).
  Root `npm test` now runs **api + web**. Writing these surfaced and fixed a real regex over-capture bug.
- **T2 (retry logic): DONE.** `callWithRetry` exported; **5 specs** assert 429/5xx retry, no-retry on 504/4xx,
  and budget exhaustion. (`services/api/src/__tests__/retry.test.js`)
- Current totals: **API 64 pass / 4 skip · web 17 pass.**
- Still open: T3 (pagination-clamp via supertest), T4 (review 4 skips), T5 (Playwright smoke), and RTL
  component tests for the full SermonBuilder UI flow.

## Gaps — RECOMMENDED (not yet implemented)

### T1 — Web app has no tests at all
- **Severity:** High · **Impact:** The entire React surface (sermon creation, AI builders, reader, billing UI,
  exports) is unverified by CI. "Tests pass" today only means the API passes.
- **Fix:** Add Vitest + React Testing Library to `apps/web`. Priority specs:
  1. **AI generation flow** — `SermonBuilder` happy path + the 502 "invalid JSON" retry branch + 429 quota copy.
  2. **`aiStructured.js`** (new) — `mergeUniqueStrings` dedupe, `normalizeSermon` partial/fallback merge.
  3. **`apiClient.js`** — API-base resolution (Electron → `VITE_API_URL` → origin) and cookie handling.
  4. **Auth context** — login/logout state, 401 handling.
- **Verification:** ⏳ Not implemented.

### T2 — New `callWithRetry` retry logic is untested
- **Severity:** Medium · **Impact:** Backoff/retry-eligibility (429/5xx retried; 504/4xx not) has no regression test.
- **Fix:** API unit test mocking `openai.chat.completions.create` to throw `{status:503}` twice then resolve;
  assert it retries and succeeds; assert `{status:400}` and `{status:504}` do **not** retry.
- **Verification:** ⏳ Not implemented.

### T3 — Pagination bounds untested
- **Severity:** Low · **Fix:** Assert `?limit=99999` clamps to 500 and `?limit=0`/negative clamps to ≥1 on
  `GET /auth/users` and `POST /functions/listUsers`.
- **Verification:** ⏳ Not implemented.

### T4 — 4 skipped tests
- **Severity:** Low · **Fix:** Review the 4 `skip`s — un-skip or document why (likely require live Stripe/OpenAI
  keys). Make them run against mocks or mark clearly as integration-only.
- **Verification:** ⏳ Not reviewed in depth.

### T5 — No E2E / smoke
- **Severity:** Medium · **Fix:** A minimal Playwright smoke (load app, login, generate a stubbed sermon, save)
  would catch router/build regressions the unit tests miss — especially relevant after the react-router-dom bump.
- **Verification:** ⏳ Not implemented.

---

## Recommended priority order
1. T1.1 + T1.2 (AI flow + aiStructured) — highest runtime risk, just refactored.
2. T2 (retry logic) — new code, easy to unit test.
3. T5 (Playwright smoke) — guards the react-router-dom upgrade.
4. T3 / T4 — quick wins.

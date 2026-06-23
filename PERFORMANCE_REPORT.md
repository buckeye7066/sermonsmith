# SermonSmith — Performance Report

**Date:** 2026-06-23 · **Scope:** web bundle + API request paths

Each finding: **Severity | Likelihood | Impact | Fix | Verification Status**.

---

## FIXED THIS PASS (measurable)

### P1 — Dead dependencies inflating install + dependency graph
- **Impact:** `three`, `lodash`, `react-markdown`, `@hello-pangea/dnd`, `canvas-confetti` were declared but never
  imported. Removing them pruned **86 packages** from `node_modules` and removed 3 empty Rollup vendor chunks
  (`vendor-3d`, `vendor-markdown`, `vendor-dnd`).
- **Measurement:** `npm install` reported `removed 86 packages`. Web build still green; emitted chunk list no
  longer contains the three dead vendor chunks.
- **Verification:** ✅ build green, tests green.

### P2 — No retry on transient OpenAI failures (tail-latency / reliability)
- **Impact:** A single 429/503 from OpenAI failed the user's whole request, burning UX (and on free tier, a wasted
  perception of quota).
- **Fix:** `callWithRetry()` — exponential backoff (500ms·2^n + jitter), max 2 retries, wrapped *inside* the 90s
  `withTimeout` so total latency stays bounded; retries 429/5xx only, never the 504 timeout or deterministic 4xx.
- **Verification:** ✅ API tests green (`services/api/src/routes/ai.js`).

---

## IDENTIFIED — RECOMMENDED

> **UPDATE 2026-06-23 (part 2): P3 RESOLVED (already optimal).** Verified BibleMaps, SermonAnalytics, and
> QuizViewer are `React.lazy` route splits in `pages.config.js`, and the build emits them as separate chunks —
> so recharts/leaflet/jspdf are fetched only when their page is visited. No eager import found; no change needed.

### P3 — Heavy page-specific vendor chunks not lazy-loaded
- **Severity:** Medium · **Impact:** Three large chunks ship even though each is used by exactly one page:
  | Chunk | Size | Used by |
  |---|---|---|
  | `vendor-pdf` (jspdf+html2canvas) | ~595 kB | QuizViewer only |
  | `vendor-charts` (recharts) | ~421 kB | SermonAnalytics only |
  | `vendor-maps` (react-leaflet) | ~155 kB | BibleMaps only |
- **Fix:** Ensure these are reached only via `React.lazy()` dynamic import on their owning page (QuizViewer already
  dynamic-imports jsPDF — verify the chart/map pages do the same) so the chunk is fetched on demand, not upfront.
- **Verification:** ⏳ Not applied. Pages are already route-split; confirm the libs aren't statically imported in a
  shared module that pulls them into the entry graph.

### P4 — Lint warns 169× (unused imports)
- **Severity:** Low · **Impact:** Dead imports add parse/transform cost and noise; many are unused lucide icons.
- **Fix:** `eslint --fix` once the in-flight diff lands; consider `no-unused-vars` as error in CI afterwards.
- **Verification:** ⏳ Not applied (would conflict with uncommitted working-tree edits).

### P5 — Bible batch import blocks a request thread
- **Severity:** Medium (admin-only) · **Impact:** Long synchronous upstream-fetch loop holds a connection for
  minutes. See `DATABASE_REPORT.md` D3 — bound concurrency / move to a job.
- **Verification:** ⏳ Not applied.

---

## VERIFIED-GOOD
- Routes are code-split (lazy pages) — good TTI baseline.
- `reportCompressedSize:false` + esbuild minify keep builds fast.
- API uses `compression` + helmet; rate-limiters scoped per route group.
- `AiUsage` quota is a single atomic upsert (no read-modify-write race).

# SermonSmith — Portfolio Hardening Audit (§5.1)

**Branch:** `claude/portfolio-hardening-2026-07-18` (from `add/privacy-policy` @ `8ff19a0`)
**Date:** 2026-07-18
**Scope:** Reproduced against the actual checkout. AI/Scripture-honesty invariants (items 1–3) prioritised; 4, 5, 11 next; remainder verified/optimised. No push/merge/deploy. No live-model calls. No real side effects.

---

## Baseline (before any change)

| Gate | Result |
|---|---|
| `npm test` (api) | **231 passed** (22 files) |
| `npm test` (web) | **189 passed** (15 files) |
| `npm run lint` | **0 errors**, 3 warnings (pre-existing, exit 0) |
| `npm run typecheck` | **OK** (web tsc; api 43 files) |
| `git diff --check` | clean |

## After hardening

| Gate | Result |
|---|---|
| `npm test` (api) | **241 passed** (+10 new gate tests) |
| `npm test` (web) | **193 passed** (+4 new validator tests) |
| Deterministic ministry benchmark (`benchmarkScenarios.test.js`) | **79 passed** |
| Full E2E sermon flow (`e2e/`, route-mocked, no live model) | **5/5 passed** (on a free port — see blockers) |
| `npm run lint` / `typecheck` | 0 errors / OK |
| `npm run build:web` | success; entry preload ↓ ~1 MB; no empty chunks |
| Live-model benchmark | **NOT run** (budget-gated; no key) — deliberate |

---

## Contract matrix

| # | Contract | Verdict | Evidence |
|---|---|---|---|
| 1 | Server-owned AI invariants (no fabricated verses/quotes/testimony/stats; fences are data; no self-claimed human review; crisis red lines) | **INTACT — preserved + regression-locked** | `packages/shared/aiFeatures/index.js:30-56`; prepended first on both routes `services/api/src/routes/ai.js:535-536`, `:692-693`; JSON instruction appended to *client* layer only `ai.js:550-551`,`:707-708`; `__tests__/aiInvariants.test.js` (client cannot displace policy) |
| 2 | Every InvokeLLM/StreamLLM: registered feature id, invariant-first, fenced input, denom block, token/quota/audit, identical final validation for stream+non-stream | **INTACT** | totality scan `apps/web/src/lib/aiFeatureTotality.test.js`; stream converges on same `extractJson` gate + honest audit + RS result trailer `ai.js:749-772`; model allowlist `ai.js:264-275`; DB quota `ai.js:293-307`; audit hashes only `ai.js:199-228` |
| 3 | Durable Scripture save gate extended beyond `Sermon` to **all** persisted AI types; honest trust-state; no over-claim on deuterocanon | **FIXED (key gap)** | see Finding F1 |
| 4 | Human-only review ack + stale-review reset | **INTACT — preserved** | `entities.js` `/review` now keyed on `REVIEWABLE_TYPES` (Sermon) `:735`; stale-review reset `:398-402`; 14 review tests pass |
| 5 | Public contact/support address = owner-controlled domain only | **FIXED** | see Finding F2 |
| 6 | Pin Node + package-manager major | **FIXED** | `package.json:50-53` |
| 7 | Bundle: no accidental eager preloads; route-lazy PDF/chart/map/admin; no dead chunks; fresh browser data | **FIXED** | see Finding F3 |
| 8 | Deprecated transitive deps via parent upgrades | **No action needed** | `npm install` emits **zero** deprecation warnings against current tree |
| 9 | Deterministic ministry tests + full E2E (not live benchmark) | **PASS** | 79 benchmark scenarios; 5/5 E2E |
| 10 | Verify (not trigger) Vercel + Railway deploy wiring; no green-but-no-op workflow | **INTACT** | `vercel.json` (build:web → `apps/web/dist`), `railway.json` (Dockerfile, `migrate deploy`, `/readyz`); `.github/workflows/railway-deploy-monitor.yml` is a real monitor that fails loudly on a missing deploy — not a no-op deployer |
| 11 | Admin RBAC, billing gates, Stripe idempotency, cookie auth, native-store billing intact | **INTACT** | see Verification §11 |

---

## Findings & fixes

### F1 — Scripture save gate only covered `Sermon` (HIGH — core ministry contract) — FIXED
**Reproduced:** `services/api/src/routes/entities.js` had `SCRIPTURE_GATED_TYPES = new Set(['Sermon'])`. AI-generated **BibleStudy, Quiz, ReadingPlan, EthicsAnalysis, StudyNote** carry Scripture references but were persisted with whatever `scripture_validation`/trust fields the client sent — a forged all-valid blob or a hallucinated reference was stored unchecked. Save shapes confirmed in source: `BibleStudy` `key_verses[]`+`study_sections[].scripture` (`pages/BibleStudy.jsx:349`), `Quiz` `questions[].scripture_reference` (`pages/QuizBuilder.jsx:106`), `ReadingPlan` `daily_readings[].passages[]` (`components/study/StudyPlanGenerator.jsx:212`), `EthicsAnalysis` **double-nested** `data.result…key_scriptures[].reference` (`pages/ChristianEthics.jsx:585`), `StudyNote` `scripture_reference` (`components/reader/StudyToolsPanel.jsx:255`).

**Fix:**
- New shape-agnostic validator in the shared module (web+api share it): `extractScriptureRefsDeep()` recursively sweeps every string in a record, and `validateAiContent()` returns the same `{refs, allValid, summary, counts}` shape as `validateAiSermon` — so a UI shape change can't silently drop a field, and the double-nested EthicsAnalysis is handled without hard-coding field names. `packages/shared/scripture/index.js:212-286`.
- `entities.js`: `SCRIPTURE_GATED_TYPES` extended to the 5 new types (`:322-329`). Sermons keep the proven sermon-shaped validator; other types use the deep validator (`:363-368`). `merged.scripture_validation` is stripped before the sweep so a previously-stored validation array can't be re-extracted as content on update (`:352-355`). Publishing unverified refs is blocked for any gated type (422); the `draft→needs_review` relabel is confined to `STATUS_WORKFLOW_TYPES` (Sermon) so no fabricated status is injected into types whose UI can't render it (`:377-402`).
- Honesty preserved: `allValid` stays strict — `chapter_checked` deuterocanon is **not** counted as verified (item-3 "do not claim full verification" requirement).
**Tests:** `services/api/src/__tests__/entitiesScriptureGateExtended.test.js` (11 cases: per-type forged-blob rejection, invalid-book/out-of-range detection, Catholic deuterocanon `chapter_checked`, double-nested extraction, review-field stripping, publish-block, no-invented-status, stale-validation drop on update, review-ack stays Sermon-only). Web unit cases in `apps/web/src/lib/scriptureRefs.test.js`.

### F2 — Support-contact address at an unmonitored domain (MEDIUM) — FIXED
**Reproduced:** `package.json:8` and `apps/desktop/package.json:9` set `author.email: "support@sermonsmith.app"` — a support/contact address at a domain not established as owner-monitored. Public-facing contact copy elsewhere already uses the owner-controlled `dr.johnwhite@axiombiolabs.org` (`apps/web/src/pages/PrivacyPolicy.jsx:166,168`; `docs/play-store/listing.md`; `services/api/src/services/errorReporter.js`).
**Fix:** both `author.email` values → `dr.johnwhite@axiombiolabs.org`.
**Reviewed, intentionally unchanged:** `noreply@sermonsmith.app` (`services/api/src/services/email.js:21`) is the product's own transactional *sender* default (env-overridable via `EMAIL_FROM`), not a contact address; `sermonsmith.app` bundle IDs / CORS / URLs are the product domain. In-app "Contact Dr. John White" (`ContactSupport.jsx`) posts to a DB `Message` entity — it exposes no email address.

### F3 — ~1 MB of accidental eager preload in the entry HTML (MEDIUM) — FIXED
**Reproduced:** `apps/web/dist/index.html` emitted `<link rel="modulepreload">` for **vendor-pdf (595 kB, jspdf+html2canvas)** and **vendor-charts (421 kB, recharts)** on every first paint, although jspdf/html2canvas are dynamically imported and recharts/leaflet live only in lazy routes (`SermonAnalytics`, `QuizViewer`, `BibleMaps` are all `React.lazy` via `pages.config.jsx`). Cause: pinning those route-specific libraries into named `manualChunks` (`vite.config.js`) made Vite hoist their preload into the entry.
**Fix:** removed `vendor-charts`/`vendor-pdf`/`vendor-maps` from `manualChunks`; Rollup now emits them as async chunks of the lazy routes that import them (deduped), loaded on navigation and **not** preloaded on landing. Verified post-build: entry preloads reduced from 7→5 chunks (shell libs only); `SermonAnalytics`/`jspdf.es.min`/`html2canvas.esm`/`BibleMaps` are now on-demand async chunks; **no chunk < 1 kB (no dead/empty chunks)**. Also ran `update-browserslist-db` → caniuse-lite `30001766 → 30001806` (item-7 "stale browser target data"); lockfile-only change, no new package.json deps.

### Advisory (not changed — rationale given)
- **A1 — Client-side dev-email/phone premium overrides embed family PII.** `QuizViewer.jsx:20-24`, `StudyGuideViewer.jsx:25`, `Community.jsx:25` hardcode four personal emails + a phone number to grant premium client-side. Not a public support address (outside item-5), and the **server independently enforces premium** for every paid action (§11), so this is cosmetic client gating + a minor PII-in-bundle smell. Left unchanged to avoid breaking the owner's own access; flagged for a follow-up (move to a server-checked allowlist / env).
- **A2 — Sermon validator is field-specific (shallower than the new deep sweep).** `validateAiSermon` scans `anchor_passage`/`points[]`/`conclusion` but not `big_idea`/`theological_notes`. Pre-existing; kept as-is for zero regression. Recommend migrating `Sermon` onto `validateAiContent` in a follow-up (strict superset — would also catch hallucinated refs in notes/illustrations).
- **A3 — `getImportStatus` (`functions.js:768`) is authenticated-but-not-admin**, exposing only non-sensitive Bible-import progress. Advisory.

---

## Verification §11 (confirmed INTACT — no change)

- **Admin RBAC:** `requireAdmin` = `role ∈ {admin,dev}` (`middleware/auth.js:171-177`); gates user listing/patch/delete (`auth.js:531,569,596`), premium/free grants + user activity (`functions.js:594,639,703,712,791`), AI audit summary (`ai.js:468`), moderation queue (`community.js:398,420`), entity User writes (`entities.js` `requireAdmin` wraps). Bans enforced at auth + login.
- **Billing gates (server-enforced):** AI image 402 unless premium/admin (`ai.js:805-809`); premium translations 402 via `userHasPremium` (`functions.js:271-274`); DB-backed daily limits (`ai.js:293-307`) on invoke/stream/image. `req.userPremium` derived server-side (`auth.js:144-145`); reserved profile keys stripped (`auth.js`, `entities.js:42-71`). Client dev-overrides only toggle a jsPDF button; server export endpoints are inert stubs.
- **Stripe:** raw-body mount before json (`index.js:122-125`), signature via `STRIPE_WEBHOOK_SECRET` (`functions.js:1322-1339`), idempotent by event id (`functions.js:1345-1348`, marker only after side-effect `:1394-1401`, 500-without-mark → Stripe retries).
- **Cookie auth:** httpOnly always (`auth.js:55-60`), `secure` in prod/none, HS256-pinned; `tokenVersion` bumped on password change/reset/revoke/delete and enforced in middleware.
- **Native-store billing:** none implemented (no RevenueCat/StoreKit/BillingClient/receipt validation in `apps/mobile` or `services/api`); only entitlement source is the signature-verified Stripe web flow. No unverified native path.

---

## External blockers

1. **E2E port collision.** `playwright.config.js` hardcodes port 4173 with `reuseExistingServer: !CI`. A foreign local server (PID 2788, returns uppercase `<!DOCTYPE>` vs the app's lowercase) was squatting on 4173, so Playwright *reused* it → all 5 tests saw `Cannot GET /SermonBuilder`. Proven environmental: on a free port the same suite is **5/5 green** and `vite preview` serves deep routes 200. Not a code defect. (Optional follow-up: set `reuseExistingServer:false` or a per-run port so a squatter can't mask the suite.)
2. **Live-model ministry benchmark** (`scripts/benchmark-live.mjs`) intentionally **not** run — budget-gated, needs `OPENAI_API_KEY`; out of the no-real-side-effects mandate.
3. **Deprecated-deps (item 8):** clean `npm install` reports no deprecation warnings; a byte-exact clean-room `npm ci` audit would be the fuller proof but is not needed given the clean signal.

---

## Follow-up pass — 4 gate bypasses found by adversarial review (all FIXED)

A second adversarial review of the extended gate surfaced four real ways unverified/fabricated Scripture could still be persisted or surfaced. All fixed with a regression test each; api 252 + web 195 green after.

### B1 — [CRITICAL] Public/share transitions bypassed the publish gate — FIXED
`applyScriptureGate` only blocked invalid references when `status === 'published'`. But gated types go public through *other* flags: `ReadingPlan` via `is_public:true` (surfaced by `GET /api/community/reading-plans` — `community.js:250-253`), SharedContent-style rows via `visibility:'public'`. A `POST /api/entities/ReadingPlan {is_public:true, daily_readings:[{passages:['Hezekiah 4:5']}]}` stored an invalid validation yet went public.
**Fix:** new `isPublicOrPublished()` (`entities.js:~338`) treats `status:'published'`, `is_public`, `public`, `is_shared`, `shared`, and `visibility:'public'` as publish transitions; the gate now rejects (422) any of them on a record whose references don't all verify, evaluated against the **merged** result record so a flag already on disk or newly set both count. **Tests:** public ReadingPlan rejected; private one still saves; flip-to-public on update rejected; `visibility:'public'` StudyNote rejected.

### B2 — [CRITICAL] Update bypassed the gate via type/id mismatch — FIXED
`PUT /api/entities/:type/:id` fetched the row by id but never checked `existing.type === req.params.type`, then validated + gated using the **URL** type. `PUT /api/entities/Collection/<bibleStudyId>` with invalid Scripture + `status:'published'` passed the permissive `Collection` schema, hit `applyScriptureGate` as a non-gated type (skipped), and merged into the gated row.
**Fix:** the update handler now rejects a type/id mismatch (`existing.type !== req.params.type → 404`) **before** any validation, and drives **both** schema validation and the Scripture gate from `existing.type` (the stored, authoritative type), never `req.params.type` (`entities.js:~690-745`). **Tests:** wrong-type PUT to a gated row → 404 and row untouched; correct-type PUT still gates by stored type.

### B3 — [HIGH] Stale trust markers survived revalidation — FIXED
The gate stripped review-only fields from the incoming patch only; the final `{...existing.data, ...patch}` merge kept a pre-existing `verified:true` / `ready_to_present:true` (legacy/migrated/forged row) even as `scripture_validation` recomputed to invalid.
**Fix:** on every gated save the merged stored record is neutralized — `verified`/`ready_to_present` (set by no endpoint, ever) always cleared; the review markers cleared too for every type without the human-review endpoint (Sermon's `pastor_reviewed` lifecycle stays owned by `/review` + the stale-review rule) (`entities.js:~415-429`). **Test:** updating a row carrying a stale `verified:true` into an invalid state strips `verified`.

### B4 — [HIGH] Streaming emitted Scripture before validation — FIXED
`/stream` wrote each model delta to the client immediately, then appended a trailer `{ok, truncated}` whose `ok` reflected only JSON **syntax** — so a stream containing `Hezekiah 4:5` rendered as a trusted, completed preview.
**Fix:** `screenStreamedScripture()` (`ai.js:~30`) runs a **canon-independent** screen on the accumulated text (flags only `invalid_book`/`out_of_range`/`unparseable` — objectively wrong in every canon; never the denomination-dependent `unsupported_canon`/`chapter_checked` the stream can't resolve). A hit sets the stream result `ok:false` and enriches the trailer with `scripture:{ok,checked,fabricated}`, so `StreamLLM` throws and the client falls back to `/invoke` (whose save re-runs the durable gate) instead of keeping the streamed preview; the audit row records `unverified_scripture`. **Tests:** unit screen (fabricated flagged, valid + deuterocanon pass); `/stream` trailer `ok:false`+`scripture.ok:false` and honest audit; client `StreamLLM` throws `scriptureUnverified:true`.

**Coverage confirmation:** every publish/public/share path (`status:'published'`, `is_public`, `visibility:'public'`, generic shared flags) and the update-by-stored-type path now enforce the Scripture gate; the streaming path can no longer surface fabricated Scripture as validated/complete.

---

## Round-3 pass — 2 more B1 exposure surfaces + gate centralization (all FIXED)

A third review found the round-2 B1 fix lived only in the entity save gate, so two exposure routes that don't cross that gate still leaked. Both fixed, plus the gate was **centralized** so exposure routes cannot drift. api 267 + web 194 green.

### Durable fix — centralized gate module `services/api/src/services/scriptureGate.js`
The gated-type set, trust-field list, `isPublicOrPublished`, the canon-aware validator selection, the write-gate core (`gateEntityWrite`), and the exposure gate (`assertGatedResourceExposable`) now live in ONE module. `routes/entities.js` (save gate), `routes/functions.js` (share-link create), and `routes/community.js` (share serve + moderation publish) all import it. A bypass fixed here is fixed everywhere; a route can no longer carry its own drifting copy of the rules.

### R3-1 — [HIGH] Share links exposed gated records with no gate — FIXED
`createShareableLink` (`functions.js:820`) only checked existence + ownership, then minted a `SharedLink`; `/api/community/share/:slug` (`community.js:93`) served the target by id. An invalid private Sermon/BibleStudy/ReadingPlan could be exposed by link, and a valid linked record could later be edited to invalid (the merged-record entity gate can't see the external SharedLink).
**Fix:** `createShareableLink` now rejects `resourceType !== resource.type` (400) and calls `assertGatedResourceExposable` over the resource's **current** stored data (422 if a gated type doesn't fully verify) using the owner's denomination → canon. `/share/:slug` re-runs the same exposure gate at **serve** time, so an edit-to-invalid after link creation is caught (422, resource withheld). **Tests** (`shareLinkScriptureGate.test.js`): invalid record not shareable; clean record shareable; `resourceType` mismatch → 400; shared-then-edited-to-invalid not served; still-valid served.

### R3-2 — [HIGH] Public SharedContent bypassed the gate + trust-stripping — FIXED
`SharedContent` (free-text `content` + `content_type`, published by `GET /api/community/shared-content` on `visibility:'public'`) was not in `SCRIPTURE_GATED_TYPES`, so `applyScriptureGate` returned early — a client could create public SharedContent with fabricated Scripture and a forged `verified:true`, with no recomputation or stripping.
**Fix:** `SharedContent` added to the centralized `SCRIPTURE_GATED_TYPES`, so every create/update recomputes `scripture_validation` over its content, strips trust fields, and blocks the `visibility:'public'` transition when references don't verify. The admin moderation route (`community.js:432`), which can also flip `visibility:'public'`, now routes that specific transition through `assertGatedResourceExposable` (hide/remove/status actions are never blocked). **Tests:** public SharedContent with invalid ref + forged `verified:true` → 422; private one → stored with `verified` stripped + honest validation; clean public → allowed; moderation public-flip on invalid → 422 while hide still 200.

### Public-exposure routes audited (each now routes through the centralized gate)
| Route | Exposure | Gated via |
|---|---|---|
| `POST /api/entities/:type` (+ `/bulk`, `PUT /:type/:id`) | create/update/publish/share of gated types | `gateEntityWrite` (entity save gate) |
| `POST /api/functions/createShareableLink` | mints public share link | `assertGatedResourceExposable` at create + `resourceType` match |
| `GET /api/community/share/:slug` | serves shared resource | `assertGatedResourceExposable` at serve |
| `GET /api/community/reading-plans` (`is_public`) | public reading plans | write-gated at entity create/update (R2-B1) |
| `GET /api/community/shared-content` (`visibility:'public'`) | community feed | write-gated at entity create/update (SharedContent now gated) |
| `PATCH /api/community/moderation/:type/:id` | admin `visibility:'public'` flip | `assertGatedResourceExposable` on the public transition |

**Out of scope (noted):** `GET /api/community/posts` + replies (ForumPost/CommunityPost are user-authored discussion, never presented as AI-verified documents) — not AI-drafted document content, so outside this contract. **Legacy-data caveat:** the write/serve gates block *new* invalid public exposure and catch edited-to-invalid at serve for share links; any pre-existing public SharedContent rows written before this change would need a one-time revalidation sweep (not run here — no prod DB access in this mandate).

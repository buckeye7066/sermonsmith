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

**Legacy-data caveat:** the write/serve gates block *new* invalid public exposure and catch edited-to-invalid at serve; any pre-existing public rows written before these changes would need a one-time revalidation sweep (not run here — no prod DB access in this mandate).

---

## Round-4 pass — 2 more community exposure paths + all feeds re-validate (all FIXED)

Codex confirmed share-link create/serve + entity writes are gated, but two community paths still bypassed the centralized gate. Both fixed; every public feed now re-validates at serve, fail-closed. api 269 + web 194 green.

### R4-1 — [HIGH] AI forum replies saved + served with no gate — FIXED
`POST /api/community/posts/:id/reply` (`community.js:203`) created a public `CommunityReply` straight from request content — including `is_ai_response:true` (the web AI-reply flow posts `InvokeLLM` output here) — with no gate, then `/posts/:id/replies` served it. Fabricated Scripture in an AI reply bypassed the gate entirely.
**Fix:** new `assertAiReplyExposable` (centralized in `scriptureGate.js`) runs the shape-agnostic validator over an `is_ai_response` reply's content at **create** and rejects unverified references (422); the validated refs are stored. The reply-list serve path re-validates and omits any `is_ai_response` reply that no longer verifies. **User-authored replies remain out of scope** — they are never gated. **Tests** (`community.test.js`): AI reply with `Hezekiah 4:5` → 422 (nothing persisted); clean AI reply → 200; user reply with the same text → 200 (ungated); a stored fabricated AI reply is omitted from the thread while the human reply is served.

### R4-2 — [MEDIUM] Public feeds returned gated rows without serve-time re-validation — FIXED
`GET /api/community/shared-content` and `GET /api/community/reading-plans` (`community.js:70,262`) returned public `SharedContent` / `ReadingPlan` rows after only visibility/status filtering — never re-validating CURRENT stored data, so a row edited to an invalid state after publishing still surfaced.
**Fix:** new non-throwing `isPublicContentServable` + a `serveExposableRows` filter recompute canon-aware validation (owner-denomination resolved + memoized per request) over each row and **fail closed — omitting** invalid rows, with an audit event (`community.omitted_unverified_scripture`). Applied to both feeds and the reply thread. **Tests:** an invalid public `SharedContent` and an invalid public `ReadingPlan` are each omitted from their feed while the clean row remains.

### Every community/feed route re-checked (round-4)
| Route | Gated at serve? |
|---|---|
| `GET /community/shared-content` | ✅ `serveExposableRows` (fail-closed omit) |
| `GET /community/reading-plans` | ✅ `serveExposableRows` (fail-closed omit) |
| `GET /community/posts/:id/replies` | ✅ `serveExposableRows` (is_ai_response replies) |
| `POST /community/posts/:id/reply` | ✅ `assertAiReplyExposable` on is_ai_response |
| `GET /community/share/:slug` | ✅ `assertGatedResourceExposable` (round 3) |
| `GET /community/posts` (CommunityPost) | user-authored discussion — not AI content, out of scope |
| `GET /community/study-groups` (StudyGroup) | group metadata, no Scripture content — out of scope |
| `GET /community/moderation/queue` | admin-only review surface — must show unverified content to moderate it |
| like / report / save routes | mutate interaction counters; do not broadcast gated content |

**Confirmed:** AI replies route through the centralized gate at create + serve; both public feeds (and the reply thread) re-validate at serve and fail closed. No other public community/feed route serves AI-generated Scripture-bearing content without a gate. Export routes are client-side stubs; `createShareableLink` is gated (round 3).

---

## Round-5 pass — SharedSermon gated + interaction routes fail closed; full coverage audit (all FIXED)

### R5-1 — [HIGH] SharedSermon copy was outside the gate — FIXED
The web share flow (`ShareSermonDialog.jsx:73`) copies a sermon's `anchor_passage` + `points` + `denomination` into `SharedSermon`, which the share-link path serves — but `SharedSermon` was not gated, so `assertGatedResourceExposable` no-op'd and an invalid sermon could be exposed as a `SharedSermon` copy. Fix: `SharedSermon` (and `SharedSeries`) added to `SCRIPTURE_GATED_TYPES` and to a new `INHERENTLY_PUBLIC_TYPES` set — a shared copy exists to be shown to the community, so `gateEntityWrite` blocks an invalid reference outright, with no explicit `visibility`/`published` flag needed. Once gated, `createShareableLink` + `/share/:slug` validate it automatically. **Tests:** SharedSermon create with `Hezekiah 4:5` → 422; valid → 200; forged trust fields stripped; share-link create + serve of an invalid SharedSermon → 422.

### R5-2 — [MEDIUM] SharedContent interaction routes returned ungated rows — FIXED
`like`/`report`/`save` (`community.js:333-465`) echoed `formatEntity(row)` after only `isPublicCommunityData` checks, so a row the feed now OMITS for invalid Scripture was still served by id through the interaction response (including the duplicate/refetch paths). Fix: a new `interactionResult` helper resolves the owner denomination and, when the row's Scripture no longer verifies, **fails closed** — returning the interaction status (counters/flags) with `content_withheld: true` and **no content body** (audit-logged); valid content is returned unchanged. Applied to every return point in like/report/save. **Tests:** like/report on an invalid public SharedContent record the interaction but withhold the content; like on a valid row still returns the full body.

### Final coverage — every gated TYPE and every content-returning ROUTE

**Gated types** (all AI-generated Scripture-bearing content): `Sermon`, `BibleStudy`, `Quiz`, `ReadingPlan`, `EthicsAnalysis`, `StudyNote`, `SharedContent`, `SharedSermon`, `SharedSeries` — all in the centralized `SCRIPTURE_GATED_TYPES`; `SharedSermon`/`SharedSeries` also `INHERENTLY_PUBLIC_TYPES`. Plus `CommunityReply` when `is_ai_response` (gated at its route). Audited every entity schema type; the rest are user-authored (Comment/SermonComment/CommunityPost/GroupMessage/ratings/Note/Highlight/Bookmark), non-Scripture metadata (Collection/ResourceTag/StudyGroup/Series containers/collaboration/activity), or reference data (Verse) — out of scope with reason. Worldview and Prayer AI outputs are **not persisted** to a served entity (client state / localStorage), so no exposure.

| Content-returning route | Coverage |
|---|---|
| `POST/PUT /api/entities/:type` (+`/bulk`) | ✅ `gateEntityWrite` (all gated types incl. SharedSermon/SharedSeries) |
| `GET /api/entities/:type` + `/:type/:id` | ✅ owner-scoped (only `Verse` is public reference data) |
| `POST /api/functions/createShareableLink` | ✅ `assertGatedResourceExposable` + `resourceType` match |
| `GET /api/community/share/:slug` | ✅ `assertGatedResourceExposable` at serve |
| `GET /api/community/shared-content` | ✅ `serveExposableRows` (fail-closed omit) |
| `GET /api/community/reading-plans` | ✅ `serveExposableRows` (fail-closed omit) |
| `GET /api/community/posts/:id/replies` | ✅ `serveExposableRows` (is_ai_response) |
| `POST /api/community/posts/:id/reply` | ✅ `assertAiReplyExposable` (is_ai_response) |
| `POST /api/community/shared-content/:id/{like,report,save}` | ✅ `interactionResult` (fail-closed, content withheld) |
| `PATCH /api/community/moderation/:type/:id` | ✅ `assertGatedResourceExposable` on the public transition |
| `GET /api/community/posts` (CommunityPost) | out of scope — user-authored discussion |
| `GET /api/community/study-groups` (StudyGroup) | out of scope — group metadata, no Scripture |
| `GET /api/community/moderation/queue` | out of scope — admin review surface (must show unverified to moderate) |

Every gated type and every content-returning route routes through the centralized `scriptureGate.js`, or is out of scope with a stated reason.

---

## Round-6 pass — Sermon validator blind spot + 2 gate-parity gaps (all FIXED)

### R6-1 — [HIGH] Sermon validator missed most sermon prose fields — FIXED
`validateAiSermon` (`packages/shared/scripture/index.js`) scanned only `anchor_passage`, `points[].supporting_scriptures`, `points[].text`, `conclusion` — but sermons also persist references in `big_idea`, `theological_notes`, and each point's `exegesis` / `application` / `illustration`. A fabricated `Hezekiah 4:5` in any of those passed as all-valid, and since the entity publish gate AND the share-link exposure gate both validate sermons through this function, the fabricated reference was persisted `published` and share-served. **Fix:** `validateAiSermon` now **deep-scans the whole sermon object** (`extractScriptureRefsDeep`), a strict superset that catches every prose field and stays correct as the sermon shape evolves — fixing the blind spot everywhere the function is used (entity gate, `/review` evidence, share-link exposure, and the web review chips). Human-review acknowledgment + stale-review behavior unchanged. **Tests:** invalid ref in `big_idea` / `theological_notes` / `points[].exegesis|application|illustration` → validator flags it; entity publish → 422; draft → `needs_review`; share-link create + serve of a sermon with the ref hidden in a point's `exegesis` → 422.

### R6-2 — [MEDIUM] Generic entity create bypassed the AI-reply gate — FIXED
The dedicated `/community/posts/:id/reply` gates `is_ai_response`, but the generic `POST /api/entities/CommunityReply` ran `applyScriptureGate`, which no-op'd (CommunityReply not a gated type) — a direct/legacy client could persist an AI-marked reply with fabricated Scripture. **Fix:** `applyScriptureGate` now routes `is_ai_response` CommunityReply writes (create/bulk/update) through `assertAiReplyExposable` (fabricated refs rejected 422, validated refs stored); user-authored replies pass through. **Tests:** generic-API CommunityReply with `is_ai_response:true` + invalid ref → 422 (nothing persisted); valid → 200; `is_ai_response:false` with the same text → 200 (ungated).

### R6-3 — [MEDIUM] `/api/ai/invoke` had no Scripture screen (fallback gap) — FIXED
`/stream` screens fabricated Scripture in its trailer, but clients fall back to `/api/ai/invoke`, which returned parsed JSON as soon as it was syntactically valid — no Scripture screen — so the fallback rendered a completed draft with fabricated refs before any save gate. **Fix:** `/invoke` now runs the same canon-independent `screenStreamedScripture` over the completion (both structured and plain-text paths) and **fails closed with 422** + `{ scripture_unverified, scripture }` metadata — parity with `/stream`, so the client cannot render/save it as trusted. Audit row records `unverified_scripture`. **Tests:** `/invoke` returning a fabricated ref (JSON and plain-text) → 422 `scripture_unverified`; clean refs → 200 with the value.

**Confirmed (round-6):** the Sermon validator deep-scans ALL prose fields (invalid `big_idea`/`theological_notes`/`exegesis` blocked on publish AND share-link serve); generic-API `is_ai_response` CommunityReply writes are gated; `/invoke` has fabricated-Scripture parity with `/stream`.

---

## Round-7 pass — the FOUNDATIONAL extractor bug + all-canon AI screen (all FIXED)

### R7-1 — [HIGH] Case-sensitive extraction let lowercase refs bypass EVERY gate — FIXED
`extractScriptureRefs` (`packages/shared/scripture/index.js`) matched book names only as `[A-Z][a-z]+` with **no case-insensitive flag**, so `hezekiah 4:5` (lowercase/mixed) was **not extracted at all**. Every gate is built on this one function — `validateAiSermon`, `validateAiContent`, `assertAiReplyExposable`, and `screenStreamedScripture` all saw *zero references → all valid* for a lowercase fabricated ref, so Sermon publish, share-link serve, generic AI-reply create, and `/api/ai/invoke` all passed it. The single lowercase letter defeated the whole contract. **Fix:** the extractor regex is now case-insensitive (`[A-Za-z]+ … /gi`); `validateScriptureRefs` already lower-cases the book for canon lookup, so lowercase refs validate correctly (`hezekiah` → `invalid_book`, `john` → `valid`). A `looksLikeReference` filter — known book always kept (incl. deuterocanon words like *Wisdom*/*Song*/*Job*), a curated `NON_BOOK_WORDS` stop-list for the prose that precedes `N:N` (times/ratios/scores: "at 3:30", "the ratio 2:1") dropped — prevents case-insensitivity from over-matching ordinary prose. **Tests:** `hezekiah 4:5` / `HEZEKIAH 4:5` / `Hezekiah 4:5` all extract; lowercase fabricated ref caught through Sermon publish, share-link create+serve, generic AI-reply create, AND `/invoke`; "at 3:30" / "ratio 2:1" / "score 24:10" / "meeting at 10:45" do **not** false-positive.

### R7-2 — [MEDIUM] AI screen wasn't actually all-canon — FIXED
`screenStreamedScripture` validated with the default Protestant canon and passed anything not `invalid_book`/`out_of_range`/`unparseable` — so a deuterocanonical book resolved to `unsupported_canon` and was treated as OK, letting an out-of-range deuterocanonical ref like `Wisdom 99:1` pass on `/invoke` (structured + plain-text) and in the `/stream` trailer. **Fix:** the screen now validates each extracted reference against **every supported canon** (Protestant, Catholic, Orthodox) and flags it as fabricated only when NO canon can place it (never `valid` and never `chapter_checked` anywhere). So a real Protestant ref passes, a real deuterocanonical ref passes (chapter_checked under Catholic/Orthodox), a fabricated book fails, and `Wisdom 99:1` fails (out_of_range in every canon — Wisdom has 19 chapters). **Tests:** `Wisdom 99:1` blocked on `/invoke` and flagged in the `/stream` trailer; in-range `Sirach 3:1` / `Wisdom 3:1` pass; lowercase fabrication caught by the screen too.

**Confirmed (round-7):** the extractor is case-insensitive — lowercase fabricated refs are caught everywhere (publish, share serve, AI-reply create, `/invoke`, `/stream`) without false-positiving on non-reference prose; and the AI screen validates against all supported canons, so out-of-range deuterocanonical refs are rejected while genuine deuterocanon passes.

---

## Round-8 pass — citation-FORMATTING variants (the last extractor layer) — FIXED

### R8-1 — [HIGH] Obfuscated/variant citation syntax bypassed every gate — FIXED
The extractor recognized only ASCII full-word book names + tight whitespace + a `N:N` token, so common formatting variants an AI naturally produces slipped through as *zero references*: `hezekiah 4 : 5` (spaces around the colon) extracted nothing; `Hez. 4:5` (abbreviation + period) extracted nothing; and `II John 1:20` had its roman-numeral prefix **dropped** and was validated as `John 1:20` (valid) instead of `2 John 1:20` (which has no verse 20) — a fabricated/misattributed ref passing as clean. Every gate depends on this one extractor.

**Fix — `extractScriptureRefs` now normalizes and canonicalizes before validation** (`packages/shared/scripture/index.js`):
- **Unicode → ASCII**: non-breaking/en/em/ideographic spaces, fullwidth digits (`４`), fullwidth Latin letters (`Ｈｅｚ`), colon variants (`：` `∶` `ː`), and dash/minus variants are normalized, so a unicode-digit/space/colon evasion can't slip past the matcher.
- **Flexible whitespace** around the colon (and book↔chapter), so `hezekiah 4 : 5` is caught.
- **Abbreviations** (with/without trailing period) via a `BOOK_ABBREV` map covering the standard set (Gen/Gn, Ps/Psa, Matt/Mt, Rom/Rm, 1 Cor/Co, Rev/Rv, Sir/Ecclus, Wis, …); ambiguous forms that collide with common words (`is`, `am`) are deliberately omitted so prose never false-positives.
- **Roman-numeral & worded prefixes** (`I/II/III`, `First/Second/Third`) mapped to `1/2/3` and **bound to the following book**, so `II John 1:20` canonicalizes to `2 John 1:20` (range-checked → out_of_range) and `II Hezekiah 4:5` extracts as `2 Hezekiah` (invalid_book) — the prefix is never silently dropped onto the wrong book.
- Each match is emitted as a clean canonical `Book C:V[-V]` string that `validateScriptureRefs` already handles; the `looksLikeReference` / `NON_BOOK_WORDS` guard still drops times/ratios/scores/pronoun-verb prose so tolerance doesn't over-match.

**Tests (through Sermon publish, share-link create+serve, generic AI-reply create, `/invoke`, AND `/stream`):** `hezekiah 4 : 5`, `Hez. 4:5`, `II Hezekiah 4:5`, `II John 1:20` (fails — 2 John has no v20), fullwidth-digit/colon variants → ALL caught; legit `Gen. 1:1`, `1 Cor 13:4`, `II Tim 1:7`, `First John 3:16` validate correctly (prefix bound to the right book); times/ratios/scores don't false-positive.

**Confirmed (round-8):** the extractor parses abbreviations, roman/worded numeral prefixes bound to the correct book, and flexible/unicode whitespace — so formatting-variant fabricated refs are caught everywhere (publish, share serve, AI-reply create, `/invoke`, `/stream`) while legitimate citations still validate and prose does not false-positive.

---

## Round-9 pass — the AI screen ran on the wrong representation — FIXED

### R9-1 — [HIGH] JSON-escaped citations bypassed the /invoke + /stream screen — FIXED
`screenStreamedScripture` ran the extractor on the RAW completion text only. For a structured JSON response the model can emit a citation via escapes — `{"note":"Hezekiah 4:5"}` — so the raw text contains ` ` (not a literal space), the regex doesn't match, and the screen reported OK; `/invoke` then returned the **parsed** JSON to the client where the string decodes to `"Hezekiah 4:5"` (a real fabricated reference), and the `/stream` trailer marked it OK too. The screen was checking a different representation than the one the client receives.

**Fix:** the screen now uses the shared **deep extractor** (`extractScriptureRefsDeep`, the same one the persist gates use) and accepts multiple inputs; `/invoke` and `/stream` screen **BOTH** the raw completion text **AND** the decoded parsed JSON value (recursively, incl. nested/array-valued strings) before returning/trailering success — so the escaped form is caught in the object the client reconstructs and the plain form is caught in the raw text. Fail closed (422 on `/invoke`, `scripture.ok:false` in the `/stream` trailer). **Tests:** `{"note":"Hezekiah 4:5"}`, `{"x":"Hez. 4:5"}`, `{"y":"II John 1:20"}` (fails — no v20), and a nested/array escaped citation → ALL flagged on `/invoke` AND `/stream` (each test asserts the raw body contains no literal space, proving the escaped form would evade a raw-only screen); a JSON-escaped but VALID `John 3:16` passes; a genuinely clean response still 200.

**Confirmed (round-9):** `/invoke` and `/stream` screen the DECODED parsed JSON value recursively (plus the raw text), so JSON-escaped fabricated citations are caught — matching the deep-scan the persist gates use.

---

## Round-10 pass — 2 representation paths that reach the user past the screen — FIXED

### R10-1 — [HIGH] `/stream` failure signal was opt-in — FIXED
`/stream` writes raw model tokens before validation, then appended the scripture/JSON outcome trailer **only when `stream_result:true`**. A stale Electron/mobile bundle, old web client, or direct caller that OMITS the flag received HTTP 200 with unvalidated bytes and NO `scripture.ok:false` signal — even for a streamed fabricated reference. **Fix:** `/stream` now **requires `stream_result:true`** and returns 400 otherwise (before any bytes/quota), directing non-opting callers to the fully-validated `/invoke`. The flag is the client's acknowledgment that it will honor the trailer, and the trailer is now **mandatory** (written unconditionally) — a streamed response can never reach a client as success without its validation outcome. **Test:** a fabricated reference streamed WITHOUT `stream_result` → 400 (not a silent 200); the legacy "raw bytes, no trailer" behavior is replaced by this fail-closed contract.

### R10-2 — [HIGH] Client coercion synthesized a citation AFTER screening — FIXED
The server screened the raw text + parsed JSON, but the web client's `coerceToSchema` reshapes fields client-side: `{"cross_references":["Hezekiah","4:5"]}` has no extractable ref in any single string, so `/invoke` returned 200; then coercion joined the array into display text `"Hezekiah\n4:5"` — a visible citation the persist gate (on non-persisted reader-insight surfaces) may never see. **Fix (server-side, protects every client):**
- **Flattened/joined scan** — new shared `extractScriptureRefsJoined` scans the JOIN of each array's string elements (with the space/newline separators coercion uses); the `/invoke` + `/stream` screen now runs it alongside the deep sweep, so a citation split across `["Hezekiah","4:5"]` is recombined and caught before returning success.
- **Schema-type enforcement** — new `violatesStringSchema` rejects (422 / `scripture.ok:false`) an array/object returned where the `response_json_schema` declared a **string** field, so the client never has to coerce a wrong-typed value into a citation.

**Tests:** `{"cross_references":["Hezekiah","4:5"]}` and `{"x":["II John","1:20"]}` (fails — no v20) flagged on `/invoke` AND `/stream`; a legit array of separate valid refs still passes; an array supplied for a string-typed field is rejected (`schema_type_violation`).

**Confirmed (round-10):** the `/stream` outcome is mandatory (no opt-in bypass — a stream can't reach a client as success without its validation trailer); and split/coerced citations across array/object values are caught at the server screen via the flattened-representation scan plus string-field schema-type enforcement.

---

## Round-11 pass — the mandatory trailer's ERROR-PATH hole (server + client) — FIXED

### R11-1 — [HIGH] Started-stream errors dropped the mandatory validation trailer — FIXED
After `/stream` writes model deltas, any exception from the upstream async iterator jumped to the catch; because `started` was true the handler only called `res.end()` and returned — it **never ran the final Scripture screen or wrote the result trailer**. A realistic upstream that yields `"Anchored on Hezekiah 4:5."` then throws reached the client as HTTP 200 body with **no** `scripture.ok:false`, and the web client treated a missing separator as legacy success — so a fabricated citation rendered unscreened.

**Fix — fail closed on BOTH ends:**
- **Server** (`services/api/src/routes/ai.js`): `full` (accumulated text) and a `trailerWritten` flag are hoisted outside the delta loop, with a `writeTrailerOnce` helper. The success path writes the trailer through it; the `started` catch path, **before** `res.end()`, writes a FAILURE trailer computed from the accumulated text — `{ok:false, truncated:true, scripture: screenStreamedScripture(full)}` — so a citation already emitted is still flagged. `trailerWritten` guards against a success+error double-write, so **every** started exit (normal end, upstream throw, abort where still writable) emits **exactly one** trailer.
- **Client** (`apps/web/src/api/apiClient.js`): since `StreamLLM` always requests `stream_result:true`, a MISSING separator/trailer (or a malformed one) is now a **protocol failure** — `StreamLLM` throws (`status:502`, `streamIncomplete`) instead of resolving the accumulated text as a valid answer, so an unscreened/partial preview is never kept.

**Tests:** (a) upstream yields a fabricated ref then throws after started → the response carries a `scripture.ok:false` failure trailer (exactly one), not a silent trailer-less 200; (b) the trailer is written exactly once on the normal success path (no double-write); (c) client with `stream_result:true` and a missing (or malformed) trailer → `StreamLLM` throws (protocol failure); (d) a clean stream still succeeds with `ok:true`.

**Confirmed (round-11):** every `/stream` exit emits exactly one validation trailer — including mid-stream upstream errors — and the client treats a missing/malformed trailer as failure when `stream_result` was requested.

---

## Round-12 pass — positive fail-closed enforcement on every axis (2 HIGH, 1 MED) — FIXED

### R12-1 — [HIGH] Client accepted schema-invalid trailers as validated — FIXED
`StreamLLM` rejected only when JSON parsing failed or `result.ok===false`. Any truthy object with a missing/non-boolean `ok`, missing `scripture`, `scripture.ok:false` **with** `ok:true`, or `truncated:true` **with** `ok:true` was treated as validated — so a trailer of `{}` or `{"ok":true,"truncated":false}` (no scripture) returned the fabricated text with no failure. **Fix** (`apps/web/src/api/apiClient.js`): **positive validation** — resolve ONLY when `result.ok===true` AND `result.truncated===false` AND `result.scripture?.ok===true` (all present and strictly boolean); anything else throws 502. Absence of explicit success is failure, never success. **Tests:** `{}`, `{ok:true}`, `{ok:true,truncated:true}`, `{ok:true,scripture:{ok:false}}`, non-boolean `ok` → all throw; a fully-valid `{ok:true,truncated:false,scripture:{ok:true}}` → resolves.

### R12-2 — [HIGH] Started error path awaited audit BEFORE the mandatory trailer — FIXED
The `started` catch path `await`ed `auditAiCall` **before** `writeTrailerOnce`; `auditAiCall` swallows rejections but has no timeout, so a stalled Prisma pool / network partition prevented the failure trailer from ever being written — leaving the client with partial text and no trailer (treated as legacy success). **Fix** (`services/api/src/routes/ai.js`): the started catch path now **writes the failure trailer and `res.end()` BEFORE any awaited observability**, then runs `auditAiCall` fire-and-forget (`.catch()`) after the response is closed — degraded audit storage can never block the stream protocol. (Success already wrote the trailer + ended before awaiting audit.) **Test:** with `aiAuditLog.create` stubbed to hang, a started error still writes exactly one `scripture.ok:false` trailer and ends the response (no hang).

### R12-3 — [MEDIUM] Error trailer used a weaker screen than success — FIXED
Success screened raw text AND the decoded JSON (`screenStreamedScripture(full, parsedValue)`), but the error path screened only raw `full` — so for a schema request that emitted complete JSON `{"cross_references":["Hezekiah","4:5"]}` then threw, the raw string had no whitespace citation and the error trailer wrongly reported `scripture.ok:true`. **Fix:** the schema context is hoisted (`responseSchema`) and a shared `screenAccumulated()` helper re-runs the SAME raw+parsed scan (flattened-join + parsed-value) the success path uses, falling back to raw-only if the accumulated text doesn't parse. **Test:** a split-array citation and a plain citation in complete JSON, each followed by an upstream throw → the trailer carries `scripture.ok:false`.

**Confirmed (round-12):** the client resolves ONLY on a fully-valid positive trailer (`ok && !truncated && scripture.ok`, else throw); the failure trailer is written before any awaited audit (audit can't block the protocol); and the error-path screen uses the same raw+parsed scan as success.

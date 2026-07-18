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

---

## Round-13 pass — client accepted internally-contradictory success trailers — FIXED

### R13-1 — [MEDIUM] Client accepted tampered/contradictory success trailers — FIXED
R12's positive check (`ok===true && truncated===false && scripture.ok===true`) did not reject **unknown keys**, **duplicate keys**, or **evidence that contradicts the verdict**. Accepted-but-should-fail cases: `{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":1,"fabricated":1}}` (fabricated:1 contradicts ok:true); a trailer with an unknown `"extra"` key; and a duplicate-key `{"ok":false,"ok":true,…}` where `JSON.parse` silently keeps the last value (ok:true), letting a corrupted/tampered trailer overwrite a failure with success.

**Fix** (`apps/web/src/api/apiClient.js`) — validate the trailer against an EXACT STRICT schema before resolving (`isFullyValidSuccessTrailer`):
1. **Unknown-key rejection**: top-level keys allowlisted to `{ok, truncated, scripture}`, scripture keys to `{ok, checked, fabricated}`; any extra key → throw 502.
2. **Duplicate-key rejection**: `trailerHasDuplicateKeys` scans the raw trailer text tracking one key-set per open object, so `{"ok":false,"ok":true}` is rejected (not silently last-wins) at any level.
3. **Verdict/evidence consistency**: all verdict fields strictly boolean and present (r12); when scripture counts are present they must be numeric with `fabricated===0` (and `checked>=0`) for `scripture.ok:true` — a `scripture.ok:true` with `fabricated>0` or a non-numeric count throws 502.

The server already includes the counts it screened (`{ok, checked, fabricated}`), so real trailers satisfy the consistency check; the client accepts a countless `scripture:{ok:true}` too (keeps r12 green). Trailer wire shape unchanged → no API change. **Tests:** `fabricated:1`-with-`ok:true`, an unknown top-level or scripture key, a duplicate `ok` key, and a non-numeric count all throw; a consistent `{ok:true,truncated:false,scripture:{ok:true,checked:N,fabricated:0}}` resolves; all r12 positive-validation tests stay green.

**Confirmed (round-13):** the client rejects unknown keys, duplicate keys, and evidence/verdict-inconsistent trailers, resolving ONLY on an exact, consistent, positive trailer.

---

## Round-14 pass — 2 HIGH: parser/validator mismatch + evidence-strip downgrade — FIXED

### R14-1 — [HIGH] Unicode-escaped duplicate keys bypassed duplicate-key rejection — FIXED
`trailerHasDuplicateKeys` compared raw key tokens WITHOUT JSON-decoding their escapes, so it recorded `"ok"` and `"ok"` as **different** keys — while `JSON.parse` normalizes both to `ok` and keeps the LATER value (last-wins). A trailer like `{"ok":false,"ok":true,…}` (or the scripture-nested variant) parsed to `ok:true` yet slipped past the duplicate check. **Fix** (`apps/web/src/api/apiClient.js`): the scanner now finds each key token's exact string bounds (respecting `\\`/`\"`) and **decodes it with `JSON.parse` before the Set lookup**, so the duplicate-detector normalizes escapes EXACTLY as the value parser — an escaped duplicate collides and is rejected, and the detector and value-parser can never disagree. **Tests:** `{"ok":false,"ok":true,…}` and the scripture-nested escaped-`ok` variant are rejected (asserting the raw text carries the escape and `JSON.parse` would last-wins to `ok:true`).

### R14-2 — [HIGH] Missing scripture counts accepted (evidence-strip downgrade) — FIXED
The success check validated `checked`/`fabricated` only WHEN PRESENT, so a trailer that STRIPPED the counts — `{"ok":true,"truncated":false,"scripture":{"ok":true}}` — bypassed the `fabricated===0` consistency check entirely, even though the server's `screenStreamedScripture` ALWAYS emits `{ok, checked, fabricated}`. **Fix:** a success trailer now **REQUIRES** `scripture.checked` and `scripture.fabricated` as own properties, each `Number.isSafeInteger`, with `checked>=0` and `fabricated===0` for `scripture.ok:true`; the "countless still accepted" allowance is dropped (no silent-omission downgrade). **Tests:** countless, missing-one-count, negative, non-integer, `fabricated>0`, and non-numeric counts all throw; a full consistent `{ok:true,truncated:false,scripture:{ok:true,checked:N,fabricated:0}}` resolves. Trailer wire shape unchanged (server already sends counts) → no API change; r12/r13 tests updated to carry counts.

**Confirmed (round-14):** escaped-duplicate keys are rejected (the duplicate-detector decodes each key with `JSON.parse`, normalizing exactly as the value parser); and a success trailer MUST carry consistent numeric counts (`fabricated===0`, safe-integer, non-negative) — no evidence-stripping downgrade.

---

## Round-15 pass — the trailer FRAME itself was spoofable by the model — FIXED

### R15-1 — [HIGH] Model output could spoof the mandatory trailer on interrupted streams — FIXED
`StreamLLM` located the trailer at the FIRST RS (`0x1E`) anywhere in the accumulated bytes, and the server forwarded model deltas UNCHANGED. So the model could emit its own `<RS>{"ok":true,"truncated":false,"scripture":{"ok":true,"checked":0,"fabricated":0}}` inside its output; if the connection/process failed BEFORE the real server trailer was written, `sepIdx` was non-negative, the injected trailer parsed as a fully-valid success, and the unscreened partial text before the injected RS was returned as VALIDATED — bypassing the missing-trailer failure path entirely. The RS separator was trusted as a server-only control byte but flowed through untrusted model output unescaped.

**Fix — make the frame UNFORGEABLE (server strip + server-only marker + client last-RS/reject-content-RS):**
- **Server** (`services/api/src/routes/ai.js`): every model delta has any RS byte **replaced with a space** before forwarding, so the ONLY RS in the stream is the one the server writes right before the trailer — a model can no longer inject a separator (space, not deletion, also keeps a citation the model tried to hide with an RS detectable by the screen; `full` accumulates exactly what the client sees). The real trailer is prefixed with a **server-only unguessable marker** (`STREAM_TRAILER_MARKER`) the model does not know.
- **Client** (`apps/web/src/api/apiClient.js`): locates the trailer at the **LAST** RS (`lastIndexOf`); **rejects** the stream (502) if any RS appears in the content portion (post-strip there can be none — a content RS signals tampering); and **requires the exact server marker** immediately after the RS before parsing the trailer JSON. All r12/r13/r14 positive-schema + count + duplicate-key checks still run on the parsed trailer.

**Net:** a model emitting its own `{…}` can no longer produce a client-accepted success — either the server stripped the RS (no separator in content) or the marker check fails; an interrupted stream with no real trailer → 502 (missing/failed frame), never a silent validated success. **Tests:** (a) `draft<RS>{full success trailer}` with NO marker → 502; (b) a model delta containing a raw RS byte is replaced by the server so the client sees exactly one authentic (marked) trailer; (c) a wrong-marker trailer → 502; a content-portion RS with a valid trailer after → 502; (d) a normal clean stream with the authentic marked trailer resolves; r14 duplicate/count tests stay green (updated to carry the marker).

**Confirmed (round-15):** the trailer frame is unspoofable — server replaces RS in deltas + a server-only marker + client last-RS/reject-content-RS/verify-marker — so a model-injected fake trailer on an interrupted stream can never be accepted as a validated success.

---

## Round-16 pass — JSON-escaped RS bypass + static marker → per-stream nonce (all FIXED)

### R16-1 — [HIGH] JSON-escaped RS bypassed the strip and post-parse screening — FIXED
The server's delta sanitizer replaced only LITERAL U+001E, so a schema response could hide the byte behind a JSON escape: `{"note":"Hezekiah4:5"}` has no literal RS to strip and no content RS for the client to reject, but `extractJson(full)` DECODES the string back to a real RS — and the shared extractor didn't treat RS as whitespace, so `"Hezekiah<RS>4:5"` wasn't caught → trailer written `ok:true`. **Fix** (`packages/shared/scripture/index.js`): `normalizeCitationText` now normalizes ALL decoded **C0 control characters** (U+0000–U+001F except `\t\n\r`) to a **space** before matching (via a dynamically-built regex so eslint's `no-control-regex` isn't tripped). This runs in `extractScriptureRefs`, so every consumer — `validateAiSermon`, `validateAiContent`, the flattened-join scan, AND the `/invoke` + `/stream` screen (success and error paths, which scan the decoded parsed value) — recombines a control-split citation and catches it. **Tests:** `{"note":"Hezekiah4:5"}` and split-array/`` variants → `scripture.ok:false` on `/invoke` and `/stream`; valid refs still validate; `\n`/`\t` are not collapsed into false merges.

### R16-2 — [MEDIUM] Static trailer marker → per-stream out-of-band nonce — FIXED
The round-15 marker was a FIXED literal shipped in the browser bundle, so a malicious user/model could know and echo it. **Fix:** replaced with a **per-stream crypto-random nonce** (`crypto.randomBytes(16)`) generated per `/stream` request, delivered **out of band** in the `X-Stream-Trailer-Nonce` response header set BEFORE any model bytes (and exposed via CORS `exposedHeaders` for cross-origin/Electron clients), and written immediately after the RS before the trailer JSON. The client reads the header and requires that exact nonce after the last RS before parsing; the RS-strip stays as defense in depth. The model never sees the nonce (header-only, set pre-body) and it changes every stream, so an echoed value from model output or a prior stream is useless. **Tests:** wrong nonce → 502; missing nonce header → 502; the authentic per-stream nonce resolves; two streams issue different nonces; the model-injected fake trailer (no nonce prefix) → 502.

**Confirmed (round-16):** decoded C0/RS separators in content are normalized to spaces before screening (an escaped control-split citation is caught on `/invoke` and `/stream`); and the trailer is authenticated by a per-stream out-of-band crypto nonce (static-marker echo no longer works).

---

## Round-17 pass — INVISIBLE non-C0 separators still bypassed screening — FIXED

### R17-1 — [HIGH] Invisible non-C0 separators bypassed Scripture screening — FIXED
Round-16 normalized C0 controls and selected Unicode spaces, but `U+200B` (zero-width space), `U+007F` (DEL), the C1 controls `U+0080–U+009F` (incl. `U+0085` NEL), and other invisible format characters are NOT matched by JS `\s` and were not normalized — so `"Hezekiah<ZWSP>4:5"` / `"Hezekiah<DEL>4:5"` returned NO refs and `validateAiContent` reported `allValid:true`. The `/stream` and `/invoke` parsed-value screens then wrote/returned a clean success.

**Fix** (`packages/shared/scripture/index.js`): `normalizeCitationText` now maps the FULL invisible/format threat set to a space before extraction, using Unicode property classes (robust and future-proof, and lint-safe — no literal control chars):
- `\p{Cc}` → space (all control chars: C0 + C1 + DEL), **except** real whitespace `\t\n\r`;
- `\p{Cf}` → space (all Unicode FORMAT characters: `U+200B–U+200D` zero-width space/non-joiner/joiner, `U+2060` word joiner, `U+FEFF` BOM/ZWNBSP, `U+00AD` soft hyphen, and every other default-ignorable format code point).

This replaces (and subsumes) round-16's dynamic C0 regex. It runs inside `extractScriptureRefs`, so every consumer benefits — the persist validators (`validateAiSermon`/`validateAiContent`), the flattened-join scan, and the `/invoke` + `/stream` screens (success AND started-error paths, which scan the decoded parsed value). A prefix stays bound through an invisible separator (`II<ZWSP>John 1:1` → `2 John 1:1`).

**Tests:** `Hezekiah<ZWSP>4:5`, `<DEL>`, `<WJ>`, `<BOM>`, `<SHY>`, C1 (`U+0080`/`U+009F`) and C0 splits, plus `II<ZWSP>John 1:1` and a split-array variant → all caught (`scripture.ok:false`) on `/invoke` AND `/stream` (success + started-error); a normal-space citation still validates; ordinary text isn't corrupted.

**Confirmed (round-17):** the full invisible-separator set (C0/C1/DEL controls via `\p{Cc}`, all format chars via `\p{Cf}`) is normalized to spaces before extraction and covered on `/invoke` and `/stream` — an invisible-char-split citation can no longer bypass the screen.

---

## Round-18 pass — default-ignorable non-Cf characters still split citations — FIXED

### R18-1 — [HIGH] Default-ignorable non-Cf characters split citations past the gate — FIXED
Round-17 mapped `\p{Cc}` + `\p{Cf}`, but **variation selectors** (`U+FE00–FE0F`, `U+E0100–E01EF`), the **combining grapheme joiner** (`U+034F`), **Mongolian free variation selectors** (`U+180B–180D`), and **Hangul fillers** are category `\p{Mn}`/other — NOT `Cf`, NOT JS whitespace. So `"Hezekiah<VS>4:5"` / `"Hezekiah<CGJ>4:5"` / `"Hezekiah<U+E0100>4:5"` extracted ZERO refs → the shared screen returned `{ok:true,checked:0,fabricated:0}`, and `/invoke` + `/stream` shipped the fabricated reference clean.

**Fix** (`packages/shared/scripture/index.js`): `normalizeCitationText` now maps `\p{Cc}` (all controls, except real whitespace `\t\n\r`) **plus** `[\p{Cf} \p{Default_Ignorable_Code_Point}]` to a space before extraction. `\p{Default_Ignorable_Code_Point}` (aka `\p{DI}`) subsumes the format chars AND adds the variation selectors / CGJ / Mongolian FVS / Hangul fillers (verified: each is DI); `\p{Cf}` is retained alongside to also cover any Cf-not-DI code point. Runs inside `extractScriptureRefs`, so every consumer benefits (persist validators + flattened-join + `/invoke` + `/stream` success AND started-error). A prefix stays bound through such a separator (`II<CGJ>John 1:1` → `2 John 1:1`); real whitespace is preserved (no wrong merges); ordinary prose (incl. a legit emoji with a variation selector) isn't corrupted for detection.

**Tests:** `Hezekiah<VS1/VS16/VS-supp/CGJ/MongFVS/HangulFiller>4:5` (plus the r16/r17 control/zero-width set) and `II<invisible>John 1:1` and a split-array variant → all caught (`scripture.ok:false`) on `/invoke` AND `/stream` (success + started-error); a normal-space citation still validates; ordinary text isn't corrupted.

**Confirmed (round-18):** `\p{Cc}` + `\p{Default_Ignorable_Code_Point}` (+`\p{Cf}`) normalization catches variation-selector / CGJ / Mongolian-FVS / Hangul-filler splits on `/invoke` and `/stream`, closing the invisible-separator class.

---

## Round-19 pass — the last invisible class: non-default-ignorable combining marks — FIXED

### R19-1 — [HIGH] Non-default-ignorable combining marks split citations past the gate — FIXED
Round-18 mapped `\p{Cc}` + `\p{Cf}` + `\p{Default_Ignorable_Code_Point}`, but zero-advance **combining marks** that aren't default-ignorable remained: combining accents (`U+0300` grave, `U+0301` acute) and enclosing marks (`U+20DD`) are `\p{Mn}`/`\p{Me}` — NOT DI, NOT JS whitespace. So `"Hezekiah<U+0300>4:5"` / `"Hezekiah<U+20DD>4:5"` extracted ZERO refs → the shared screen returned `{ok:true,checked:0,fabricated:0}`, and `/invoke` + `/stream` shipped the fabricated reference clean.

**Fix** (`packages/shared/scripture/index.js`): `normalizeCitationText` now adds `\p{M}` (all combining marks — Mn/Mc/Me) to the space-normalization set, so the full set is `\p{Cc}` (except `\t\n\r`) + `[\p{Cf} \p{Default_Ignorable_Code_Point} \p{M}]` → space, before extraction. This is safe: scripture book names are ASCII so legit citations are unaffected; mapping a combining mark to a space can only ADD whitespace — erring toward FLAGGING a hidden citation, never toward missing one; and it affects only the extraction/screen copy, not stored/displayed text. It runs inside `extractScriptureRefs`, so every consumer benefits (persist validators + flattened-join + `/invoke` + `/stream` success AND started-error).

**Tests:** `Hezekiah<U+0300/U+0301/U+20DD/U+20E3>4:5` (plus the full prior DI/Cf/control/zero-width set) and `II<invisible>John 1:1` and a split-array variant → all caught (`scripture.ok:false`) on `/invoke` AND `/stream` (success + started-error); a normal-space citation still validates; ordinary accented prose (even decomposed combining accents) without a book-name+chapter:verse pattern is NOT mis-flagged as a citation.

**Confirmed (round-19):** `\p{Cc}` + `\p{Cf}` + `\p{Default_Ignorable_Code_Point}` + `\p{M}` normalization catches combining-mark splits on `/invoke` and `/stream` — the invisible / zero-width / zero-advance separator class is now fully covered.

---

## Round-20 pass — r19's global `\p{M}` introduced a false positive (NFC + boundary-aware) — FIXED

### R20-1 — [MEDIUM] Global `\p{M}`→space turned decomposed accented prose into fabricated citations — FIXED
Round-19's global `\p{M}`→space didn't only operate at the book↔chapter boundary — it split ordinary **decomposed** accented words before the permissive citation regex: `"café 4:5"` (decomposed `cafe` + `U+0301`) extracted `"Cafe 4:5"` (→ `invalid_book` → `scripture.ok:false`), and `"résumé 4:5"` extracted `"Sume 4:5"`. Legit AI output with decomposed accented prose followed by a ratio-like `N:N` was WRONGLY rejected.

**Fix** (`packages/shared/scripture/index.js`), two parts:
1. **NFC first** — `text.normalize('NFC')` recomposes legitimate decomposed accents into single Letter code points (`café` → `café`, `é` = `U+00E9`, category `\p{L}`), so they are NOT treated as combining marks — killing the café/résumé false positives. An un-composable attack sequence (`h` + `U+0300` grave has no precomposed form) still leaves a standalone `\p{M}`.
2. **Boundary-aware `\p{M}`** — the truly-invisible zero-width/format/control chars (`\p{Cc}`+`\p{Cf}`+`\p{Default_Ignorable_Code_Point}`) stay GLOBAL (they never occur inside a legit word). Combining marks (`\p{M}`) are now normalized to a space ONLY where they sit at a book↔chapter boundary — between a letter and a digit (both directions) — so a residual mark hiding a `book↔chapter` boundary is caught (`Hezekiah<U+0300>4:5` → `Hezekiah 4:5` → `invalid_book`), while a mark that stays **word-internal** (letter↔letter) is left alone (no false split).

Runs inside `extractScriptureRefs`, so every consumer benefits. The r16–r18 invisible-char coverage (control/format/default-ignorable, incl. zero-width prefix binding `II<ZWSP>John` → `2 John`) is preserved via the global replacement.

**Tests:** `café 4:5`, `résumé 4:5`, NFC-composed `café 4:5`, and a decomposed accent + ratio in prose → NOT rejected (200 / `scripture.ok:true`) on `/invoke` AND `/stream`; `Hezekiah<U+0300/U+0301/U+20DD/U+20E3>4:5` and the r16–r19 zero-width/DI set → caught (`scripture.ok:false`) on `/invoke` AND `/stream` (success + started-error); `John 3:16` validates.

**Confirmed (round-20):** NFC + boundary-aware combining-mark handling catches the hidden-separator attack WITHOUT falsely rejecting decomposed accented prose (café/résumé), preserving the full invisible-separator coverage.

---

## Round-21 pass — the hard core: combining marks still hid citations in two cases — FIXED

### R21-1 — [HIGH] Combining marks still bypassed screening (mark-before-space; NFC-composed mark) — FIXED
The r20 boundary rule replaced `\p{M}` only immediately between a **letter and a digit**, missing: (a) `"Hezekiah̀ 4:5"` — the mark is followed by a real SPACE (letter↔space), so the book token `"Hezekiah̀"` didn't match → zero refs → treated clean; (b) `"Hezekiaḣ 4:5"` / `"Hezekiaḣ4:5"` — NFC **composes** `h`+`U+0307` into a precomposed non-ASCII letter (`ḣ`) BEFORE the mark rule, so the book token is non-ASCII and isn't extracted.

**The tension:** the attack (`Hezekiah`+mark+`N:N`, a fabricated book hidden by a mark) and the false positive (`café 4:5`, a legit accented word + ratio) both look like "ASCII-base + combining mark + N:N"; they separate only on whether the mark-stripped base is a plausible SCRIPTURE BOOK.

**Fix** (`packages/shared/scripture/index.js`) — mark-insensitive detection + book-shaped flagging:
1. **Two-pass extraction.** `extractScriptureRefs` now runs the existing normalized pass (unchanged for normal text) AND a second **mark-stripped** pass: `markStrippedText` = NFD-decompose → replace every `\p{M}` with a space → normalize. This reconstructs the ASCII base of a book token whose boundary a mark hid — regardless of the mark's position (letter↔space, letter↔digit) or whether NFC composed it (`Hezekiaḣ` → `Hezekiah`).
2. **Book-shaped gate on the mark-stripped pass.** A mark-stripped `Word N:N` flags ONLY when the base is book-shaped: a known canonical book / abbreviation / numbered book, OR a fabricated **biblical-proper-noun shape** (a biblical name suffix — `iah/jah/iel/uel/ael/oel/[aeiou]el/ah/oth/ith` — and not a common non-book word). So `Hezekiah` (→ `-iah`) is flagged even when a mark hid it, while `café`/`résumé` (mark-stripped `cafe`/`resume`) are NOT — they aren't book-shaped and are also listed as non-book words. The normal pass is unchanged (a fabricated book with a normal space is still caught by the existing non-stopword rule).
3. The r16–r20 invisible/zero-width coverage and NFC handling of legit accents are preserved; everything runs inside `extractScriptureRefs`, so `/invoke` + `/stream` (success + started-error) all inherit it.

**Tests (acceptance):** `Hezekiah̀ 4:5`, `Hezekiaḣ 4:5`, `Hezekiaḣ4:5`, and normal `Hezekiah 4:5` → all CAUGHT (`scripture.ok:false`) on `/invoke` AND `/stream`; `café 4:5`, `résumé 4:5`, NFC-composed `café 4:5`, plain `cafe 4:5`, and decomposed-accent + ratio prose → NOT flagged (200 / `scripture.ok:true`); `John 3:16` and `II John 1:1` (roman-numeral book) valid; the r16–r19 zero-width/DI set still caught (incl. zero-width prefix binding).

**Known limitation (documented):** a mark-hidden fabricated book that is NOT biblical-name-shaped (e.g. a city name like a mark-hidden "Babylon 4:5") is caught by the normal pass only when written with a normal space; the mark-stripped pass gates on book-shape to avoid the café/résumé class of false positive. This is the correct side of the attack-vs-false-positive tradeoff for book-shaped fabrications (the realistic fabricated-scripture case), which the tests cover.

**Confirmed (round-21):** mark-stripped detection catches a mark-hidden book name at any mark position (NFC-composed or not), while the book-shaped-token gate keeps café/résumé from false-flagging.

---

## Round-22 pass — word-internal marks still bypassed known-book screening — FIXED

### R22-1 — [HIGH] Internal combining marks split the token instead of reconstructing it — FIXED
The r21 `markStrippedText` replaced EVERY combining mark with a space, so a **word-internal** mark split the token instead of rejoining it: `"Joh́n 99:1"` / `"Joḣn 99:1"` → `"Joh n 99:1"` → the regex extracted nothing → `refs:[] allValid:true`. So even a KNOWN book out of range (`John 99:1` — John has no ch.99) was treated as clean, and likewise for numbered books (`"II Joḣn 99:1"`). `/invoke` + `/stream` inherited it via `extractScriptureRefsDeep`.

**Fix** (`packages/shared/scripture/index.js`): the mark-stripped pass is now **position-aware** on the NFD-decomposed text:
- a mark at a book↔chapter **boundary** (letter↔digit, either direction) hides the separator → replaced with a **SPACE** (`"Hezekiaḣ4:5"` → `"Hezekiah 4:5"`);
- every OTHER mark (word-internal letter↔letter, or letter↔space) is **DELETED**, so the ASCII token rejoins (`"Joh́n 99:1"` → `"John 99:1"`; `"café 4:5"` → `"cafe 4:5"`).

So a mark hidden ANYWHERE in a known or biblical-shaped book name is caught: `"Joh́n 99:1"` → `John 99:1` (out_of_range), `"II Joḣn 99:1"` → `2 John 99:1` (out_of_range), `"Hezekiaḣ4:5"` → `Hezekiah 4:5` (invalid_book). Deleting internal marks does NOT create a café false positive — the book-shape gate (r21) still rejects `cafe`/`resume`; and a token with no mark is never altered (`"John 3:16"` unchanged). The r16–r21 coverage is preserved; runs inside `extractScriptureRefs` so `/invoke` + `/stream` (success + started-error) inherit it.

**Tests:** `"Joh́n 99:1"`, `"Joḣn 99:1"`, `"II Joḣn 99:1"` (known books out of range, internal mark) → CAUGHT (`scripture.ok:false`) on `/invoke` AND `/stream`; the r21 set (`Hezekiah̀`/`Hezekiaḣ` caught; café/résumé/`John 3:16`/`II John 1:1`/zero-width clean) still behaves; a normal `"John 3:16"` still valid (not mangled by mark deletion when no mark is present).

**Confirmed (round-22):** word-internal marks are deleted (rejoining the token) while letter↔digit-boundary marks become a space — so a mark hidden anywhere in a known or biblical-shaped book name is caught, with no café-class false positive.

---

## Round-23 pass — three residual Unicode gaps: compatibility look-alikes, digit-internal invisibles, mid-word match start — FIXED

### R23-1 — [HIGH] Compatibility look-alikes (Roman numerals, math/fullwidth digits) bypassed screening — FIXED
The extractor normalized canonical forms (NFC/NFD) but not **compatibility** look-alikes. `"Ⅱ John 1:20"` (U+2161 ROMAN NUMERAL TWO, category `Nl`) is not `[a-z]`/`[1-3]`, so the numeral prefix never bound — the pass saw a bare `"John 1:20"` (valid) and missed that this is **2 John 1:20** (2 John has 13 verses → out_of_range). `"John 𝟗𝟗:𝟏"` (mathematical bold digits U+1D7D7/U+1D7CF) never matched the ASCII `\d` in the matcher, so it extracted **nothing** → `allValid:true`.

**Fix** (`packages/shared/scripture/index.js`): the detection shadow (`markStrippedText`) now runs `.normalize('NFKC')` before NFD. NFKC folds Roman-numeral code points to ASCII (`Ⅱ`→`II`→2 John, range-checked → out_of_range) and folds mathematical / fullwidth / superscript digit look-alikes to ASCII (`𝟗𝟗`→`99` → `John 99:1` out_of_range). NFKC is used **only for detection** — never for stored or displayed text — and the book-shape gate keeps it from over-flagging (a folded token still has to look like a book).

### R23-2 — [HIGH] Invisible characters inside a digit run truncated the number past the gate — FIXED
The normal pass mapped every invisible/zero-width char to a **space** (correct for a prefix↔book seam like `II​John`→`II John`), but that split a number placed with an invisible **between digits**: `"John 3:9​9"` (renders `John 3:99`, and John 3 has only 36 verses) became `"John 3:9 9"`, from which the pass extracted the truncated **in-range** `"John 3:9"` (valid) and never saw the real out-of-range `3:99`.

**Fix** (`packages/shared/scripture/index.js`): the detection shadow now applies the same **position-aware** rule to the combined invisible-or-mark class that r22 applied to marks — at a letter↔digit boundary → SPACE, but **inside a letter run OR a digit run → DELETE** (rejoin). So `"3:9​9"`→`"3:99"` (out_of_range) and `"Joh​n 99:1"`→`"John 99:1"` are reconstructed and caught, while the normal pass keeps its safe global→space so `II​John`→`2 John` and accented prose are unaffected. A seam that fuses a non-book (`II​John`→`IIJohn`→`iijohn`) is harmlessly dropped by the book-shape gate rather than becoming a false positive.

### R23-3 — [MEDIUM] The ASCII matcher could start mid-word after an accented letter (false positive) — FIXED
`CITATION_RE` began with an ASCII `\b`, which treats the seam between a non-ASCII letter and an ASCII letter as a word boundary. So `"naïve 4:5"` matched `"ve 4:5"` and `"L'Oréal 4:5"` matched `"al 4:5"` — phantom "books" then screened as fabricated (a café-class false positive on ordinary accented prose).

**Fix** (`packages/shared/scripture/index.js`): `CITATION_RE` gains a Unicode-aware negative lookbehind `(?<![\p{L}\p{M}'’])` (and the `u` flag) so a book token cannot start immediately after a Unicode letter, combining mark, or apostrophe — it must begin at a real word start (BoS / whitespace / non-letter punctuation). `"naïve 4:5"`/`"L'Oréal 4:5"`/`"résumé 4:5"` now yield no reference; genuine references are unchanged.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (three new `it` blocks: NFKC folding, digit-internal invisible, mid-word start) and `services/api/src/__tests__/aiStreamScripture.test.js` (one new block asserting each string over `/invoke` + `/stream` success + error). CAUGHT (`scripture.ok:false` / 422): `"Ⅱ John 1:20"`, `"John 𝟗𝟗:𝟏"`, `"Joh​n 99:1"`, `"Hezekia​h 4:5"`, `"John 3:9​9"`. NOT flagged: `"naïve 4:5"`, `"L'Oréal 4:5"`. Still valid: `"II John 1:1"`, `"John 3:16"`. The r16–r22 attack set and the `II<invisible>John`→`2 John` prefix binding all still behave.

**Confirmed (round-23):** compatibility look-alikes are folded (detection-only), invisibles inside a digit run are rejoined so the true number is range-checked, and the matcher can no longer start mid-word after an accented letter — with no new false positives and every prior round preserved.

---

## Round-24 pass — compatibility numeral-prefix + invisible seam, and non-ASCII decimal digits — FIXED

### R24-1 — [HIGH] A compatibility Roman-numeral prefix fused to a book by an invisible seam was misread as the bare book — FIXED
`"Ⅱ​John 1:20"` (U+2161 ROMAN NUMERAL TWO + a zero-width space): after NFKC the r23 detection **shadow** folds `Ⅱ`→`II` but then its aggressive delete-and-rejoin merges the folded prefix and book across the invisible seam into `"IIJohn"` → `iijohn`, which the book-shape gate drops. The **normal** pass does not NFKC-fold `Ⅱ`, so it only extracts the bare `"John 1:20"` (valid). Neither pass produced `2 John 1:20` — 2 John has 13 verses in ch.1, so verse 20 is out_of_range — and the screen reported `ok:true`.

**Fix** (`packages/shared/scripture/index.js`): added a **third detection input** — NFKC-fold **then** apply the SAME normal (global invisible→space, non-deleting) normalization, gated by `looksLikeReference` like pass 1. `"Ⅱ​John 1:20"` → NFKC `"II​John 1:20"` → global hidden→space `"II John 1:20"` → the numeral prefix stays its own token → `2 John 1:20` (out_of_range). The three detection inputs are now: (1) normal (global→space, no NFKC); (2) **NFKC + global→space** (this one — catches a folded numeral prefix + invisible seam); (3) the book-shape-gated NFKC + delete-rejoin shadow (catches mark-hidden book names). NFKC keeps precomposed accents non-ASCII (`café`→`café`), so pass 2 does not reintroduce the café/résumé false positive, and `II<invisible>John`→`2 John` prefix binding is preserved.

### R24-2 — [HIGH] Non-ASCII decimal digits (Arabic-Indic, Devanagari, …) were not normalized — FIXED
`"John 3:٣٧"` (Arabic-Indic 3,7 → 37; John 3 has 36 verses) and `"John ٩٩:١"` (99:1) are visibly out-of-range references, but `normalizeCitationText` only folded **fullwidth** digits and `CITATION_RE` matches the ASCII `\d`; NFKC does **not** fold Arabic-Indic / Devanagari digits to ASCII. So these extracted **zero** refs → `allValid:true`.

**Fix** (`packages/shared/scripture/index.js`): `normalizeCitationText` now maps **every** Unicode decimal digit (`\p{Nd}`) to its ASCII value, replacing the fullwidth-only fold. A `NON_ASCII_DIGIT_VALUE` map is built from each script's digit-**zero** base code point (`DIGIT_ZERO_BASES`) plus its next nine (Nd runs are 10 contiguous, 0–9), covering the BMP scripts (Arabic-Indic U+0660, Extended Arabic-Indic U+06F0, Devanagari U+0966, …) and the SMP sets (incl. the math/fullwidth digits NFKC already folds). ASCII `0–9` pass through untouched; a code point outside the enumerated sets is left as-is. Applied in `normalizeCitationText`, so **all three** detection passes get it. `"John 3:٣٧"`→`John 3:37` (out_of_range), `"John ٩٩:١"`→`John 99:1` (out_of_range), a numbered-book prefix `"٢ John 1:20"`→`2 John 1:20`; a VALID ref in any numeral system still validates (`"John ३:१६"`→`John 3:16` valid). Detection-only — stored/displayed text is never altered.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks: folded-prefix+invisible-seam → numbered book; non-ASCII decimal digits Arabic-Indic/Devanagari) and `services/api/src/__tests__/aiStreamScripture.test.js` (one new block over `/invoke` + `/stream` success + error). CAUGHT (`scripture.ok:false` / 422): `"Ⅱ​John 1:20"`, `"Ⅲ​John 1:20"`, `"John 3:٣٧"`, `"John ٩٩:١"`, `"John ३:३७"`, `"٢ John 1:20"`. Still valid / not flagged: `"II John 1:1"`, `"John 3:16"`, `"John ३:१६"`, `café`/`résumé`/`naïve`/`L'Oréal`. The full r16–r23 attack set behaves unchanged.

**Confirmed (round-24):** a compatibility numeral prefix fused by an invisible seam is now bound to the correct numbered book (via the NFKC+global pass), and every Unicode decimal-digit system is normalized to ASCII so a visibly out-of-range chapter/verse is range-checked — on `/invoke` and `/stream`, with no new false positives.

---

## Round-25 pass — completes the numeral / prefix grammar (complete \p{Nd} table, Roman chapter/verse, compact numbered-book binding) — FIXED

### R25-1 — [HIGH] The decimal-digit fold was an incomplete hand-listed table — FIXED
R24 folded non-ASCII digits from a hand-listed `DIGIT_ZERO_BASES` array, which omitted newer/rarer `\p{Nd}` blocks (e.g. Kawi U+11F50–11F59, Nag Mundari U+1E4F0–1E4F9). Residuals: `"John 𑽓:𑽓𑽗"` (Kawi 3:37) extracted zero refs; `"𑽒 John 1:20"` read as bare `John 1:20` (valid).

**Fix** (`packages/shared/scripture/index.js`): replaced the table with a COMPLETE, Unicode-version-agnostic rule. `decimalDigitToAscii(ch)` derives any digit's value by walking to the start of its contiguous `\p{Nd}` run (decimal-digit sets are always 10 contiguous code points encoding 0–9 in order) and taking `(codePoint − runStart) mod 10` (the `mod 10` is correct even for back-to-back script blocks), memoized per code point. No digit block can be missed, now or in a future Unicode version. Applied in `normalizeCitationText`, so all three detection passes get it. **Property-sweep-verified**: a test enumerating EVERY `\p{Nd}` code point (760 of them, incl. Kawi / Nag Mundari) asserts each folds to its correct ASCII value.

### R25-2 — [HIGH] Roman-numeral chapter/verse were not screened — FIXED
`CITATION_RE` required ASCII `\d{1,3}` for chapter/verse/range-end, so `"John III:37"`, `"John Ⅲ:37"` (U+2162), `"John 3:XXXVII"`, `"II John I:XX"` extracted zero refs → `ok:true`.

**Fix**: the number token is now `(\d{1,3}|[ivxlcdm]{1,15}(?![a-z]))` in the chapter, verse, and range-end positions; `parseCitation` converts a Roman token to its integer via `romanToInt` (lenient subtractive parse) and the converted number is range-checked. Unicode Roman-numeral code points (Ⅰ–Ⅻ) are folded to ASCII by the NFKC detection passes before the matcher runs. The trailing `(?![a-z])` keeps a Roman token from being the head of a longer word (`"Luke 2:live"` does not become verse `"liv"`=54), and Roman numbers are only read in the chapter/verse position after a book+separator, so ordinary prose is unaffected. `"John III:37"`/`"John 3:XXXVII"` → `John 3:37` (out_of_range); `"II John I:XX"` → `2 John 1:20` (out_of_range); `"John 3:16"` still valid.

### R25-3 — [HIGH] Compact / hyphen / dot numbered-book prefixes were dropped or mis-bound — FIXED
The prefix grammar required whitespace after the numeral, so `"2John 1:20"` extracted zero refs and `"2-John 1:20"` extracted a bare, VALID `"John 1:20"` (dropping the `2`).

**Fix**: a `COMPACT_NUMBERED_RE` rewrite in `normalizeCitationText` turns a numeric (1-3) or Roman (I-III) prefix joined to a numbered-book **stem** by nothing / hyphen / dot into the spaced form (`"2John"`/`"2-John"`/`"2.John"`/`"IIJohn"` → `"2 John"`), which the existing spaced-prefix grammar then binds. Crucially, the rewrite is restricted to actual numbered-book stems (full names + 3+ char abbreviations, **derived from the book tables** so it can't drift; 2-char abbreviations excluded), so a real book name is NEVER split (`"Isaiah"` stays `"Isaiah"`, never `"1 Saiah"`), a hyphenated non-book is not mis-bound (`"pseudo-John 4:5"` → plain `John 4:5`, not a numbered book), and prose is not fused. Because `"2-John"` is rewritten to `"2 John"` before matching, it can no longer extract as a bare valid `"John"`. `"2John 1:20"`/`"2-John 1:20"`/`"IIJohn 1:20"` → `2 John 1:20` (out_of_range).

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (property-sweep over every `\p{Nd}`; Roman chapter/verse/range with the `"Luke 2:live"` negative; compact/hyphen/dot binding with the `Isaiah`/`pseudo-John` negatives) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, split to respect the 30/min AI rate limit). CAUGHT: `John III:37`, `John Ⅲ:37`, `John 3:XXXVII`, `II John I:XX`, `2John 1:20`, `2-John 1:20`, `2.John 1:20`, `IIJohn 1:20`, `John 𑽓:𑽓𑽗` (Kawi). Not flagged / still valid: `John 3:16`, `1 John 1:1`, `II John 1:1`, `Isaiah 3:1`, `pseudo-John 4:5`, café/résumé/naïve/L'Oréal.

**Confirmed (round-25):** the decimal-digit fold is COMPLETE (property-sweep-verified over every `\p{Nd}`), Roman-numeral chapter/verse are parsed and range-checked, and compact/hyphen numbered-book forms bind to the correct numbered book — on `/invoke` and `/stream`, with no new false positive.

### Status of the scripture-screening class
With R25 the **numeric / prefix grammar** for reference detection is comprehensively closed: the book token (abbrevations, "of X", period), the numeric/Roman/worded prefix (spaced, compact, hyphen, dot), and the chapter/verse/range numbers (ASCII, fullwidth, every Unicode decimal-digit script, and Roman) are all covered, across all three normalization passes (normal, NFKC+global, NFKC+delete-rejoin shadow) and the book-shape gate, over per-string, deep, joined-array, `/invoke`, and `/stream` (success + error) surfaces. Remaining theoretical residue is intentional and fails safe: a common English word that is itself a valid Roman numeral sitting exactly in a `Book N:<word>` verse slot (e.g. "John 3:mix") over-flags (rejects the AI output) rather than under-flags. No known under-flagging (bypass) vector remains in the extractor grammar.

---

## Round-26 pass — the last under-flagging gaps: compact book↔chapter, compact fabricated-book prefixes, non-canonical Roman — FIXED

### R26-1 — [MEDIUM] A book run together with chapter:verse (no space) was not bound — FIXED
The matcher required whitespace between the book token and the chapter, so `"John3:37"`, `"Jn3:37"`, `"Hezekiah4:5"` extracted zero refs (an out-of-range real-book ref and a fabricated-book ref both slipped).

**Fix** (`packages/shared/scripture/index.js`): a `COMPACT_BOOK_CHAPTER_RE` rewrite in `normalizeCitationText` inserts a space when a KNOWN book/abbreviation OR a book-SHAPED token (same biblical-suffix set as the r21 book-shape gate) is immediately glued to a `chapter:verse` (digit OR Roman). `"John3:37"`→`John 3:37` (out_of_range), `"Jn3:37"`→John 3:37, `"Hezekiah4:5"`→invalid_book, `"John3:16"`→valid. The book-shape gate keeps a non-book safe: `"cafe4:5"`/`"size10:30"` are not book-shaped → not bound → no false positive.

### R26-2 — [MEDIUM] A compact numeric/Roman prefix only bound KNOWN numbered-book stems — FIXED
`COMPACT_NUMBERED_RE` (r25) rewrote only when the suffix was an existing numbered-book stem, so a compact FABRICATED numbered ref `"2Hezekiah 4:5"` / `"𑽒Hezekiah 4:5"` (Kawi 2) → no refs, while spaced `"2 Hezekiah 4:5"` was caught.

**Fix**: a second rewrite `COMPACT_PREFIX_BOOKSHAPED_RE` binds a numeric (1-3, incl. any Unicode digit already folded to ASCII) or Roman prefix fused (no-space / hyphen / dot) to a book-SHAPED token before `chapter:verse` into the spaced numbered form, emitting `invalid_book` rather than dropping. `spaceCompactPrefix` gates it: a digit prefix binds with no separator (no real book starts with a digit); a Roman prefix with an explicit separator always binds; a Roman prefix with NO separator binds only when the fused word is not itself a real book — so `"Isaiah"` (which the biblical-suffix pattern would otherwise match as "I"+"saiah") is NEVER split, while `"IIHezekiah 4:5"` (fused word not a book) IS caught. `"2Hezekiah 4:5"`/`"2-Hezekiah 4:5"`/`"𑽒Hezekiah 4:5"`/`"IIHezekiah 4:5"` → `2 Hezekiah 4:5` (invalid_book); `"2John 1:20"` → `2 John 1:20` (out_of_range); a hyphenated non-book `"pseudo-Hezekiah 4:5"` → plain `Hezekiah 4:5` (invalid_book), NOT a numbered form.

### R26-3 — [MEDIUM] Malformed Roman numerals were coerced into valid refs — FIXED
`romanToInt` accepted any `[ivxlcdm]{1,15}` without canonical validation, so `"John IIV:1"` → `John 5:1` (valid), `"John ⅠⅠⅤ:1"` → 5:1, and `"John 3:1-IIV"` → `3:1-5` all validated as clean.

**Fix**: `numberTokenToDecimal` now validates a Roman token against the canonical grammar `^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$` (case-insensitive, over the NFKC-folded ASCII form) BEFORE conversion. A NON-canonical token is kept RAW (non-numeric), so `buildCanonical` emits a non-numeric chapter/verse that `validateScriptureRefs` flags: `"John IIV:1"` → `John IIV:1` (invalid_book), `"John 3:IIV"` → unparseable. For a malformed RANGE end (chapter/verse numeric, only the end non-numeric), `validateScriptureRefs` gained a `malformedRange` check (`/:\s*\d{1,3}\s*[-–]\s*[^\d\s]/`) → out_of_range, so `"John 3:1-IIV"` can no longer be silently trimmed to a valid `John 3:1`. Canonical Roman still parses: `III`→3, `IV`→4.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (three new `it` blocks: glued book↔chapter with the `cafe4:5`/`size10:30` negatives; compact fabricated-book prefixes with the `Isaiah`/`pseudo-Hezekiah` negatives; non-canonical Roman incl. the malformed-range direct-validator assertion) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, split for the 30/min AI rate limit). CAUGHT: `John3:37`, `Jn3:37`, `Hezekiah4:5`, `2Hezekiah 4:5`, `2-Hezekiah 4:5`, `𑽒Hezekiah 4:5`, `IIHezekiah 4:5`, `John IIV:1`, `John ⅠⅠⅤ:1`, `John 3:1-IIV`, `John III:37`. Not flagged / still valid: `John3:16`, `cafe4:5`, `size10:30`, `Isaiah 5:1`, `John IV:2`, `John 3:16`, café/résumé/naïve/L'Oréal.

**Confirmed (round-26):** compact book↔chapter, compact fabricated-book prefixes, and non-canonical Roman are all handled on `/invoke` and `/stream` (success + error) with no new false positive.

### Status of the scripture-screening class — comprehensively closed
With R26 the reference-detection grammar has no remaining known UNDER-flagging (bypass) vector. Every axis is covered across all three normalization passes (normal, NFKC+global, NFKC+delete-rejoin shadow), the book-shape gate, and every surface (per-string, deep, joined-array, `/invoke`, `/stream` success + error):
- **Book token:** full names, abbreviations, "of X", trailing period; glued to chapter with no space (R26-1); book-shape-gated so non-books don't false-positive.
- **Prefix:** numeric (ASCII + every Unicode decimal-digit script) / Roman (ASCII + Unicode) / worded; spaced, compact, hyphen, dot; bound to KNOWN numbered books (valid) and to fabricated book-shaped names (invalid_book) (R25-3, R26-2); real books never split.
- **Chapter / verse / range:** ASCII, fullwidth, every Unicode decimal digit (complete `\p{Nd}` fold, property-sweep-verified), and canonical Roman; non-canonical Roman and malformed ranges are flagged, not coerced (R26-3).
- **Evasion normalization:** control / format / default-ignorable / combining-mark / compatibility (NFKC) hiding, in all positions, with position-aware delete-vs-space.

The only remaining residue is intentional and fails SAFE (over-flagging, i.e. rejecting AI output — never a bypass): a common English word that is itself a valid Roman numeral sitting exactly in a `Book N:<word>` verse slot (e.g. "John 3:mix"), and a book-shaped but non-canonical proper noun (e.g. "Utah 4:5"). No under-flagging vector remains.

---

## Round-27 pass — two adjacent HIGH bypasses opened by the r26 grammar fixes: overlong tokens dropped, worded hyphen/dot prefixes mis-bound — FIXED

### R27-1 — [HIGH] Overlong numeric / Roman tokens were dropped before validation — FIXED
`NUM_TOKEN` admitted only `\d{1,3}` or `[ivxlcdm]{1,15}`, so a LONGER visible token vanished before validation: `"John 1000:1"` matched nothing (the 4-digit chapter couldn't reach the colon) → no refs → `ok:true`; `"John 3:1-IIIIIIIIIIIIIIII"` (16 I's) extracted only the valid `"John 3:1"` (the overlong range end dropped) → `ok:true`. `validateScriptureRefs` had the SAME `\d{1,3}` cap in its parse.

**Fix** (`packages/shared/scripture/index.js`): `NUM_TOKEN` now matches the FULL contiguous run — `(\d+|[ivxlcdm]+(?![a-z]))` — in chapter/verse/range positions (never length-capped), and `CV_LOOKAHEAD` likewise. `validateScriptureRefs` now parses full-length numbers: `bookPart` strip `/\s+\d+\s*:.+$/`, `cv` `/(\d+):(\d+)(?:\s*[-–]\s*(\d+))?/`, and the `malformedRange` guard `/:\s*\d+\s*[-–]\s*[^\d\s]/`. Extraction captures the whole token and VALIDATION classifies the failure: `"John 1000:1"`/`"John 99999:1"`/`"John 3:99999"` → out_of_range; an overlong or non-canonical Roman range end is preserved and flagged (malformedRange → out_of_range), not trimmed. Legit refs and 3-digit chapters/verses (`Psalms 119:176`) still validate.

### R27-2 — [HIGH] Worded hyphen/dot numbered-book prefixes were mis-bound as bare "John" — FIXED
The compact-prefix rewrites handled only numeric/Roman prefixes, and `CITATION_RE` treats `first|second|third` as a prefix only when followed by WHITESPACE. So `"Second-John 1:20"`, `"Third.John 1:20"`, `"First-John 5:22"` (and the joined-array `["Second-John","1:20"]`) parsed as a bare `"John 1:20"`/`"John 5:22"` — validating as a real Gospel-of-John reference while the intended out-of-range numbered ref passed → `ok:true`.

**Fix**: a shared `COMPACT_PREFIX_ALT = '[1-3]|i{1,3}|first|second|third'` now drives BOTH compact rewrites (`COMPACT_NUMBERED_RE` for known stems and `COMPACT_PREFIX_BOOKSHAPED_RE` for fabricated book-shaped names), so a worded prefix fused by nothing / hyphen / dot binds to the numbered book: `"Second-John"`→`2 John`, `"Third.John"`→`3 John`, `"SecondJohn"`→`2 John`. Because the rewrite produces the spaced form BEFORE matching, a bare `"John"` can no longer be extracted after a worded-prefix+separator. `spaceCompactPrefix` keeps the Isaiah-style protection (a no-separator worded/Roman prefix is not split when the fused word is itself a real book). It runs inside `normalizeCitationText`, so per-string, deep, `extractScriptureRefsJoined`, `/invoke`, and `/stream` all inherit it. Spaced `"Second John 1:1"` still validates; `"Isaiah"` is never split.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks: overlong numeric/Roman with `Psalms 119:176` still valid; worded hyphen/dot prefixes across per-string + deep + `extractScriptureRefsJoined`, now re-exported from the web lib) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. a `["Second-John","1:20"]` joined-array case, split for the 30/min AI rate limit). CAUGHT: `John 1000:1`, `John 99999:1`, `John 3:99999`, `John 3:1-<16 I's>`, `John <16 I's>:1`, `Second-John 1:20`, `Third.John 1:20`, `First-John 5:22`, `SecondJohn 1:20`, joined `["Second-John","1:20"]`. Still valid: `John 3:16`, `John 3:1-5`, `Psalms 119:176`, `Second John 1:1`, `First John 1:1`, `Isaiah 5:1`, café/résumé/naïve/L'Oréal.

**Confirmed (round-27):** overlong numeric/Roman tokens are captured in full and classified by validation (never dropped), and worded hyphen/dot numbered-book prefixes bind to the numbered book across per-string / deep / joined-array / `/invoke` / `/stream` — no under-flagging, no new false positive.

### Status of the number / prefix grammar — comprehensively closed
Every prefix form × separator × book class is now covered: **prefix** numeric (1-3, ASCII + every Unicode decimal-digit script) / Roman (ASCII + Unicode) / worded (first-third), in **spaced / compact / hyphen / dot** forms, binding to KNOWN numbered books (valid) and FABRICATED book-shaped names (invalid_book), while a real book (Isaiah) is never split. **Numbers** are matched at full length (no cap) and VALIDATION classifies out-of-range / overlong / non-canonical-Roman / malformed-range failures. All of it runs in the shared `normalizeCitationText`/extractor, so per-string, deep, joined-array, `/invoke`, and `/stream` (success + error) inherit it. No known under-flagging (bypass) vector remains in the number/prefix grammar; the only residue is the intentional fail-safe over-flag (a word that is itself a valid Roman numeral in a `Book N:<word>` slot; a book-shaped non-canonical proper noun) which rejects AI output rather than letting a fabrication through.

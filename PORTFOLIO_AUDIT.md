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

---

## Round-28 pass — two "reinterpret-as-shorter-valid" bypasses: unsupported prefix stripped to bare valid book, and trailing-letter tokens truncated — FIXED

### R28-1 — [HIGH] An unsupported numbered-book prefix was stripped, reinterpreting the ref as bare valid John — FIXED
The prefix grammar recognized only `1-3 / I-III / first-third`, and on an unrecognized prefix the matcher RESTARTED at the bare book token. So `"4 John 1:1"`, `"٤ John 1:1"` (Arabic 4), `"Ⅳ John 1:1"` (Roman IV), `"Fourth-John 1:1"`, `"IIII-John 1:1"` all extracted as valid `"John 1:1"`, and `"4John 1:1"` extracted nothing — every one a fabricated numbered book passing as `ok:true`.

**Fix** (`packages/shared/scripture/index.js`): `CITATION_RE`'s prefix now accepts EVERY form — `COMPACT_PREFIX_ALT = \d+ | [ivxlcdm]+ | first..tenth` — so the prefix is CONSUMED by the match instead of the matcher restarting at the bare book. `prefixToNumber` maps any numeric / Roman / ordinal prefix to its value (Unicode digits are already folded to ASCII; Unicode Roman folds in the NFKC passes). `parseCitation` then BINDS the number when it is a supported ordinal (1-3) OR the book is a NUMBERED stem (`NUMBERED_FULL_BASES`): `"4 John"`→`4 John` (invalid_book, no 4 John), `"5 Corinthians"`→`5 Corinthians` (invalid_book) — never dropped to the bare valid book. A number on a NON-numbered book is spurious and dropped, so `"5 Psalms 119:1"`→`Psalms 119:1` (valid) as before. The compact/hyphen/dot forms flow through the r26/r27 rewrites (now driven by the same broadened `COMPACT_PREFIX_ALT`, with `spaceCompactPrefix` splitting on ANY digit prefix and keeping the Isaiah no-split guard for Roman/worded). Inherited by per-string, deep, `extractScriptureRefsJoined`, `/invoke`, `/stream`. Bare `"John 1:1"` and `"2/3 John"` stay correct.

### R28-2 — [MEDIUM] Malformed number tokens with trailing letters were truncated to their valid part — FIXED
The extractor's `\d+` and the validator's `\d{1,3}` matched only the leading digits and IGNORED trailing letters, so `"John 3:16I"`, `"Psalms 119:176I"`, `"John 3:1-5I"`, `"John 3:1-5abc"` validated by truncating to `"John 3:16"` / range `"5"` → `ok:true`.

**Fix**: `NUM_TOKEN`'s digit branch now captures the trailing run — `\d+[\p{L}\p{M}]*` — so the FULL malformed token (`"16I"`, `"5abc"`) reaches the validator (a `numberTokenToDecimal` non-`^\d+$` token is kept raw). `validateScriptureRefs` gained a strict token-anchor guard `malformedToken = /\d[\p{L}\p{M}]/u` (a digit immediately followed by a letter/combining mark → the whole ref is malformed → out_of_range). A real separator ends a token cleanly, so `"John 3:16 is …"` is unaffected; numbered-book display prefixes are always space-separated (`"1 John"`), so the only digit↔letter adjacency is a malformed number. Clean refs incl. the longest chapter (`Psalms 119:176`) still validate.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks: unsupported prefixes across all forms + Arabic/Roman/ordinal/compact + deep + joined-array, with bare-Gospel/2-3 John/`5 Psalms` still correct; trailing-letter malformed tokens with the `John 3:16 is` negative) and `services/api/src/__tests__/aiStreamScripture.test.js` (three new blocks over `/invoke` + `/stream` success + error, incl. a `["4 John","1:1"]` joined-array case, split for the 30/min AI rate limit). CAUGHT: `4 John 1:1`, `٤ John 1:1`, `Ⅳ John 1:1`, `IV John 1:1`, `Fourth-John 1:1`, `IIII-John 1:1`, `4John 1:1`, `5 Corinthians 1:1`, `John 3:16I`, `Psalms 119:176I`, `John 3:1-5I`, `John 3:1-5abc`, joined `["4 John","1:1"]`. Still valid / not flagged: `John 1:1`, `2 John 1:1`, `3 John 1:1`, `5 Psalms 119:1`, `John 3:16`, `John 3:1-5`, `Psalms 119:176`, `John 3:16 is …`, `Isaiah 5:1`, café/résumé/naïve/L'Oréal.

**Confirmed (round-28):** an unsupported numbered-book prefix is classified invalid (never reinterpreted as bare valid John), and a trailing-letter number token is flagged malformed (never truncated to valid) — on per-string / deep / joined-array / `/invoke` / `/stream` — no new false positive.

### Status — number/prefix grammar comprehensively closed (permissive extraction + strict validator)
The design is now complete and self-consistent: **extraction is maximally permissive** (captures every prefix form and the full number token including overlong runs and trailing garbage), and a **strict validator classifies every deviation** (unsupported prefix on a numbered stem → invalid_book; spurious number on a non-numbered book → dropped to the valid bare book; overlong / out-of-range number → out_of_range; non-canonical Roman → invalid/unparseable; malformed range or trailing-letter token → out_of_range). There is no truncation-to-valid and no bare-book fallback for an unsupported prefix. All of it lives in the shared extractor/validator, so per-string, deep, joined-array, `/invoke`, and `/stream` (success + error) inherit it. No known under-flagging (bypass) vector remains in the number/prefix grammar; the only residue is the intentional fail-safe over-flag (rejects AI output rather than passing a fabrication).

---

## Round-29 pass — strict treatment applied UNIFORMLY: Roman malformed suffixes, spaced-separator prefixes, Unicode-Roman bare-book duplicate — FIXED

### R29-1 — [HIGH] Roman verse/range tokens truncated a malformed suffix to valid — FIXED
The r28 strict trailing-capture applied only to the NUMERIC branch; the Roman branch was `[ivxlcdm]+(?![a-z])` (ASCII-letter guard only). So a NON-ASCII suffix passed the guard and truncated: `"John 3:XЖ"` (Cyrillic) / `"John 3:Xé"` → `John 3:10`, `"John 3:IVé"` → `John 3:4`, `"John 3:I-Vabc"` → `John 3:1` — all validated `ok:true`.

**Fix** (`packages/shared/scripture/index.js`): ONE shared token-end rule (`TOK_TRAIL = [\p{L}\p{M}]*`) now applies to numeric AND Roman in chapter, verse, and range-end. `NUM_TOKEN = (\d+TOK_TRAIL | [ivxlcdm]+(?![a-z])TOK_TRAIL)` — the digit branch and the Roman branch both capture the full contiguous run PLUS any trailing letters/marks. The Roman `(?![a-z])` guard stays for chapter/verse so a Roman token is not the head of an ASCII WORD (`"John 2:live"` is prose → no match, preserved), while a NON-ASCII trailing char is captured and flagged. A dedicated `RANGE_TOKEN = (\d+TOK_TRAIL | [ivxlcdm]+TOK_TRAIL)` drops the ASCII-word guard for the range-end (after a dash the context is unambiguously numeric), so `"3:1-Vabc"`/`"3:1-5abc"` are captured and flagged. The validator's existing `malformedToken` (`/\d[\p{L}\p{M}]/`), `malformedRange`, and cv-null (a non-numeric verse → unparseable) then classify every captured malformed token → out_of_range / unparseable. Clean canonical Roman (`John IV:2` → 4) and `"John 2:live"` / `"John 3:16 is"` are unaffected.

### R29-2 — [HIGH] Whitespace around a prefix separator reopened the bare-book fallback — FIXED
The compact rewrites used `[.\-]?` (a bare separator char), so a separator with SURROUNDING SPACES was not handled: `"4 - John 1:1"`, `"4- John 1:1"`, `"Fourth - John 1:1"`, `"4 . John 1:1"`, `"IV – John 1:1"` extracted only a valid bare `"John 1:1"`.

**Fix**: ONE shared separator `COMPACT_SEP = \s*[.\-]?\s*` (nothing / hyphen / dot — en-dash already normalized to `-` upstream — with optional surrounding whitespace) now drives BOTH compact rewrites (`COMPACT_NUMBERED_RE` and `COMPACT_PREFIX_BOOKSHAPED_RE`). Every spacing of every separator collapses to the spaced form before bare-book extraction, so an unsupported prefix through ANY separator+spacing binds to the numbered book and is flagged invalid — never a bare-book fallback. `spaceCompactPrefix` still splits on any digit prefix and keeps the Isaiah no-split guard for Roman/worded. Normal `"2 John 1:1"` stays valid; ordinary hyphenated prose (`"well - John 3:16"`, "well" is not a prefix) is not mis-bound.

### R29-3 — [MEDIUM] A Unicode-Roman prefix emitted a spurious bare valid ref — FIXED
`"Ⅳ John 1:1"` extracted BOTH `John 1:1` (valid, from the normal pass, which does not NFKC-fold Ⅳ) and `4 John 1:1` (invalid, from the folded shadow passes). The screen still rejected (invalid present), but the no-bare-book-fallback invariant was false and the validation/audit output carried a fabricated VALID reference.

**Fix**: precomposed Unicode roman-numeral code points (U+2160–U+2188) are folded to their ASCII letters (`ROMAN_NUMERAL_FOLD`, applied in `normalizeCitationText` in EVERY pass, incl. the normal display pass) — a targeted fold that does not touch ordinary accents. So the normal pass sees `"IV John 1:1"`, consumes the prefix, and emits ONLY the invalid `4 John 1:1`. Verified across all separators (`Ⅳ John`, `ⅣJohn`, `Ⅳ-John`, `Ⅳ.John`, `Ⅳ - John`) → only `4 John 1:1`, no bare `John 1:1`; a supported `"Ⅱ John 1:1"` still binds to the valid `2 John 1:1`.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (three new `it` blocks: uniform Roman malformed suffix with the `John 2:live` negative; spaced-separator unsupported prefixes across forms + deep + joined-array with the `well - John`/`2 John` negatives; Unicode-Roman fold producing only the invalid ref) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. an assertion that `fabricated === checked` so no valid ref leaks; split for the 30/min AI rate limit). CAUGHT: `John 3:XЖ`, `John 3:Xé`, `John 3:IVé`, `John 3:I-Vabc`, `4 - John 1:1`, `4- John 1:1`, `Fourth - John 1:1`, `4 . John 1:1`, `IV – John 1:1`, `Ⅳ John 1:1` (all forms). Still valid / not flagged: `John IV:2`, `John 2:live …`, `John 3:16 is …`, `2 John 1:1`, `well - John 3:16`, `Ⅱ John 1:1`, `John 3:16`, `John 3:1-5`, `Psalms 119:176`, `Isaiah 5:1`, `5 Psalms 119:1`, café/résumé/naïve/L'Oréal.

**Confirmed (round-29):** Roman malformed suffixes, spaced-separator unsupported prefixes, and Unicode-Roman bare-book duplicates are all handled UNIFORMLY (one shared token-end rule, one shared prefix-separator, compat-fold in every pass) — on per-string / deep / joined-array / `/invoke` / `/stream` — no under-flagging, no spurious valid ref, no new false positive.

### Status — the number/prefix grammar is comprehensively and UNIFORMLY closed
The strict, self-consistent design now holds across the WHOLE class: **permissive extraction** captures every prefix form (numeric / Roman / worded × spaced / compact / hyphen / dot × optional surrounding whitespace, incl. Unicode digits/romans folded to ASCII in every pass) and every number token at full length WITH its trailing run (numeric AND Roman, in chapter, verse, and range-end); a **strict validator** classifies every deviation (unsupported prefix on a numbered stem → invalid_book; spurious number on a non-numbered book → dropped to the valid bare book; overlong / out-of-range → out_of_range; non-canonical or malformed Roman / trailing-garbage / malformed-range → out_of_range / unparseable). No truncation-to-valid, no bare-book fallback, no spurious-valid duplicate. All of it lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error). No known under-flagging (bypass) vector remains; the only residue is the intentional fail-safe over-flag.

---

## Round-30 pass (FINAL) — a list false-positive regression from r29, plus two completeness edges — FIXED

### R30-1 — [HIGH — regression my r29 caused] Spaced separators misread outline markers as numbered books — FIXED
The r29 `COMPACT_SEP = \s*[.\-]?\s*` (separator with surrounding whitespace) made an ordinary numbered-list / outline item bind as a numbered-book prefix: `"2 - John 3:16"` → `2 John 3:16` (out_of_range) — so a VALID Gospel-John reference in a list was WRONGLY REJECTED by `/invoke` and `/stream`; `"1 - John 3:16"` emitted a spurious valid `1 John 3:16`.

**Fix** (`packages/shared/scripture/index.js`): REVERTED the spaced-separator over-binding. `COMPACT_SEP` is back to `[.\-]?` (hyphen/dot with NO surrounding whitespace), and `CITATION_RE`'s prefix separator is now `\s+` (whitespace only — the `\.?` was removed). So a compact numbered-book prefix binds only for the UNAMBIGUOUS forms — `"2John"` (glued), `"2-John"`/`"2.John"` (separator, no spaces), and `"2 John"` (single space, no hyphen/dot). A separator with WHITESPACE around a hyphen/dot (`"2 - John"`, `"2 . John"`, and the list form `"2. John"`) is an OUTLINE / LIST marker → read as the BARE book, so a valid Gospel-John ref in a numbered list is NOT rejected and emits no spurious numbered ref.

**DOCUMENTED TRADE-OFF:** consequently a FABRICATED numbered book written with a spaced separator (`"4 - John 1:1"`) reads as the valid bare `"John 1:1"` — an accepted low-risk residual (exotic input), because **a rejected VALID citation is a worse harm than an exotic fabrication slipping**. The no-space / single-space unsupported-prefix trapping from r28 is kept: `"4John"`/`"4-John"`/`"Fourth John"` → invalid_book.

### R30-2 — [MEDIUM] Roman chapter/verse tokens with ASCII suffixes disappeared — FIXED
The r29 Roman branch kept `(?![a-z])` before the trailing capture, so the shared malformed-suffix rule never applied to ASCII letters after a Roman token: `"John 3:Xabc"`, `"John IVabc:2"`, `"John 3:IVabc"` → zero refs (bypass).

**Fix**: the ASCII-word guard was removed from the regex — `NUM_TOKEN` is now ONE token for chapter, verse, AND range-end: `(\d+[\p{L}\p{M}]*|[ivxlcdm]+[\p{L}\p{M}]*)`, capturing any trailing letters/marks for numeric AND Roman alike. A new CASE-SENSITIVE `classifyNumberToken` (plain JS, no `i` flag — safe across Node/browser, unlike `(?-i:)` inline modifiers) then decides: clean digits / canonical Roman → `number`; a lowercase-ASCII word that is not a canonical Roman (`"live"`, `"ivy"`) → `prose` (the match is DROPPED in `collect`, so `"John 2:live"` stays clean); anything else — digits+letters, UPPERCASE Roman + junk (`"Xabc"`, `"IVabc"`), a non-canonical Roman (`"IIV"`), or a non-ASCII trailing char (`"Xé"`, `"XЖ"`) — → `malformed` (kept; the validator flags it out_of_range / unparseable). Case is the practical signal separating a deliberate numeral (`"Xabc"`) from lowercase prose (`"live"`). `"John III:37"` / `"John iv:2"` still validate.

### R30-3 — [HIGH] Fold table incomplete for U+2180–U+2188 (archaic Roman) — FIXED
`ROMAN_NUMERAL_FOLD` only stored code points whose NFKC form is ASCII `[ivxlcdm]`; the archaic / apostrophus numerals U+2180–U+2188 (ↀ ↁ ↂ Ↄ ↄ ↅ ↆ ↇ ↈ) do NOT NFKC-fold in Node, so they were skipped: `"ↁ John 1:1"` → spurious valid bare `"John 1:1"`, `"John ↁ:1"` → zero refs.

**Fix**: U+2160–U+217F still fold to ASCII roman via NFKC; U+2180–U+2188 are now mapped EXPLICITLY to their decimal value (`ARCHAIC_ROMAN`: ↀ→1000, ↁ→5000, ↂ→10000, Ↄ/ↄ→100, ↅ→6, ↆ→50, ↇ→50000, ↈ→100000). Applied in `normalizeCitationText` in EVERY pass. None is 1/2/3, so a numbered-book prefix built from them is a fabricated numbered book (invalid_book) and a chapter/verse is out_of_range; `"John ↅ:1"` (ↅ = 6) correctly reads as the valid `John 6:1`.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (the r29 spaced-separator test REPLACED with the r30 outline trade-off — `2 - John 3:16`/`1 - John 3:16`/`2. John 3:16` → valid Gospel, `4 - John` → valid bare residual, `4John`/`4-John`/`Fourth John` → invalid_book; a new Roman-ASCII-suffix block with the `John 2:live`/`John 3:ivy` prose negatives; a new full U+2160–U+2188 sweep asserting no bare-John leak + archaic value checks) and `services/api/src/__tests__/aiStreamScripture.test.js` (the r29 block updated: Roman ASCII suffix + archaic Roman flagged, `2 - John 3:16` outline → valid, over `/invoke` + `/stream` success + error; split for the 30/min AI rate limit). Deep + joined-array covered in the web suite.

**Confirmed (round-30):** the outline false-positive is fixed (`"2 - John 3:16"` passes as valid Gospel John), Roman ASCII suffixes and archaic Roman are handled, with the ONE documented spaced-separator trade-off — on per-string / deep / joined-array / `/invoke` / `/stream` — no under-flagging beyond the documented residual, no over-flagging of legit lists.

### Status — the scripture number/prefix grammar is comprehensively closed (with one documented trade-off)
Extraction is permissive (every prefix form × unambiguous separator × spacing, Unicode digits + the FULL Unicode roman-numeral block folded in every pass; one shared number token capturing the full run + trailing for numeric AND Roman in chapter/verse/range) and a strict, case-aware classifier + validator resolves every token to number / prose (dropped) / malformed (flagged) and every prefix to supported-valid / fabricated-invalid / spurious-dropped. The single accepted, DOCUMENTED residual is by deliberate design: a fabricated numbered book written with a SPACED separator ("4 - John 1:1") reads as the valid bare book, chosen so a legitimate numbered-list citation ("2 - John 3:16") is never wrongly rejected. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error). This is the final scripture-hardening round.

---

## Round-31 pass (final review) — two adversarial edges: glued-chapter compact prefix, and lowercase malformed Roman — FIXED

### R31-1 — [HIGH] Compact prefix+book+chapter (glued) bypassed or rebound to bare John — FIXED
`COMPACT_NUMBERED_RE` ended with `\b` after the book stem, which does NOT fire when the chapter DIGIT is glued to the stem. So `"2John1:1"` and `"SecondJohn1:1"` (legitimate compact numbered-book citations) extracted ZERO refs — WRONGLY REJECTED — while `"2-John1:1"`, `"Second-John1:1"`, `"4-John1:1"`, `"Ⅳ-John1:1"`, `"ↀ-John1:1"` extracted as a valid bare `"John 1:1"` (a fabricated / unsupported numbered-book input PASSED the AI/persist screens as valid Gospel John).

**Fix** (`packages/shared/scripture/index.js`): the trailing boundary of `COMPACT_NUMBERED_RE` is now `(?:\b|(?=CV_LOOKAHEAD))` — the stem may be followed by a word boundary OR a glued chapter:verse. So `"2John1:1"`→`2 John1:1` (the later book↔chapter spacing pass makes it `2 John 1:1`, valid), `"1Cor13:4"`→`1 Corinthians 13:4` (valid), and `"4John1:1"`/`"4-John1:1"`/`"Ⅳ-John1:1"`/`"ↀJohn1:1"`→the numbered-book path → invalid_book (NOT bare John). `CV_LOOKAHEAD` was hoisted above `COMPACT_NUMBERED_RE`. A glued chapter never occurs in prose, and the r30 SPACED-separator OUTLINE behavior (`"2 - John 3:16"` = valid bare John) is untouched because `COMPACT_SEP` (`[.\-]?`) never matches a space.

### R31-2 — [MEDIUM] Lowercase malformed Roman tokens were dropped as prose — FIXED
`classifyNumberToken` treated EVERY non-canonical all-lowercase-ASCII token as `prose` (dropped). Since canonical lowercase Romans ARE accepted (`"John iv:2"` valid), an adversary lowercases only the malformed Roman token to make the extractor drop the WHOLE citation: `"John iiii:2"`, `"John vv:2"`, `"John iiv:2"`, `"John 3:iiii"` extracted ZERO refs and validated as all-valid content instead of reaching the strict validator.

**Fix**: `classifyNumberToken` now classifies a token composed ONLY of Roman-numeral letters (`/^[ivxlcdm]+$/`, case-sensitive, plain JS) that fails `ROMAN_CANONICAL_RE` as `malformed` — BEFORE the lowercase-word `prose` escape. So `"iiii"`/`"vv"`/`"iiv"` reach the validator (→ invalid_book / unparseable / out_of_range), while a lowercase word containing ANY non-Roman letter (`"live"` has `e`, `"ivy"` has `y`) keeps the prose escape (dropped, clean). `"John iv:2"` (canonical) still validates. NOTE: an all-Roman-letter English word (e.g. "dill", or the canonical-valued "mix") is consequently screened rather than treated as prose — the same fail-safe over-flag class already documented at r25 (rejects AI output, never lets a fabrication through); it requires the exotic `Book N:<roman-letter-word>` shape and is not real citation prose.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks: glued compact numbered book — legit `2John1:1`/`1Cor13:4`/`SecondJohn1:1` valid, fabricated `4John1:1`/`4-John1:1`/`Ⅳ-John1:1`/`ↀJohn1:1` invalid_book and never bare John, plus deep + joined-array and the `2 - John 3:16` outline re-assertion; lowercase malformed Roman `iiii`/`vv`/`iiv`/`3:iiii` screened, `iv` valid, `live`/`ivy` clean) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. `fabricated === checked` so a glued fabrication never rebinds to a bare valid John; split for the 30/min AI rate limit).

**Confirmed (round-31):** compact numbered-book citations extract correctly for glued / hyphen / dot forms (legit → valid numbered book, fabricated → invalid_book, never rebinding to bare John), and lowercase non-canonical Roman tokens reach the strict validator as malformed rather than being dropped — on per-string / deep / joined-array / `/invoke` / `/stream` — with the r30 outline trade-off intact and no new legitimate-prose over-flag beyond the documented residual.

### Status — scripture number/prefix grammar comprehensively closed (final)
With r31 the two remaining false-accept / false-reject edges are closed. The grammar now: extracts compact numbered books for every unambiguous form including a glued chapter; routes every number token to number / prose / malformed with a case-aware, canonical-Roman-aware classifier; binds every prefix form (numeric / Roman incl. the full Unicode block + archaic / worded) as supported-valid / fabricated-invalid / spurious-dropped; and never rebinds an unsupported prefix to a bare valid book. The single accepted, documented residual is the r30 spaced-separator trade-off (a fabricated numbered book written with a SPACED separator reads as the valid bare book, so a legitimate numbered-list citation is never wrongly rejected). All logic is in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-32 pass (final review) — numeric ordinal-suffix prefixes bypassed numbered-book binding — FIXED

### R32-1 — [HIGH] Numeric ordinal-suffix prefixes (1st/2nd/3rd/4th/11th) bypassed binding — FIXED
`COMPACT_PREFIX_ALT` (the shared prefix alternation used by `CITATION_RE` and the compact rewrites) did NOT include ordinal-suffix numeric forms, so `CITATION_RE` restarted at the following book token: `"1st John 1:1"`, `"2nd John 1:1"`, `"4th John 1:1"` all produced a bare `"John 1:1"` with status VALID — a WRONG-REF leak for legitimate numbered books (1st/2nd/3rd John collapsed to the Gospel John) AND a FALSE-ACCEPT for fabricated ones (4th/5th John accepted as valid Gospel John). Glued forms (`"2ndJohn1:1"`) produced no refs → `allValid:true` (silent drop).

**Fix** (`packages/shared/scripture/index.js`, shared grammar so ALL passes inherit it):
- `COMPACT_PREFIX_ALT`'s numeric alternative is now `\d+(?:st|nd|rd|th)?` (the suffix letters match case-insensitively via `CITATION_RE`'s `i` flag; a bare number still matches).
- `prefixToNumber` strips the suffix (`/^(\d+)(?:st|nd|rd|th)$/` → the digits): `1st`→1, `2nd`→2, `11th`→11.
- `spaceCompactPrefix`'s digit test is now `/^\d/` (starts with a digit — no real book does), so an ordinal-suffix prefix (`"4th"`) is safely split from a fabricated book-shaped name.

So a SUPPORTED value binds the numbered stem (`"1st John"`→`1 John` valid, `"2nd John"`→`2 John`, `"3rd John"`→`3 John`) and an UNSUPPORTED value binds as INVALID (`"4th John"`/`"5th John"`/`"11th John"`→invalid_book, NEVER bare John), across ALL separators: spaced (`"1st John 1:1"`), hyphen/dot (`"4th-John1:1"`, `"2nd.John1:1"`), and glued (`"2ndJohn1:1"`→`2 John 1:1`, `"4thJohn1:1"`→invalid_book — via the r31 glued-chapter `(?:\b|(?=CV))` handling). The ordinal token only binds when a book stem/name follows (the same way every numeric prefix binds), so ordinary prose (`"the 1st chapter of the book"`, `"read the 2nd verse today"`) stays clean — no citation. The r30 spaced-outline (`"2 - John 3:16"` = valid bare John) and r31 glued / lowercase-Roman fixes are unaffected.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (a new `it` block: supported 1st/2nd/3rd/1ST → valid 1/2/3 John; unsupported 4th/5th/11th and glued 4thJohn1:1/4th-John1:1 → invalid_book and never bare John; glued/dot supported forms valid; deep + joined-array; `"the 1st chapter"`/`"read the 2nd verse"` clean; r30 outline + r31 glued re-assertions) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. `fabricated === checked` so an unsupported ordinal never rebinds to a bare valid John; split for the 30/min AI rate limit).

**Confirmed (round-32):** ordinal-suffix numbered-book prefixes bind correctly (supported → valid numbered book, unsupported → invalid_book, never bare John) across spaced / hyphen / dot / glued forms and case-insensitive suffixes, with ordinary ordinal prose left clean — on per-string / deep / joined-array / `/invoke` / `/stream`.

### Status — scripture number/prefix grammar comprehensively closed (still with the one documented trade-off)
Every prefix SPELLING is now covered: numeric (`1`), numeric-ordinal-suffix (`1st`), Roman (`I`, the full Unicode roman block + archaic), and ordinal WORD (`first`), each in spaced / compact / hyphen / dot forms (incl. a glued chapter), binding to a numbered stem as supported-valid / unsupported-invalid / spurious-dropped, and NEVER rebinding an unsupported prefix to a bare valid book. Number tokens route through the case-aware, canonical-Roman-aware classifier to number / prose / malformed. The single accepted, documented residual remains the r30 spaced-separator trade-off (a fabricated numbered book written with a SPACED separator reads as the valid bare book, so a legitimate numbered-list citation is never wrongly rejected). All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-33 pass (final review) — two ordinal-suffix EDGES still rebound to bare John — FIXED

### R33-1 — [HIGH] NFKC / superscript ordinal suffixes still emitted a bare John match — FIXED
Pass 1 runs BEFORE the NFKC-folded pass, and `normalizeCitationText` did not fold superscript/compatibility ordinal-suffix letters. So `"2ⁿᵈ John 1:1"` returned `['John 1:1','2 John 1:1']` (bare John leaked) and `"4ᵗʰ John 1:1"` returned `['John 1:1','4 John 1:1']` (bare John leaked + fabricated 4th accepted) — violating the never-bare-John invariant for look-alike ordinal suffixes.

**Fix — two structural moves (`packages/shared/scripture/index.js`):**
- **(A) Fold ordinal-suffix look-alikes ahead of pass 1.** A new `SUPERSCRIPT_FOLD` map (applied in `normalizeCitationText`, so EVERY pass inherits it) folds superscript DIGITS (`¹²³⁰⁴-⁹`, category No — `decimalDigitToAscii` does NOT cover these) and the superscript/modifier ordinal letters `ˢ ᵗ ⁿ ᵈ ʳ ʰ` → `s t n d r h`. So `"2ⁿᵈ"`→`"2nd"`, `"4ᵗʰ"`→`"4th"`, `"1ˢᵗ"`→`"1st"`, `"3ʳᵈ"`→`"3rd"`, `"²ⁿᵈ"`→`"2nd"` — recognized as ordinal prefixes in the SAME pass that would otherwise emit a bare John. This joins the existing unicode-roman (`ROMAN_NUMERAL_FOLD`) and unicode-digit (`decimalDigitToAscii`) prefix folds, so pass 1's normalization now covers the compatibility-prefix class.
- **(B) Span-aware cross-pass bare-book suppression (the general fix).** `extractScriptureRefs` was refactored to collect each pass separately (`pass1`/`pass2`/`pass3`) and then drop a BARE-book ref iff a FOLDED pass (2 = NFKC, or 3 = shadow) produced a NUMBERED version of it AND produced NO genuine bare version. Folding only ADDS prefix recognition (it never removes a real bare), so this is SOUND: a legitimately un-prefixed citation elsewhere in the text (`"John 1:1 and 2ⁿᵈ John 1:1"`) is preserved because the folded pass still emits the genuine bare. This closes ANY future look-alike prefix that only a later pass captures — not just superscripts.

### R33-2 — [HIGH] Ordinal suffix + spaced punctuation still rebound to bare John — FIXED
`CITATION_RE` consumes an ordinal-suffix prefix only when followed DIRECTLY by whitespace, and the r30 compact dot/dash handling covers only NO-surrounding-whitespace. So `"4th. John 1:1"`, `"4th- John 1:1"`, `"1st. John 1:1"`, `"2nd. John 1:1"` extracted only a bare `"John 1:1"` (valid) — a false-accept for a fabricated/wrong-ref numbered John. (This is NOT the r30 bare-numeric outline case.)

**Fix — (C) punctuation path for ordinal suffixes.** A new `ORDINAL_NUMBERED_RE` (`\b(\d+(?:st|nd|rd|th))\s*[.\-]?\s*(numbered-stem)(?:\b|(?=CV))`, applied in `normalizeCitationText`) rewrites an ordinal-suffix prefix + optional dot/hyphen + OPTIONAL surrounding whitespace + numbered stem → the spaced form. **CRITICAL discriminator:** an ordinal SUFFIX is NEVER an outline marker, so it always binds numbered regardless of separator/space (supported → valid `1st/2nd/3rd John`, unsupported → invalid_book `4th/5th/11th John`, NEVER bare John). A BARE numeric with a spaced separator (`"2 - John 3:16"`, `"2. John 3:16"`) has no st/nd/rd/th suffix so `ORDINAL_NUMBERED_RE` does not match it — it STAYS the r30 outline marker → valid bare John. The presence/absence of the ordinal suffix is the discriminator.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks: superscript/NFKC ordinals — supported → numbered book with NO bare-John output, unsupported → invalid_book, `²ⁿᵈ` digit-superscript, and the (B) mixed `"John 1:1 and 2ⁿᵈ John 1:1"` case that MUST keep the legit bare; ordinal + spaced punctuation — 1st./2nd-/2nd - valid, 4th./4th-/4th . invalid_book never bare, with the r30 bare-numeric outline `"2 - John 3:16"`/`"2. John 3:16"` re-asserted valid and `"the 1st chapter"`/`"won the 3rd race"` clean) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. `fabricated === checked` so an unsupported superscript ordinal never rebinds to a bare valid John; split for the 30/min AI rate limit).

**Confirmed (round-33):** all visible ordinal forms — ASCII (`1st`), NFKC/superscript (`1ˢᵗ`/`²ⁿᵈ`), and punctuated-with-space (`4th. John`) — bind ONCE to the numbered book (supported → valid, unsupported → invalid_book) and NEVER leak a bare John, while the r30 bare-numeric outline behavior (`"2 - John 3:16"` = valid bare John) is intact and ordinary ordinal prose stays clean — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix SPELLING and RENDERING is now covered: numeric (`1`), numeric-ordinal-suffix (`1st`) in ASCII / superscript / spaced-punctuation forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding to a numbered stem as supported-valid / unsupported-invalid / spurious-dropped, and NEVER rebinding an unsupported prefix to a bare valid book (guaranteed at the source by comprehensive pass-1 prefix folding AND by the sound cross-pass bare-suppression safety net). Number tokens route through the case-aware, canonical-Roman-aware classifier to number / prose / malformed. The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC (a fabricated numbered book written as a spaced bare-numeric outline reads as the valid bare book, so a legitimate numbered-list citation is never wrongly rejected — ordinal suffixes are exempt from this and always bind numbered). All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-34 pass (final review) — hidden chars inside an ordinal, and a superscript-fold footnote regression — FIXED

### R34-1 — [HIGH] Invisible/combining chars inside an ordinal suffix reopened the bare-John leak — FIXED
`ORDINAL_NUMBERED_RE` only recognized a CONTIGUOUS ASCII ordinal, but `normalizeCitationText` turns a default-ignorable / digit↔letter combining seam into a SPACE before that regex runs, so a hidden char at the digit→suffix boundary SPLITS the ordinal token. Confirmed: `"4​th John 1:1"`, `"4͏th. John 1:1"`, `"4́th- John 1:1"` extracted only a bare `"John 1:1"` (valid), and `"2​nd John 1:1"` misread as the Gospel John — reopening the bare-John leak via the invisible/combining machinery.

**Fix** (`packages/shared/scripture/index.js`): a new `ORDINAL_PREFIX_RE` + `foldOrdinalPrefix` normalize an ordinal prefix whose digits and/or suffix letters may be ASCII or SUPERSCRIPT and may have hidden/combining chars (`\p{Cf}`, `\p{Default_Ignorable_Code_Point}`, `\p{M}`, incl. U+200B) spliced between — ONLY when it sits immediately before a NUMBERED-book stem — collapsing it to the bare ASCII ordinal (`"4​th"`/`"4́th"`/`"⁴ᵗʰ"`→`"4th"`), DELETING the internal hidden chars (so the seam is never turned into a space) and folding superscripts. The start boundary is a Unicode-aware negative lookbehind `(?<![\p{L}\p{N}])` (NOT `\b`, which does not fire before a superscript digit — category No). Crucially this runs in `scrubSuperscripts`, applied to the RAW text FIRST in every pass — ahead of NFKC (pass 2) and the shadow's hidden→space handling (pass 3), which would otherwise split the seam before the ordinal fold could see it.

### R34-2 — [MEDIUM — regression from r33] Global superscript folding turned footnote markers into chapter/verse digits — FIXED
The r33 `SUPERSCRIPT_FOLD` ran over the ENTIRE input, so an ordinary superscript footnote marker adjacent to a reference mutated the citation: `"John 3:16¹"` → `"John 3:161"` (out_of_range FALSE-REJECT of a valid ref), and `"John²:1"`/`"Rev²:1"` MINTED a valid `"John 2:1"`/`"Revelation 2:1"` from footnote-like text. (Also present via pass 2's NFKC, which folds superscript digits globally.)

**Fix**: the global superscript fold is removed. `scrubSuperscripts` now (1) folds a superscript run to ASCII ONLY in ordinal-prefix position (via `ORDINAL_PREFIX_RE`, which requires a real ordinal SUFFIX + a following numbered stem), and (2) DELETES any REMAINING superscript digit/letter (a footnote marker or stray) — applied to the RAW text before NFKC, so NFKC can no longer fold a footnote superscript into a chapter/verse digit. So `"John 3:16¹"` → `"John 3:16"` (valid, the ¹ is dropped), `"John²:1"`/`"Rev²:1"` mint nothing, while the intended `"²ⁿᵈ John 1:1"`/`"2ⁿᵈ John 1:1"` (superscript in ordinal-prefix position before the book stem) still fold and bind 2 John.

**Design note:** the two fixes are consistent — a superscript run before a BOOK stem is an ordinal prefix (fold); a superscript run before/after/adjacent a chapter:verse NUMBER (no ordinal suffix, or no following stem) is a footnote marker (delete). The (B) span-suppression soundness is preserved: because `scrubSuperscripts` runs first in ALL passes, pass 3 no longer splits the ordinal into a spurious bare John, and a genuinely co-occurring bare John (`"John 1:1 and 2ⁿᵈ John 1:1"`) is still kept.

**Tests:** `apps/web/src/lib/scriptureRefs.test.js` (two new `it` blocks, using `String.fromCodePoint` to avoid literal-char encoding issues: ordinal + hidden-seam — `2​nd`→2 John valid, `4​th`/`4͏th.`/`4́th-`/`⁴​ᵗʰ`→invalid_book never bare; superscript ordinal vs footnote — `2ⁿᵈ`/`²ⁿᵈ`→2 John, `4ᵗʰ`→invalid_book, `John 3:16¹`→valid `John 3:16` (not 3:161), `John²:1`/`Rev²:1` mint nothing, the (B) mixed-bare-preserved case, and the r30 outline re-assert) and `services/api/src/__tests__/aiStreamScripture.test.js` (two new blocks over `/invoke` + `/stream` success + error, incl. `fabricated === checked` so an ordinal hidden-seam fabrication never rebinds to a bare valid John).

**Confirmed (round-34):** ordinal binding tolerates hidden/combining seams (no bare-John leak — ASCII, superscript, and mixed), and the superscript fold is bounded to ordinal-prefix context so footnote markers no longer mutate citations, with the r30 bare-numeric outline behavior and the r31–r33 fixes all intact — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix SPELLING × RENDERING is now covered, robust to hidden/combining seams and bounded against footnote look-alikes: numeric (`1`), numeric-ordinal-suffix (`1st`) in ASCII / superscript / spaced-punctuation / hidden-seam forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding to a numbered stem as supported-valid / unsupported-invalid / spurious-dropped, and NEVER rebinding an unsupported prefix to a bare valid book (guaranteed by comprehensive pass-1 prefix folding, a raw-text superscript/ordinal scrub ahead of all passes, and the sound cross-pass bare-suppression safety net). Number tokens route through the case-aware, canonical-Roman-aware classifier. Superscript footnote markers are stripped (never folded into a number). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-35 pass (final review) — three Unicode-DIGIT findings: ordinal Unicode digits, superscript number-data drop, and cross-block digit-fold — FIXED

### R35-1 — [HIGH] Unicode-digit ordinals with hidden seams still leaked bare John — FIXED
`ORDINAL_PREFIX_RE`/`foldOrdinalPrefix` is the only path that deletes hidden chars before the ordinal's digit->suffix seam, but `ORD_DIGIT` only covered ASCII + superscript digits, and `scrubSuperscripts` runs BEFORE NFKC / decimal-digit folding. A non-ASCII digit fell through -> the hidden char became a space -> the matcher restarted at the bare book. Confirmed: `4<ZWSP>th John 1:1` (fullwidth), `<Arabic-4><ZWSP>th John 1:1`, `<math-2><ZWSP>nd John 1:1` extracted only bare `John 1:1` (allValid true).

**Fix** (`packages/shared/scripture/index.js`): `ORD_DIGIT` is now `[\p{Nd}<superscript-digits>]` — ANY Unicode decimal digit (ASCII, fullwidth, Arabic-Indic, mathematical, ...) plus superscript digits. `foldOrdinalPrefix` folds each leading digit to ASCII regardless of script (`decimalDigitToAscii` for `\p{Nd}`, `SUPERSCRIPT_FOLD` for superscripts). So the fullwidth / Arabic / math ordinals (with or without a hidden seam) bind numbered — supported -> valid 1/2/3 John, unsupported 4th/11th -> invalid_book, NEVER bare John.

### R35-2 — [HIGH] Stray superscript DELETION dropped/rewrote real chapter/verse tokens — FIXED
`STRAY_SUPERSCRIPT_RE` deleted EVERY non-ordinal superscript, including superscript digits that are PART of a chapter/verse number. Confirmed: `Hezekiah 4:<sup5>` and `John 3:<sup16>` extracted NO refs (dropped); `John 3:1<sup6>5` -> `John 3:15`; `John <sup2>3:16` -> `John 3:16` — silently dropping/rewriting visible references.

**Fix**: superscript handling is now POSITION-AWARE. The chosen PRINCIPLED RULE (documented): a superscript digit filling an EMPTY chapter/verse slot (no ASCII digit there — after a colon, before a colon, or between digits) is NUMBER DATA -> LEFT for NFKC (pass 2) to fold as the user sees it; a superscript digit that TRAILS a COMPLETE number (preceded by a decimal digit, not followed by more number/colon/superscript) is a FOOTNOTE -> deleted. Implemented as `FOOTNOTE_SUPERSCRIPT_RE` (a superscript-digit run preceded by `\p{Nd}` and not followed by digit/colon/superscript -> delete) + `STRAY_SUP_LETTER_RE` (delete stray superscript ordinal letters). So `John 3:<sup16>` -> John 3:16 (valid), `Hezekiah 4:<sup5>` -> Hezekiah 4:5 (invalid_book — flagged, NOT dropped), `John<sup2>:1` -> John 2:1 (empty chapter slot folded; the visible text reads as John 2:1 and the strict validator classifies it), `John <sup2>3:16` -> John 23:16 (out_of_range), `John 3:1<sup6>5` -> flagged (out_of_range via John 3:165), while `John 3:16<sup1>` -> John 3:16 (trailing footnote deleted). "Prefer folding, let the validator classify" — a real reference is never silently dropped.

### R35-3 — [MEDIUM — pre-existing heuristic bug exposed] Unicode digit folding corrupted adjacent Nd blocks into phantom refs — FIXED
`decimalDigitToAscii` walked backward through prior `\p{Nd}` code points but CAPPED the walk at 9 steps; styled decimal blocks are encoded BACK-TO-BACK (e.g. the 50-wide mathematical run U+1D7CE-U+1D7FF), so a digit in a later sub-block derived its value from a NEIGHBOUR block. Confirmed: `John <math-3>:<math-1><math-6>` extracted BOTH `John 0:00` and `John 3:16` (false-reject of a legit Unicode-digit ref); `<math-2> John 1:1` added a phantom `0 John 1:1`.

**Fix**: removed the 9-step cap — the walk now reaches the start of the MAXIMAL contiguous `\p{Nd}` run, and value = `(cp - runStart) mod 10`. Since a decimal run is always a concatenation of aligned 10-code-point blocks, the mod-10 gives the correct in-block value even across adjacent blocks. `John <math-3>:<math-1><math-6>` -> John 3:16 (single correct ref, no phantom zero); `<math-2> John 1:1` -> 2 John 1:1. The r25 property-sweep test's `expected` computation was updated to the same uncapped walk.

**Pipeline ordering (the crux):** (1) `scrubSuperscripts` on RAW text — fold ordinal-prefix (any Unicode digit + hidden seams + superscript suffix) to ASCII, delete only TRAILING footnote superscripts, delete stray superscript letters; (2) per pass, NFKC (pass 2/3) folds remaining compatibility digits incl. number-data superscripts; (3) `decimalDigitToAscii` (in `normalizeCitationText`, now cross-block-correct) maps every `\p{Nd}`; (4) generic hidden->space + extraction passes. Each transform sees a consistent form; none corrupts another.

**Tests** (all literals via `String.fromCodePoint` to avoid heredoc corruption): `apps/web/src/lib/scriptureRefs.test.js` (Unicode-digit ordinals fullwidth/Arabic/math with/without hidden seam -> invalid_book never bare, math-digit citation folds with no phantom zero, positive Arabic/fullwidth John 3:16 valid; superscript number-data folded John 3:<sup16>/John<sup2>:1, footnote John 3:16<sup1> deleted, Hezekiah 4:<sup5> flagged-not-dropped, between-digits flagged; the r25 property sweep updated) and `services/api/src/__tests__/aiStreamScripture.test.js` (a new block over `/invoke` + `/stream` success + error). The r34 John<sup2>:1/Rev<sup2>:1 assertions were updated to the new empty-slot-fold rule (John 2:1/Revelation 2:1).

**Confirmed (round-35):** Unicode-digit ordinals bind numbered (no bare-John leak), superscript digits forming chapter/verse numbers are FOLDED not dropped (real refs validated as the user sees them, trailing footnotes still stripped), and Unicode-digit citations fold correctly with NO phantom zero refs — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error), with all prior-round behavior preserved.

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix/number SPELLING x RENDERING is now covered in every digit script and typeset form: numeric and numeric-ordinal-suffix (`1st`) in ASCII / fullwidth / Arabic / mathematical / superscript / spaced-punctuation / hidden-seam forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding as supported-valid / unsupported-invalid / spurious-dropped and NEVER rebinding to a bare valid book. Chapter/verse numbers fold from any Unicode decimal script (cross-block-correct) and canonical Roman; superscript number-data is folded and superscript footnotes stripped. The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-36 pass (final review) — control-char ordinal seams and ambiguous superscript numbers — FIXED

### R36-1 — [HIGH] Control-character (Cc) ordinal seams still leaked to bare John — FIXED
`ORD_HIDDEN` (the ordinal-prefix fold's hidden class) covered `\p{Cf}` / default-ignorable / combining marks but NOT `\p{Cc}` (C0/C1 controls). Because `scrubSuperscripts()` runs BEFORE `normalizeCitationText()` converts Cc to spaces, an ordinal with a control seam (`4<C0>th John`, `11<C0>th John`, `<math-2><C0>nd John`) was not folded → it normalized to split prose → the matcher restarted at bare `John 1:1` (allValid true). The same inputs with ZWSP/CGJ/combining seams correctly bound numbered — the drift between the two hidden classes was the whole bug.

**Fix** (`packages/shared/scripture/index.js`): `ORD_HIDDEN` now IS the single shared `SHADOW_HIDDEN` class (non-whitespace `\p{Cc}` + `\p{Cf}` + `\p{Default_Ignorable_Code_Point}` + `\p{M}`), the same constant the detection shadow uses. So the ordinal fold deletes a C0/C1 control seam inside an ordinal exactly like every other hidden char, BEFORE it can be turned into a space. The shared constant means the two paths can never drift again. After the fix: `4<Cc>th`/`11<Cc>th`/`<math-2><Cc>nd` (and any Unicode-digit ordinal with a C0/C1 seam) bind numbered — 2nd valid, 4th/11th invalid_book, NEVER bare John.

### R36-2 — [HIGH] Trailing/mixed superscript digits could silently SHORTEN a visible verse number — FIXED
`FOOTNOTE_SUPERSCRIPT_RE` deleted a superscript-digit run trailing an ASCII digit. That kept `John 3:16¹` = John 3:16, but it also silently REWROTE mixed visible numbers to a DIFFERENT, shorter reference: `John 3:3⁷` → `John 3:3` (valid) when the visible number reads as 37 (out of range); `John 3:1⁶` → `John 3:1` instead of the visible `John 3:16`. Silently emitting a valid reference that DIFFERS from the visible text is a false-accept.

**Fix — FAIL CLOSED on ambiguity (invariant: never silently emit a valid ref that differs from the visible number).** A superscript-digit run IMMEDIATELY AFTER an ASCII/decimal digit is an AMBIGUOUS mixed number — the footnote reading (delete → shorter value) and the number-data reading (fold → longer value) DIFFER, and there is no sound, non-gameable way to distinguish them (an adversary can always write an evasion as `N<superscript>`). `scrubSuperscripts` now replaces such a run (via `AMBIGUOUS_SUPERSCRIPT_RE = /(?<=\p{Nd})[<sup-digits>]+/gu`) with a malformed-token marker letter, so the number becomes malformed and the strict validator flags the reference: `John 3:3⁷` → `John 3:3z` (out_of_range), `John 3:1⁶` → `John 3:1z`, `John 3:1⁶5` → `John 3:1z` (out_of_range), and — DOCUMENTED — `John 3:16¹` → `John 3:16z` (out_of_range). The last is deliberate: footnote-delete→16 (valid) vs fold→161 (invalid) DIFFER, so by the fail-closed rule it flags; over-flagging a real footnoted ref is the documented r25 fail-safe direction (better than silently validating a wrong/shortened one), and there is no sound distinction that treats `3:16¹` as a footnote while treating `3:3⁷`/`3:1⁶` as ambiguous. A superscript filling an EMPTY chapter/verse slot (NOT preceded by an ASCII digit — `John 3:¹⁶`, `John²:1`) remains UNAMBIGUOUS number data → LEFT for NFKC to fold as the user sees it (r35 rule, unchanged): `John 3:¹⁶` → John 3:16 (valid), `John²:1` → John 2:1.

**Tests** (all literals via `String.fromCodePoint`): `apps/web/src/lib/scriptureRefs.test.js` (control-char ordinal seams — `2<C1>nd`/`<math-2><NUL>nd` → 2 John, `4<NUL>th`/`11<SOH>th` → flagged never bare; ambiguous ASCII-adjacent superscripts `3:3⁷`/`3:1⁶`/`3:16¹`/`3:1⁶5` → fail-closed flagged and NOT the silently-valid shortened ref; empty-slot `3:¹⁶`/`John²:1` still fold) and `services/api/src/__tests__/aiStreamScripture.test.js` (a new block over `/invoke` + `/stream` success + error). The r34/r35 `John 3:16¹`→valid assertions were updated to the r36 fail-closed outcome.

**Confirmed (round-36):** ordinal folding uses one shared hidden class including `\p{Cc}` (no control-seam leak — the two paths can no longer drift), and no trailing/mixed superscript can silently produce a valid reference different from the visible number (fail-closed on ambiguity), while empty-slot superscript numbers still fold and all prior rounds are preserved — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix/number SPELLING x RENDERING is covered in every digit script and typeset form, robust to hidden/combining/control seams (one shared hidden class) and fail-closed on typeset ambiguity: numeric and numeric-ordinal-suffix in ASCII / fullwidth / Arabic / mathematical / superscript / spaced-punctuation / hidden-and-control-seam forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding as supported-valid / unsupported-invalid / spurious-dropped and NEVER rebinding to a bare valid book. Chapter/verse numbers fold from any Unicode decimal script (cross-block-correct) and canonical Roman; an all-superscript number folds as data, while a superscript touching ASCII digits is flagged (fail-closed). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-37 pass (final review) — Unicode-SEPARATOR seams complete the seam-class coverage — FIXED

### R37-1 — [HIGH] Unicode-space (separator) ordinal seams still rebound to bare John — FIXED
The ordinal-prefix fold's seam class (`ORD_HIDDEN` = `SHADOW_HIDDEN`) covered the HIDDEN class (Cc/Cf/DI/M) but NOT Unicode SEPARATORS. `normalizeCitationText` turns every Unicode separator into an ASCII space LATER, so a separator seam missed the fold and split the ordinal → the matcher restarted at bare `John 1:1`. Confirmed: `4<U+200A>th John` (hair), `2<U+00A0>nd John` (NBSP), plus narrow NBSP (U+202F), thin space (U+2009), Zl (U+2028), Zp (U+2029) all leaked bare John.

### R37-2 — [HIGH] Hidden/separator seams bypassed the fail-closed superscript handling — FIXED
`AMBIGUOUS_SUPERSCRIPT_RE` only matched a superscript digit IMMEDIATELY after a raw decimal digit. A seam (default-ignorable / control / mark / separator) between the digit and the superscript missed the scrub; later passes split/deleted the seam and the shortened reading validated. Confirmed: `John 3:1<U+200B>⁶` → valid `John 3:1` + `John 3:16`; `John 3:1-3<U+200B>⁶` → valid `John 3:1-3` + `John 3:1-36`; allValid true — defeating the r36 fail-closed invariant.

### Root-cause hardening — ONE complete seam class (`packages/shared/scripture/index.js`)
`COMPLETE_SEAM` is now the single source of truth for a seam wedged between two citation-significant tokens: the hidden class (non-whitespace `\p{Cc}` C0/C1 + `\p{Cf}` + `\p{Default_Ignorable_Code_Point}` [which already covers variation selectors U+FE00–FE0F / U+E0100–E01EF and tag chars U+E0000–E007F] + `\p{M}`) PLUS Unicode separators (`\p{Zs}` — space/NBSP/hair/narrow/thin/… — and `\p{Zl}` U+2028 / `\p{Zp}` U+2029). It is used by BOTH context-scrubs:
- **Ordinal digit↔suffix:** `ORD_HIDDEN = COMPLETE_SEAM`, so `ORDINAL_PREFIX_RE`/`foldOrdinalPrefix` consume any seam (hidden or separator) between the digits and the ordinal suffix (and between the two suffix letters) BEFORE normalization collapses it. `4<any-seam>th`/`2<any-seam>nd` (any Unicode-digit + any seam) bind numbered — supported → valid 1/2/3 John, unsupported 4th/11th → invalid_book, NEVER bare John.
- **Decimal-digit↔superscript:** `AMBIGUOUS_SUPERSCRIPT_RE = /(\p{Nd})COMPLETE_SEAM*[<sup-digits>]+/gu` captures the decimal digit, consumes the seam, and replaces the superscript run with the malformed marker (keeping the digit): `John 3:1<seam>⁶` → `John 3:1z` (out_of_range), `John 3:1-3<seam>⁶` → `John 3:1-3z` (out_of_range), `John 3:16<seam>¹` → `John 3:16z`. So no inserted seam can smuggle the shortened/extended reading past the fail-closed rule.

The scrub therefore consumes a SUPERSET of everything `normalizeCitationText` later collapses to a space (it maps every `\p{Zs}` to ASCII space and every hidden char to a space), so the two can never drift OR be incomplete. Both scrubs reference the one `COMPLETE_SEAM` constant (grep-verified). The scrubs are CONTEXTUAL — only inside the bounded digit↔suffix / digit↔superscript patterns — so a normal inter-word space elsewhere is never treated as a seam, and tab/nl/cr stay real whitespace. The r30 outline distinction is preserved: `2 - John 3:16` / `2. John 3:16` have NO st/nd/rd/th suffix, so they are NOT ordinals → still the valid bare-John outline case. Empty-slot superscript numbers (`John 3:¹⁶`, `John²:1`) are NOT preceded by a decimal digit → unchanged (fold as data).

**Tests** (all literals via `String.fromCodePoint`): `apps/web/src/lib/scriptureRefs.test.js` (Unicode-separator ordinal seams — NBSP/thin/hair/narrow/Zl/Zp + math-digit+separator → numbered bind never bare; seamed superscript numbers ZWSP/NBSP/CGJ/variation-selector + range-end → fail-closed flagged and NOT the silently-valid shortened/extended ref; empty-slot still folds) and `services/api/src/__tests__/aiStreamScripture.test.js` (a new block over `/invoke` + `/stream` success + error).

**Confirmed (round-37):** both context-scrubs consume the complete shared seam class (hidden + separators), so neither a Unicode-space ordinal seam leaks bare John nor a hidden/separator seam defeats the fail-closed superscript rule — while empty-slot superscript numbers still fold, the r30 outline holds, and all prior rounds are preserved — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix/number SPELLING × RENDERING is covered in every digit script and typeset form, robust to hidden/combining/control AND Unicode-separator seams (one complete shared seam class, used by every context-scrub and a superset of the normalizer's collapse set) and fail-closed on typeset ambiguity: numeric and numeric-ordinal-suffix in ASCII / fullwidth / Arabic / mathematical / superscript / spaced-punctuation / any-seam forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding as supported-valid / unsupported-invalid / spurious-dropped and NEVER rebinding to a bare valid book. Chapter/verse numbers fold from any Unicode decimal script (cross-block-correct) and canonical Roman; an all-superscript number folds as data, while a superscript touching ASCII digits through ANY seam is flagged (fail-closed). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-38 pass (final review) — tab/LF/CR seams bypassed both scrubs; seam class now closed BY CONSTRUCTION — FIXED

### R38-1 — [HIGH] Regular ASCII whitespace (tab/LF/CR) seams bypassed both contextual scrubs — FIXED
`COMPLETE_SEAM` (r37) was built from Unicode CATEGORIES (Cc-nonws / Cf / DI / M + Zs / Zl / Zp) but EXPLICITLY EXCLUDED `\t`, `\n`, `\r` (via `(?![\t\n\r])`) — while `CITATION_RE` still treats them as `\s` separators. So the superset/no-drift claim was false for ASCII whitespace. Confirmed: `4<TAB>th John 1:1` / `2<LF>nd John 1:1` returned bare `John 1:1` (not `4 John` invalid_book / `2 John` valid); `John 3:1<TAB>⁶` / `John 3:1<LF>⁶` / `John 3:1-3<CR>⁶` returned silently-VALID shortened/extended refs — defeating the fail-closed invariant.

**Fix (close the class BY CONSTRUCTION, `packages/shared/scripture/index.js`):** `COMPLETE_SEAM` was renamed `CONTEXT_SEAM` and the `(?![\t\n\r])` exclusion REMOVED, so it is now `[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{M}\p{Zs}\p{Zl}\p{Zp}]` — `\p{Cc}` now includes ALL C0/C1 controls (TAB/LF/CR/VT/FF + NEL). Verified this is a TRUE SUPERSET of exactly what the tokenizer treats as a separator: `CITATION_RE` uses JS `\s` (the `u` flag does NOT change `\s`), whose members — `\t \n \v \f \r`, SPACE, NBSP, all `\p{Zs}`, LS (U+2028), PS (U+2029), BOM (U+FEFF) — are each a member of `CONTEXT_SEAM` (`\t\n\v\f\r` ∈ `\p{Cc}`; the rest ∈ `\p{Zs}`/`\p{Zl}`/`\p{Zp}`/`\p{Cf}`), plus NEL (U+0085 ∈ `\p{Cc}`, not even in JS `\s`). This closes the seam class by CONSTRUCTION rather than one category at a time. `CONTEXT_SEAM` is the single constant used by BOTH context-scrubs (`ORD_HIDDEN = CONTEXT_SEAM`; `AMBIGUOUS_SUPERSCRIPT_RE = /(\p{Nd})CONTEXT_SEAM*[<sup-digits>]+/`) — grep-verified, `COMPLETE_SEAM` fully removed.

### R38-2 — same seam bypassed the ambiguous-superscript scrub — FIXED
Same root cause / same fix: with `\t\n\r` now in `CONTEXT_SEAM`, the ambiguous-superscript scrub consumes a whitespace seam between the decimal digit and the superscript and replaces the superscript run with the malformed marker: `John 3:1<TAB>⁶` → `John 3:1z` (out_of_range), `John 3:1-3<CR>⁶` → `John 3:1-3z` (out_of_range) — never a silently-valid shortened/extended ref.

### Safety of the wider seam (BOUNDED contexts) — CONFIRMED
The scrubs are CONTEXTUAL — the seam is only consumed INSIDE the two bounded patterns (digit → seam* → ordinal suffix → numbered stem; decimal-digit → seam* → SUPERSCRIPT-run), never as a general inter-word separator. So:
- **r30 outline preserved:** `2 - John 3:16` / `2. John 3:16` have NO st/nd/rd/th suffix → the ordinal scrub does not fire → still valid bare John. A bare numeric with a whitespace seam and no suffix (`2<TAB>John`) is likewise not an ordinal → unchanged.
- **Multi-line / multi-ref preserved:** `John 3:16\nMark 1:1` — the newline is between a complete ref and a LETTER (next book), which is neither a digit↔ordinal-suffix nor a decimal-digit↔SUPERSCRIPT context (the superscript scrub REQUIRES a superscript digit after the seam, not a letter), so it is untouched → both refs extract.

**Tests** (literals via `String.fromCodePoint` / explicit escapes): `apps/web/src/lib/scriptureRefs.test.js` (whitespace ordinal seams tab/CR/FF/NEL → numbered bind never bare; whitespace superscript seams tab/LF/CR → fail-closed; a BY-CONSTRUCTION SUPERSET GUARD that iterates every JS-`\s` char + NEL and asserts each is consumed in BOTH bounded contexts (no bare-John leak, no silently-valid superscript ref); plus a multi-line/outline preservation test — `John 3:16\nMark 1:1` → both refs, `2 - John 3:16` → valid bare John) and `services/api/src/__tests__/aiStreamScripture.test.js` (a new block over `/invoke` + `/stream` success + error).

**Confirmed (round-38):** `CONTEXT_SEAM` is a verified superset of `CITATION_RE`'s separator set (tab/LF/CR/FF/VT/NEL included, proven by the guard test), so neither a whitespace ordinal seam leaks bare John nor a whitespace superscript seam defeats the fail-closed rule — with the r30 outline and multi-line refs intact, and all prior rounds preserved — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture number/prefix grammar comprehensively closed (with the one documented trade-off)
Every prefix/number SPELLING × RENDERING is covered in every digit script and typeset form, robust to EVERY seam the tokenizer recognizes (one CONTEXT_SEAM constant, proven-by-construction to be a superset of the matcher's `\s` set plus the hidden/ignorable classes, used by every context-scrub) and fail-closed on typeset ambiguity: numeric and numeric-ordinal-suffix in ASCII / fullwidth / Arabic / mathematical / superscript / punctuation / any-seam forms, Roman (`I` + full Unicode roman block + archaic), and ordinal WORD (`first`), across spaced / compact / hyphen / dot / glued-chapter forms — binding as supported-valid / unsupported-invalid / spurious-dropped and NEVER rebinding to a bare valid book. Chapter/verse numbers fold from any Unicode decimal script (cross-block-correct) and canonical Roman; an all-superscript number folds as data, a superscript touching ASCII digits through ANY seam is flagged (fail-closed), and multi-line refs + the r30 outline are preserved by the bounded contexts. The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All logic lives in the shared extractor/validator, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error).

---

## Round-39 pass (final review) — raw-JSON false-reject of valid multi-line refs, and literal escape-seam bypass — FIXED

### META: the deleted r38 test was a REAL signal, not noise
In r38 I removed an API test whose multi-line case failed, calling it a "harness artifact". Codex adjudicated it: the failure was a genuine PRODUCTION false-reject. Corrected here — a failing test through a real code path is traced to the production defect before touching the test; the coverage is RESTORED (routed through the real JSON transport).

### R39-1 — [HIGH] Raw JSON screening rejects valid multi-line references in production — FIXED
`/invoke` and `/stream` passed the RAW model JSON into `screenStreamedScripture` EVEN AFTER `JSON.parse` succeeded, unioning refs from the raw text with refs from the parsed value. In the raw JSON text a real newline is the escape `\n`, which glues `n` onto the next book — so `JSON.stringify({text:"John 3:16\nMark 1:1"})` yields a fabricated `Nmark 1:1` from the raw scan while the parsed value yields the valid `John 3:16` + `Mark 1:1`. Result: valid structured AI output returned 422 (`/invoke`) or a failed stream trailer (`/stream`). A real production false-reject.

**Fix** (`services/api/src/routes/ai.js`): when `extractJson` SUCCEEDS, the DECODED value is authoritative — screen ONLY it, never union refs scanned from the raw JSON text. Applied at all three sites: `/invoke` structured (`screenStreamedScripture(parsed.value)`), the `/stream` `screenAccumulated` error path, and the `/stream` success path (`screenStreamedScripture(parsedValue)`). Raw text is scanned ONLY when there is no parseable JSON (non-structured completions). A JSON-escaped citation (`{"note":"Hezekiah 4:5"}`) is still caught because the parse DECODES it into the object being screened (confirmed: the escaped-citation tests still pass).

### R39-2 — [HIGH] Literal backslash-escape seams still leak shortened/bare refs — FIXED
The r38 seam class covered real control/separator CODEPOINTS but NOT literal JSON-style ESCAPE SEQUENCES (the two chars backslash + n) that survive into the PARSED value when a model DOUBLE-escapes (`{"text":"4\\nth John"}` → after one `JSON.parse` the value still holds a literal backslash+n). Confirmed: `extractScriptureRefs("4\\nth John 1:1")` → valid bare `John 1:1`; `"2\\nnd John 1:1"` → bare `John 1:1`; `"John 3:1\\n⁶"` → valid `John 3:1`. Residual false-accept via adversarial literal escapes (defense-in-depth gap: even with R39-1, a double-escape reaches the parsed value).

**Fix** (`packages/shared/scripture/index.js`): `CONTEXT_SEAM` now ALSO matches an `ESCAPE_SEAM` = one-or-more backslashes followed by a JSON-style whitespace/control escape (`[nrtvfb0]` named escapes, plus `\u00[01]x` / `` / `` / ` ` / ` ` / ` ` / `\u200[b-d]` / `⁠` / `﻿` and `\x00-\x1F` / `\x7F` control forms). Because `CONTEXT_SEAM` is used ONLY inside the two bounded contexts (ordinal digit↔suffix, decimal-digit↔superscript), a literal escape between the digit and the ordinal suffix or the digit and a superscript is consumed: `4\nth` → `4th` (invalid_book, never bare John), `2\nnd` → `2 John` (valid), `John 3:1\n⁶` → flagged (fail-closed). Double/triple backslashes (`\\+`) are covered. A legitimate literal backslash in PROSE (`C:\name`) is NOT in a bounded context → untouched (no spurious ref). Covers `\t \r \v \f` and double-escaped forms.

**Defense in depth (both needed):** R39-1 makes the SCREEN authoritative on parsed data (removes the raw-escape fabrication at the source, fixing the false-reject of valid multi-line output); R39-2 hardens the EXTRACTOR against literal escapes that survive into the parsed value (fixing the false-accept). Neither alone is sufficient.

**Tests** (literals via `String.fromCodePoint`/explicit escapes; API routed through the REAL JSON transport): `services/api/src/__tests__/aiStreamScripture.test.js` — RESTORED valid-multiline coverage through BOTH `/invoke` (200, body = `{text:"John 3:16\nMark 1:1"}`, no 422/Nmark) and `/stream` (clean trailer), plus a literal-escape-seam block over `/invoke`+`/stream`. `apps/web/src/lib/scriptureRefs.test.js` — literal escape seams (`\n \t \r \v \f`, double-backslash, `\u`/`\x` control forms) → ordinal binds / superscript fail-closed, and a prose backslash (`C:\name`) left untouched.

**Confirmed (round-39):** the screen treats parsed JSON as authoritative (no raw-escape fabrication → valid multi-line output passes, no false-reject), and the extractor neutralizes literal backslash-escape seams (no bare-John leak, no silent shortening) — while a prose backslash is untouched and all prior rounds (r30 outline, glued/Roman, ordinals, span-suppression, Unicode-digit, fail-closed superscript, real-codepoint seam class, multi-line real-newline refs) are preserved — on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### Status — scripture screening comprehensively closed (with the one documented trade-off)
The extractor grammar covers every prefix/number spelling × rendering × seam (hidden / Unicode-separator / ASCII-whitespace real codepoints AND literal JSON-escape sequences, in the two bounded contexts), fail-closed on typeset ambiguity, with cross-block Unicode-digit folding and empty-slot superscript folding; and the AI screen treats decoded JSON as the authoritative user-visible data (no raw-escape fabrication) while still catching JSON-escaped fabrications via the decode. The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker. All extractor logic lives in the shared package, inherited by per-string, deep, joined-array, `/invoke`, and `/stream` (success + error); the screen-authority fix lives in the AI route for both endpoints.

---

## Round-40 pass (re-review of r39) — fixing r39 opened two false-accepts: an incomplete screen surface, and enumerated escape seams — FIXED

### META: closing one leak must not open two
Codex re-reviewed r39. R39-1 (screen the DECODED value, not the raw text) was correct, but it narrowed the screened surface to string VALUES only — leaving object KEYS and any non-JSON PREFIX/SUFFIX text unscreened. R39-2 hardened literal escape seams by ENUMERATION, which is inherently incomplete. Both regressions are false-accepts a fabricated reference slips through.

### R40-1 — [HIGH] Screening the parsed value misses JSON KEYS and streamed PREFIX/SUFFIX text — FIXED
After r39 made the decoded JSON authoritative, the screen walked only string VALUES. Two surfaces stayed unscreened:
- **Object keys.** A model can place a fabricated reference in a KEY: `{"Hezekiah 4:5":"safe"}`. The value `"safe"` is clean, so the response passed with the fabrication in plain sight.
- **Non-JSON prefix/suffix.** `extractJson` fence-strips and salvages (first `{` last `}`), silently discarding any text OUTSIDE the object. `{"text":"safe"}\nHezekiah 4:5` parsed to a clean object while the trailing `Hezekiah 4:5` (real user-visible text) was thrown away unscreened.

**Fix:**
- `packages/shared/scripture/index.js`  `extractScriptureRefsDeep` now scans object KEYS as well as values (`out.push(...extractScriptureRefs(key))` before recursing), so a fabricated ref in any key at any depth is caught.
- `services/api/src/routes/ai.js`  `extractJson(raw)` now returns `{ ok, value, rest }`, where `rest` is the text OUTSIDE the parsed/salvaged object (fence prefix+suffix, or the salvage-discarded bytes before the first `{` / after the last `}`, or the direct-parse leading/trailing prose). Every call site now screens the COMPLETE emitted surface: `screenStreamedScripture(parsed.value, parsed.rest)` on `/invoke` structured, `screenAccumulated`, and the `/stream` success path. Decoded values + keys + non-JSON prefix/suffix are all screened; the raw JSON body is still NOT re-scanned (r39-1 preserved  no escape-fabrication false-reject).

### R40-2 — [HIGH] Enumerated escape seams still shorten/rebind; escaped ASCII space bypassed — FIXED
r39-2 matched literal escape seams from an ENUMERATED list, which missed the escaped ASCII space: `4 th John 1:1`  bare `John 1:1` (the `4th`-ordinal never bound, so the fabricated 4 John rebinds to a valid bare book); `John 3:1 ` + superscript-6  silently valid `John 3:1` (the fail-closed superscript scrub was bypassed). Any enumerated set is incomplete by construction.

**Fix** (`packages/shared/scripture/index.js`): `ESCAPE_SEAM` is now defined BY CONSTRUCTION  it matches ANY backslash-escape (`\uXXXX`, `\xXX`, or a single-char named/simple escape) and membership in the seam class is decided by DECODING the escape and testing whether its codepoint is in `CONTEXT_SEAM`s character set (`seamRunIsAllSeam`). So every escape whose decoded codepoint is a seam (space, tab, NBSP, zero-width, control, ...) is consumed in the two bounded contexts, regardless of enumeration; and a backslash-escape that decodes to a NON-seam (`A` = `A`) is NOT treated as a seam  `4Ath John` leaves a real `A` between the digit and suffix, so it is not an ordinal and reads as a bare valid `John 1:1` with no spurious `4 John` (no over-flag). The dual holds for superscripts: `John 3:1 ` = fail-closed, `John 3:1A` (A) = the superscript is an unambiguous footnote and `John 3:1` stays valid.

**Defense in depth (both needed):** R40-1 widens the SCREEN to the complete emitted surface (values + keys + non-JSON prefix/suffix), so nothing user-visible is left unscreened; R40-2 makes the EXTRACTOR seam test complete-by-construction (decode-and-check, not enumerate), so no escaped seam evades the bounded-context scrubs and no non-seam escape over-flags.

**Tests** (literals via `String.fromCodePoint`/explicit escapes; API routed through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js`  a BY-CONSTRUCTION guard iterating seam codepoints `[space, tab, LF, NBSP, U+2028, ZWSP]` (escaped `\uXXXX` form  ordinal binds, no bare John) and non-seam codepoints `[A, 5, z]` (escaped form  NOT a seam, no spurious `4 John`); the escaped-space ordinal/superscript cases; and the asymmetry that a NON-seam escape between verse and superscript leaves `John 3:1` VALID (footnote), vs. the escaped-space seam that fails closed. Plus a deep-scanner KEY test: `{"Hezekiah 4:5":"safe"}`  key caught; a valid ref in a key passes.
- `services/api/src/__tests__/aiStreamScripture.test.js`  a fabricated ref in a JSON KEY (`{"Hezekiah 4:5":"safe"}`) caught by `/invoke` (422) AND `/stream` (failed trailer); a fabricated ref in TRAILING prose after a salvaged object (`{"text":"safe"}\nHezekiah 4:5`) caught by both; a clean object with a VALID ref in a key + blank suffix passes (200); and the escaped-space seam block (`4 th`, `4\x20th`, `John 3:1 `+sup  flagged; `2 nd`  valid 2 John; `4Ath`  bare valid John) through the transport.
- `services/api/src/__tests__/ai.test.js`  `extractJson` now returns `{ ok, value, rest }`; the shape test asserts `rest` carries the leading/trailing prose.

**Confirmed (round-40):** the screen covers the COMPLETE emitted surface (decoded values + object keys + non-JSON prefix/suffix), and the extractor seam test is complete BY CONSTRUCTION (any backslash-escape whose decoded codepoint  `CONTEXT_SEAM` is a seam; a non-seam escape like `A`=`A` is not)  so a fabricated ref hidden in a key or in trailing prose is caught, an escaped-space seam can neither rebind a fabricated numbered book to a bare valid one nor silently shorten a verse, and a legitimate non-seam escape does not over-flag  while r39-1 (decoded value authoritative, valid multi-line passes) and all prior rounds are preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker.

---

## Round-41 pass (re-review of r40) — a reserved-key blind spot on the live screen, and escape decoding that split supplementary codepoints — FIXED

### META: a persistence-only optimization must not leak into the live screen; decode the codepoint an escape actually means
Codex re-reviewed r40. Two HIGH false-accepts remained: (1) a reserved dictionary key that is legitimately skipped for PERSISTED records was also skipped when screening untrusted LIVE model output, creating an unscreened subtree; (2) the r40 by-construction escape logic decoded each `\uXXXX` unit INDEPENDENTLY, so a supplementary seam char written as a surrogate-pair escape (or the `\u{...}` form) was not reconstructed to its true codepoint before the seam test.

### R41-1 — [HIGH] The reserved `scripture_validation` key creates an unscreened live-output subtree — FIXED
`extractScriptureRefsDeep` / `extractScriptureRefsJoined` unconditionally skip the `scripture_validation` key (in `NON_CONTENT_KEYS`). That is correct for a PERSISTED record: the key holds this module's own prior `{ref,status,...}` output, and walking it would re-validate/double-count already-recorded references. But the SAME walkers back the LIVE AI-output screen (`screenStreamedScripture` → `/invoke`, `/stream`, `screenAccumulated`), where the model produced EVERYTHING — there is no trusted server block to protect. So a model could hide a fabricated reference under that key (`{"scripture_validation":{"Hezekiah 4:5":"safe"}}`) and still get `ok:true, checked:0` — a clean live response/trailer — whenever the schema accepts an object.

**Fix** (`packages/shared/scripture/index.js` + `services/api/src/routes/ai.js`): separate PERSISTED-record validation from LIVE screening with an extractor option. Both deep walkers now take `options.screenReservedKeys` (default `false`): the persist paths (`validateAiContent` / `validateAiSermon`, called with no options) still skip the server-generated blob, but `screenStreamedScripture` now calls them with `{ screenReservedKeys: true }`, so the reserved subtree — values, keys, nested objects, and split arrays (via the joined walker) — is screened like any other user-visible model output. No trusted-block double-count is reintroduced, because on the live path there is no trusted block.

### R41-2 — [HIGH] Escaped supplementary seam codepoints (surrogate pairs, `\u{...}`) still rebind/shorten — FIXED
The r40 escape check decoded each `\uXXXX` token on its own, so a supplementary seam char written as a SURROGATE PAIR (`\uD800-\uDBFF` then `\uDC00-\uDFFF`) was seen as two lone surrogate halves (each a non-seam) rather than the one codepoint it represents; the ES6 `\u{...}` form was not recognized at all. Probe: `4󠄀th John 1:1` (U+E0100 variation selector) → valid bare `John 1:1` (the fabricated `4 John` rebinds to a bare valid book), and `John 3:1󠄀` + superscript → silently valid `John 3:1` (should fail closed) — even though the LITERAL U+E0100 char was correctly flagged. A by-construction gap.

**Fix** (`packages/shared/scripture/index.js`): the escape decoder now reconstructs the ACTUAL codepoint(s) an escape RUN represents before the seam test. `ESCAPE_SEAM` also matches the `\u{HHHHHH}` form; `seamRunIsAllSeam` DECODES the whole run in place (each escape token → the char(s) it stands for — a single UTF-16 unit for `\uXXXX`, a full codepoint for `\u{...}`/`\xXX`/named — with real chars kept as-is), then iterates the decoded string BY CODEPOINT so a truly-adjacent escaped surrogate PAIR recombines into its supplementary codepoint and is tested once. An escaped supplementary SEAM char (U+E0100, U+E0000 tag, `\u{2028}`) is thus a seam by construction (same membership test as the literal char, `SEAM_CHAR_RE` over `SEAM_CHARS`); a non-seam supplementary codepoint (emoji `\u{1F600}` / `😀`) is NOT a seam (bare valid book, no over-flag, superscript stays a valid footnote); and a lone/unpaired surrogate or a malformed escape (`\u{110000}`) is treated as a non-seam and never throws. Still scoped to the two bounded contexts (ordinal digit↔suffix, decimal-digit↔superscript).

**Defense in depth (both needed):** R41-1 removes the reserved-key blind spot so the live screen covers the COMPLETE emitted surface even under the reserved key; R41-2 makes the escape seam test complete for the FULL Unicode range (astral codepoints via surrogate pairs and `\u{...}`), not just the BMP. Neither alone closes both leaks.

**Tests** (literals via `String.fromCodePoint`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — a reserved-key test (persist path skips `scripture_validation`; live path with `screenReservedKeys:true` catches value + key + split-array; the stored-blob no-double-flag contract still holds); and a BY-CONSTRUCTION supplementary-seam guard iterating a representative supplementary SEAM codepoint (U+E0100) in its literal, surrogate-pair, and `\u{...}` forms (all consumed in both bounded contexts) plus a `\u{2028}` seam, versus a non-seam emoji (U+1F600) in escaped forms (NOT a seam), plus malformed-escape no-throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — a fabricated ref hidden under `scripture_validation` (value, key, split array) caught by `/invoke` (422) AND `/stream` (failed trailer); and escaped supplementary seams (surrogate pair, `\u{E0100}`, `\u{2028}`, superscript fail-closed; non-seam `\u{1F600}` passes) through the transport.

**Confirmed (round-41):** the live screen covers the reserved `scripture_validation` subtree (no reserved-key blind spot) while the persist path still skips the server-generated blob (no double-count), and escape decoding reconstructs full codepoints (surrogate pairs + `\u{...}`) so an escaped supplementary seam char is caught by construction and a non-seam supplementary codepoint is not over-flagged — with r40 (keys + non-JSON prefix/suffix screened, BMP escape seams), r39 (decoded value authoritative, valid multi-line passes), and all prior rounds r30–r38 preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker.

---

## Round-42 pass (re-review of r41) — mixed literal/escaped surrogate seams: closed STRUCTURALLY (stop enumerating representations) — FIXED

### META: the run must be CAPTURED before it can be decoded; capture had to stop treating each representation specially
Codex re-reviewed r41. The r41 decode-then-check recombined surrogate halves correctly, but only across halves that were BOTH captured into the seam run. The run CAPTURE class (`CONTEXT_SEAM`) matched real SEAM_CHARS chars OR fully-escaped tokens — it did NOT match a LITERAL lone surrogate code unit. So if one half of a supplementary seam char was a literal surrogate and the other an escape token, the run capture stopped at the literal half and the ordinal/superscript scrub never fired.

### R42-1 — [HIGH] Mixed escaped/literal surrogate seams still rebind/shorten — FIXED
Confirmed probes (through the real transport): `{text:"4󠄀th John 1:1"}` with one half literal and the other escaped → valid bare `John 1:1` (should be `4 John` invalid_book); `{text:"John 3:1󠄀⁶"}` similarly → valid `John 3:1` (should fail closed). Both surrogate orders (high-escaped + low-literal, and high-literal + low-escaped) bypassed, and the same bypass worked under `scripture_validation` with `screenReservedKeys:true` — so the r41 reserved-key fix did not cover this seam variant.

**Fix** (`packages/shared/scripture/index.js`): make seam recognition a SINGLE decode-then-check over a run that captures any mix of real chars (including literal surrogate code units) and escape tokens — no representation is special. Concretely, the seam-run capture class now includes a lone-surrogate range: `CONTEXT_SEAM = (?:[SEAM_CHARS\uD800-\uDFFF]|ESCAPE_SEAM)`. Under the `u` flag, `\uD800-\uDFFF` matches ONLY an unpaired surrogate in the subject (a valid astral char is read as its combined codepoint, never as halves), so a LITERAL surrogate half is captured into the run and then recombines — in the existing `seamRunIsAllSeam` decode step, which decodes each escape token to its code unit(s), keeps real chars as-is, and iterates the decoded string BY CODEPOINT — with an ESCAPED half of the other representation into the one supplementary codepoint before the seam-membership test. So real-codepoint, escaped-BMP, escaped-pair, high-escaped+low-literal, and high-literal+low-escaped all decode to the SAME codepoint and hit the SAME check, by construction.

**Guards against over-reach (all preserved):** a non-seam codepoint anywhere in the run (emoji `\u{1F600}`/`😀` in any representation, a letter `A`) → NOT a seam (bare valid book, superscript stays a valid footnote, no spurious `4 John`); a genuinely lone/unpaired or reversed surrogate, and a malformed `\u{110000}`, → non-seam and never throws; a legitimate SUPPLEMENTARY DIGIT ordinal (`𝟚nd`, U+1D7DA `\p{Nd}`) is matched by the DIGIT class (as its combined codepoint, > U+DFFF) not the seam class, so it still folds via the digit path (`2 John`) and is never dropped; a prose backslash (`C:\name`) outside the two bounded citation contexts is untouched.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — a by-construction guard asserting a representative supplementary SEAM codepoint (U+E0100) in ALL five representations — literal pair, fully-escaped pair, `\u{...}`, high-escaped+low-literal, high-literal+low-escaped — is consumed identically in BOTH bounded contexts AND under `scripture_validation` (`screenReservedKeys:true`); the same five forms of a NON-seam codepoint (emoji U+1F600) are NOT a seam; the supplementary-digit ordinal `𝟚nd` still folds valid; lone/reversed surrogates and malformed escapes never throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — mixed literal/escaped surrogate seams (both orders, ordinal + superscript; non-seam mixed emoji passes) over `/invoke` + `/stream`; and a mixed-surrogate fabrication hidden under `scripture_validation` caught by `/invoke` (422) AND `/stream` (failed trailer).

**Confirmed (round-42):** seam recognition is now one decode-then-check over the mixed real/escaped run, so every surrogate representation — literal, fully-escaped, `\u{...}`, and MIXED literal/escaped (both orders) — decodes to the same codepoint and is caught by construction, with non-seam codepoints, supplementary-digit ordinals, and prose backslashes unaffected. r41 (reserved-key live screen + fully-escaped supplementary seams), r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker.

---

## Round-43 pass (re-review of r42) — a different seam POSITION (suffix↔book); closed ALL positions at once with a global escaped-seam→real-codepoint pre-pass — FIXED

### META: stop patching one seam POSITION at a time — eliminate the escaped representation globally
Codex re-reviewed r42. The r30–r42 fixes taught individual seam POSITIONS (digit↔suffix, digit↔superscript) to decode escapes, but the ordinal→book bind also allows a seam at the suffix↔book position — and there the seam is only look-ahead'd, never decoded/consumed. So an escaped seam there stayed raw and the fabricated numbered book was not bound.

### R43-1 — [HIGH] Escaped/mixed seam AFTER the ordinal suffix (suffix↔book) was only look-ahead'd, not decoded — FIXED
`ORDINAL_PREFIX_RE` allows `ORD_SEP*` between the ordinal suffix and the book stem in its LOOKAHEAD, but `foldOrdinalPrefix` only decodes/validates the digit↔suffix seam it captures. A literal escaped seam after the suffix stayed raw: `4th​John 1:1` extracted no ref, `4th\u{E0100}John 1:1` → valid bare `John 1:1`, mixed `4th\uDB40<literal-low>John 1:1` → valid bare `John 1:1` — including under `scripture_validation` (`screenReservedKeys:true`). The equivalent REAL seams (`4th<U+200B>John`, `4th<U+E0100>John`) correctly produce invalid `4 John 1:1` (via `normalizeCitationText` Cf/Cc/Zs→space + `ORDINAL_NUMBERED_RE`), so this was a representation bypass at a seam position the decode logic didn't cover — and there may be others (book↔chapter, within-token).

**Fix — close the whole class by ELIMINATING the escaped representation GLOBALLY** (`packages/shared/scripture/index.js`): a new `decodeEscapedSeams` pre-pass runs FIRST in `extractScriptureRefs` (before the ordinal/superscript scrubs and `normalizeCitationText`). It scans for runs of EXPLICIT code-point escapes (`\uXXXX`, `\u{…}`, `\xHH`) mixed with literal surrogate halves / real seam chars, DECODES each run with the SAME by-construction logic used in `seamRunIsAllSeam` (surrogate pairs recombined regardless of literal/escaped origin, both orders), and — ONLY when EVERY decoded codepoint is a seam — REPLACES the run with the real seam codepoint(s) it denotes. After this, an escaped seam ANYWHERE is a REAL seam codepoint, and the existing real-seam paths handle every position uniformly (Codex confirms real seams are already correct). Escaped == real everywhere, by construction — no seam POSITION is special either.

**Guards against over-decoding (all verified):** only an ALL-seam run is rewritten — a non-seam escape (`A`=A, `\u{1F600}`=emoji, in any representation) stays literal and never fabricates a numbered book; SHORT NAMED escapes (`\n \t \r …`) are DELIBERATELY excluded from the global pass (a bare backslash-letter is overwhelmingly a prose path/regex, `C:\name`/`C:\new`, not an intended invisible) and remain handled only inside the two bounded scrub contexts where a digit/suffix/superscript anchor proves citation intent (r39–r42 unchanged); a malformed / lone / reversed surrogate or `\u{110000}` is left as-is (non-seam) and never throws; a prose backslash with no code-point-escape form is never matched. Real-seam behavior is unchanged (already correct); a legit supplementary DIGIT ordinal (`𝟚nd`, U+1D7DA) still folds via the digit path.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — a by-construction guard asserting a representative BMP seam (U+200B) and supplementary seam (U+E0100) in ALL representations (literal, fully-escaped, `\u{…}`, mixed surrogate halves both orders) are consumed IDENTICALLY at EVERY seam position — digit↔suffix, suffix↔book, digit↔superscript, book↔chapter — and in the reserved-key live scan; escaped==real at suffix↔book; non-seam escapes never fabricate a numbered book and match the literal codepoint; prose backslash / Windows path / short named escapes untouched; malformed no-throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — escaped seams at the suffix↔book position (BMP, `\u{…}`, mixed both orders; non-seam passes) over `/invoke` + `/stream`, and a suffix↔book escaped-seam fabrication under `scripture_validation` caught by both.

**Confirmed (round-43):** escaped seams are decoded to real codepoints GLOBALLY up front, so EVERY seam position (digit↔suffix, suffix↔book, digit↔superscript, book↔chapter) is handled by construction through the ordinary real-seam paths, with non-seam escapes, short named escapes, and prose backslashes unaffected. r42 (mixed literal/escaped surrogate seams), r41 (reserved-key live screen + fully-escaped supplementary), r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residual remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker.

---

## Round-44 pass (re-review of r43) — two findings in tension resolved by ONE citation-shaped seam decoder scoped to citation candidates — FIXED

### META: stop chasing seam POSITIONS and REPRESENTATIONS separately — one decoder, scoped to citation shape
Codex re-reviewed r43 and found two issues that point to the same fix: (1) a HIGH representation FALSE-ACCEPT — short named escapes still bypass the book↔chapter (and suffix↔book) seam because r43 excluded them from the global pass and the bounded scrubs only cover digit↔suffix/digit↔superscript; (2) a MEDIUM prose FALSE-REJECT — the r43 GLOBAL code-point rewrite fabricates refs inside prose/code literals anywhere. The fix (Codex's explicit recommendation) resolves the tension: consolidate into ONE seam decoder that is complete across representations AND prose-safe by SCOPING.

### R44-1 — [HIGH] Short named escapes bypass book↔chapter / suffix↔book seams — FIXED
`decodeEscapedSeams` (r43) excluded short named escapes (`\n \t …`) globally, and the bounded scrubs only decode seams at digit↔suffix and digit↔superscript. So a named escape at book↔chapter stayed raw: `validateAiContent({content:"Hezekiah\n4:5"})` → `allValid:true`, ZERO refs — while `Hezekiah
4:5` AND a real LF both extract `Hezekiah 4:5` → invalid_book. A representation-dependent false-accept at book↔chapter (a fabricated/wrong ref slips the screen via `\n`/`\t`).

### R44-2 — [MEDIUM] The global code-point rewrite false-rejects prose/code literals — FIXED (scoped)
r43's `decodeEscapedSeams` rewrote EVERY all-seam code-point escape ANYWHERE, so `{"label":"Hezekiah 4:5"}` and `C:​Hezekiah4:5` were rewritten and screened, false-rejecting legitimate code/JSON whose displayed text is not a citation.

**Fix — consolidate into ONE citation-shaped seam decoder scoped to citation candidates** (`packages/shared/scripture/index.js`): replace the r43 global `decodeEscapedSeams` + the r43 named-escape exclusion with a single `decodeCitationSeams` pre-pass (runs first in `extractScriptureRefs`). It:
1. **Operates ONLY within citation-candidate spans** — a seam run BETWEEN TWO WORD CHARACTERS (`\p{L}`/`\p{Nd}`), the intra-citation position where a book / prefix / number token meets the next citation token (book↔chapter, suffix↔book, prefix↔book, chapter↔verse, digit↔suffix, digit↔superscript). A seam whose neighbor is a NON-word char — a Windows path (`C:\name`: the seam follows `:`), a standalone/edge escape, a regex/LaTeX literal not forming a book↔number shape — is NOT a candidate and is left untouched.
2. **Canonicalizes seams uniformly across EVERY representation** via the same by-construction decode-then-check used elsewhere: real seam codepoints, code-point escapes (`\uXXXX`/`\u{…}`/`\xHH`, incl. surrogate pairs and MIXED literal/escaped halves, both orders), AND short NAMED escapes (`\n \r \t \v \f \b \0`). When every decoded codepoint is a seam, the run becomes the real codepoint(s); the ordinary real-seam paths (`normalizeCitationText` Cf/Cc/Zs→space, the ordinal/superscript scrubs) then handle every position uniformly.
3. **Guards:** a decoded non-seam codepoint anywhere (`A`=A, `\u{1F600}`=emoji) leaves the run literal (no fabrication); a malformed / lone / reversed surrogate or `\u{110000}` is left as-is and never throws. The bounded ordinal/superscript scrubs are retained for their folding / fail-closing duties (they now consume already-canonicalized seams; their escape-awareness remains as defense-in-depth).

This closes R44-1 (named escapes now decoded at book↔chapter and every candidate position, consistent with code-point escapes and real seams) AND R44-2 for all content whose escapes do NOT form a citation shape (prose paths, standalone escapes, non-book code → untouched, no fabricated ref, no false-reject).

### DOCUMENTED RESIDUAL (r25 over-flag class) — a book+chapter shape in a code literal with an escaped seam
A fabricated/wrong book+chapter shape that appears INSIDE a code/JSON literal with an ESCAPED seam (`{"x":"Hezekiah 4:5"}`) IS a citation candidate (word↔word) and is screened as a citation → invalid_book. This over-flag is DELIBERATE and REQUIRED for representation-consistency: a real space, a zero-width, a ` `, and a `\n` between the same book and chapter must all reach the same verdict — a screen cannot let the ENCODING of a seam decide whether a smuggled reference is checked, and real seams / code-point escapes already flag. Shape cannot soundly distinguish a smuggled citation from a code-literal one, so — per the r25 documented class — the screen prefers to flag (a false-accept that lets a fabricated reference through is the worse failure for a screen). Content whose escapes do NOT form a book↔number shape is unaffected.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — a by-construction guard asserting a BMP seam (U+200B), a supplementary seam (U+E0100), and NAMED-escape seams (`\n`, `\t`) in ALL representations behave IDENTICALLY at digit↔suffix, suffix↔book, book↔chapter, and digit↔superscript, plus the reserved-key live scan; finding #1 closed (`Hezekiah\n4:5`→not allValid, `John\n3:16`→valid); non-seam escapes never fabricate; a prose-safety block (Windows paths, standalone ` `, regex literal, JSON `width`/`path` values → untouched, not rejected) and the documented residual over-flag; malformed no-throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — named-escape (and code-point) seams at book↔chapter over `/invoke` + `/stream` and under `scripture_validation`; and a prose-safe non-citation escape (path + `width`) NOT false-rejected (200).

**Confirmed (round-44):** one citation-scoped seam decoder handles all positions and all representations consistently — the named-escape book↔chapter false-accept (finding #1) is closed and every representation reaches the same verdict at every position — scoped to citation candidates so prose/code literals that don't form a citation shape are not false-rejected (finding #2), with the book+chapter-in-a-code-literal case documented as a deliberate r25 fail-safe over-flag. r43 (suffix↔book), r42 (mixed surrogate), r41 (reserved-key live screen), r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residual for the extractor grammar itself remains the r30 spaced-separator trade-off for a BARE NUMERIC outline marker.

---

## Round-45 pass (re-review of r44) — the word↔word scoping missed seams adjacent to citation DELIMITERS (':' / '-'); extend the scoped decoder to the full citation-shaped span — FIXED

### R45-1 — [HIGH] Escaped seams next to ':' or '-' bypass validation — FIXED
r44's `decodeCitationSeams` only decoded seam runs flanked by `\p{L}`/`\p{Nd}` on BOTH sides — which EXCLUDES a seam immediately before/after the chapter:verse `:` and range `-`, even though `CITATION_RE` accepts real whitespace there (`\s*:\s*`, `\s*[-]\s*`). Confirmed: `Hezekiah 4\n:5` and `Hezekiah 4:\n5` → refs `[]` / `allValid:true` (should be invalid_book); `John 999\n:16` → dropped the out-of-range ref; `John 3:1\n-999` and `John 3:1-\n999` → truncated to a valid `John 3:1` instead of preserving the invalid range — while the real-newline versions correctly flag. A representation-dependent false-accept at the delimiter positions.

**Fix** (`packages/shared/scripture/index.js`): extend the scoped decoder to the full citation-shaped candidate span. `decodeCitationSeams` now applies TWO scoped passes over one shared, by-construction `decodeSeamRun` (real / code-point escapes incl. surrogate pairs and mixed literal-escaped / short named escapes → real seam iff every decoded codepoint is a seam):
1. **WORD↔WORD** (r44): a seam run between two `\p{L}`/`\p{Nd}` — book↔number, prefix/ordinal↔book, digit↔suffix, digit↔digit.
2. **NUMBER↔delimiter↔NUMBER** (new): a numeric citation span `\p{Nd}+( seams? DELIM seams? \p{Nd}+ )+` where DELIM is `:` / `-` (plus the Unicode colon/dash variants `normalizeCitationText` folds), decoding EVERY seam run INSIDE the span. This is anchored by an ACTUAL number-delimiter-number shape, so the delimiter positions are covered without touching a lone escape in prose/code.

After both passes an escaped seam adjacent to `:` / `-` is a real seam, and the ordinary real-seam path (`CITATION_RE`'s `\s*` tolerance) reaches the SAME verdict as a real space there — including PRESERVING an out-of-range chapter/verse or a bad range-end (`John 3:1<seam>-999` keeps the `999`, so it is out_of_range, never silently truncated to a valid `John 3:1`). Digit↔SUPERSCRIPT stays with the bounded AMBIGUOUS_SUPERSCRIPT scrub (the superscript is `\p{No}`, not `\p{Nd}`); parity there (real == named == code-point == supplementary → out_of_range fail-closed) is asserted by tests.

**Prose-safety preserved:** the numeric-span pass requires an actual `number DELIM number` shape, so a lone escaped seam in a path/regex/LaTeX/non-citation literal, a version string (`1\n.2.3` — `.` is NOT a chapter:verse delimiter), a phone number (`555\n-1234` — no book → no ref), or a bare numeric value (` 50px`) is not turned into a fabricated reference and is not false-rejected. The documented r25 over-flag residual (a genuine book+chapter shape inside a code literal with an escaped seam) is unchanged and is the same principle extended to delimiter-adjacent seams: a real space, a zero-width, and a `\n` around `:` must reach the same verdict.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — a by-construction parity guard asserting a real seam, named escapes (`\n`, `\t`), a BMP code-point escape (`​`), and a supplementary escape (`\u{E0100}`) reach the IDENTICAL verdict at book↔number, number↔`:`, `:`↔number, out-of-range chapter across `:`, range before/after `-`, digit↔suffix, suffix↔book, and digit↔superscript — for fabricated book, out-of-range, and bad-range cases; a bad range-end is preserved (never truncated to a valid ref); reserved-key + `validateAiContent` parity; prose-safety (version / phone / bare numeric untouched) and valid-citation consistency (`John 3\n:16`→John 3:16, `John 3:1\n-5`→John 3:1-5); malformed no-throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — delimiter-adjacent named-escape seams (`:` and `-`, fabricated / out-of-range / bad-range, valid stays valid) over `/invoke` + `/stream`, and a delimiter-adjacent fabrication under `scripture_validation`.

**Confirmed (round-45):** the scoped decoder now covers the full citation-shaped span, so a seam adjacent to `:` / `-` (and the book↔number space, digit↔suffix, suffix↔book) reaches the same verdict as a real space at every position — across real, named, code-point, and supplementary representations — with out-of-range/bad-range readings preserved (never truncated), digit↔superscript parity via the bounded scrub, and prose/code still not false-rejected. r44 (word↔word positions), r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The single accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag.

---

## Round-46 pass (re-review of r45) — the abbreviation-dot boundary; then CLOSE THE CLASS with grammar-complete seam coverage + a grammar-derived parity lock — FIXED

### R46-1 — [HIGH] Escaped seam after an abbreviation dot drops the reference — FIXED
r45's `decodeCitationSeams` decoded seams only between word chars or inside a numeric `:`/`-` span. The abbreviated-book + trailing `.` + whitespace + chapter boundary — which `CITATION_RE` supports (`[a-z]{2,}\.?\s+NUM`) — is neither (left neighbour is `.`, the numeric span starts after the book). Confirmed: `extractScriptureRefs('Jn.\n999:1' / 'Gen.\n999:1' / 'Hez.\n4:5')` → `[]`, while the real-newline forms return `John 999:1` / `Genesis 999:1` (out_of_range) and `Hez 4:5` (invalid_book); `validateAiContent({content:'Jn.\n999:1'})` → `allValid:true` zero refs — a model hides an invalid/out-of-range ref via a dotted abbreviation + escaped seam.

### CLOSING THE CLASS — enumerated whitespace-tolerant positions + grammar-derived parity lock
Rather than fix one boundary at a time, I audited `CITATION_RE` and the compact/ordinal/abbreviation sub-grammars and enumerated EVERY position where they tolerate whitespace (`\s` / `\s*`). A probe (escaped `\n` vs a real newline) confirmed which were already at parity and which bypassed:

| # | Position | Grammar | Example | Coverage |
|---|---|---|---|---|
| P1 | prefix↔book | `(prefix)\s+book` | `4\nJohn` | word↔word |
| P2 | book-internal "of" | `\s+of\s+` | `Song of\nSolomon` | word↔word |
| P3 | book↔chapter | `book\s+NUM` | `Hezekiah\n4:5` | word↔word |
| P4 | abbrev-dot↔chapter | `book\.?\s+NUM` (dotted) | `Gen.\n999:1` | **NEW abbrev-dot pass** |
| P5 | chapter↔`:`↔verse | `NUM\s*:\s*NUM` | `4\n:5` / `4:\n5` | numeric span (r45) |
| P6 | range↔`-` | `NUM\s*-\s*NUM` | `3:1\n-999` | numeric span (r45) |
| P7 | ordinal-sep↔stem | `\d+(st\|nd\|rd\|th)\s*[.\-]?\s*stem` | `4th.\nJohn` | **NEW ordinal-sep pass** |
| P8 | digit↔suffix | ORD digit↔suffix | `4\nth John` | word↔word + bounded scrub |
| P9 | suffix↔book | suffix↔stem | `4th\nJohn` | word↔word |
| P10 | digit↔superscript | digit↔`\p{No}` | `3:1\n⁶` | bounded AMBIGUOUS_SUPERSCRIPT scrub |

The probe showed P4 (abbrev-dot) and P7 (ordinal-separator, `4th.\nJohn` / `4th\n.John` / `4th-\nJohn`) bypassing; all others already at parity.

**Fix** (`packages/shared/scripture/index.js`): `decodeCitationSeams` now runs one scoped pass per position class, all sharing the single by-construction `decodeSeamRun` (real / code-point escapes incl. surrogate pairs and mixed literal-escaped / short named escapes → real seam iff every decoded codepoint is a seam):
- **P4 abbrev-dot↔chapter** — `ABBREV_DOT_SEAM_RE = (?<=\p{L}\p{L}\.)(seam+)(?=\p{Nd})`: a seam between a ≥2-letter word + `.` and a chapter DIGIT is decoded. Anchored so a sentence period before a NON-number word (`Gen.\nThen`) and a digit-dot (`4.\n5`) and a single-letter abbreviation (`e.g.`) are NOT matched.
- **P7 ordinal-separator** — `ORDINAL_SEP_SPAN_RE = (\d+(st|nd|rd|th))((seam|[.\-])+)(?=\p{L})`: decode the seam runs in the connector, KEEPING the `.`/`-`, so `ORDINAL_NUMBERED_RE` binds `4th.\nJohn`→`4 John` like a real space.

**Grammar-derived parity LOCK** (the new test): for EACH enumerated position P1–P10 and EACH representation (real BMP seam, real newline, named `\n`/`\t`, BMP code-point escape, supplementary `\u{E0100}`, mixed escaped/literal surrogate), assert the seam reaches the IDENTICAL verdict as a real space at that position — valid / invalid_book / out_of_range as applicable. The baseline for each position is computed with a real ASCII space, so the test tracks the grammar: a future boundary `CITATION_RE` tolerates but the decoder misses will FAIL it (verified red-able — the pre-fix probe showed P4/P7 mismatching).

**Preserved:** prose-safety (the abbrev pass needs a 2-letter word + dot + DIGIT, so a sentence period + non-number word is not fabricated; bookless number:number / times / ratios / versions (`1\n.2.3`, `.` is not a chapter delimiter) / phones (`555\n-1234`) still not fabricated); out-of-range / bad-range preservation (`John 3:1<seam>-999` keeps the 999 → out_of_range, never truncated); digit↔superscript parity via the bounded scrub; the r30 outline + r44 code-literal fail-safe residuals; and r30–r45 behaviour. Multi-pass ordering (word↔word → abbrev-dot → ordinal-sep → numeric span) targets disjoint positions over the shared decodeSeamRun, so there is no double-decode; escapes only ever SHRINK to real codepoints, and the ordinal-sep pass keeps the `.`/`-`, so span-suppression / superscript-marker offsets downstream are unaffected. Malformed / lone / reversed surrogate never throws.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — the grammar-derived parity lock (P1–P10 × 7 representations vs the real-space baseline); the HIGH abbrev-dot no-bypass + reserved-key parity; prose-safety (sentence period + newline, `e.g.`, paths, version, phone) NOT fabricated; out-of-range/bad-range preserved; valid citations with escaped seams stay valid; malformed no-throw.
- `services/api/src/__tests__/aiStreamScripture.test.js` — abbrev-dot + ordinal-separator escaped seams over `/invoke` + `/stream`, a real sentence period + newline NOT false-rejected, and an abbrev-dot fabrication under `scripture_validation`.

**Confirmed (round-46):** decodeCitationSeams covers every enumerated whitespace-tolerant citation position (P1–P10), so no citation boundary lets an escaped seam bypass — a seam of any representation reaches the same verdict as a real space at every position, guarded by the grammar-derived parity lock — with prose-safety (sentence periods, paths, versions, phones untouched) and out-of-range/bad-range preservation intact. r45 (delimiter-adjacent), r44 (word↔word + code-literal residual), r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag.

---

## Round-47 pass (re-review of r46) — the POSITION axis was complete, but the seam decoder's TOKEN SURFACE was narrower than the grammar — aligned + 2-D parity lock — FIXED

### R47-1 — [HIGH] Escaped delimiter seams decoded only for DECIMAL digits, but the grammar accepts ROMAN numerals — FIXED
`NUMERIC_CITATION_SPAN_RE` matched only `\p{Nd}+` around `:`/`-`, while `CITATION_RE`'s `NUM_TOKEN` accepts Roman chapter/verse/range tokens. So an escaped seam around a ROMAN delimiter stayed literal → dropped/truncated. Confirmed: `validateAiContent({content:"John XCIX\n:I"})` → `allValid:true`, NO refs (real newline → `John 99:1` out_of_range); `John III:XVI\n-CM` → reduced to a valid `John 3:16` instead of preserving the invalid range (the `\n-CM` dropped).

### R47-2 — [MEDIUM] Prefix/ordinal seam passes omitted normalized non-ASCII prefixes → valid refs FALSE-REJECT — FIXED
P7 was ASCII-digit-anchored (`\d+(st|nd|rd|th)`) and `WORDISH` treated only letters/decimal digits as citation-token chars, but the normalized grammar also accepts fullwidth digits, Unicode Roman prefix characters (Nl), etc. Confirmed: real-newline `２nd.\nJohn 1:1` (fullwidth 2) and `Ⅱ\nJohn 1:1` (Unicode Roman) validate as `2 John 1:1`, but the ESCAPED-newline variants → `Njohn 1:1` invalid_book (false-reject).

**Root fix — align the seam decoder's TOKEN SURFACE with the grammar** (`packages/shared/scripture/index.js`), the same "derive from the grammar" discipline as r46's position enumeration, now on the token axis (option (a) — broaden the flanking classes; option (b), re-ordering after normalization, was rejected as too entangled with the seam-vs-space and ordinal-fold pass ordering):
- **`WORDISH`** (P1/P2/P3/P8/P9, prefix/book token char) = `[\p{L}\p{Nd}Ⅰ-ↈ]` — letters (incl. superscript-letter Lm and ASCII Roman, which are letters), decimal digits (ASCII/fullwidth/Arabic/…), AND Unicode Roman-numeral characters (Nl, U+2160–2188). So `Ⅱ\nJohn` is word-flanked and decodes.
- **`NUMROMAN` token** (P5/P6 delimiter span, and P4's chapter lookahead) = `[\p{Nd} i v x l c d m I V X L C D M Ⅰ-ↈ]` — matching `NUM_TOKEN`'s surface: decimal, ASCII Roman (either case), and Unicode Roman. So an escaped seam around a ROMAN `:` / `-` decodes and the Roman ref/range is seen (`John XCIX\n:I` → `John 99:1` out_of_range; `John III:XVI\n-CM` preserves the invalid `-CM` range).
- **P7 ordinal-separator** digit broadened from ASCII `\d` to `\p{Nd}` (ASCII AND fullwidth/Arabic), so `２nd.\nJohn` reaches parity with its real-space form.

The seam decoder only NORMALIZES the seam; the existing validator still classifies the token, so an overlarge/malformed Roman (`MMMM`, lowercase `iiii`) is still flagged exactly as in r31 — no regression to the Roman-canonical grammar or the r32/r35 ordinal work.

**Parity LOCK extended to 2-D (position × token surface × representation), asserting REFS + STATUSES.** The grammar-derived parity test now iterates each position P1–P10, each token-surface variant (decimal, ASCII Roman, Unicode Roman, fullwidth digit), and each seam representation (real BMP seam, real newline, named `\n`/`\t`, BMP code-point escape, supplementary `\u{E0100}`, mixed escaped/literal surrogate), asserting the escaped-seam signature equals the real-space signature — the full `[ref, status]` array, NOT statuses alone (asserting statuses alone missed the dropped-ref case). A future narrow-token OR narrow-position gap now FAILS the lock.

**Preserved:** prose-safety (roman-letter words + `:` WITHOUT a book — `the mix\n:iv`, `did:mix` — are not fabricated; times, versions, phones, paths, sentence periods still safe); out-of-range / bad-range preservation (asserted on the REFS array, so a dropped/truncated Roman range is caught); the r30 outline + r44 code-literal residuals; digit↔superscript parity; and r30–r46.

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — the 2-D parity lock (position × token surface × representation, refs+statuses); Roman-delimiter refs asserted (`John XCIX\n:I`→`John 99:1`, `John III:XVI\n-CM` not truncated); fullwidth-ordinal / Unicode-Roman prefix not false-rejected; Roman validator classification unchanged (`MMMM`/`iiii` still flagged); prose-safety for the broadened Roman surface.
- `services/api/src/__tests__/aiStreamScripture.test.js` — Roman-delimiter seams (out_of_range / invalid range) and Unicode-Roman / fullwidth prefixes over `/invoke` + `/stream`, plus a Roman-delimiter fabrication under `scripture_validation`.

**Confirmed (round-47):** the seam decoder's token surface matches the grammar — Roman `:`/`-` delimiters decode (Roman refs seen, invalid ranges preserved) and fullwidth / Unicode-Roman prefixes reach parity (no false-reject) — and the parity lock is now 2-dimensional (position × token surface × representation, refs+statuses), so neither a narrow-position nor a narrow-token gap can ship. r46 (P1–P10 decimal), r45, r44, r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error). The accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag.

---

## Round-48 pass (FINAL) — token surface DERIVED from the fold tables (not enumerated); exhaustive lock over fold-equivalence classes — CLOSED BY CONSTRUCTION

### R48-1 — [HIGH] The decoder's hand-enumerated token surface still missed grammar-accepted forms — FIXED
r47's `NUMROMAN_CH` covered `\p{Nd}` + ASCII Roman + U+2160–2188, but `normalizeCitationText` ALSO folds FULLWIDTH LATIN ROMAN letters (Ｘ Ｃ Ｉ …) and fullwidth / superscript ORDINAL-SUFFIX letters to ASCII — and the seam decoder runs BEFORE that fold, so it missed them. Confirmed: `John ＸＣＩＸ\n:Ｉ` → no refs (real-LF twin → `John 99:1` out_of_range); `John ＩＩＩ:ＸＶＩ\n-ＣＭ` → truncated to a valid `John 3:16` (real-LF twin preserves the invalid range); `４ｔｈ\n.John 1:1` and `⁴ᵗʰ\n.John 1:1` → bare valid `John 1:1` (real-space twins → `4 John` invalid_book). Hand-enumerating token surfaces never ends — every round added one and missed the next.

**DEFINITIVE ROOT FIX — DERIVE the decoder's flank token classes from the SAME fold tables `normalizeCitationText` applies** (`packages/shared/scripture/index.js`). The recurring cause was the flank classes hand-REPLICATING the grammar's fold surface. Now:
- `foldCitationChar(ch)` applies the citation folds to one char — fullwidth-Latin→ASCII, Unicode-Roman→ASCII (`ROMAN_NUMERAL_FOLD`), superscript→ASCII (`SUPERSCRIPT_FOLD`), `\p{Nd}`→ASCII (`decimalDigitToAscii`).
- `derivedClassChars(targetSet)` collects, from the FINITE fold-source pool (the fold tables' keys + the fullwidth Latin ranges), every source whose fold target is entirely within `targetSet`, escaped for a regex class.
- The flank classes are BUILT from that: `NUMROMAN_CH` = `\p{Nd}` + ASCII Roman + `derivedClassChars(digit ∪ roman)`; `ORD_PREFIX_DIGIT` = `\p{Nd}` + `derivedClassChars(digit)`; the ordinal-suffix letters = ASCII + `derivedClassChars` per letter; `WORDISH` = `\p{L}` + `\p{Nd}` + `derivedClassChars(digit ∪ roman)`.

So a char is a NUMBER / ROMAN / ORDINAL-SUFFIX token char IFF, after the grammar's own folds, it canonicalizes to a decimal digit / ASCII Roman / ordinal-suffix letter. The decoder's token surface therefore EQUALS the grammar's surface BY CONSTRUCTION, and a FUTURE fold entry is inherited automatically — no hand-kept list to fall behind. (`decodeCitationSeams` and its derived classes were relocated to AFTER the fold tables so they can derive from them.) The decoder only NORMALIZES the seam; the validator still classifies the canonical token, so an overlarge/malformed Roman (`MMMM`, `iiii`) is still flagged (r31), and the position-aware superscript handling (r35/r36 footnote-vs-data-vs-fail-close, via the bounded scrub) is untouched.

**EXHAUSTIVE PARITY LOCK, DERIVED.** A new module export `__citationFoldSurfaces()` returns the reverse of the SAME fold tables (ASCII target → { fullwidth, superscript, unicodeRoman } sources). The parity lock uses it to RENDER each ASCII token in every folded surface, then iterates position × derived-token-surface × seam-representation, asserting the escaped-seam signature equals the real-space/real-token baseline — the full `[ref, status]` array (so a dropped/truncated ref is caught). Because BOTH the decoder and the lock derive from the fold tables, a new fold entry is covered by the decoder AND exercised by the lock automatically. Red-ability is asserted (a non-seam char at the same position produces a DIFFERENT verdict, so parity is achieved by the decoder, not trivially; and the fullwidth-Roman ref is asserted present so a `[] == []` pass can't hide a bug) — and was demonstrated by the pre-fix probe, which failed these exact assertions.

**Preserved:** prose-safety (roman-letter words + `:` without a book, times, versions, phones, paths, sentence periods); out-of-range / bad-range preservation (asserted on refs); r30 outline + r44 code-literal residuals; digit↔superscript parity; the r31 Roman classifier; and r30–r47 (full suites green).

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — the exhaustive derived lock (position × derived token surface × representation, refs+statuses, red-able); fullwidth-Roman refs asserted (`John ＸＣＩＸ\n:Ｉ`→`John 99:1`; range not truncated); fullwidth / superscript ordinals bound; plus the r46/r47 enumerated-position lock retained.
- `services/api/src/__tests__/aiStreamScripture.test.js` — fullwidth-Latin-Roman delimiter (out_of_range / invalid range) and fullwidth / superscript ordinals over `/invoke` + `/stream`, plus a fullwidth-Roman fabrication under `scripture_validation`.

**Confirmed (round-48):** the seam decoder's token surface is DERIVED from the grammar's fold tables (decoder surface ⊇ grammar surface by construction — fullwidth Latin Roman, fullwidth / superscript ordinal suffixes, and any future fold entry are inherited), and the parity lock is exhaustive over fold-equivalence classes × positions × representations (refs+statuses, red-able). r47, r46, r45, r44, r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### The seam class is now closed BY CONSTRUCTION on both axes
- **Position axis** — every whitespace-tolerant position in the grammar is enumerated (P1–P10) and locked by the grammar-derived parity test; a new tolerated position fails the lock.
- **Token axis** — the flank token classes are DERIVED from the grammar's own fold tables, so the decoder's surface equals the grammar's surface by shared source of truth; a new fold entry is inherited by the decoder and exercised by the lock automatically.
- **Representation axis** — every seam is decoded by the one by-construction `decodeSeamRun` (real / code-point escapes incl. surrogate pairs + mixed literal-escaped / short named escapes), with non-seam escapes, malformed/lone surrogates, and prose backslashes left untouched.

The only accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag — both deliberate, both consistent across all representations.

---

## Round-49 pass (re-review of r48) — the r48 derivation used the WRONG (too-narrow) source of truth; derive from the ACTUAL normalization (NFKC + explicit folds) — CLOSED BY CONSTRUCTION

### R49-1 — [HIGH] NFKC-only numeric/Roman token chars bypass escaped-seam decoding — FIXED
r48 derived the flank classes from the EXPLICIT fold tables + `\p{Nd}`, but extraction's pass 2 also applies **NFKC** on top of those folds. So NFKC-only compatibility tokens — subscript digits (₄ ₅, category No, not `\p{Nd}`), mathematical letters (𝐈𝐕 𝐕), circled digits (④ ⑤), etc. — fold into grammar tokens but were NOT in the decoder flank classes, so a literal escaped seam around them was not decoded before pass 2. Confirmed: `Hezekiah ₄\n:₅` → no refs (real-seam baseline → `Hezekiah 4:5` invalid_book); `Hezekiah 𝐈𝐕\n:𝐕` → no refs (real newline flagged). The derived LOCK missed it too because `__citationFoldSurfaces()` reversed the NARROW explicit tables, not the full NFKC-accepted surface.

**DEFINITIVE FIX — derive the token-flank predicate from the ACTUAL normalization the grammar applies (NFKC ∪ the explicit folds)** (`packages/shared/scripture/index.js`). The explicit tables were only PART of it:
- `normalizeTokenChar(ch)` now applies the SAME normalization pass 2 applies: **NFKC first**, then the explicit folds that `normalizeCitationText` adds on top of NFKC (archaic Roman that does NOT NFKC-fold, `decimalDigitToAscii` for every `\p{Nd}` script, fullwidth-Latin, superscript). A flank char is a NUMBER/ROMAN/ORDINAL-SUFFIX token char IFF `normalizeTokenChar(c)` ∈ the ASCII token set — so decoder surface ≡ grammar surface by construction (subscript / mathematical / circled / any future compatibility form inherited automatically).
- The precomputed regex CLASSES (`NUMROMAN_CH`, `ORD_PREFIX_DIGIT`, the ordinal-suffix letters, `WORDISH`) are GENERATED by scanning the Unicode compatibility ranges (BMP + SMP: super/subscripts, letterlike + Roman numerals, enclosed/circled, fullwidth, mathematical alphanumerics) ∪ the explicit fold-table keys, NFKC-folding each and bucketing those whose canonical is a token char — derived from NFKC, not hand-listed. `\p{Nd}` decimals and `\p{L}` letters are matched by those classes directly (not enumerated).

The decoder only NORMALIZES the seam; the validator still classifies the canonical token (an overlarge/malformed Roman like `MMMM`/`iiii` is still flagged, r31), and the r35/r36 position-aware superscript handling (footnote-vs-data-vs-fail-close, via the bounded scrub) is untouched.

**The lock is now exhaustive over the NFKC surface.** `__citationFoldSurfaces()` enumerates, for each ASCII token char, the compatibility sources that NFKC-canonicalize to it, bucketed by surface (fullwidth / subscript / superscript / mathematical / romanNumeral / circled) — DERIVED by scanning the SAME compatibility ranges + NFKC. The parity lock iterates position × NFKC-derived token surface × representation, asserting the full `[ref, status]` array equals the real-space/real-token baseline. Because BOTH the decoder and the lock derive from NFKC, a subscript / mathematical / any-future compatibility form is covered by the decoder AND exercised by the lock automatically. Red-ability is asserted (a non-seam char at a subscript delimiter produces a DIFFERENT verdict; the subscript/math refs are asserted present so a `[] == []` pass can't hide a bug) and was demonstrated by the pre-fix probe.

**Preserved:** prose-safety (roman-letter words + `:` without a book, times, versions, phones, paths, sentence periods); out-of-range / bad-range preservation (asserted on refs); r30 outline + r44 code-literal residuals; digit↔superscript parity; the r31 Roman classifier; and r30–r48 (full suites green).

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — the NFKC-exhaustive derived lock (position × every NFKC surface × representation, refs+statuses, red-able); subscript / mathematical / circled refs asserted; plus the retained r46/r47 enumerated-position lock.
- `services/api/src/__tests__/aiStreamScripture.test.js` — subscript-digit and mathematical-letter delimiter seams (invalid_book / out_of_range; valid subscript stays valid) over `/invoke` + `/stream`, plus a subscript-token fabrication under `scripture_validation`.

**Confirmed (round-49):** the token-flank predicate is derived from the ACTUAL normalization (NFKC + explicit folds), so NFKC-only compatibility tokens (subscript, mathematical, circled, and any future form) are covered by construction, and the lock is exhaustive over the NFKC surface (position × surface × representation, refs+statuses, red-able). r48, r47, r46, r45, r44, r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### The seam class is now closed BY CONSTRUCTION on all three axes — definitively
- **Position** — every whitespace-tolerant grammar position is enumerated (P1–P10) and locked by the grammar-derived parity test.
- **Token** — the flank classes are derived from the grammar's ACTUAL normalization (NFKC ∪ explicit folds), the true single source of truth, so decoder surface ≡ grammar surface; any compatibility form the grammar accepts (fullwidth, subscript, superscript, mathematical, circled, Roman, archaic, any `\p{Nd}` script, any future NFKC entry) is inherited by the decoder and exercised by the lock automatically.
- **Representation** — every seam is decoded by the one by-construction `decodeSeamRun` (real / code-point escapes incl. surrogate pairs + mixed literal-escaped / short named escapes), with non-seam escapes, malformed/lone surrogates, and prose backslashes left untouched.

The only accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag — both deliberate, both consistent across all representations.

---

## Round-50 pass (re-review of r49) — the derivation was right but its IMPLEMENTATION still enumerated (a range allowlist); replaced with a FULL Unicode scan — CLOSED BY CONSTRUCTION

### R50-1 — [HIGH] The generated token scan used a finite range ALLOWLIST that misses NFKC sources — FIXED
r49 derived the flank classes from the ACTUAL normalization (NFKC + explicit folds) — the right predicate — but its class GENERATION scanned a hand-listed `COMPAT_SCAN_RANGES` allowlist, which is not the predicate and omits sources like U+1D9C ᶜ→c, U+2C7D ⱽ→V, U+1F132 🄲→C. Confirmed: `John ᶜ\n:I` → [] while real-space `John ᶜ :I` → `John 100:1` out_of_range — a model hides an out-of-range citation behind a literal escaped seam. The derived lock missed it too (it reversed the same allowlist).

**DEFINITIVE FIX — build the flank classes AND the lock's surface generator by scanning the ENTIRE Unicode scalar space** (`packages/shared/scripture/index.js`). No range allowlist remains:
- The scan iterates every code point U+0000..U+10FFFF EXCLUDING surrogates, applies the ACTUAL predicate `normalizeTokenChar` (NFKC + the explicit folds), and buckets a code point as a token source when its full normalized form differs from itself (decimal digits are matched by `\p{Nd}` directly, so skipped). `derivedClassChars(targetSet)` then keeps sources whose FULL normalized form is WHOLLY in the target set — handling multi-codepoint NFKC expansions correctly (a source → 'IV' counts as roman; a source → '1⁄2' does NOT, since ⁄ is not a token char). The derived class is therefore EXACTLY `{ c : normalizeTokenChar(c) ⊆ tokenset }` — provably complete, no range to omit.
- The scan is memoized on `globalThis` so it runs ONCE per process (a ~150ms NFKC-dominated one-time cost; a second same-process import measured 13ms), keeping the gate fast under per-file test isolation while remaining a full-domain scan.
- `__citationFoldSurfaces()` (the lock's surface generator) is the reverse of the SAME full scan — for each ASCII token char, EVERY code point that normalizes to it — so decoder and lock share the one complete source of truth and neither can miss a code point.

`normalizeTokenChar` is the single predicate both the decoder flank test and the class generation use, so decoder surface ≡ grammar surface ≡ `{c: normalizeTokenChar(c) ⊆ tokenset}`, exactly. Over-inclusion is bounded (only sources whose canonical is WHOLLY token chars are added, and the passes stay anchored to a citation shape) — prose-safety tests confirm no fabrication from non-citation text. The decoder only NORMALIZES the seam; the validator still classifies the canonical token (`MMMM`/`iiii` still flagged, r31), and the r35/r36 position-aware superscript handling is untouched.

**The lock is exhaustive over the FULL scan.** It iterates EVERY discovered number/roman source (293+) at the chapter-delimiter position and EVERY discovered ordinal-suffix source at the ordinal separator × every seam representation, asserting the `[ref, status]` array equals the real-space verdict. Because the class IS the full scan, the lock samples every surface bucket the scan produces. The exact missed repros (ᶜ→`John 100:1` out_of_range, ⱽ, 🄲) are asserted explicitly, along with red-ability (a non-seam char at the same position yields a different verdict) — demonstrated by the pre-fix probe.

**Preserved:** prose-safety (roman-letter words + `:` without a book, times, versions, phones, paths, sentence periods); out-of-range / bad-range preservation (asserted on refs); r30 outline + r44 code-literal residuals; digit↔superscript parity; the r31 Roman classifier; and r30–r49 (full suites green).

**Tests** (literals via `String.fromCodePoint`/`String.fromCharCode`/explicit escapes; API through the REAL JSON transport):
- `apps/web/src/lib/scriptureRefs.test.js` — the full-scan-derived exhaustive lock (every discovered number/roman source and ordinal-suffix source × representation, refs+statuses, red-able); the exact repros ᶜ/ⱽ/🄲 asserted; the prior NFKC/fullwidth/roman surfaces retained; the r46/r47 enumerated-position lock retained.
- `services/api/src/__tests__/aiStreamScripture.test.js` — ᶜ / 🄲 / ⱽ token seams over `/invoke` + `/stream` and a ᶜ fabrication under `scripture_validation`.

**Confirmed (round-50):** the flank classes are derived from a FULL Unicode scan through `normalizeTokenChar` (no range allowlist, the exact set `{c: normalizeTokenChar(c) ⊆ tokenset}`, provably complete), memoized per process for speed, and the lock samples every discovered surface. r49, r48, r47, r46, r45, r44, r43, r42, r41, r40, r39, and r30–r38 are all preserved, on per-string / deep / joined-array / `/invoke` / `/stream` (success + error).

### The token axis — and thus the whole seam class — is now closed BY CONSTRUCTION
- **Position** — every whitespace-tolerant grammar position is enumerated (P1–P10) and locked by the grammar-derived parity test.
- **Token** — the flank predicate IS the grammar's actual normalization (`normalizeTokenChar` = NFKC ∪ explicit folds), and the classes are the EXACT full-Unicode-scan set `{c: normalizeTokenChar(c) ⊆ tokenset}` — no allowlist, provably complete; the lock reverses the same full scan, so any code point the grammar accepts (fullwidth, subscript, superscript, mathematical, circled, Roman, archaic, modifier-letter, squared, any `\p{Nd}` script, any future NFKC entry) is inherited by the decoder and exercised by the lock automatically.
- **Representation** — every seam is decoded by the one by-construction `decodeSeamRun` (real / code-point escapes incl. surrogate pairs + mixed literal-escaped / short named escapes), with non-seam escapes, malformed/lone surrogates, and prose backslashes left untouched.

The only accepted, documented residuals remain the r30 spaced-separator BARE-NUMERIC outline and the r44 book+chapter-in-a-code-literal fail-safe over-flag — both deliberate, both consistent across all representations.

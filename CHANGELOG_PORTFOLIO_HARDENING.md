# Changelog — Portfolio Hardening (2026-07-18)

Branch `claude/portfolio-hardening-2026-07-18`. Local commit only — not pushed, merged, or deployed.

## User-visible / behavioural changes

### Scripture trust now covers every AI-generated content type (not just sermons)
- Server-side Scripture validation and honest trust-state storage were extended from **Sermon** to **Bible Study, Quiz, Reading Plan, Christian-Ethics Analysis, and Study Note**.
- For these types the server now **recomputes `scripture_validation` itself** (ignoring any value the client sends), **strips review-only trust fields** (`pastor_reviewed`, `ready_to_present`, `reviewed_by`, `reviewed_at`, `verified`) so AI output can never self-certify, and **blocks publishing** a record whose references don't all verify.
- Honesty preserved: deuterocanonical references remain **chapter-checked only** and are never reported as fully verified.
- A hallucinated or out-of-range reference in a saved Bible study / quiz / plan / ethics analysis is now caught and recorded honestly, exactly as it already was for sermons.

### Smaller initial download
- The landing page no longer eagerly preloads the PDF-export and charting libraries (~1 MB). They now load only when you open the Analytics, Quiz-export, or Bible-Maps screens. No feature changes; first paint is lighter.

### Contact metadata
- The package `author` email was corrected to the owner-monitored address (`dr.johnwhite@axiombiolabs.org`).

## Internal / maintenance
- Node/npm engine ranges pinned to bounded majors: `node >=20 <25`, `npm >=10 <12` (were unbounded `>=20` / `>=10`).
- Browser-target data refreshed (`caniuse-lite` 30001766 → 30001806); lockfile only.
- New tests: `services/api/src/__tests__/entitiesScriptureGateExtended.test.js` (+11) and additions to `apps/web/src/lib/scriptureRefs.test.js` (+4).

## Compatibility & migration
- **No database migration.** `scripture_validation` was already a stored field; it is simply now computed for more types. Existing records are unaffected until their next save, at which point they gain a server-computed validation.
- **No API contract break.** New behaviour only *adds* server-side recomputation/stripping on the existing `POST/PUT /api/entities/:type` paths. Clients that never sent trust fields are unaffected.
- **Review acknowledgment is unchanged** — still Sermon-only (`POST /api/entities/Sermon/:id/review`); the newly gated types are forgery-protected at save but do not expose the pastoral-review endpoint.
- **Bundle change is build-time only** (`vite.config.js` `manualChunks`); no runtime behaviour or offline/native path changed.

## Follow-up pass — closed 4 gate bypasses (2026-07-18)
- **Public/shared content is now gated like publishing.** A Bible study, reading plan, quiz, or note with an unverified reference can no longer be made public/shared (`is_public`, `visibility:'public'`, etc.) — the same 422 that already blocked publishing now covers every public/share transition. Private drafts with imperfect references still save.
- **Cross-type edits are rejected.** Updating a record through the wrong type in the URL now returns 404; validation and the Scripture gate always use the record's stored type, closing a path that skipped the gate.
- **Stale "verified"/"reviewed" markers are cleared on edit.** A record that somehow carried a trust marker it shouldn't (legacy/migrated data) has it removed whenever it is saved and re-validated.
- **Streamed drafts are screened for fabricated Scripture.** A live-generated draft containing a reference that is invalid in every tradition (e.g. a non-existent book) is no longer shown as a finished, trusted result; the client discards it and regenerates. No behaviour change for clean drafts. No API break (the stream result trailer gained an optional `scripture` field; older clients ignore it).

## Round-3 pass — closed 2 more exposure surfaces + centralized the gate (2026-07-18)
- **Share links now enforce the Scripture gate.** A sermon, study, or plan with an unverified reference can no longer be exposed by a share link — blocked both when the link is created and when it is opened (so a record shared while valid and later edited to invalid is also caught). Share links whose type doesn't match the resource are rejected.
- **Community "shared" content is gated like everything else.** Public community posts (SharedContent) now have their Scripture re-checked and any forged "verified" marker stripped before they can go public; the same applies when a moderator makes something public.
- **Durable fix:** the Scripture/trust gate now lives in one shared module that the entity save path, the share-link routes, and the community routes all call — so these surfaces can't drift apart in the future. No API break; no user-facing behavior change for valid content.

## Round-4 pass — AI forum replies gated + public feeds re-validate at serve (2026-07-18)
- **AI-generated forum replies are now Scripture-checked.** An AI reply posted to a discussion thread with a reference that can't be verified is rejected, and any such reply is hidden from the thread. Replies written by people are unaffected.
- **Public community feeds re-check content when serving it.** The shared-content feed, the public reading-plans feed, and discussion threads now re-validate each item as it's served and quietly drop anything that was edited into an invalid state after it went public (fail-closed). No change for valid content.

## Round-5 pass — shared-sermon copies gated + interaction responses fail closed (2026-07-18)
- **Shared sermon/series copies are now Scripture-checked.** When a sermon is shared to the community as a copy, an unverified reference in it is blocked at creation and at share time — a shared copy can no longer surface fabricated Scripture that the original kept private.
- **Community like/report/save no longer leak withheld content.** If a public post was pulled from the feed for an unverified reference, liking/reporting/saving it now returns only the interaction result (counts) — never the flagged content body.
- Full coverage confirmed: every AI-generated Scripture-bearing content type and every route that returns such content now runs through one shared gate.

## Rollback
- Revert the branch (or the single commit `fix: harden sermonsmith against confirmed contract violations`). No data backfill or migration to undo.
- To restore the previous chunking, re-add `vendor-charts`/`vendor-pdf`/`vendor-maps` to `manualChunks` in `apps/web/vite.config.js`.
- To restore Sermon-only gating, reset `SCRIPTURE_GATED_TYPES` to `new Set(['Sermon'])` in `services/api/src/routes/entities.js`.

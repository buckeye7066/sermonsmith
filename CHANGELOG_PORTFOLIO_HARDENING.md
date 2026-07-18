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

## Rollback
- Revert the branch (or the single commit `fix: harden sermonsmith against confirmed contract violations`). No data backfill or migration to undo.
- To restore the previous chunking, re-add `vendor-charts`/`vendor-pdf`/`vendor-maps` to `manualChunks` in `apps/web/vite.config.js`.
- To restore Sermon-only gating, reset `SCRIPTURE_GATED_TYPES` to `new Set(['Sermon'])` in `services/api/src/routes/entities.js`.

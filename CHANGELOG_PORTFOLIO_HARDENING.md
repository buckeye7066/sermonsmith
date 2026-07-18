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

## Round-6 pass — sermon validator now checks every prose field; /invoke parity (2026-07-18)
- **The sermon Scripture check now covers the whole sermon.** Previously it only checked the anchor passage, supporting scriptures, and conclusion; a fabricated reference tucked into the big idea, theological notes, or a point's exegesis/application/illustration slipped through. It now scans the entire sermon, so those are caught on publish and on shared links.
- **AI replies posted through the raw data API are checked too** (not just the forum reply button).
- **The non-streaming AI endpoint now screens for fabricated Scripture** just like the streaming one — a draft with an unverifiable reference is rejected instead of returned as finished. No change for valid content.

## Round-7 pass — case-insensitive Scripture detection + all-canon AI screen (2026-07-18)
- **Fixed the root of all the gates: reference detection is now case-insensitive.** Previously a reference written in lowercase (e.g. "hezekiah 4:5") was not detected at all, so it slipped past every check. All checks now catch it regardless of capitalization, while ordinary prose like times ("at 3:30") and ratios ("2:1") is still ignored.
- **The live-AI Scripture screen now checks all traditions.** An impossible deuterocanonical reference (e.g. "Wisdom 99:1") is now rejected in the non-streaming and streaming AI paths, while genuine deuterocanonical references still pass. No change for valid content.

## Round-8 pass — reference detection now understands citation formatting (2026-07-18)
- **Scripture detection now handles the many ways a reference can be written.** Abbreviations ("Gen. 1:1", "1 Cor 13:4"), spaces around the colon ("hezekiah 4 : 5"), roman-numeral and worded prefixes ("II John", "First John"), and unicode/fullwidth characters are all recognized and normalized. Previously these variants were invisible to the checks, letting a fabricated reference through. A key correctness win: "II John 1:20" is now correctly checked against 2 John (which has no verse 20) instead of being misread as the Gospel of John. Ordinary prose like times and ratios still isn't mistaken for a reference.

## Round-9 pass — the AI Scripture screen now checks the decoded response (2026-07-18)
- **The live-AI Scripture screen now inspects the actual decoded content.** Previously it scanned only the raw response text, so a reference hidden with JSON escape codes (which decode to a real reference on the user's screen) slipped past. Both the non-streaming and streaming AI paths now check the decoded, fully-parsed response (including nested fields), matching the depth of the save-time checks. No change for valid content.

## Round-10 pass — streaming always reports its validation; split citations caught (2026-07-18)
- **The streaming AI endpoint now always reports whether its output validated.** Previously the pass/fail signal was optional, so an older or misbehaving client could receive a streamed draft — including a fabricated reference — with no indication it hadn't been checked. Streaming now requires clients to opt into (and honor) the validation result; anything else is directed to the non-streaming, fully-checked endpoint.
- **References split across list items are now caught.** A citation broken into pieces (e.g. "Hezekiah" and "4:5" as separate list entries) that the app would rejoin for display is now recombined and checked on the server, and responses that put a list where plain text was expected are rejected. No change for valid content.

## Round-11 pass — streaming reports its result even when the AI errors mid-stream (2026-07-18)
- **A streamed AI response now always reports its validation result, even if the underlying model connection fails partway through.** Previously, an error after streaming began could drop the pass/fail signal, and the app would treat the half-finished text (possibly containing a fabricated reference) as a completed answer. Now the server always appends a failure result on error, and the app treats any missing result signal as a failure and retries instead of showing unvalidated content. No change for successful responses.

## Round-12 pass — streaming trusts only an explicit "all clear" (2026-07-18)
- **The app now accepts a streamed AI answer only when the server explicitly confirms it passed every check.** Previously an incomplete or ambiguous validation result could be treated as success; now anything short of a full, explicit pass is retried instead of shown.
- **A slow/unavailable audit log can no longer swallow the failure signal** — the validation result is always sent to the app first, and record-keeping happens afterward.
- **The failure result on a mid-stream error is now checked as thoroughly as a normal one** (including references split across list items), so a fabricated citation is flagged even when the model connection drops right after producing it.

## Rollback
- Revert the branch (or the single commit `fix: harden sermonsmith against confirmed contract violations`). No data backfill or migration to undo.
- To restore the previous chunking, re-add `vendor-charts`/`vendor-pdf`/`vendor-maps` to `manualChunks` in `apps/web/vite.config.js`.
- To restore Sermon-only gating, reset `SCRIPTURE_GATED_TYPES` to `new Set(['Sermon'])` in `services/api/src/routes/entities.js`.

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

## Round-13 pass — the app only trusts a clean, well-formed "all clear" (2026-07-18)
- **The app now verifies the streaming validation result is exact and self-consistent before trusting it.** A result that claims success but includes contradictory evidence (e.g. says it's clean yet reports a fabricated reference), carries unexpected extra fields, or has duplicated/tampered fields is now rejected and retried, rather than accepted. No change for genuine successful responses.

## Round-14 pass — closes two ways a tampered "all clear" could sneak through (2026-07-18)
- **A validation result that repeats a field using disguised (unicode-escaped) spellings is now caught and rejected** — previously such a trick could flip a failure into a fake success.
- **A success result must now include its supporting evidence (how many references were checked, and zero fabricated)** — a result that omits the evidence is no longer trusted. No change for genuine successful responses.

## Round-15 pass — the AI can no longer fake its own "all clear" (2026-07-18)
- **The signal that tells the app a streamed answer passed validation is now unforgeable.** Previously, the AI's own output could imitate that signal; if the connection dropped at the wrong moment, the app could mistake the AI's imitation for a genuine server confirmation and show unvalidated content. The server now guarantees only it can produce the signal (and marks it with a private token the model doesn't know), and the app rejects anything that isn't the genuine server-produced confirmation. No change for genuine successful responses.

## Round-16 pass — closes an escaped-character evasion and strengthens the trailer token (2026-07-18)
- **A reference hidden with an escaped control character is now caught.** The AI could previously split a fabricated reference using an invisible control character that survived until the response was decoded; the checks now normalize those characters so the reference is recombined and flagged.
- **The token that authenticates the streaming validation result is now unique per response and delivered privately** (in a response header the AI never sees), instead of a fixed value baked into the app. An echoed or guessed token no longer works. No change for genuine successful responses.

## Round-17 pass — closes invisible-character evasions in reference detection (2026-07-18)
- **A fabricated reference split by an invisible character is now caught.** Beyond the control characters handled previously, references hidden using zero-width spaces, joiners, the byte-order mark, soft hyphens, and other invisible formatting characters are now normalized so the reference is recombined and flagged — on both the streaming and non-streaming AI paths. No change for genuine references or ordinary text.

## Round-18 pass — closes the remaining invisible-character split trick (2026-07-18)
- **References split by other invisible characters — variation selectors, joiners, and similar zero-width marks — are now caught too.** This completes the invisible-character coverage from the previous round on both the streaming and non-streaming AI paths. No change for genuine references or ordinary text (including emoji).

## Round-19 pass — completes invisible-character coverage in reference detection (2026-07-18)
- **References split by combining marks (accents and enclosing marks placed between characters) are now caught too**, completing the invisible/zero-width character coverage on both the streaming and non-streaming AI paths. Safe by design: it only affects what the checker sees, never stored or displayed text, and can only make a hidden reference easier to catch. No change for genuine references or ordinary (including accented) text.

## Round-20 pass — fixes a false alarm on accented text from the previous round (2026-07-18)
- **Ordinary accented words (like "café" or "résumé") followed by a number are no longer mistaken for a fabricated reference.** The previous round's invisible-character handling was too aggressive and could turn accented prose into a false citation; the text is now standardized first (so real accents stay part of the word) and the hidden-character handling only applies right where a book name would meet a chapter number. Genuinely hidden separators are still caught. No change for real references.

## Round-21 pass — reliably tells a hidden fake reference from an ordinary accented word (2026-07-18)
- **A fabricated Bible reference hidden with a combining mark is now caught wherever the mark is placed**, including cases where the mark merges into an accented letter. At the same time, ordinary accented words like "café" or "résumé" followed by a number are correctly left alone. The checker now recognizes when a hidden word actually looks like a Bible book name (versus a common word), which is what separates a real attack from a harmless coincidence. No change for genuine references.

## Round-22 pass — catches a hidden mark placed inside a book name (2026-07-18)
- **A hidden character placed in the middle of a Bible book name (not just at the end) is now handled correctly.** Previously such a character could break the book name apart so a real reference with an impossible chapter/verse (e.g. "John 99:1") slipped through unchecked; the name is now rejoined and the invalid reference is flagged. Ordinary accented words are still left alone, and normal references are unaffected.

## Round-23 pass — closes three remaining lookalike/hidden-character gaps (2026-07-18)
- **Look-alike characters that render as normal text are now folded before checking.** A fabricated reference disguised with a Roman-numeral character ("Ⅱ John 1:20" → 2 John, which has no verse 20) or with mathematical / full-width digit look-alikes ("John 𝟗𝟗:𝟏" → John 99:1) is now normalized to plain text in the checker and flagged. This folding is used only for detection, never for stored or displayed text.
- **A hidden character placed inside a chapter or verse number is now handled.** Previously an invisible character between two digits ("John 3:9<hidden>9", which renders as the impossible "John 3:99") let a truncated in-range number ("3:9") pass while the real out-of-range number went unseen; the digits are now rejoined so the invalid reference is caught.
- **Ordinary accented words are no longer mistaken for a reference.** The book-name matcher could previously begin in the middle of a non-ASCII word ("naïve 4:5", "L'Oréal 4:5"), producing a phantom reference ("ve 4:5"/"al 4:5") that was then flagged as fabricated; it now requires a genuine word start, so accented prose is left alone. Genuine references and every earlier round's protections are unchanged.

## Round-24 pass — closes two more look-alike gaps (2026-07-18)
- **A look-alike numeral in front of a book, split by an invisible character, is now read correctly.** A fabricated reference like a Roman-numeral "Ⅱ" (or "Ⅲ") joined to a book by a hidden character ("Ⅱ<hidden>John 1:20") was previously read as plain "John" and passed; it is now correctly understood as "2 John 1:20" (which has no verse 20) and flagged. Genuine references such as "II John 1:1" are unaffected.
- **Non-Western numerals are now understood.** A reference written with Arabic-Indic or Devanagari digits ("John 3:٣٧", "John ٩٩:١") looks like a normal — and impossible — chapter/verse to a reader but previously matched nothing, so it slipped through; all numeral systems are now converted to standard digits before checking, so out-of-range references are caught while genuine ones (in any numeral system) still validate. This affects only the checker's copy, never stored or displayed text. All earlier rounds' protections and the accented-word handling are preserved.

## Round-25 pass — completes the numeral / prefix grammar (2026-07-18)
- **Every numeral system is now covered, not just the common ones.** The digit conversion is now derived automatically for every decimal-digit system the platform's Unicode version knows (including newer ones like Kawi and Nag Mundari), so a reference hidden with any exotic numeral ("John 𑽓:𑽓𑽗") is converted and checked. Verified by a test that sweeps every decimal-digit character.
- **References written with Roman numerals are now checked.** A chapter or verse given as a Roman numeral ("John III:37", "John 3:XXXVII", "II John I:XX", and the single-character Roman forms like "Ⅲ") is now converted to a number and range-checked, instead of matching nothing and passing. Ordinary prose is protected (a Roman numeral is only read in the chapter/verse position right after a book, and it can't be the start of a longer word).
- **Compact and hyphenated numbered-book references are now bound correctly.** Forms like "2John", "2-John", "2.John", and "IIJohn" are now understood as "2 John" and checked, and "2-John" can no longer slip through as a plain, valid "John". Real book names that merely start with a numeral letter (like "Isaiah") are never split, and a hyphenated non-book (like "pseudo-John") is not mis-bound to a numbered book. All earlier rounds' protections and false-positive handling (café/résumé/naïve) are preserved. With this, the numeric/prefix grammar for reference detection is comprehensively closed.

## Round-26 pass — closes the last under-flagging gaps in the reference grammar (2026-07-18)
- **A book run together with its chapter and verse (no space) is now caught.** References like "John3:37", "Jn3:37", or a fabricated "Hezekiah4:5" — where the book name touches the numbers with no space — are now recognized and checked, while an ordinary word touching digits ("cafe4:5") is deliberately left alone.
- **A number run together with a fabricated book name is now caught.** A made-up numbered reference like "2Hezekiah 4:5" or "2-Hezekiah 4:5" is now recognized and flagged as an invalid book, instead of being dropped. Real book names are still never split (e.g. "Isaiah" is untouched).
- **Malformed Roman numerals can no longer masquerade as valid references.** A Roman numeral that isn't well-formed (like "IIV") is no longer quietly turned into a number ("John IIV:1" is no longer read as "John 5:1"), and a malformed Roman range end ("John 3:1-IIV") is no longer silently trimmed to a clean, valid reference — both are now flagged. Well-formed Roman numerals ("III", "IV") still work. All earlier rounds' protections and false-positive handling are preserved. With this the reference-detection grammar is comprehensively closed against known under-flagging (bypass) vectors.

## Round-27 pass — closes two adjacent gaps the round-26 fixes exposed (2026-07-18)
- **An impossibly large chapter or verse number is no longer dropped.** A reference with a very long number ("John 1000:1", "John 3:99999") used to disappear before checking because the matcher only accepted short numbers; the full number is now read and correctly flagged as out of range. The same applies to an over-long Roman range end ("John 3:1-IIIIIIIIIIIIIIII") — it is no longer silently trimmed to a clean "John 3:1".
- **Spelled-out numbered-book prefixes joined by a hyphen or dot are now bound.** References like "Second-John 1:20", "Third.John 1:20", "First-John 5:22", and "SecondJohn 1:20" are now understood as 2/3/1 John (and range-checked) instead of slipping through as a plain "John" reference — including when the reference is split across a list ("Second-John", "1:20"). Spaced forms ("Second John 1:1") and real book names ("Isaiah") are unaffected. With this, all prefix forms (numeric / Roman / spelled-out, spaced / compact / hyphen / dot, valid / fabricated) and full-length numbers are covered; the number-and-prefix grammar is comprehensively closed.

## Round-28 pass — closes two "reinterpret-as-shorter-valid" bypasses (2026-07-18)
- **An out-of-range numbered-book number is no longer quietly dropped.** A reference with an unsupported prefix on a numbered book — "4 John 1:1", "٤ John 1:1" (Arabic 4), "Ⅳ John 1:1" (Roman four), "Fourth-John 1:1", "4John 1:1" — used to be reinterpreted as a plain, valid "John 1:1". It is now correctly identified as a made-up book (there is no 4 John) and flagged, in every prefix form and when split across a list. A stray number in front of an ordinary (non-numbered) book, like "5 Psalms 119:1", still reads as the valid "Psalms 119:1".
- **A number with trailing garbage is no longer trimmed to its valid part.** A chapter/verse/range with letters stuck on the end — "John 3:16I", "Psalms 119:176I", "John 3:1-5abc" — is no longer accepted by silently dropping the letters; the whole reference is flagged as malformed. A citation followed by a real word after a space ("John 3:16 is …") is unaffected. This completes the design: full-token extraction plus a strict validator that classifies every malformed or unsupported form — no truncation-to-valid, no bare-book fallback.

## Rollback
- Revert the branch (or the single commit `fix: harden sermonsmith against confirmed contract violations`). No data backfill or migration to undo.
- To restore the previous chunking, re-add `vendor-charts`/`vendor-pdf`/`vendor-maps` to `manualChunks` in `apps/web/vite.config.js`.
- To restore Sermon-only gating, reset `SCRIPTURE_GATED_TYPES` to `new Set(['Sermon'])` in `services/api/src/routes/entities.js`.

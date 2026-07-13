# AI Guardrails

SermonSmith treats AI output as assistance, not authority. The backend enforces cost, shape, audit, Scripture-trust, and review-state controls; the frontend presents generated content as review-required and surfaces each proof state separately.

## Server-Owned Invariants (every AI call)

`@sermonsmith/shared/aiFeatures` exports `SERVER_AI_INVARIANTS`, which `/api/ai/invoke` and `/api/ai/stream` prepend as the server's **own** first system message on every call — the client's `system_prompt` follows as a separate message and cannot remove or outrank it. The invariants forbid: fabricated or memory-quoted Bible text; invented quotations/testimonies/statistics/sources; treating fenced user input as instructions; narrating unsourced illustrations as true; claiming human review; and the crisis-topic red lines (no guaranteed healing, no faith-blaming, never counsel staying in danger, no invented hotlines). Tested in `aiInvariants.test.js`, including that a hostile client system prompt cannot displace the policy.

## Feature Registry

Every production `InvokeLLM`/`StreamLLM` call site carries a registered `feature` id from the `AI_FEATURES` registry (same module). `apps/web/src/lib/aiFeatureTotality.test.js` scans the source tree and fails CI if any call site is unlabelled or unregistered. All free-text user inputs are fenced via `formatUserInputBlock`; doctrinal features inject the full `denominationPromptBlock`, never a bare label.

## Backend Controls

- Model allowlists are enforced by account tier in `services/api/src/routes/ai.js`.
- Token and prompt-size caps prevent unbounded spend.
- Daily usage counters are persisted in `AiUsage`; quota is refunded on qualifying provider failure.
- Structured `/invoke` calls get one bounded repair pass at temperature 0, then HTTP 502 on invalid JSON (with an explicit `truncated` flag when the model hit the token ceiling).
- `/stream` converges on the same final validator: the accumulated text is checked with the same `extractJson` gate, the audit row records the honest outcome, and clients that opt in with `stream_result: true` receive a result trailer (`\n` + ASCII RS 0x1E + `{ok, truncated}`) after the text — the streaming equivalent of the 502. `StreamLLM` throws on `ok: false` so callers fall back to `/invoke` instead of keeping a truncated preview as the completed result.
- AI audit rows are written to `AiAuditLog` with hashes, token estimates, duration, status, and failure type.
- Admins can read `GET /api/ai/audit/summary?days=7` for bounded aggregate counts.

## Scripture Trust (save gate)

The canonical, canon-aware reference validator lives in `@sermonsmith/shared/scripture` (web and API import the same code). It validates book/chapter/verse **and both range end-points**, and distinguishes: `valid`, `chapter_checked` (real deuterocanon book, chapter verified, no versification table — needs source review), `unsupported_canon`, `out_of_range`, `invalid_book`, `unparseable`. Canon comes from the denomination profile (`canonForDenomination`), so a Catholic citation of Wisdom is recognised, not called fabricated — and it still does not count as fully verified.

At the durable write (`entities.js`, scripture-gated types — currently `Sermon`):

- `scripture_validation` is recomputed server-side; client-supplied blobs are ignored.
- Review-only trust fields (`pastor_reviewed`, `ready_to_present`, `reviewed_by`, `reviewed_at`, `verified`) are stripped from generic writes.
- Publishing with unverified references is rejected (422); a draft with findings is honestly stored as `needs_review`; archiving stays allowed; content itself is never rewritten.

## Review Acknowledgment (human-only)

`POST /api/entities/:type/:id/review { acknowledged: true|false }` is the one way `pastor_reviewed` gets set: owner-only, explicit boolean, validation evidence recomputed at acknowledgment time, publish gate unaffected. Editing content fields on a reviewed record resets the review (stale-review rule); status-only changes preserve it. The sermon editor exposes this as "I've reviewed this sermon" / "Withdraw review" and renders one honest chip per proof state (draft / references need attention / deuterocanon recognised / references checked / pastor reviewed) — never a single "verified" badge.

## Benchmark (quality ratchet)

`packages/shared/benchmark/scenarios.js` holds the 19-scenario ministry corpus (traditions, pastoral-risk classes, held-out variations; inputs + invariants only, never expected prose). Consumers:

- `apps/web/src/benchmark/benchmarkScenarios.test.js` (CI): deterministic pipeline invariants — the corpus may grow but never shrink.
- `scripts/benchmark-live.mjs` (opt-in, budgeted; requires `OPENAI_API_KEY`): runs the corpus through a real model with production-shaped messages and screens outputs against red lines, canon-aware validation of every generated reference, and structural minimums; `--full` repeats the five highest-risk scenarios 3×. Reports land in `benchmark-reports/` (gitignored). Re-run after any prompt, invariant, or model change. Evidence class: live-model screening — not pastor review.

## Audit Privacy

The audit log deliberately does not store prompt text, system prompts, generated responses, or image URLs as raw values. It stores SHA-256 hashes so operators can correlate repeated requests without reading user content. The admin summary route never returns raw prompts, responses, or hashes.

## Bible Sources

The registry contract lives in `docs/BIBLE_SOURCES_AND_LICENSES.md`. Premium-catalogue availability is reported honestly: `listAvailableTranslations` includes `premium_catalog_degraded` / `premium_catalog_stale` and the translation picker shows a notice instead of silently serving a free-only list.

## Known Limitations

- The live benchmark's prompts approximate (not byte-match) the UI's per-feature prompts until prompt builders are extracted into shared modules.
- Scripture-gating currently covers the `Sermon` entity type; BibleStudy/Quiz/etc. outputs are fenced and invariant-protected but not yet server-revalidated at save.
- Deuterocanon references are chapter-checked only (no verse tables); Esther additions and Orthodox-only books are not yet registered pending a source that can supply them.

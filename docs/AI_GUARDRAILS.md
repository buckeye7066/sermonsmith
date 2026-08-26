# AI and Scripture integrity controls

SermonSmith treats generated material as editable assistance. It does not label generated theology, quotations, or citations as authoritative merely because a model returned structured JSON.

## System invariants

1. **Structured output is untrusted input.** API and web callers parse, normalize, and validate model output against an explicit schema.
2. **User text stays delimited.** Prompt helpers keep user-provided material separate from system instructions and schema directions.
3. **Scripture references are checked mechanically.** Persisted AI-assisted entities are scanned for book, chapter, verse, and quotation issues.
4. **Public exposure fails closed.** Publishing and public sharing are blocked when a Scripture citation is invalid or its wording provenance is unavailable.
5. **Private drafts remain usable.** A failed integrity check does not erase a private draft. The response includes specific problems so the owner can correct them.
6. **The owner controls the workflow.** Save, present, publish, and share are separate explicit actions. No model or background task makes those choices for the owner.
7. **Provider limits are visible.** Unsupported translations, unavailable providers, fabricated citations, and wording mismatches keep their distinct statuses.

## Scripture coverage

The canonical book catalog in `packages/shared/scripture/index.js` is the source for names, aliases, OSIS codes, and chapter counts. The Reader route canonicalizes incoming names and rejects unknown books or book-specific chapter overflow before any upstream request.

`services/api/src/__tests__/functions.test.js` traverses all 66 books and all 1,189 chapters for each bundled public-domain source (KJV, WEB, and ASV). The test asserts 3,567 successful source requests with no fallback, plus explicit unknown-book and overflow failures.

## Persisted-entity gate

`services/api/src/services/scriptureGate.js` runs on create, update, publish, and share paths for persisted AI-assisted content. Its result contains machine-readable issues and wording provenance; a single ambiguous badge is not used.

Old entities may contain metadata from a retired workflow. The service removes those old keys during a normal write and maps the old intermediate status to `draft`. The limited field-name references in the migration service and its behavior tests exist only to make that cleanup deterministic.

## Live-model benchmark

`scripts/benchmark-live.mjs` is an opt-in screening harness. It needs an explicitly configured provider key and writes evidence artifacts for the tested model/scenario set. Its results are evidence about that run, not proof that generated content is correct.

## Repository policy

`scripts/release-language-policy.mjs` scans every tracked text file after normalizing complete-file whitespace, hyphens, and underscores. The companion Node test includes wrapped-phrase probes and verifies that the legacy-field exception stays confined to the cleanup service and its two behavior suites.

## Known limits

- Premium translation sources depend on provider credentials and content licensing.
- Live-model quality changes with the configured provider and model.
- Automated Scripture checks cannot adjudicate theological interpretation.
- Media transcription uses a provider interface with an offline plain-text implementation and an
  optional OpenAI audio/video implementation. Raw upload bytes are discarded after processing;
  only the transcript, provider timestamps, editable clip proposals, safe metadata, and failure
  state are persisted. Text-only clip proposals carry no invented timestamps.

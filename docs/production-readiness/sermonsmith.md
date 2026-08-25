# SermonSmith release status

Updated: 2026-08-25.

This document records verifiable application status. It does not declare the repository complete merely because a branch builds.

## Core product path

- Bible reading: canonical 66-book catalog, book-specific chapter validation, and KJV/WEB/ASV sources.
- Sermon creation: structured topic/passage workflow, editable outline, exegesis and illustration helpers, save, pulpit view, PDF, and PPTX.
- Integrity: invalid Scripture citations fail closed for public publishing and sharing while private drafts remain editable.
- Ownership: the account owner chooses when to save, present, publish, or share.
- Reuse: sermon text can be adapted to social, bulletin, email, and short-thread formats.

## Automated evidence

- `services/api/src/__tests__/functions.test.js` covers every one of the 1,189 chapters in all 66 Reader books across the three bundled sources: 3,567 successful provider calls with no fallback.
- `apps/web/src/lib/sermonPdf.test.js` inspects generated PDF bytes and content.
- `apps/web/src/lib/sermonPptx.test.js` and `studyExport.test.js` inspect real PDF/PPTX output, Open XML relationships, content, pagination, MIME type, and filenames.
- `scripts/release-language-policy.test.mjs` proves wrapped and alternate-separator workflow phrases are caught repository-wide.
- The branch still requires its exact-head CI, Android build, security audit, and deployment preview to finish successfully before it is eligible to merge.

## Remaining product gaps

The dated competitive matrix at `docs/COMPETITIVE-MATRIX-2026-08-25.md` records official sources, concrete implementation/test mappings, and current gaps. Dated preaching calendar, immutable document history, reusable sermon templates, and media transcription/clips remain product work.

## External prerequisites

Premium Bible providers and live AI generation require separately configured credentials and applicable licenses. Those live integrations cannot be proven by an unauthenticated pull-request runner; unavailable providers must remain explicit and fail closed.

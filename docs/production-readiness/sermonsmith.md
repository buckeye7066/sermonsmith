# SermonSmith release status

Updated: 2026-08-25.

This document records verifiable application status. It does not declare the repository complete merely because a branch builds.

## Core product path

- Bible reading: canonical 66-book catalog, book-specific chapter validation, and KJV/WEB/ASV sources.
- Sermon creation: structured topic/passage workflow, editable outline, exegesis and illustration helpers, save, pulpit view, PDF, and PPTX.
- Integrity: invalid Scripture citations fail closed for public publishing and sharing while private drafts remain editable.
- Ownership: the account owner chooses when to save, present, publish, or share.
- Reuse: sermon text can be adapted to social, bulletin, email, and short-thread formats.
- Planning: dated drag/drop sermon calendar with a keyboard date control, plus reusable sermon and series templates.
- Recovery: immutable snapshots before each sermon/series/study save, tenant-scoped history, and reversible restore.
- Media reuse: transient upload bytes, provider-based transcription, timestamp-grounded or transcript-only clip proposals, saved failure state, and sermon-draft creation.
- Native export: PDF/PPTX files are persisted through Capacitor and handed to the operating-system file/share sheet on Android/iOS.

## Automated evidence

- `services/api/src/__tests__/functions.test.js` covers every one of the 1,189 chapters in all 66 Reader books across the three bundled sources: 3,567 successful provider calls with no fallback.
- `apps/web/src/lib/sermonPdf.test.js` and `pdfUnicodeFont.test.js` inspect generated PDF bytes, embedded Unicode mapping, and Greek/Hebrew source-language handling.
- `apps/web/src/lib/sermonPptx.test.js` and `studyExport.test.js` inspect real PDF/PPTX output, Open XML relationships, content, pagination, MIME type, and filenames.
- `services/api/src/__tests__/entityRevisions.test.js`, `media.test.js`, and `mediaTranscription.test.js` cover recovery, isolation, transient media, provider selection, and failure states.
- `apps/web/src/lib/sermonCalendar.test.js`, `sermonTemplates.test.js`, `mediaDrafts.test.js`, `downloadBlob.test.js`, and `components/sermon/PlanningWorkflows.test.jsx` cover planning, template sanitization, reuse, and native file persistence.
- `scripts/release-language-policy.test.mjs` proves wrapped and alternate-separator workflow phrases are caught repository-wide.
- The branch still requires its exact-head CI, Android build, security audit, and deployment preview to finish successfully before it is eligible to merge.

## Remaining configuration boundaries

The dated competitive matrix at `docs/COMPETITIVE-MATRIX-2026-08-25.md` records official sources and concrete implementation/test mappings. Live audio/video transcription, premium Bible sources, and AI generation still depend on separately configured credentials and applicable licenses. PDF output embeds a redistributable DejaVu Sans face and exercises Greek/Hebrew text plus bidi handling; broader script families require additional licensed fallback fonts and shaping tests before being claimed.

## External prerequisites

Premium Bible providers and live AI generation require separately configured credentials and applicable licenses. Those live integrations cannot be proven by an unauthenticated pull-request runner; unavailable providers must remain explicit and fail closed.

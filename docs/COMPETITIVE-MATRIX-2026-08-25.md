# SermonSmith competitive capability matrix

Research date: 2026-08-25. The evidence rank favors official product documentation with concrete workflow detail over marketing-only descriptions. This is a capability audit, not a claim that every operational concern is complete.

## Evidence-ranked competitors

| Rank | Product | Official evidence | Confirmed capability used for comparison | SermonSmith implementation | Automated evidence | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Logos Sermon Builder | [Sermon Builder guide](https://support.logos.com/hc/en-us/articles/360016747391-Writing-Sermons-Using-Sermon-Builder), [sermon tools guide](https://support.logos.com/hc/en-us/articles/20993014297101-Logos-Tools-for-Great-Sermons) | Structured manuscript, passage blocks, sermon metadata, preaching view, slide/PowerPoint output, document history | Structured builder in `apps/web/src/pages/SermonBuilder.jsx`; canonical Reader route in `services/api/src/routes/functions.js`; pulpit view in `apps/web/src/components/sermon/PresentationMode.jsx`; client-side PDF and PPTX in `apps/web/src/lib/sermonPdf.js` and `sermonPptx.js` | `services/api/src/__tests__/functions.test.js`; `apps/web/src/components/sermon/PresentationMode.test.jsx`; `apps/web/src/lib/sermonPdf.test.js`; `apps/web/src/lib/sermonPptx.test.js` | Implemented except document history |
| 2 | Sermonary | [Product overview](https://sermonary.com/), [editor](https://sermonary.com/editor/), [podium mode](https://sermonary.com/podium-mode/) | Block-oriented editor, templates, built-in Scripture, podium timer, presentation export | Section-based sermon editor; built-in Bible Reader; timed pulpit view; PPTX export | `services/api/src/__tests__/functions.test.js`; `apps/web/src/components/sermon/PresentationMode.test.jsx`; `apps/web/src/lib/sermonPptx.test.js` | Implemented except reusable sermon templates |
| 3 | Ministry Pass | [Series Planner](https://ministrypass.com/seriesplanner/), [sermon calendars](https://ministrypass.com/sermon-series-sermon-calendars/) | Topic/book planning, series search, drag-and-drop preaching calendar, team sharing | Three-to-twelve-week series outline generation and shared group workspaces | `apps/web/src/pages/SermonBuilder.test.jsx`; API entity/community suites | Partial: series planning exists; dated drag-and-drop calendar does not |
| 4 | Pulpit AI | [Official product page](https://www.pulpitai.com/) | Media upload, transcription, clips, discussion/devotional/blog/newsletter reuse | Text-based sermon adaptation creates social posts, bulletin blurbs, email newsletters, and short threads in `apps/web/src/components/sermon/SermonAdaptation.jsx` | AI schema/invariant suites cover structured generation; no dedicated adaptation component suite | Partial: text reuse exists; media ingestion, transcription, and clips do not |
| 5 | Sermonly | [Official product page](https://www.sermon.ly/), [pricing and capabilities](https://www.sermon.ly/pricing) | Distraction-free preaching, built-in translations, templates, tags, AI assistance | Timed pulpit view, built-in KJV/WEB/ASV Reader, library tags, structured AI drafting | `apps/web/src/components/sermon/PresentationMode.test.jsx`; `services/api/src/__tests__/functions.test.js`; web and API AI suites | Implemented except reusable sermon templates |

## Core-path coverage added in this change

- The Reader validates canonical book names and book-specific chapter bounds before fetching. The provider test traverses every one of the 66 books and all 1,189 chapters for KJV, WEB, and ASV: 3,567 successful source requests with no fallback.
- Sermon and Bible-study exports now create actual PDF or Open XML presentation files from the content currently on screen. Tests inspect document signatures, ZIP relationships, slide packages, escaped content, pagination, MIME types, and safe filenames. LibreOffice headless smoke tests also opened both generated decks and converted them to PDF.
- Save, present, publish, and share remain owner-controlled actions. Scripture exposure checks automatically block invalid citations from public publishing/sharing without adding another workflow state.

## Known product gaps after this change

| Gap | Why it remains | Next bounded increment |
| --- | --- | --- |
| Dated preaching calendar | Series outlines do not yet have scheduled cards or drag-and-drop dates | Add a calendar entity, date editor, reorder interaction, timezone tests, and mobile interaction coverage |
| Document history | Entity edits overwrite the current document | Add immutable revisions, restore semantics, author/time metadata, retention policy, and concurrency tests |
| Reusable sermon templates | Current structured generation is not a user-managed template library | Add template CRUD, import/export, starter templates, and application tests |
| Media-to-content workflow | Current reuse begins with sermon text, not audio/video | Add resumable upload, transcription provider abstraction, consent/retention controls, and clip boundaries |

Premium translation sources and AI generation still require configured third-party credentials and applicable content licenses. Those external prerequisites cannot be validated from an unauthenticated pull-request environment; the application must continue to fail closed and label unavailable provider output accurately.

# SermonSmith competitive capability matrix

Research date: 2026-08-25. The evidence rank favors official product documentation with concrete workflow detail over marketing-only descriptions. This is a capability audit, not a claim that every operational concern is complete.

## Evidence-ranked competitors

| Rank | Product | Official evidence | Confirmed capability used for comparison | SermonSmith implementation | Automated evidence | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Logos Sermon Builder | [Sermon Builder guide](https://support.logos.com/hc/en-us/articles/360016747391-Writing-Sermons-Using-Sermon-Builder), [sermon tools guide](https://support.logos.com/hc/en-us/articles/20993014297101-Logos-Tools-for-Great-Sermons) | Structured manuscript, passage blocks, sermon metadata, preaching view, slide/PowerPoint output, document history | Structured builder and Reader; pulpit view; PDF/PPTX export; immutable pre-save snapshots and owner restore in `services/api/src/routes/entities.js` with `RevisionHistory.jsx` | Reader totality suite; presentation and export suites; `entityRevisions.test.js`; `PlanningWorkflows.test.jsx` | Implemented for the compared capabilities |
| 2 | Sermonary | [Product overview](https://sermonary.com/), [editor](https://sermonary.com/editor/), [podium mode](https://sermonary.com/podium-mode/) | Block-oriented editor, templates, built-in Scripture, podium timer, presentation export | Section-based editor; Bible Reader; timed pulpit view; PPTX export; user-managed sermon and series templates in `TemplateLibrary.jsx` | Reader totality, presentation, PPTX, template, and planning-workflow suites | Implemented for the compared capabilities |
| 3 | Ministry Pass | [Series Planner](https://ministrypass.com/seriesplanner/), [sermon calendars](https://ministrypass.com/sermon-series-sermon-calendars/) | Topic/book planning, series search, drag-and-drop preaching calendar, team sharing | Three-to-twelve-week series generation; shared group workspaces; dated six-week calendar with drag/drop and keyboard date controls in `SermonCalendarPlanner.jsx` | `SermonBuilder.test.jsx`; entity/community suites; `sermonCalendar.test.js`; `PlanningWorkflows.test.jsx` | Implemented for the compared capabilities |
| 4 | Pulpit AI | [Official product page](https://www.pulpitai.com/) | Media upload, transcription, clips, discussion/devotional/blog/newsletter reuse | Text adaptation plus transient media upload, provider-based transcription, timestamp-grounded or transcript-only clip proposals, saved job state, and sermon-draft reuse in `routes/media.js`, `mediaTranscription.js`, and `MediaWorkbench.jsx` | `media.test.js`; `mediaTranscription.test.js`; `mediaDrafts.test.js`; `PlanningWorkflows.test.jsx`; AI schema/invariant suites | Implemented internally; live audio/video needs configured provider credentials |
| 5 | Sermonly | [Official product page](https://www.sermon.ly/), [pricing and capabilities](https://www.sermon.ly/pricing) | Distraction-free preaching, built-in translations, templates, tags, AI assistance | Timed pulpit view, KJV/WEB/ASV Reader, tags, structured AI drafting, and reusable sermon/series templates | Presentation, Reader totality, AI, template, and planning-workflow suites | Implemented for the compared capabilities |

## Core-path coverage added in this change

- The Reader validates canonical book names and book-specific chapter bounds before fetching. The provider test traverses every one of the 66 books and all 1,189 chapters for KJV, WEB, and ASV: 3,567 successful source requests with no fallback.
- Sermon and Bible-study exports now create actual PDF or Open XML presentation files from the content currently on screen. Tests inspect document signatures, ZIP relationships, slide packages, escaped content, pagination, MIME types, and safe filenames. LibreOffice headless smoke tests also opened both generated decks and converted them to PDF.
- Native Android/iOS exports write a Capacitor file and open the operating-system file/share sheet rather than relying on a browser-only synthetic download. PPTX bodies always contain a DrawingML paragraph and paginate against an estimated rendered-line budget. PDF export embeds the redistributable DejaVu Sans TTF and uses jsPDF's Unicode bidi engine so Greek and Hebrew source-language notes remain in the generated document.
- Sermon saves create immutable prior-version snapshots; owners can inspect and restore them, and every restore creates a recovery snapshot and re-applies Scripture integrity checks.
- The sermon library now includes a dated drag/drop calendar with a keyboard date control, reusable sermon/series templates that exclude identity/lifecycle fields, and a media workbench whose raw bytes remain transient.
- Save, present, publish, and share remain owner-controlled actions. Scripture exposure checks automatically block invalid citations from public publishing/sharing without adding another workflow state.

## Configuration boundaries and bounded follow-ups

| Boundary | Current behavior | Bounded follow-up |
| --- | --- | --- |
| Live audio/video transcription | The plain-text provider is credential-free; audio/video fails explicitly when no provider is configured | Configure a permitted provider/model and run a live canary with non-sensitive fixture media |
| Media size | Uploads are bounded at 25 MiB and raw bytes are discarded | Add resumable multipart transport if field recordings routinely exceed the provider limit |
| PDF script coverage | Bundled DejaVu Sans plus jsPDF bidi handling covers the Greek and Hebrew source-language path; tests assert an embedded ToUnicode map | Add separately licensed fallback fonts and shaping tests before claiming coverage for CJK or other scripts outside DejaVu Sans |
| Template portability | Account-owned sermon/series templates can be created, applied, and deleted | Add explicit JSON import/export if cross-account portability becomes a requested workflow |

Premium translation sources and AI generation still require configured third-party credentials and applicable content licenses. Those external prerequisites cannot be validated from an unauthenticated pull-request environment; the application must continue to fail closed and label unavailable provider output accurately.

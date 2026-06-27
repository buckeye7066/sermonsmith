# Migration From Base44 Entities

SermonSmith still supports the generic `Entity` API so older UI paths keep working, but production data now has typed Prisma tables for durable records.

## Typed Tables

The migration `20260627_typed_content_privacy_ai_audit` adds typed tables for sermons, sermon series, sermon outlines, Bible studies, study notes, highlights, bookmarks, prayer requests, shared content, forum posts, study groups, audit logs, saved content, AI audit logs, and Bible source/cache metadata.

## Deployment Order

1. Deploy code that contains both the generic Entity API and the typed models.
2. Run `npm run db:migrate:deploy`.
3. Run `npm run db:migrate:typed` from the repo root to backfill typed rows from existing Entity rows.
4. Keep Entity writes enabled until the web app has moved each feature to typed service calls.
5. Re-run `npm run db:migrate:typed` after the web migration; the script uses upserts and is safe to repeat.

## Backfill Scope

The backfill currently maps these Entity types:

- `Sermon`
- `Series` into `SermonSeries`
- `SermonOutline`
- `BibleStudy`
- `StudyNote`
- `Highlight`
- `Bookmark`
- `PrayerRequest`
- `SharedContent`
- `ForumPost`
- `StudyGroup`

Unknown or legacy-only Entity types remain in `entities` until a product owner defines their durable schema.

## Verification

After migration:

- Compare `entities` counts by type against typed table counts.
- Spot-check user ownership on typed rows.
- Confirm public shared content still appears through `/api/community/shared-content`.
- Confirm privacy export includes both `entities` and `typed` sections.

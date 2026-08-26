# SermonSmith 2.0 installed-client migration

**Published:** 2026-08-26  
**Applies to:** web, Electron desktop, Android/iOS shells, and the API

## Why this is a major release

Version 2 removes the former intermediate lifecycle endpoint and its client
action. The supported workflow is now direct and owner controlled:

- save private work with `status: "draft"`;
- publish with `status: "published"`;
- archive with `status: "archived"`;
- create or remove a share link through the sharing API.

The API continues to accept ordinary create and update payloads from older
installed clients when they contain the retired lifecycle value. It converts
that value to `draft` and removes obsolete metadata before current-schema
validation. The removed action itself is intentionally not emulated.

## Coordinated deployment order

1. Publish the 2.0 web bundle and native shells.
2. Require installed 1.x clients to update before switching their API base URL
   to the 2.0 service.
3. Deploy the 2.0 API and database migrations.
4. Verify create, edit, publish, archive, share, and restore from each supported
   2.0 client.
5. Keep the previous 1.x API deployment available for rollback until the 2.0
   client rollout is complete.

Do not point a 1.x installed bundle at the 2.0 API. A coordinated cutover is
required because the removed lifecycle action returns `404` by design.

## Data migration

No destructive bulk rewrite is required. Existing sermon/study content remains
intact. On the next normal create or update, the centralized write boundary:

- removes obsolete lifecycle metadata;
- maps the retired intermediate value to `draft`;
- recomputes Scripture-reference integrity data;
- preserves explicit owner-controlled publish/share choices.

Revision history remains private to its source owner and is removed
transactionally when that source is deleted.

## Rollback

If the coordinated cutover must be reversed, restore both the 1.x client and
1.x API together. Do not mix client/API major versions. User-created content is
unchanged by the compatibility cleanup except for removal of obsolete metadata
on records edited through 2.0.

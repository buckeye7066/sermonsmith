# Offline And Sync Strategy

Offline support should be implemented as an explicit sync layer, not as ad hoc localStorage writes.

## Goals

- Let users read cached Bible passages and recent personal content offline.
- Queue edits locally and replay them when connectivity returns.
- Avoid duplicate writes and accidental overwrite of newer server data.
- Keep private sermon/study/prayer content encrypted at rest on the device when the platform supports it.

## Client Data Classes

| Data | Offline Read | Offline Write | Notes |
| --- | --- | --- | --- |
| Bible translations and cached passages | Yes | No | Cache by translation/reference with license metadata. |
| Sermons, studies, notes, highlights, bookmarks | Yes | Yes | Use typed IDs and server `updatedAt` for conflict detection. |
| Community content | Limited | No | Cache public feeds briefly; moderation can remove content. |
| Billing/account/admin data | No | No | Always require server freshness. |

## Sync Protocol

1. Client stores pending mutations in an ordered outbox with a stable idempotency key.
2. Each mutation includes `resourceType`, `resourceId`, `baseUpdatedAt`, operation, and patch body.
3. Server accepts idempotency keys and returns the latest row.
4. If `baseUpdatedAt` is older than server `updatedAt`, server returns HTTP 409 with the current row.
5. Client prompts the user to keep local, keep server, or merge.

## Recommended Storage

- Web: IndexedDB, with WebCrypto for sensitive payload encryption where feasible.
- Desktop: OS keychain for encryption key, SQLite/IndexedDB for payloads.
- Mobile: platform secure storage for encryption key, SQLite for payloads.

## Do Not Cache

- Password reset tokens
- Auth cookies/JWTs outside the browser or platform secure store
- Stripe customer/session objects
- Raw AI prompts or responses unless the user explicitly saved them as content

## Server Prep Already Present

- Typed Prisma models with durable ids and `updatedAt`.
- Privacy export endpoint for user-owned data inspection.
- Bible passage cache and translation metadata.
- AI audit rows that avoid raw prompt storage.

## Remaining Build Work

- Add idempotency-key columns for write endpoints that will be syncable.
- Add conflict-aware PATCH endpoints for typed content.
- Add client outbox and retry scheduler.
- Add encrypted local persistence by platform.

# Privacy And Moderation

This document describes the privacy and community safety controls now available in the API.

## Privacy Export

`GET /api/auth/export` requires authentication and returns:

- sanitized user profile without password hash
- generic Entity rows owned by the user
- typed content rows owned by the user
- export timestamp

The route records a best-effort `privacy.export` audit log entry with counts only.

## Self-Service Account Delete

`DELETE /api/auth/me` requires authentication and performs a soft delete:

- sets `deletedAt`
- increments `tokenVersion`
- clears the auth cookie
- records a best-effort `privacy.account_delete_requested` audit entry

Login and authenticated requests already reject soft-deleted users. A later purge job can hard-delete rows after the retention window required by the deployment policy.

## Community Reporting

`POST /api/community/shared-content/:id/report` lets authenticated users report public shared content. The route:

- rejects private or removed content
- validates `category` and `reason`
- increments `reported_count` and `reportedCount`
- stores the latest report summary
- marks content as `reported` after three reports
- records a best-effort `community.report` audit entry

## Moderation

`GET /api/community/moderation/queue` requires admin/dev access and returns reported or moderated shared content/forum posts.

`PATCH /api/community/moderation/:type/:id` requires admin/dev access and accepts:

- `status`: `active`, `reported`, `hidden`, `removed`, or `rejected`
- `visibility`: `private` or `public`
- `moderatorNotes`

Public community feeds hide content whose status is `hidden`, `removed`, `rejected`, or `deleted` even when `visibility` remains `public`.

## Retention Notes

Soft-deleted user records and moderation audit rows should be retained according to the operator's privacy policy. If a deployment requires full erasure, build a separate admin-only purge job that removes typed rows, Entity rows, audit rows where legally permitted, and external billing/email provider references.

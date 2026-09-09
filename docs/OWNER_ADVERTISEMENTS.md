# Owner advertisements and shared accounts

Advertisement management is available in Settings only when the authenticated database account ID exactly matches the API service's private `OWNER_USER_ID`. Set this to the existing, independently verified John White account. Do not infer ownership from a signup email, profile field, URL parameter, or a generic admin/dev role. An absent owner ID disables management. Suspended, deleted and revoked accounts remain rejected by the existing authentication middleware.

Registration always creates an ordinary user. Login preserves the stored database role and no longer promotes an unverified `ADMIN_EMAILS` claim. Existing accounts are preserved. Shared links remain read-only and return selected content without account/profile/credential metadata; they never create a session. Published citations and scripture text are preserved.

## Deployment

The additive Prisma migration creates dedicated `advertisements` and `advertisement_events` tables. The existing Railway startup migration command applies it before serving traffic. Configure `OWNER_USER_ID` privately on the API service before declaring owner management usable. Never put the ID, credentials, a session, or production advertising fixtures into frontend builds or installers. No advertisements are seeded.

## Owner workflow

Open Settings → Advertisements. Upload up to ten PNG, JPEG or WebP pictures, each no larger than 1 MB. Each is saved as a distinct creative with its filename. Set advertiser, headline, copy, destination, slide seconds, and inclusive UTC run dates. Presets support a week, two weeks, or a calendar month; custom dates and 3–120 seconds are supported. New drafts start paused. Publish, pause, edit and remove controls remain available beside each creative. Removing a creative retains its purchased-run statistics.

Images are decoded, size-limited, stripped of metadata, re-encoded as WebP, and stored in PostgreSQL. The server never fetches an arbitrary image URL. Uploaded files cannot execute as SVG or HTML. Ads appear inline on the signed-in Home page and are hidden in print. They are not part of sermon content or exports.

## Measurement

The browser counts an impression only after an image successfully loads and the slot is at least half visible in a foreground tab for a full second. Rotation pauses while hidden/offscreen. The API additionally requires a signed, short-lived display ticket bound to the creative and a keyed viewer pseudonym, rejects premature impressions, and confirms the creative is currently published and within its purchased dates.

PostgreSQL unique constraints prevent both repeated ticket delivery and repeated viewer/creative/event counts within a UTC minute, including across API replicas/restarts. These are conservative counts, not fraud-proof proof of human attention. Clicks are counted through the authenticated API before navigation. Unique viewers are pseudonymous signed-in accounts, not inferred people across devices/accounts. Event rows contain no account IDs, IP addresses, email, profile, sermon, or health data. Only aggregate totals and UTC daily counts are returned to the owner. Rotating the API signing secret changes future viewer pseudonyms.

## Verification

Unit/API tests cover real JWT authentication with DB identity fixtures, owner versus generic admin/guest roles, revoked sessions, unsafe URLs/images, date validation and display-ticket binding/expiry. The CI Postgres job runs a separate integration test covering real raster persistence, rotation/date filters, concurrent event deduplication, ticket replay in another minute, fresh-connection counts, and preserved statistics after removal. Browser tests exercise owner multi-picture uploads and reader rotation/print behavior on desktop Chromium/WebKit and Android/iPhone viewport profiles. These browser profiles do not replace native package checks, which remain in CI.

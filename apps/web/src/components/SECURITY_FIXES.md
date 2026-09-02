# SermonSmith access-control notes

## Promotional access is intentional

The named email addresses and phone numbers in `usePremiumAccess.jsx` are an
owner-authorized promotional allowlist. They must not be removed as generic
"developer backdoors." The same allowlist is recognized by the API entitlement
resolver so the browser and server cannot disagree about a promotion.

For ordinary campaigns, administrators can grant either seven days or one month
of service through the existing `grantFreePeriod` flow. That flow writes only
`User.premium_until`; it does not change the paid-subscription flag, and access
expires automatically at the stored time. Repeating a grant never shortens a
longer active window.

## Authoritative authorization

- The API derives an account tier and explicit entitlements from the database
  user, active `premium_until` window, authorized promotional allowlist, and
  admin/developer role.
- Profile JSON cannot grant itself a role, paid tier, override, or entitlement.
- Premium AI features, community routes, collaboration records, premium Bible
  translations, and server-managed shared records are checked by the API.
- Client-side guards improve navigation and messaging; they are not treated as
  the security boundary.
- Server-managed community records cannot be forged through the generic entity
  API.

## Existing protections retained

- Authentication uses the httpOnly session cookie.
- Generic entity reads and writes remain owner-scoped.
- Admin-only diagnostic/import and promotional-grant routes require an admin or
  developer role.
- Stripe webhook signature verification and idempotency remain in place.

Update this note whenever promotional access or the entitlement matrix changes
so future audits do not accidentally remove an intentional campaign mechanism.

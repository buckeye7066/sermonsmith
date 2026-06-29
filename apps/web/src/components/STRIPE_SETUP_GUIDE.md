# Stripe Launch Checklist

SermonSmith uses the Express API route `/api/functions/createCheckoutSession` for checkout, `/api/functions/createBillingPortal` for subscription management, and `/api/functions/stripeWebhook` for Stripe webhooks.

Do not treat this file as evidence that production Stripe is configured. The API now fails startup in `NODE_ENV=production` when billing is enabled and any required Stripe value is missing or shaped like a placeholder.

## Required Production Environment

Set these on the API deployment:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
FRONTEND_URL=https://your-web-app.example
CORS_ORIGIN=https://your-web-app.example
```

`FRONTEND_URL` or the first `CORS_ORIGIN` value is used for Stripe success, cancel, and billing-portal return URLs. In production, localhost and non-HTTPS redirect origins are rejected.

## Stripe Dashboard Setup

Create a live-mode webhook endpoint:

```text
https://your-api.example/api/functions/stripeWebhook
```

Select these events:

```text
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
```

Copy the live signing secret into `STRIPE_WEBHOOK_SECRET`. Test-mode and live-mode webhook secrets are different.

## What The App Updates

`checkout.session.completed` sets `premium: true` and stores `stripeCustomerId` on the user.

`customer.subscription.updated` sets `premium: true` for active/trialing subscriptions and removes paid premium for canceled/unpaid/expired subscriptions.

`customer.subscription.deleted` removes paid premium by stable `stripeCustomerId`, with an email fallback only for older accounts that subscribed before the customer id was stored.

Each processed webhook event is recorded in `StripeEvent` after the side effect succeeds, so failed events can be retried by Stripe.

## Launch Proof

Before accepting live payments:

1. Create a checkout from the live app.
2. Complete one live payment.
3. Confirm the user becomes premium in the app.
4. Open the billing portal from Settings.
5. Cancel the subscription in Stripe.
6. Confirm the cancellation webhook removes paid premium.
7. Confirm Stripe shows `200` deliveries for all webhook events.

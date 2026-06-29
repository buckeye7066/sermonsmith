# Stripe Webhook Setup

Webhook endpoint:

```text
https://your-api.example/api/functions/stripeWebhook
```

Required Stripe events:

```text
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
```

The API verifies the `stripe-signature` header with `STRIPE_WEBHOOK_SECRET`. Invalid signatures return `400`. If webhook processing fails after a valid signature, the API returns `500` so Stripe retries.

Webhook idempotency is handled by the `StripeEvent` table. Events are recorded only after the premium/customer side effect succeeds.

Production reminders:

```text
STRIPE_SECRET_KEY must be a live sk_live_ key.
STRIPE_WEBHOOK_SECRET must come from the live webhook endpoint.
STRIPE_PRICE_ID must be the live subscription price used by checkout.
FRONTEND_URL should be the public HTTPS web app URL.
```

Do not reuse test-mode webhook secrets or test-mode price ids for launch.

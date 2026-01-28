# 🔔 Stripe Webhook Setup Guide

## Overview
Your Stripe webhook is **already implemented** and ready to use! This guide shows you how to configure it in your Stripe dashboard.

---

## 📍 Webhook Endpoint URL

### Production URL:
```
https://your-app-domain.base44.com/api/functions/stripeWebhook
```

**Replace `your-app-domain` with your actual app domain.**

---

## 🔧 Setup Steps

### 1. Go to Stripe Dashboard
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **"Add endpoint"**

### 2. Configure Endpoint
- **Endpoint URL:** `https://your-app-domain.base44.com/api/functions/stripeWebhook`
- **Description:** SermonSmith Subscription Management
- **Events to send:** Select these events:
  - ✅ `checkout.session.completed` - When payment succeeds
  - ✅ `customer.subscription.deleted` - When subscription is cancelled
  - ✅ `customer.subscription.updated` - When subscription status changes

### 3. Get Webhook Signing Secret
1. After creating the endpoint, Stripe will show you a **signing secret**
2. It starts with `whsec_...`
3. Copy this secret

### 4. Add Secret to Base44
1. Go to your Base44 app dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Find `STRIPE_WEBHOOK_SECRET`
4. Paste the webhook signing secret you copied
5. Save changes

---

## ✅ What the Webhook Does

### Event: `checkout.session.completed`
**Trigger:** User completes payment  
**Action:**
- Upgrades user to `subscription_tier: 'premium'`
- Stores `stripe_customer_id` on user record
- Records event in `StripeEvent` entity for idempotency

### Event: `customer.subscription.deleted`
**Trigger:** User cancels subscription  
**Action:**
- Downgrades user to `subscription_tier: 'free'`
- Respects `premium_override` flag (won't downgrade manually granted premium)
- Records event for idempotency

### Event: `customer.subscription.updated`
**Trigger:** Subscription status changes  
**Action:**
- If status is inactive/cancelled → downgrades to free
- If status is active → keeps premium
- Respects `premium_override` flag
- Records event for idempotency

---

## 🔒 Security Features

✅ **Signature Validation**
- Every webhook request is verified using Stripe's signature
- Invalid signatures are rejected with 400 error

✅ **Idempotency**
- Each event is processed only once
- Duplicate events are automatically skipped

✅ **Service Role Access**
- Uses `asServiceRole` for database operations
- No user authentication needed (webhooks come from Stripe)

✅ **Premium Override Protection**
- Users with `premium_override: true` won't be downgraded
- Useful for lifetime access, testing, or special cases

---

## 🧪 Testing Your Webhook

### Test Mode (Recommended)
1. In Stripe Dashboard, click on your webhook endpoint
2. Click **"Send test webhook"**
3. Select an event type (e.g., `checkout.session.completed`)
4. Click **"Send test webhook"**
5. Check the response - it should show `200 OK`

### View Webhook Logs
1. In Stripe Dashboard → Webhooks
2. Click on your endpoint
3. View the **"Recent events"** tab
4. Check for successful deliveries (200 status codes)

### Check Base44 Logs
1. Go to Base44 Dashboard → Code → Functions
2. Select `stripeWebhook`
3. View logs to see webhook processing

---

## 🐛 Troubleshooting

### Webhook Returns 400 Error
**Problem:** Signature verification failed  
**Solution:**
- Verify `STRIPE_WEBHOOK_SECRET` is correctly set in Base44
- Make sure you copied the full secret (starts with `whsec_`)
- Regenerate the signing secret in Stripe if needed

### Webhook Returns 500 Error
**Problem:** Server-side error processing webhook  
**Solution:**
- Check Base44 function logs for error details
- Verify `StripeEvent` entity exists
- Verify `User` entity can be accessed with service role

### User Not Getting Premium After Payment
**Problem:** Checkout completes but user stays on free tier  
**Solution:**
- Check webhook is properly configured in Stripe
- Verify `client_reference_id` is being passed in checkout session (should be user.id)
- Check Base44 logs to see if webhook was received
- Manually check `StripeEvent` entity to see if event was recorded

### User Not Downgraded After Cancellation
**Possible Causes:**
1. User has `premium_override: true` (intentional - check user record)
2. Webhook not configured for `customer.subscription.deleted` event
3. Different Stripe customer ID than stored in user record

---

## 📊 Monitoring

### Check Webhook Health
```javascript
// Query StripeEvent entity to see recent webhook activity
const recentEvents = await base44.asServiceRole.entities.StripeEvent.list('-processed_at', 10);
console.log('Recent webhook events:', recentEvents);
```

### Verify User Subscriptions
```javascript
// Check premium users
const premiumUsers = await base44.asServiceRole.entities.User.filter({
  subscription_tier: 'premium'
});
console.log('Premium users:', premiumUsers.length);
```

---

## 🚀 Going Live

### Before Production:
1. ✅ Test webhook with Stripe test mode
2. ✅ Verify checkout flow works end-to-end
3. ✅ Test subscription cancellation
4. ✅ Verify webhook secret is set correctly

### Switching to Live Mode:
1. Create a **new** webhook endpoint for **live mode**
2. Use same URL: `https://your-app-domain.base44.com/api/functions/stripeWebhook`
3. Get the **live mode** webhook signing secret
4. Update `STRIPE_WEBHOOK_SECRET` in Base44 with the **live mode** secret
5. Test with a real payment (use a small amount like $0.50)

**Note:** Test mode and live mode use different webhook secrets!

---

## 📝 Summary

Your webhook is **ready to use**! Just:
1. Add the endpoint URL to Stripe Dashboard
2. Select the 3 events (checkout completed, subscription deleted/updated)
3. Copy the webhook signing secret to Base44
4. Test with Stripe's test webhook feature

**Status:** 🟢 **Implemented & Ready**  
**Next Step:** Configure webhook endpoint in Stripe Dashboard
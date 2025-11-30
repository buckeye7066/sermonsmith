import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 * 
 * Note: Stripe webhooks have special handling - they need raw body for signature verification
 */

Deno.serve(async (req) => {
  try {
    // Allow GET for health checks
    if (req.method !== "POST") {
      return Response.json({ ok: true, message: 'Webhook endpoint active' });
    }

    // Clone request to check for self-test
    const clonedReq = req.clone();
    try {
      const jsonBody = await clonedReq.json();
      if (jsonBody._selfTest) {
        return Response.json({ ok: true, selfTest: true, message: 'stripe-webhook is operational', data: null });
      }
    } catch {
      // Not JSON or no _selfTest, proceed normally
    }

    const stripeKey = Deno.env.get("STRIPE_API_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      return Response.json({ ok: false, error: "Stripe not configured", data: null });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    if (!signature) {
      return Response.json({ ok: false, error: "No signature", data: null }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return Response.json({ ok: false, error: err.message, data: null }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    console.log(`📨 Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (!userId) {
          console.error("❌ No user ID in checkout session");
          break;
        }

        const users = await base44.asServiceRole.entities.User.filter({ id: userId });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found: ${userId}`);
          break;
        }

        if (user.premium_override === true) {
          console.log(`⚠️ User ${userId} has premium_override - skipping`);
          break;
        }

        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: "premium",
          stripe_customer_id: session.customer,
          premium_until: null
        });

        console.log(`✅ User ${userId} upgraded to premium`);

        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: userId,
            data: { customer: session.customer }
          });
        } catch (e) {
          console.log("⚠️ Could not log event:", e.message);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found for customer: ${customerId}`);
          break;
        }

        if (user.premium_override === true) {
          console.log(`⚠️ User ${user.id} has premium_override - skipping`);
          break;
        }

        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: "free",
          premium_until: null
        });

        console.log(`✅ User ${user.id} downgraded to free`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found for customer: ${customerId}`);
          break;
        }

        if (user.premium_override === true) {
          console.log(`⚠️ User ${user.id} has premium_override - skipping`);
          break;
        }

        const newTier = status === "active" ? "premium" : "free";
        await base44.asServiceRole.entities.User.update(user.id, { subscription_tier: newTier });
        console.log(`✅ User ${user.id} subscription updated: ${status} → ${newTier}`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return Response.json({ ok: true, error: null, data: { received: true } });

  } catch (err) {
    console.error("[stripe-webhook] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    }, { status: 500 });
  }
});
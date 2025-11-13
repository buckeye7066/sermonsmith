/**
 * Stripe Webhook Handler - PRODUCTION
 * 
 * Handles Stripe webhook events for subscription management.
 * 
 * Webhook URL:
 * https://sermon-smith-0150c183.base44.app/api/stripe-webhook
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  console.log(`[Stripe Webhook] ${req.method} request received`);
  
  // Allow Stripe's validation pings (GET requests)
  if (req.method !== "POST") {
    console.log("[Stripe Webhook] GET request - validation ping");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  // Accept Stripe's pre-flight verification (no signature)
  if (!signature) {
    console.log("[Stripe Webhook] No signature - pre-flight check");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate the webhook signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[Stripe Webhook] ✅ Signature verified - Event: ${event.type}`);
  } catch (err) {
    console.error("[Stripe Webhook] ❌ Signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Connect Base44 client (service role, no user auth required)
  const base44 = createClientFromRequest(req);

  try {
    // Handle events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        
        console.log(`[Stripe Webhook] 💳 Checkout completed for user: ${userId}`);

        if (!userId) {
          console.warn("[Stripe Webhook] No user ID in session");
          break;
        }

        // Find user
        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.id === userId);

        if (!user) {
          console.error(`[Stripe Webhook] User not found: ${userId}`);
          break;
        }

        // Check premium_override
        if (user.premium_override) {
          console.log(`[Stripe Webhook] User has premium_override, skipping`);
          break;
        }

        // Grant premium
        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: "premium",
          stripe_customer_id: session.customer,
          premium_until: null,
        });

        console.log(`[Stripe Webhook] ✅ User ${userId} upgraded to premium`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log(`[Stripe Webhook] 🔴 Subscription deleted: ${subscription.customer}`);

        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.stripe_customer_id === subscription.customer);

        if (!user) {
          console.warn(`[Stripe Webhook] No user found for customer: ${subscription.customer}`);
          break;
        }

        if (user.premium_override) {
          console.log(`[Stripe Webhook] User has premium_override, keeping premium`);
          break;
        }

        // Revoke premium
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: "free",
        });

        console.log(`[Stripe Webhook] ✅ User ${user.id} downgraded to free`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log(`[Stripe Webhook] 🔄 Subscription updated: ${subscription.status}`);

        if (subscription.status === "active" || subscription.status === "trialing") {
          console.log(`[Stripe Webhook] Subscription still active, no action`);
          break;
        }

        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.stripe_customer_id === subscription.customer);

        if (!user) {
          console.warn(`[Stripe Webhook] No user found for customer: ${subscription.customer}`);
          break;
        }

        if (user.premium_override) {
          console.log(`[Stripe Webhook] User has premium_override, keeping premium`);
          break;
        }

        // Revoke premium
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: "free",
        });

        console.log(`[Stripe Webhook] ✅ User ${user.id} downgraded to free (inactive)`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Stripe Webhook] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
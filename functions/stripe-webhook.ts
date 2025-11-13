import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  // Allow verification pings (GET requests from Stripe dashboard)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  // If no signature, this is not from Stripe
  if (!signature) {
    return new Response(JSON.stringify({ error: "No signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  let event;
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const base44 = createClientFromRequest(req);

  console.log(`📨 Stripe webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (!userId) {
          console.error("❌ No user ID in checkout session");
          break;
        }

        // 🔒 SECURITY: Use asServiceRole for admin-level database updates
        const users = await base44.asServiceRole.entities.User.filter({ id: userId });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found: ${userId}`);
          break;
        }

        // Check for premium override protection
        if (user.premium_override === true) {
          console.log(`⚠️ User ${userId} has premium_override - skipping webhook update`);
          break;
        }

        // ✅ Update correct fields: subscription_tier, stripe_customer_id
        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: "premium",
          stripe_customer_id: session.customer,
          premium_until: null // Clear any temporary premium access
        });

        console.log(`✅ User ${userId} upgraded to premium`);

        // Log event for debugging
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: userId,
            data: { customer: session.customer }
          });
        } catch (e) {
          console.log("⚠️ Could not log event (non-critical):", e.message);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe customer ID
        const users = await base44.asServiceRole.entities.User.filter({ 
          stripe_customer_id: customerId 
        });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found for customer: ${customerId}`);
          break;
        }

        // Check for premium override protection
        if (user.premium_override === true) {
          console.log(`⚠️ User ${user.id} has premium_override - skipping downgrade`);
          break;
        }

        // Downgrade to free tier
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: "free",
          premium_until: null
        });

        console.log(`✅ User ${user.id} downgraded to free`);

        // Log event
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: user.id,
            data: { customer: customerId }
          });
        } catch (e) {
          console.log("⚠️ Could not log event (non-critical):", e.message);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        // Find user by Stripe customer ID
        const users = await base44.asServiceRole.entities.User.filter({ 
          stripe_customer_id: customerId 
        });
        const user = users[0];

        if (!user) {
          console.error(`❌ User not found for customer: ${customerId}`);
          break;
        }

        // Check for premium override protection
        if (user.premium_override === true) {
          console.log(`⚠️ User ${user.id} has premium_override - skipping update`);
          break;
        }

        // Update based on subscription status
        const newTier = status === "active" ? "premium" : "free";
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: newTier
        });

        console.log(`✅ User ${user.id} subscription updated: ${status} → ${newTier}`);

        // Log event
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: user.id,
            data: { customer: customerId, status }
          });
        } catch (e) {
          console.log("⚠️ Could not log event (non-critical):", e.message);
        }

        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return new Response(JSON.stringify({ 
      error: "Webhook processing failed",
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
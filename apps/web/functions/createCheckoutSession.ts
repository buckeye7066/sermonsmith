import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

async function safeRun(req) {
  if (req.method !== "POST") {
    return { ok: false, error: "POST required", data: null };
  }

  const stripeKey = Deno.env.get("STRIPE_API_KEY");
  if (!stripeKey) {
    return { ok: false, error: "Stripe not configured", data: null };
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const base44 = createClientFromRequest(req);
  
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: "Authentication required", data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  
  if (body._selfTest) {
    return { ok: true, selfTest: true, message: 'createCheckoutSession is operational', data: null };
  }

  const appUrl = req.headers.get("origin") || "https://sermon-smith-0150c183.base44.app";
  const successUrl = body.success_url || `${appUrl}/pages/Settings?payment=success`;
  const cancelUrl = body.cancel_url || `${appUrl}/pages/Pricing?payment=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: "price_1STE1wD0SPSojgdlxuUUhYII",
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    customer_email: user.email,
    metadata: {
      user_id: user.id,
      user_email: user.email
    }
  });

  return {
    ok: true,
    error: null,
    data: {
      url: session.url,
      sessionId: session.id
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[createCheckoutSession] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});
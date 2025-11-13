import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
    });
  }

  const base44 = createClientFromRequest(req);
  const user = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: Deno.env.get("STRIPE_PRICE_ID"),
        quantity: 1,
      },
    ],
    success_url: user.success_url,
    cancel_url: user.cancel_url,
    client_reference_id: user.userId,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import Stripe from "npm:stripe@17.4.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  // Allow verification pings
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
    });
  }

  const base44 = createClientFromRequest(req);

  switch (event.type) {
    case "checkout.session.completed":
      await base44.entities.user.update({
        id: event.data.object.client_reference_id,
        data: { premium: true },
      });
      break;

    case "customer.subscription.deleted":
      await base44.entities.user.update({
        id: event.data.object.metadata.userId,
        data: { premium: false },
      });
      break;

    case "customer.subscription.updated":
      await base44.entities.user.update({
        id: event.data.object.metadata.userId,
        data: {
          premium: event.data.object.status === "active",
        },
      });
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
  });
});
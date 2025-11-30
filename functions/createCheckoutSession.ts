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
  
  // 🔒 SECURITY: Get user from authenticated session, NOT request body
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        message: "Please log in to create a checkout session"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Read optional redirect URLs from request body (if provided)
    const body = await req.json().catch(() => ({}));
    
    // Handle self-test from system check
    if (body._selfTest) {
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Checkout session function is operational'
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get app URL for redirect URLs
    const appUrl = req.headers.get("origin") || "https://sermon-smith-0150c183.base44.app";
    const successUrl = body.success_url || `${appUrl}/pages/Settings?payment=success`;
    const cancelUrl = body.cancel_url || `${appUrl}/pages/Pricing?payment=cancelled`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: "price_1SHpNkIZTZppGBxIvXfyvfNc", // SermonSmith Premium $4.99/month
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id, // ✅ Use authenticated user ID
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        user_email: user.email
      }
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Checkout session error:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to create checkout session",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

const PREMIUM_PRICE_ID = 'price_1S3hWpIZTZppGBxIvYEi41M7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'User must be logged in to upgrade.' }, {
        status: 401,
      });
    }

    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    
    // Handle Base44 preview iframe - use the actual app URL
    const appUrl = origin || 'https://sermon-smith.base44.app';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: PREMIUM_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${appUrl}/MySermons?upgrade=success`,
      cancel_url: `${appUrl}/Pricing`,
      client_reference_id: user.id,
      customer_email: user.email,
      locale: 'auto',
      allow_promotion_codes: true,
    });

    return Response.json({ 
      url: session.url,
      sessionId: session.id,
      isPreview: origin?.includes('base44.app') || origin?.includes('localhost')
    }, {
      status: 200,
    });

  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return Response.json({ 
      error: 'Failed to create checkout session.',
      details: error.message 
    }, {
      status: 500,
    });
  }
});
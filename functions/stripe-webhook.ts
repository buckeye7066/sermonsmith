/**
 * Stripe Webhook Handler - PRODUCTION
 * 
 * Handles Stripe webhook events for subscription management.
 * 
 * Events:
 * - checkout.session.completed: Upgrades user to premium
 * - customer.subscription.deleted: Downgrades user to free
 * - customer.subscription.updated: Updates subscription status
 * 
 * Security:
 * - Validates webhook signature using Stripe webhook secret
 * - Uses service role for database operations (no user auth required for webhooks)
 * - Implements idempotency to prevent duplicate processing
 * - Respects premium_override flag for special users
 * 
 * Webhook URL:
 * https://sermon-smith-0150c183.base44.app/api/stripe-webhook
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  console.log('\n' + '='.repeat(80));
  console.log('🔔 STRIPE WEBHOOK RECEIVED');
  console.log('='.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Allow Stripe's validation pings (GET requests)
  if (req.method === 'GET') {
    console.log('✅ GET request - responding with OK for Stripe validation');
    console.log('='.repeat(80) + '\n');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only accept POST requests for actual webhooks
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    console.log('='.repeat(80) + '\n');
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Get signature and body
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  console.log('Signature present:', !!signature);
  console.log('Body length:', body.length);

  // Accept Stripe's pre-flight verification (no signature)
  if (!signature) {
    console.log('⚠️ No signature - responding OK for Stripe pre-flight check');
    console.log('='.repeat(80) + '\n');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify webhook signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log('✅ Signature verified');
    console.log('Event ID:', event.id);
    console.log('Event Type:', event.type);
  } catch (err) {
    console.error('❌ Signature verification failed:', err.message);
    console.log('='.repeat(80) + '\n');
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Initialize Base44 with service role (no user auth required for webhooks)
  const base44 = createClientFromRequest(req);

  // Check if event already processed (idempotency)
  try {
    const existingEvents = await base44.asServiceRole.entities.StripeEvent.filter({
      event_id: event.id
    });

    if (existingEvents.length > 0) {
      console.log(`⚠️ Event ${event.id} already processed, skipping`);
      console.log('='.repeat(80) + '\n');
      return Response.json({ received: true, skipped: true });
    }
  } catch (error) {
    console.log('Note: StripeEvent entity check skipped (non-critical)');
  }

  // Handle webhook events
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerEmail = session.customer_email || session.customer_details?.email;

        console.log('💳 Checkout completed');
        console.log('  User ID:', userId);
        console.log('  Email:', customerEmail);
        console.log('  Customer:', session.customer);

        if (!userId) {
          console.warn('⚠️ No user ID in checkout session');
          break;
        }

        // Find user
        const users = await base44.asServiceRole.entities.User.list();
        const targetUser = users.find(u => u.id === userId);

        if (!targetUser) {
          console.error('❌ User not found:', userId);
          break;
        }

        // Check if user has premium_override (don't change their tier)
        if (targetUser.premium_override) {
          console.log(`ℹ️ User ${userId} has premium_override, not changing tier`);
          break;
        }

        // Upgrade to premium
        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: 'premium',
          stripe_customer_id: session.customer,
          premium_until: null
        });
        
        console.log(`✅ Upgraded user ${userId} to premium`);

        // Record event (optional, for debugging)
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: userId,
            data: { customer: session.customer, email: customerEmail }
          });
        } catch (e) {
          console.log('Could not record event (non-critical):', e.message);
        }

        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        console.log('🔴 Subscription deleted');
        console.log('  Customer:', subscription.customer);

        // Find user by Stripe customer ID
        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.stripe_customer_id === subscription.customer);
        
        if (!user) {
          console.warn('⚠️ No user found with customer ID:', subscription.customer);
          break;
        }

        // Don't downgrade if premium_override is true
        if (user.premium_override) {
          console.log(`ℹ️ User ${user.id} has premium_override, keeping premium`);
          break;
        }

        // Downgrade to free
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: 'free'
        });
        
        console.log(`✅ Downgraded user ${user.id} to free`);

        // Record event (optional)
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: user.id,
            data: { customer: subscription.customer }
          });
        } catch (e) {
          console.log('Could not record event (non-critical):', e.message);
        }

        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        console.log('🔄 Subscription updated');
        console.log('  Customer:', subscription.customer);
        console.log('  Status:', subscription.status);
        
        // Only process if subscription is no longer active
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          console.log('  Subscription still active, no action needed');
          break;
        }

        // Find user
        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.stripe_customer_id === subscription.customer);
        
        if (!user) {
          console.warn('⚠️ No user found with customer ID:', subscription.customer);
          break;
        }

        // Don't downgrade if premium_override is true
        if (user.premium_override) {
          console.log(`ℹ️ User ${user.id} has premium_override, keeping premium`);
          break;
        }

        // Downgrade to free
        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: 'free'
        });
        
        console.log(`✅ Downgraded user ${user.id} to free (subscription inactive)`);

        // Record event (optional)
        try {
          await base44.asServiceRole.entities.StripeEvent.create({
            event_id: event.id,
            event_type: event.type,
            processed_at: new Date().toISOString(),
            user_id: user.id,
            data: { customer: subscription.customer, status: subscription.status }
          });
        } catch (e) {
          console.log('Could not record event (non-critical):', e.message);
        }

        break;
      }
      
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    console.log('='.repeat(80) + '\n');
    
    return Response.json({ 
      received: true, 
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString()
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    console.log('='.repeat(80) + '\n');
    
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
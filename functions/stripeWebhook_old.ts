/**
 * Stripe Webhook Handler - OLD VERSION (BACKUP)
 * 
 * This is a backup of the original webhook handler.
 * The active webhook is now at functions/stripeWebhook.js
 * 
 * Handles Stripe webhook events for subscription management:
 * - checkout.session.completed: Upgrades user to premium
 * - customer.subscription.deleted: Downgrades user to free
 * - customer.subscription.updated: Updates subscription status
 * 
 * Security:
 * - Validates webhook signature using Stripe webhook secret
 * - Uses service role for database operations
 * - Implements idempotency to prevent duplicate processing
 * - Respects premium_override flag for special users
 * 
 * Webhook URL Format:
 * https://your-app.base44.com/api/functions/stripeWebhook
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"), {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  console.log('\n' + '='.repeat(80));
  console.log('🔔 STRIPE WEBHOOK RECEIVED');
  console.log('='.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    console.log('='.repeat(80) + '\n');
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Get signature and body
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  // Verify webhook signature
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")
    );
    console.log('✅ Signature verified');
    console.log('Event ID:', event.id);
    console.log('Event Type:', event.type);
  } catch (err) {
    console.error('❌ Signature verification failed:', err.message);
    console.log('='.repeat(80) + '\n');
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Initialize Base44 with service role
  const base44 = createClientFromRequest(req);

  // Check if event already processed (idempotency)
  try {
    const existingEvents = await base44.asServiceRole.entities.StripeEvent.filter({
      event_id: event.id
    });

    if (existingEvents.length > 0) {
      console.log(`⚠️ Event ${event.id} already processed, skipping`);
      return Response.json({ received: true, skipped: true });
    }
  } catch (error) {
    console.log('Note: StripeEvent entity check skipped');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const customerEmail = session.customer_email || session.customer_details?.email;

      console.log('💳 Checkout completed. User ID:', userId, 'Email:', customerEmail);

      if (userId) {
        try {
          const user = await base44.asServiceRole.entities.User.list();
          const targetUser = user.find(u => u.id === userId);

          if (targetUser) {
            // Don't override developer backdoor
            if (targetUser.premium_override) {
              console.log(`ℹ️ User ${userId} has premium_override, not changing tier`);
            } else {
              await base44.asServiceRole.entities.User.update(userId, {
                subscription_tier: 'premium',
                stripe_customer_id: session.customer,
                premium_until: null
              });
              console.log(`✅ Upgraded user ${userId} to premium (Stripe customer: ${session.customer})`);
            }
          }

          // Record event
          try {
            await base44.asServiceRole.entities.StripeEvent.create({
              event_id: event.id,
              event_type: event.type,
              processed_at: new Date().toISOString(),
              user_id: userId,
              data: { customer: session.customer, email: customerEmail }
            });
          } catch (e) {
            console.log('Could not record event:', e.message);
          }

        } catch (error) {
          console.error(`❌ Failed to upgrade user ${userId}:`, error);
          return Response.json({ 
            error: 'Failed to upgrade user',
            details: error.message 
          }, { status: 500 });
        }
      }
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('🔴 Subscription deleted for customer:', subscription.customer);
      
      try {
        const users = await base44.asServiceRole.entities.User.list();
        const user = users.find(u => u.stripe_customer_id === subscription.customer);
        
        if (user) {
          // Don't downgrade if premium_override is true
          if (user.premium_override) {
            console.log(`ℹ️ User ${user.id} has premium_override, keeping premium`);
          } else {
            await base44.asServiceRole.entities.User.update(user.id, {
              subscription_tier: 'free'
            });
            console.log(`✅ Downgraded user ${user.id} to free (subscription cancelled)`);
          }

          // Record event
          try {
            await base44.asServiceRole.entities.StripeEvent.create({
              event_id: event.id,
              event_type: event.type,
              processed_at: new Date().toISOString(),
              user_id: user.id,
              data: { customer: subscription.customer }
            });
          } catch (e) {
            console.log('Could not record event:', e.message);
          }

        } else {
          console.warn('⚠️ No user found with customer ID:', subscription.customer);
        }
      } catch (error) {
        console.error('❌ Failed to downgrade user:', error);
      }
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log('🔄 Subscription updated. Status:', subscription.status);
      
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        try {
          const users = await base44.asServiceRole.entities.User.list();
          const user = users.find(u => u.stripe_customer_id === subscription.customer);
          
          if (user) {
            // Don't downgrade if premium_override is true
            if (user.premium_override) {
              console.log(`ℹ️ User ${user.id} has premium_override, keeping premium`);
            } else {
              await base44.asServiceRole.entities.User.update(user.id, {
                subscription_tier: 'free'
              });
              console.log(`✅ Downgraded user ${user.id} to free (subscription inactive)`);
            }

            // Record event
            try {
              await base44.asServiceRole.entities.StripeEvent.create({
                event_id: event.id,
                event_type: event.type,
                processed_at: new Date().toISOString(),
                user_id: user.id,
                data: { customer: subscription.customer, status: subscription.status }
              });
            } catch (e) {
              console.log('Could not record event:', e.message);
            }
          }
        } catch (error) {
          console.error('❌ Failed to downgrade user:', error);
        }
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
});
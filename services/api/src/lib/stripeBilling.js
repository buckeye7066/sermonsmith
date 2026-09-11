// Shared Stripe access for routes that need billing side effects.
//
// Account deletion lives in routes/auth.js while checkout and the webhook live
// in routes/functions.js; both need the same lazily-constructed client so a
// deleted account can have its subscription cancelled instead of silently
// continuing to bill a login that no longer exists.

let _stripe = null;

export async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY || process.env.DISABLE_BILLING === '1') return null;
  if (!_stripe) {
    const { default: Stripe } = await import('stripe');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Statuses that can still produce a charge. `canceled` and
// `incomplete_expired` are terminal, so there is nothing to stop.
const TERMINAL_STATUSES = new Set(['canceled', 'incomplete_expired']);

// Walk every page of a Stripe list. Stopping at the first page would leave any
// subscription past it billing an account that is about to become unreachable.
async function listAll(list, params) {
  const items = [];
  let startingAfter;
  for (;;) {
    const page = await list(startingAfter ? { ...params, starting_after: startingAfter } : params);
    const data = page?.data || [];
    items.push(...data);
    if (!page?.has_more || data.length === 0) return items;
    startingAfter = data[data.length - 1].id;
  }
}

/**
 * Cancel every live subscription billed to this user's Stripe customer(s).
 * Prefers the stored customer id; falls back to the email Checkout used for
 * accounts that subscribed before the id was captured (same fallback as the
 * billing portal route). All pages are read before anything is cancelled.
 * Throws on any Stripe failure so callers can refuse to delete an account
 * whose billing could not be stopped.
 *
 * @returns {Promise<{ canceled: string[] }>} ids of subscriptions cancelled
 */
export async function cancelStripeSubscriptionsForUser(stripe, user) {
  if (!stripe || !user) return { canceled: [] };

  let customerIds = [];
  if (user.stripeCustomerId) {
    customerIds = [user.stripeCustomerId];
  } else if (user.email) {
    const customers = await listAll((p) => stripe.customers.list(p), { email: user.email, limit: 100 });
    customerIds = customers.map((customer) => customer.id);
  }

  const live = [];
  for (const customer of customerIds) {
    const subscriptions = await listAll((p) => stripe.subscriptions.list(p), { customer, status: 'all', limit: 100 });
    live.push(...subscriptions.filter((subscription) => !TERMINAL_STATUSES.has(subscription.status)));
  }

  const canceled = [];
  for (const subscription of live) {
    await stripe.subscriptions.cancel(subscription.id);
    canceled.push(subscription.id);
  }
  return { canceled };
}

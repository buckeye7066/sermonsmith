import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required", data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body._selfTest) {
    return { ok: true, selfTest: true, message: 'listUsers is operational', data: null };
  }

  const users = await base44.asServiceRole.entities.User.list('-created_date', 100);

  const userLog = users.map(u => ({
    email: u.email,
    name: u.full_name || 'N/A',
    role: u.role,
    subscription_tier: u.subscription_tier || 'free',
    premium_override: u.premium_override || false,
    stripe_customer_id: u.stripe_customer_id || null,
    premium_until: u.premium_until || null,
    created_date: u.created_date,
    onboarding_completed: u.onboarding_completed || false,
    id: u.id
  }));

  const stats = {
    total_users: users.length,
    premium_subscribers: users.filter(u => u.subscription_tier === 'premium').length,
    premium_overrides: users.filter(u => u.premium_override === true).length,
    free_users: users.filter(u => !u.subscription_tier || u.subscription_tier === 'free').length,
    admins: users.filter(u => u.role === 'admin').length,
    with_stripe_customer: users.filter(u => u.stripe_customer_id).length
  };

  return {
    ok: true,
    error: null,
    data: { stats, users: userLog }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[listUsers] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});
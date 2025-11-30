import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // 🔒 Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Self-test mode for system diagnostics
    const body = await req.json().catch(() => ({}));
    if (body._selfTest) {
      return Response.json({ ok: true, selfTest: true, message: 'listUsers is operational' });
    }

    // Fetch all users
    const users = await base44.asServiceRole.entities.User.list('-created_date', 100);

    // Format user data for easy viewing
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

    // Calculate statistics
    const stats = {
      total_users: users.length,
      premium_subscribers: users.filter(u => u.subscription_tier === 'premium').length,
      premium_overrides: users.filter(u => u.premium_override === true).length,
      free_users: users.filter(u => !u.subscription_tier || u.subscription_tier === 'free').length,
      admins: users.filter(u => u.role === 'admin').length,
      with_stripe_customer: users.filter(u => u.stripe_customer_id).length
    };

    return Response.json({
      success: true,
      stats,
      users: userLog
    }, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
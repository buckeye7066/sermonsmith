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
      return Response.json({ ok: true, selfTest: true, message: 'grantFamilyAccess is operational' });
    }

    const familyEmails = [
      "Anyawhite@rocketmail.com",
      "Tishka1201@icloud.com", 
      "Whiterobert1201@icloud.com"
    ];

    const results = [];

    // Also grant access to Hailee Hopkins (troubleshooting helper - 423 315 9124)
    try {
      const haileeUsers = await base44.asServiceRole.entities.User.filter({ 
        full_name: { $regex: "Hailee Hopkins", $options: "i" }
      });
      
      for (const haileeUser of haileeUsers) {
        await base44.asServiceRole.entities.User.update(haileeUser.id, {
          premium_override: true,
          subscription_tier: "premium"
        });
        results.push({
          email: haileeUser.email,
          status: "success",
          message: "Premium access granted (Hailee Hopkins - 423 315 9124)",
          user_id: haileeUser.id
        });
      }
    } catch (e) {
      console.log("Could not find/update Hailee Hopkins:", e.message);
    }

    for (const email of familyEmails) {
      try {
        // Find user by email (case-insensitive)
        const users = await base44.asServiceRole.entities.User.filter({
          email: email
        });

        if (users.length === 0) {
          results.push({
            email,
            status: "not_found",
            message: "User hasn't signed up yet"
          });
          continue;
        }

        const targetUser = users[0];

        // Grant premium override
        await base44.asServiceRole.entities.User.update(targetUser.id, {
          premium_override: true
        });

        results.push({
          email,
          status: "success",
          message: "Premium access granted",
          user_id: targetUser.id
        });

      } catch (error) {
        results.push({
          email,
          status: "error",
          message: error.message
        });
      }
    }

    return Response.json({
      success: true,
      results,
      summary: {
        total: familyEmails.length,
        granted: results.filter(r => r.status === "success").length,
        not_found: results.filter(r => r.status === "not_found").length,
        errors: results.filter(r => r.status === "error").length
      }
    });

  } catch (error) {
    console.error("Error granting family access:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
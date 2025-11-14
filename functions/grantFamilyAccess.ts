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

    const familyEmails = [
      "Anyawhite@rocketmail.com",
      "Tishka1201@icloud.com", 
      "Whiterobert1201@icloud.com"
    ];

    const results = [];

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
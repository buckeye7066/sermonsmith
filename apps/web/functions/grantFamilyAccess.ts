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
    return { ok: true, selfTest: true, message: 'grantFamilyAccess is operational', data: null };
  }

  const familyEmails = [
    "Anyawhite@rocketmail.com",
    "Tishka1201@icloud.com", 
    "Whiterobert1201@icloud.com"
  ];

  const results = [];

  // Also grant access to Hailee Hopkins
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
        message: "Premium access granted (Hailee Hopkins)",
        user_id: haileeUser.id
      });
    }
  } catch (e) {
    console.log("Could not find/update Hailee Hopkins:", e.message);
  }

  for (const email of familyEmails) {
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email });

      if (users.length === 0) {
        results.push({ email, status: "not_found", message: "User hasn't signed up yet" });
        continue;
      }

      const targetUser = users[0];
      await base44.asServiceRole.entities.User.update(targetUser.id, { premium_override: true });
      results.push({ email, status: "success", message: "Premium access granted", user_id: targetUser.id });

    } catch (error) {
      results.push({ email, status: "error", message: error.message });
    }
  }

  return {
    ok: true,
    error: null,
    data: {
      results,
      summary: {
        total: familyEmails.length,
        granted: results.filter(r => r.status === "success").length,
        not_found: results.filter(r => r.status === "not_found").length,
        errors: results.filter(r => r.status === "error").length
      }
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[grantFamilyAccess] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});
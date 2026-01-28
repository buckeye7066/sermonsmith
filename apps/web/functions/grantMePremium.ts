import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Not authenticated', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body._selfTest) {
    return { ok: true, selfTest: true, message: 'grantMePremium is operational', data: null };
  }

  await base44.asServiceRole.entities.User.update(user.id, {
    premium_override: true,
    subscription_tier: 'premium'
  });

  return {
    ok: true,
    error: null,
    data: {
      message: `Premium access granted to ${user.email}`,
      user_id: user.id
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[grantMePremium] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});
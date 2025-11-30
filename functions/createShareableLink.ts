import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

function generateShareCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Unauthorized', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body', data: null };
  }

  const { resourceType, resourceId, title, description, accessLevel, expiresInDays, _selfTest } = body;

  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'createShareableLink is operational', data: null };
  }

  if (!resourceType || !resourceId) {
    return { ok: false, error: 'Missing resourceType or resourceId', data: null };
  }

  const shareCode = generateShareCode();

  let expiresAt = null;
  if (expiresInDays && expiresInDays > 0) {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + expiresInDays);
    expiresAt = expireDate.toISOString();
  }

  const shareableLink = await base44.entities.ShareableLink.create({
    user_id: user.id,
    resource_type: resourceType,
    resource_id: resourceId,
    share_code: shareCode,
    title: title || `Shared ${resourceType}`,
    description: description || '',
    access_level: accessLevel || 'view',
    expires_at: expiresAt,
    view_count: 0,
    is_active: true
  });

  const appUrl = req.headers.get('origin') || 'https://app.base44.com';
  const shareUrl = `${appUrl}/share/${shareCode}`;

  return {
    ok: true,
    error: null,
    data: {
      shareUrl,
      shareCode,
      expiresAt,
      shareableLink
    }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[createShareableLink] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});
/**
 * Client-side error ingestion.
 *
 * The web app POSTs uncaught render/runtime errors here so the same
 * owner-notification pipeline that covers backend 500s also covers frontend
 * crashes. The route is intentionally tolerant of anonymous callers (a crash
 * can happen before/around auth); the owner/admin exclusion is enforced inside
 * reportErrorToOwner using the authenticated email.
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma, AUTH_COOKIE } from '../middleware/auth.js';
import { reportErrorToOwner } from '../services/errorReporter.js';
import { classifyExternalError } from '../services/externalErrorClassifier.js';

const router = Router();

// Best-effort identity resolution. Unlike authenticateToken this NEVER 401s —
// an unauthenticated crash report is still useful, and the reporter handles the
// admin exclusion. We resolve the email when a valid token is present so the
// owner exclusion and the "for <user>" subject work.
async function resolveUserEmail(req) {
  const token = req.cookies?.[AUTH_COOKIE]
    || (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : null);
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { email: true },
    });
    return user?.email || null;
  } catch {
    return null;
  }
}

const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(120).optional(),
  stack: z.string().max(20_000).optional(),
  componentStack: z.string().max(20_000).optional(),
  route: z.string().max(2000).optional(),
  statusCode: z.union([z.number(), z.string()]).optional(),
  // Client-side classification hint (the server re-derives it from the
  // message regardless, so stale cached bundles are still classified).
  classification: z.string().max(40).optional(),
  // True when the client's stack was synthesized by the reporter itself
  // (non-Error rejection wrapped in `new Error(...)`) — the stack then points
  // at the reporter's bundle location, NOT the real throw site.
  syntheticStack: z.boolean().optional(),
});

router.post('/report-client-error', async (req, res) => {
  const parsed = clientErrorSchema.safeParse(req.body || {});
  if (!parsed.success) {
    // Guard against missing/garbage payloads but stay quiet — this is fire-and-forget.
    return res.status(204).end();
  }

  const { message, name, stack, componentStack, route, statusCode, classification, syntheticStack } = parsed.data;

  const userEmail = await resolveUserEmail(req);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);
  const authState = userEmail ? `authenticated:${userEmail}` : 'anonymous';

  // Errors injected by external mail-security scanners (Outlook SafeLinks
  // crawling password-reset links to /Login) are logged for the audit trail
  // but never emailed to the owner as fake 500s. Server-side detection wins;
  // the client hint covers future signatures the message regex can't see.
  const external = classifyExternalError(message)
    || (classification === 'external-scanner' ? { classification, detail: {} } : null);

  if (external) {
    console.warn('[clientErrors] external-scanner error — logged, not emailed', JSON.stringify({
      disposition: 'logged-not-emailed',
      classification: external.classification,
      // The "record" the scanner's RPC bridge claimed was missing — an
      // internal handle of the scanner itself, not one of our rows.
      claimedMissingObject: external.detail,
      message: message.slice(0, 300),
      route: route || 'unknown',
      authState,
      userAgent,
      requestId: req.id,
      syntheticStack: Boolean(syntheticStack),
    }));
    return res.status(204).end();
  }

  const error = new Error(message);
  error.name = name || 'ClientError';
  // Prefer the real client stack; append the React component stack when present.
  error.stack = [stack, componentStack && `Component stack:\n${componentStack}`]
    .filter(Boolean)
    .join('\n\n') || `${error.name}: ${message}`;

  console.info('[clientErrors] client error forwarded to owner reporter', JSON.stringify({
    disposition: 'forwarded',
    name: error.name,
    route: route || 'unknown',
    authState,
    requestId: req.id,
    syntheticStack: Boolean(syntheticStack),
  }));

  reportErrorToOwner({
    error,
    source: 'frontend',
    userEmail,
    route: route || 'unknown',
    method: 'CLIENT',
    requestId: req.id,
    // Only pass a status when the client actually observed one — client-side
    // crashes are not HTTP 500s and used to be mislabeled as such.
    statusCode: Number(statusCode) || undefined,
    extra: (userAgent || syntheticStack)
      ? { ...(userAgent && { userAgent }), ...(syntheticStack && { syntheticStack: true }) }
      : undefined,
  });

  return res.status(204).end();
});

export default router;

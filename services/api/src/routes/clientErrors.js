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
});

router.post('/report-client-error', async (req, res) => {
  const parsed = clientErrorSchema.safeParse(req.body || {});
  if (!parsed.success) {
    // Guard against missing/garbage payloads but stay quiet — this is fire-and-forget.
    return res.status(204).end();
  }

  const { message, name, stack, componentStack, route, statusCode } = parsed.data;

  const error = new Error(message);
  error.name = name || 'ClientError';
  // Prefer the real client stack; append the React component stack when present.
  error.stack = [stack, componentStack && `Component stack:\n${componentStack}`]
    .filter(Boolean)
    .join('\n\n') || `${error.name}: ${message}`;

  const userEmail = await resolveUserEmail(req);

  reportErrorToOwner({
    error,
    source: 'frontend',
    userEmail,
    route: route || 'unknown',
    method: 'CLIENT',
    requestId: req.id,
    statusCode: Number(statusCode) || 500,
  });

  return res.status(204).end();
});

export default router;

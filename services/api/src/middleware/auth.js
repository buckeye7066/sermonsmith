import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Singleton — avoids spawning multiple connection pools.
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma || (globalForPrisma.__prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  datasources: { db: { url: process.env.DATABASE_URL } },
}));

const JWT_OPTS = { algorithms: ['HS256'] };

/** Cookie name for the httpOnly auth token */
export const AUTH_COOKIE = 'ss_token';

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return s;
}

/**
 * Cookie options.
 *
 * - httpOnly: always
 * - secure:  true in production (required when sameSite='none')
 * - sameSite:
 *     - dev/test: 'lax' (works for same-origin local dev)
 *     - production: configurable via COOKIE_SAMESITE; defaults to 'none'
 *       so that the SermonSmith web app deployed on Vercel can authenticate
 *       against the API deployed on Railway (different eTLD+1).
 *
 *       If you instead deploy the API and web on the same registered domain
 *       (e.g. api.example.com + app.example.com) you can set
 *       COOKIE_SAMESITE=lax for stricter CSRF properties.
 *
 *       SameSite=none REQUIRES secure=true; we enforce that here.
 * - domain: when COOKIE_DOMAIN is set we scope the cookie to that registered
 *   domain so api.example.com and app.example.com can share auth.
 */
export function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteRaw = (process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax';

  // SameSite=none MUST have secure=true. In dev, force lax to avoid surprising
  // browser warnings.
  const secure = isProd || sameSite === 'none';

  const opts = {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };

  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }

  return opts;
}

/**
 * Sign a JWT for a user.
 *
 * Accepts either a user object (preferred — encodes the user's
 * tokenVersion as `tv`) or a bare userId string (back-compat for older
 * callers and the test mocks). When given a string we omit `tv` from the
 * payload; authenticateToken treats missing `tv` as "any version" for the
 * migration window, so existing tests and pre-rollout tokens keep working.
 */
export function signToken(userOrId) {
  const isString = typeof userOrId === 'string';
  const userId = isString ? userOrId : userOrId?.id;
  if (!userId) throw new Error('signToken: missing user id');
  const payload = { userId };
  if (!isString && typeof userOrId.tokenVersion === 'number') {
    payload.tv = userOrId.tokenVersion;
  }
  return jwt.sign(payload, jwtSecret(), { algorithm: 'HS256', expiresIn: '30d' });
}

/**
 * Extract the JWT from the request.
 * Prefers the httpOnly cookie; falls back to Authorization header for
 * backward compatibility (e.g., mobile/Electron clients during migration).
 */
function extractToken(req) {
  return req.cookies?.[AUTH_COOKIE]
    || (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : null);
}

export async function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret(), JWT_OPTS);
    req.userId = decoded.userId;
    // Cache the user role once so route handlers never need a second DB lookup.
    // Also acts as a revocation check — deleted users are rejected immediately.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, premium: true, email: true, tokenVersion: true, deletedAt: true, premium_until: true },
    });
    if (!user || user.deletedAt) {
      // Treat soft-deleted accounts as gone — their tokenVersion was also bumped
      // on deletion, but this is the loader-independent net.
      return res.status(401).json({ message: 'User account not found' });
    }

    // Session-revocation check. Any token issued before the latest
    // password change / reset / forced-logout encodes an older `tv` and is
    // rejected here. Tokens issued before this rollout have no `tv`
    // claim; we accept those during the migration window so existing
    // sessions keep working — they will be re-issued with `tv` on the
    // next login/password event.
    if (typeof decoded.tv === 'number' && decoded.tv !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: 'Session expired — please sign in again' });
    }

    req.userRole = user.role;
    // Effective premium = a paid flag OR an unexpired free-trial window
    // (premium_until in the future). See functions.js grantFreePeriod.
    req.userPremium = !!user.premium
      || (user.premium_until ? new Date(user.premium_until) > new Date() : false);
    req.userEmail = user.email;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret(), JWT_OPTS);
      req.userId = decoded.userId;
    } catch {
      // Invalid token — continue without auth
    }
  }
  next();
}

/**
 * Middleware: require admin or dev role.
 * Must be used AFTER authenticateToken (which caches req.userRole).
 */
export function requireAdmin(req, res, next) {
  const role = req.userRole;
  if (!role || (role !== 'admin' && role !== 'dev')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

/**
 * Middleware: require an active premium subscription.
 */
export function requirePremium(req, res, next) {
  if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') {
    return res.status(402).json({ message: 'Premium subscription required' });
  }
  next();
}

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import {
  ACCOUNT_TIERS,
  accountTierFor,
  entitlementsFor,
  requestHasEntitlement,
} from '../lib/entitlements.js';

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

  // Session cookie: no maxAge/expires, so the browser drops it when fully
  // closed. Combined with the short token TTL below this means a signed-in
  // browser stays in only for the current session — reopening the app in a new
  // browser session requires logging in again (owner requirement: the app must
  // not silently auto-resume a 30-day login).
  const opts = {
    httpOnly: true,
    secure,
    sameSite,
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
  // 1-day TTL (was 30d). With the session cookie above, a signed-in browser
  // stays in for the current session, capped at 24h, then must log in again.
  return jwt.sign(payload, jwtSecret(), { algorithm: 'HS256', expiresIn: '1d' });
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
      select: {
        name: true,
        full_name: true,
        role: true,
        premium: true,
        premium_until: true,
        email: true,
        promotionalEmail: true,
        promotionalPhone: true,
        profile: true,
        tokenVersion: true,
        deletedAt: true,
        is_banned: true,
      },
    });
    if (!user || user.deletedAt) {
      // Treat soft-deleted accounts as gone — their tokenVersion was also bumped
      // on deletion, but this is the loader-independent net.
      return res.status(401).json({ message: 'User account not found' });
    }

    // Kill an active session the moment the account is banned — a ban must take
    // effect immediately, not only at the next login.
    if (user.is_banned) {
      return res.status(403).json({ message: 'This account has been suspended.' });
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
    // One server-authoritative access decision is attached to every protected
    // request. Route handlers must consult the entitlement list rather than
    // accepting a client/profile-supplied tier flag.
    req.accountTier = accountTierFor(user);
    req.entitlements = entitlementsFor(req.accountTier);
    req.userPremium = req.accountTier === ACCOUNT_TIERS.PREMIUM;
    req.userEmail = user.email;
    // Email is private by default and must never become a public community
    // display name merely because both optional name columns are empty.
    const publicName = String(user.full_name || user.name || '').trim();
    req.userName = publicName && !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(publicName)
      ? publicName
      : 'Member';
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
  if (req.accountTier !== ACCOUNT_TIERS.PREMIUM
      && !req.userPremium
      && req.userRole !== 'admin'
      && req.userRole !== 'dev') {
    return res.status(402).json({ message: 'Premium subscription required' });
  }
  next();
}

/**
 * Middleware factory for feature-specific plan checks.
 * Must be used after authenticateToken.
 */
export function requireEntitlement(entitlement) {
  return (req, res, next) => {
    if (!requestHasEntitlement(req, entitlement)) {
      return res.status(402).json({
        message: 'Premium subscription required',
        requiredEntitlement: entitlement,
      });
    }
    next();
  };
}

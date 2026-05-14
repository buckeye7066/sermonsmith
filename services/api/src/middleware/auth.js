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

export function signToken(userId) {
  return jwt.sign({ userId }, jwtSecret(), { algorithm: 'HS256', expiresIn: '30d' });
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
      select: { role: true, premium: true, email: true },
    });
    if (!user) {
      return res.status(401).json({ message: 'User account not found' });
    }
    req.userRole = user.role;
    req.userPremium = !!user.premium;
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

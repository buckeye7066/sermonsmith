import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Singleton — avoids spawning multiple connection pools
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma || (globalForPrisma.__prisma = new PrismaClient({
  log: ['warn', 'error'],
  datasources: { db: { url: process.env.DATABASE_URL } },
}));

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_OPTS = { algorithms: ['HS256'] };

/** Cookie name for the httpOnly auth token */
export const AUTH_COOKIE = 'ss_token';

/** Cookie options — httpOnly, Secure in production, SameSite=Lax */
export function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (matches JWT expiry)
    path: '/',
  };
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
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
    const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTS);
    req.userId = decoded.userId;
    // Cache the user role once so route handlers never need a second DB lookup.
    // Also acts as a revocation check — deleted users are rejected immediately.
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { role: true } });
    if (!user) {
      return res.status(401).json({ message: 'User account not found' });
    }
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTS);
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

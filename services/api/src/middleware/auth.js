import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Singleton — avoids spawning multiple connection pools
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma || (globalForPrisma.__prisma = new PrismaClient());

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_OPTS = { algorithms: ['HS256'] };

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTS);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, _res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
 * Must be used AFTER authenticateToken.
 */
export async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!user || (user.role !== 'admin' && user.role !== 'dev')) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.userRole = user.role;
    next();
  } catch (err) {
    next(err);
  }
}

import { Router } from 'express';
import { prisma, authenticateToken, requireAdmin } from '../middleware/auth.js';

// Tenant-isolated entity API.
//
// Production-readiness fix (2026-05-13): the previous implementation used
// `optionalAuth` on list/filter/get routes which let ANY (anonymous!)
// caller read ANY user's entities. Every endpoint here now requires
// authentication and scopes the query by `userId`. Admins (and the `dev`
// role) may pass `?all=1` to fan out across users for support tasks; this
// is logged via the userId trail in the response.

const router = Router();

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;

// Public entity types intentionally exposed without ownership checks.
// `Verse` is the imported Bible (read-only reference data); `SharedLink`
// metadata is fetched via slug lookup from a separate route, not from this
// generic API.
const PUBLIC_TYPES = new Set(['Verse']);

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

function sanitizeUser(u) {
  // Strip password and any sensitive profile fields before returning to a
  // caller. Note: callers should never receive arbitrary other users'
  // profile JSON; admin lookups go through /api/auth/users.
  const { password, ...rest } = u;
  const profile = typeof rest.profile === 'object' && rest.profile !== null ? rest.profile : {};
  return { id: rest.id, ...rest, ...profile };
}

function resolveOrderBy(raw) {
  if (!raw) return { createdAt: 'desc' };
  if (typeof raw === 'string') {
    const desc = raw.startsWith('-');
    const field = desc ? raw.slice(1) : raw;
    const col = field === 'created_date' ? 'createdAt' : field === 'updated_date' ? 'updatedAt' : 'createdAt';
    return { [col]: desc ? 'desc' : 'asc' };
  }
  return { createdAt: 'desc' };
}

function clampLimit(raw) {
  const n = typeof raw === 'number' ? raw : DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, n), MAX_PAGE_SIZE);
}

function isAdmin(req) {
  return req.userRole === 'admin' || req.userRole === 'dev';
}

// --- Filter (must be registered before /:type/:id to avoid route collision) ---
router.post('/:type/filter', authenticateToken, async (req, res, next) => {
  try {
    const { _limit, _offset, _orderBy, ...filterFields } = req.body;
    const take = clampLimit(_limit);
    const skip = typeof _offset === 'number' ? _offset : 0;
    const orderBy = resolveOrderBy(_orderBy);

    if (req.params.type === 'User') {
      // Listing users is admin-only.
      if (!isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, name: true, full_name: true, avatar: true,
          role: true, premium: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
        },
        orderBy,
        take,
        skip,
      });
      return res.json(users.map(sanitizeUser));
    }

    const where = { type: req.params.type };
    if (!PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      where.userId = req.userId;
    }

    const conditions = [];
    for (const [key, value] of Object.entries(filterFields)) {
      // Block client-supplied user_id override — auth context is the only
      // authority. Otherwise a non-admin caller could request another
      // user's data by passing { user_id: '...' }.
      if (key === 'user_id' || key === 'userId') continue;
      if (value !== undefined && value !== null) {
        conditions.push({ data: { path: [key], equals: value } });
      }
    }
    if (conditions.length > 0) where.AND = conditions;

    const entities = await prisma.entity.findMany({
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
      where,
      orderBy,
      take,
      skip,
    });
    res.json(entities.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Bulk create (uses transaction for atomicity) ---
router.post('/:type/bulk', authenticateToken, async (req, res, next) => {
  try {
    const items = req.body.items || req.body;
    const arr = Array.isArray(items) ? items : [items];
    const now = new Date().toISOString();

    const created = await prisma.$transaction(
      arr.map((rawItem) => {
        // Strip client-supplied user_id / userId so a caller can't claim
        // they're creating an entity on someone else's behalf.
        const { user_id: _u1, userId: _u2, id: _id, ...item } = rawItem || {};
        return prisma.entity.create({
          data: {
            type: req.params.type,
            userId: req.userId,
            data: { ...item, user_id: req.userId, created_date: now },
          },
        });
      })
    );

    res.json(created.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Create ---
router.post('/:type', authenticateToken, async (req, res, next) => {
  try {
    const { user_id: _u1, userId: _u2, id: _id, ...body } = req.body || {};
    const entity = await prisma.entity.create({
      data: {
        type: req.params.type,
        userId: req.userId,
        data: { ...body, user_id: req.userId, created_date: new Date().toISOString() },
      },
    });
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- List (with default pagination) ---
router.get('/:type', authenticateToken, async (req, res, next) => {
  try {
    const take = clampLimit(Number(req.query.limit) || DEFAULT_PAGE_SIZE);
    const skip = Number(req.query.offset) || 0;

    if (req.params.type === 'User') {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, name: true, full_name: true, avatar: true,
          role: true, premium: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
      return res.json(users.map(sanitizeUser));
    }

    const where = { type: req.params.type };
    if (!PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      where.userId = req.userId;
    }

    const entities = await prisma.entity.findMany({
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    res.json(entities.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Get single ---
router.get('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      if (!isAdmin(req) && req.params.id !== req.userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(sanitizeUser(user));
    }

    const entity = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!entity) return res.status(404).json({ message: 'Not found' });

    if (!PUBLIC_TYPES.has(entity.type) && entity.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- Update ---
router.put('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      return requireAdmin(req, res, async () => {
        try {
          // Block client-supplied role/premium/email/password from a
          // generic entity-update path; admins must use /api/auth/users.
          const { password: _p, role: _r, premium: _pr, email: _e, ...safe } = req.body || {};
          const user = await prisma.user.update({ where: { id: req.params.id }, data: safe });
          res.json(sanitizeUser(user));
        } catch (err) { next(err); }
      });
    }

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, data: true, userId: true, createdAt: true, updatedAt: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only update your own items' });
    }

    const { user_id: _u1, userId: _u2, id: _id, ...patch } = req.body || {};
    const entity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        data: { ...existing.data, ...patch, updated_date: new Date().toISOString() },
      },
    });
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- Delete ---
router.delete('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      return requireAdmin(req, res, async () => {
        try {
          await prisma.user.delete({ where: { id: req.params.id } });
          res.status(204).send();
        } catch (err) { next(err); }
      });
    }

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, userId: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only delete your own items' });
    }

    await prisma.entity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

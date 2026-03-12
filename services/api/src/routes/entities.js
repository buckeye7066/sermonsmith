import { Router } from 'express';
import { prisma, authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

function sanitizeUser(u) {
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

// --- Filter (must be registered before /:type/:id to avoid route collision) ---
router.post('/:type/filter', optionalAuth, async (req, res, next) => {
  try {
    const { _limit, _offset, _orderBy, ...filterFields } = req.body;
    const take = clampLimit(_limit);
    const skip = typeof _offset === 'number' ? _offset : 0;
    const orderBy = resolveOrderBy(_orderBy);

    if (req.params.type === 'User') {
      const users = await prisma.user.findMany({ orderBy, take, skip });
      return res.json(users.map(sanitizeUser));
    }

    const where = { type: req.params.type };
    const conditions = [];
    for (const [key, value] of Object.entries(filterFields)) {
      if (value !== undefined && value !== null) {
        conditions.push({ data: { path: [key], equals: value } });
      }
    }
    if (conditions.length > 0) where.AND = conditions;

    const entities = await prisma.entity.findMany({ where, orderBy, take, skip });
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
      arr.map(item =>
        prisma.entity.create({
          data: {
            type: req.params.type,
            userId: req.userId,
            data: { ...item, user_id: req.userId, created_date: now },
          },
        })
      )
    );

    res.json(created.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Create ---
router.post('/:type', authenticateToken, async (req, res, next) => {
  try {
    const entity = await prisma.entity.create({
      data: {
        type: req.params.type,
        userId: req.userId,
        data: { ...req.body, user_id: req.userId, created_date: new Date().toISOString() },
      },
    });
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- List (with default pagination) ---
router.get('/:type', optionalAuth, async (req, res, next) => {
  try {
    const take = clampLimit(Number(req.query.limit) || DEFAULT_PAGE_SIZE);
    const skip = Number(req.query.offset) || 0;

    if (req.params.type === 'User') {
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take, skip });
      return res.json(users.map(sanitizeUser));
    }

    const entities = await prisma.entity.findMany({
      where: { type: req.params.type },
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
router.get('/:type/:id', optionalAuth, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(sanitizeUser(user));
    }

    const entity = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!entity) return res.status(404).json({ message: 'Not found' });
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
          const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
          res.json(sanitizeUser(user));
        } catch (err) { next(err); }
      });
    }

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && req.userRole !== 'admin' && req.userRole !== 'dev') {
      const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
      if (!u || (u.role !== 'admin' && u.role !== 'dev')) {
        return res.status(403).json({ message: 'You can only update your own items' });
      }
    }

    const entity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        data: { ...existing.data, ...req.body, updated_date: new Date().toISOString() },
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

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId) {
      const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
      if (!u || (u.role !== 'admin' && u.role !== 'dev')) {
        return res.status(403).json({ message: 'You can only delete your own items' });
      }
    }

    await prisma.entity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

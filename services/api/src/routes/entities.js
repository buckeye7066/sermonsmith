import { Router } from 'express';
import { prisma, authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

function sanitizeUser(u) {
  const { password, ...rest } = u;
  const profile = typeof rest.profile === 'object' && rest.profile !== null ? rest.profile : {};
  return { id: rest.id, ...rest, ...profile };
}

// --- Filter (must be registered before /:type/:id to avoid route collision) ---
router.post('/:type/filter', optionalAuth, async (req, res, next) => {
  try {
    const { _limit, _offset, _orderBy, ...filterFields } = req.body;

    // User entity → query users table
    if (req.params.type === 'User') {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        ...(typeof _limit === 'number' ? { take: _limit } : {}),
        ...(typeof _offset === 'number' ? { skip: _offset } : {}),
      });
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

    const entities = await prisma.entity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(typeof _limit === 'number' ? { take: _limit } : {}),
      ...(typeof _offset === 'number' ? { skip: _offset } : {}),
    });

    res.json(entities.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Bulk create ---
router.post('/:type/bulk', authenticateToken, async (req, res, next) => {
  try {
    const items = req.body.items || req.body;
    const arr = Array.isArray(items) ? items : [items];

    const created = await Promise.all(
      arr.map(item =>
        prisma.entity.create({
          data: {
            type: req.params.type,
            userId: req.userId,
            data: { ...item, user_id: req.userId, created_date: new Date().toISOString() },
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

// --- List ---
router.get('/:type', optionalAuth, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.json(users.map(sanitizeUser));
    }

    const entities = await prisma.entity.findMany({
      where: { type: req.params.type },
      orderBy: { createdAt: 'desc' },
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

// --- Helper: check if user is admin ---
async function isAdmin(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u && (u.role === 'admin' || u.role === 'dev');
}

// --- Update ---
router.put('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      if (!(await isAdmin(req.userId))) {
        return res.status(403).json({ message: 'Admin access required to update users' });
      }
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
      });
      return res.json(sanitizeUser(user));
    }

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // Ownership: only the owner or an admin can update
    if (existing.userId !== req.userId && !(await isAdmin(req.userId))) {
      return res.status(403).json({ message: 'You can only update your own items' });
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
      if (!(await isAdmin(req.userId))) {
        return res.status(403).json({ message: 'Admin access required to delete users' });
      }
      await prisma.user.delete({ where: { id: req.params.id } });
      return res.status(204).send();
    }

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && !(await isAdmin(req.userId))) {
      return res.status(403).json({ message: 'You can only delete your own items' });
    }

    await prisma.entity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

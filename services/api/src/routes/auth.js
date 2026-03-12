import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, authenticateToken, signToken } from '../middleware/auth.js';

const router = Router();

const ADMIN_EMAILS = [
  'buckeye7066@gmail.com',
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : []),
];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  const profile = typeof rest.profile === 'object' && rest.profile !== null ? rest.profile : {};
  return { ...rest, ...profile };
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const displayName = name || email.split('@')[0];
    const admin = isAdminEmail(email);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        name: displayName,
        full_name: displayName,
        ...(admin ? { role: 'admin', premium: true } : {}),
      },
    });

    const token = signToken(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Auto-promote admin emails on every login so access is never lost
    let currentUser = user;
    if (isAdminEmail(user.email) && (user.role !== 'admin' || !user.premium)) {
      currentUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', premium: true },
      });
    }

    const token = signToken(currentUser.id);
    res.json({ token, user: sanitizeUser(currentUser) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ensure admin emails always have admin+premium — self-healing
    if (isAdminEmail(user.email) && (user.role !== 'admin' || !user.premium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', premium: true },
      });
    }

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticateToken, async (req, res, next) => {
  try {
    const directFields = ['name', 'full_name', 'avatar', 'onboarding_completed', 'special_message', 'last_seen_version'];
    const blockedFields = ['premium', 'role', 'email', 'password'];
    const data = {};

    for (const key of directFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    // Store extra fields in the profile JSON column
    const extraFields = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!directFields.includes(key) && !blockedFields.includes(key) && key !== 'profile') {
        extraFields[key] = value;
      }
    }

    if (Object.keys(extraFields).length > 0 || req.body.profile) {
      const current = await prisma.user.findUnique({ where: { id: req.userId } });
      const currentProfile = typeof current.profile === 'object' && current.profile !== null ? current.profile : {};
      data.profile = { ...currentProfile, ...extraFields, ...(req.body.profile || {}) };
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
    });

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// Admin: list all users
router.get('/users', authenticateToken, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'dev')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true, full_name: true,
        role: true, premium: true, avatar: true, profile: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users.map(sanitizeUser));
  } catch (err) {
    next(err);
  }
});

// Admin: update user
router.patch('/users/:id', authenticateToken, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'dev')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { role, premium, name, full_name } = req.body;
    const data = {};
    if (role !== undefined) data.role = role;
    if (premium !== undefined) data.premium = premium;
    if (name !== undefined) data.name = name;
    if (full_name !== undefined) data.full_name = full_name;

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// Admin: delete user
router.delete('/users/:id', authenticateToken, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'dev')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

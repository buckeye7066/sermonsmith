import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();
const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      const u = prisma._store.user.find((x) => x.id === decoded.userId);
      req.userId = decoded.userId;
      req.userRole = u?.role;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(403).json({ message: 'Admin required' });
    next();
  },
  optionalAuth: (req, _res, next) => next(),
}));

vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(async () => ({ id: 'm' })),
  sendEmail: vi.fn(async () => ({ id: 'm' })),
}));

process.env.JWT_SECRET = SECRET;

const { default: authRoutes } = await import('../routes/auth.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

// The most recent take/skip the route passed to prisma.user.findMany.
function lastFindManyArgs() {
  const calls = prisma.user.findMany.mock.calls;
  return calls[calls.length - 1][0];
}

describe('admin user-list pagination clamp (GET /api/auth/users)', () => {
  let app;
  let token;
  beforeEach(() => {
    prisma._reset();
    prisma._store.user.push({ id: 'admin1', email: 'admin@x.com', role: 'admin', deletedAt: null });
    token = jwt.sign({ userId: 'admin1' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    app = buildApp();
    prisma.user.findMany.mockClear();
  });

  const call = (query = '') =>
    request(app).get(`/api/auth/users${query}`).set('Cookie', `ss_token=${token}`);

  it('clamps an absurdly high limit to 500', async () => {
    await call('?limit=99999');
    expect(lastFindManyArgs().take).toBe(500);
  });

  it('passes through a reasonable limit', async () => {
    await call('?limit=250');
    expect(lastFindManyArgs().take).toBe(250);
  });

  it('clamps a negative limit up to 1', async () => {
    await call('?limit=-5');
    expect(lastFindManyArgs().take).toBe(1);
  });

  it('defaults to 100 when no limit is given', async () => {
    await call();
    expect(lastFindManyArgs().take).toBe(100);
  });

  it('honours offset and floors a negative offset to 0', async () => {
    await call('?limit=10&offset=25');
    expect(lastFindManyArgs().skip).toBe(25);
    await call('?offset=-9');
    expect(lastFindManyArgs().skip).toBe(0);
  });

  it('excludes soft-deleted users from the query', async () => {
    await call();
    expect(lastFindManyArgs().where).toEqual({ deletedAt: null });
  });

  it('requires admin (403 for a non-admin)', async () => {
    prisma._store.user.push({ id: 'u2', email: 'u2@x.com', role: 'user', deletedAt: null });
    const userToken = jwt.sign({ userId: 'u2' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const res = await request(app).get('/api/auth/users').set('Cookie', `ss_token=${userToken}`);
    expect(res.status).toBe(403);
  });
});

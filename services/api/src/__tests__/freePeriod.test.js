import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();

// Auth mock: role/uid come from headers so we can exercise admin vs non-admin.
vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({}),
  signToken: () => 'tok',
  authenticateToken: (req, _res, next) => {
    req.userRole = req.headers['x-role'] || 'admin';
    req.userId = req.headers['x-uid'] || 'admin1';
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },
  optionalAuth: (req, _res, next) => next(),
}));

const { default: functionsRoutes } = await import('../routes/functions.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/functions', functionsRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const DAY = 24 * 60 * 60 * 1000;
const grant = (app, body, role = 'admin') =>
  request(app).post('/api/functions/grantFreePeriod').set('x-role', role).send(body);

describe('grantFreePeriod (free week / free month)', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    prisma._store.user.push({ id: 'u1', email: 'u1@x.com', role: 'user', premium: false, premium_until: null, deletedAt: null });
    prisma._store.user.push({ id: 'u2', email: 'u2@x.com', role: 'user', premium: false, premium_until: null, deletedAt: null });
    app = buildApp();
  });

  it('grants a free week (~7 days out) to a user by id', async () => {
    const res = await grant(app, { userId: 'u1', period: 'week' });
    expect(res.status).toBe(200);
    const until = new Date(res.body.premium_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 6.9 * DAY);
    expect(until).toBeLessThan(Date.now() + 7.1 * DAY);
    // Only premium_until is set — the paid flag stays false.
    expect(prisma._store.user.find((u) => u.id === 'u1').premium).toBe(false);
  });

  it('grants a free month (~30 days out) by email', async () => {
    const res = await grant(app, { email: 'U2@x.com', period: 'month' });
    expect(res.status).toBe(200);
    const until = new Date(res.body.premium_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 29.9 * DAY);
    expect(until).toBeLessThan(Date.now() + 30.1 * DAY);
  });

  it('rejects an invalid period', async () => {
    expect((await grant(app, { userId: 'u1', period: 'forever' })).status).toBe(400);
    expect((await grant(app, { userId: 'u1' })).status).toBe(400);
  });

  it('requires a target', async () => {
    expect((await grant(app, { period: 'week' })).status).toBe(400);
  });

  it('404s an unknown user', async () => {
    expect((await grant(app, { userId: 'nope', period: 'week' })).status).toBe(404);
  });

  it('is admin-only (403 for a normal user)', async () => {
    expect((await grant(app, { userId: 'u1', period: 'week' }, 'user')).status).toBe(403);
  });

  it('scope:all pushes every active user out', async () => {
    const res = await grant(app, { scope: 'all', period: 'month' });
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(2);
    for (const u of prisma._store.user) {
      expect(new Date(u.premium_until).getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
    }
  });

  it('never shortens a longer existing window', async () => {
    const farFuture = new Date(Date.now() + 100 * DAY);
    prisma._store.user.find((u) => u.id === 'u1').premium_until = farFuture;
    const res = await grant(app, { userId: 'u1', period: 'week' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.premium_until).getTime()).toBe(farFuture.getTime());
  });
});

const revoke = (app, body, role = 'admin') =>
  request(app).post('/api/functions/revokeFreePeriod').set('x-role', role).send(body);

describe('revokeFreePeriod (turn a comp off early)', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    prisma._store.user.push({ id: 'u1', email: 'u1@x.com', role: 'user', premium: false, premium_until: new Date(Date.now() + 7 * DAY), deletedAt: null });
    prisma._store.user.push({ id: 'u2', email: 'u2@x.com', role: 'user', premium: false, premium_until: new Date(Date.now() + 30 * DAY), deletedAt: null });
    app = buildApp();
  });

  it('clears premium_until for one user (by id) without touching the paid flag', async () => {
    const res = await revoke(app, { userId: 'u1' });
    expect(res.status).toBe(200);
    const u1 = prisma._store.user.find((u) => u.id === 'u1');
    expect(u1.premium_until).toBe(null);
    expect(u1.premium).toBe(false);
  });

  it('scope:all clears every trial window', async () => {
    const res = await revoke(app, { scope: 'all' });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
    for (const u of prisma._store.user) expect(u.premium_until).toBe(null);
  });

  it('is admin-only and 404s an unknown user', async () => {
    expect((await revoke(app, { userId: 'u1' }, 'user')).status).toBe(403);
    expect((await revoke(app, { userId: 'nope' })).status).toBe(404);
    expect((await revoke(app, {})).status).toBe(400);
  });
});

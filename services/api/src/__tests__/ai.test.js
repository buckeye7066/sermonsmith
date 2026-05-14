import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const u = prisma._store.user.find((x) => x.id === decoded.userId);
      req.userRole = u?.role;
      req.userPremium = !!u?.premium;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
}));

const { default: aiRoutes, __test: aiInternals } = await import('../routes/ai.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/ai', aiRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
function tokenFor(id) { return jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }); }

describe('ai routes — authentication & abuse limits', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
  });

  it('rejects anonymous /invoke', async () => {
    const res = await request(app).post('/api/ai/invoke').send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects anonymous /image', async () => {
    const res = await request(app).post('/api/ai/image').send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });

  it('clamps maxTokens for non-premium users', () => {
    expect(aiInternals.clampTokens(99999, false)).toBeLessThanOrEqual(1500);
    expect(aiInternals.clampTokens(99999, true)).toBeLessThanOrEqual(4096);
    expect(aiInternals.clampTokens(undefined, false)).toBe(1500);
    expect(aiInternals.clampTokens(-50, false)).toBe(1500);
  });

  it('clamps temperature to [0, 2]', () => {
    expect(aiInternals.clampTemperature(99)).toBe(2);
    expect(aiInternals.clampTemperature(-1)).toBe(0);
    expect(aiInternals.clampTemperature('not-a-number')).toBe(0.7);
  });

  it('enforces a daily usage cap', () => {
    const userId = 'u-quota';
    let allowed = true;
    for (let i = 0; i < 50 && allowed; i++) {
      const r = aiInternals.consumeUsage(userId, false);
      allowed = r.allowed;
    }
    expect(allowed).toBe(false);
  });

  it('returns 503 when DISABLE_AI=1 (the default in tests)', async () => {
    prisma._store.user.push({ id: 'u-x', role: 'user', premium: false });
    process.env.DISABLE_AI = '1';
    const res = await request(app).post('/api/ai/invoke').send({ prompt: 'hi' }).set('Cookie', [`ss_token=${tokenFor('u-x')}`]);
    expect(res.status).toBe(503);
  });

  it('returns 501 (not 200) for unimplemented stub endpoints', async () => {
    prisma._store.user.push({ id: 'u-x', role: 'user', premium: false });
    const sms = await request(app).post('/api/ai/sms').send({ to: '+1234' }).set('Cookie', [`ss_token=${tokenFor('u-x')}`]);
    expect(sms.status).toBe(501);
    const upload = await request(app).post('/api/ai/upload').send({}).set('Cookie', [`ss_token=${tokenFor('u-x')}`]);
    expect(upload.status).toBe(501);
  });
});

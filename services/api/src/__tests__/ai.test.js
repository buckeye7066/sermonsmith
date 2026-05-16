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
      req.userEmail = u?.email;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  },
  requireAdmin: (req, res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
}));

vi.mock('../services/email.js', () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
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

  it('enforces a daily usage cap (DB-backed, persistent across calls)', async () => {
    const userId = 'u-quota';
    let lastResult;
    let denied = false;
    for (let i = 0; i < 35; i++) {
      lastResult = await aiInternals.consumeUsageDb(userId, false, prisma);
      if (!lastResult.allowed) {
        denied = true;
        break;
      }
    }
    expect(denied).toBe(true);
    expect(lastResult.count).toBeGreaterThan(lastResult.limit);
    // The store has exactly one row for this user / today
    const rows = prisma._store.aiUsage.filter((r) => r.userId === userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBeGreaterThan(lastResult.limit);
  });

  it('DB-backed counter survives "process restart" (fresh consumeUsageDb call sees prior count)', async () => {
    const userId = 'u-restart';
    for (let i = 0; i < 10; i++) {
      await aiInternals.consumeUsageDb(userId, false, prisma);
    }
    // Simulate a new process by calling again with the same userId — the
    // stored row still has count=10, next call yields count=11.
    const next = await aiInternals.consumeUsageDb(userId, false, prisma);
    expect(next.count).toBe(11);
    expect(next.allowed).toBe(true);
  });

  it('premium users get the premium limit', async () => {
    const userId = 'u-prem';
    for (let i = 0; i < 100; i++) {
      const r = await aiInternals.consumeUsageDb(userId, true, prisma);
      expect(r.allowed).toBe(true);
    }
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

describe('ai routes — /email lockdown', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    delete process.env.DISABLE_AI;
  });

  it('rejects anonymous /email', async () => {
    const res = await request(app).post('/api/ai/email').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('REJECTS a caller-supplied to: address with HTTP 400', async () => {
    // Policy change: previously the route silently re-routed `to:` to the
    // authenticated user's email. We now reject overrides outright so the
    // contract is impossible to misuse — the endpoint can never be used to
    // mail an arbitrary address.
    prisma._store.user.push({ id: 'u-mail', role: 'user', premium: false, email: 'me@example.com' });
    const { sendEmail } = await import('../services/email.js');
    sendEmail.mockClear();

    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail')}`])
      .send({ to: 'attacker@evil.com', message: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not allowed/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('REJECTS a caller-supplied email: alias with HTTP 400', async () => {
    prisma._store.user.push({ id: 'u-mail-alias', role: 'user', premium: false, email: 'me@example.com' });
    const { sendEmail } = await import('../services/email.js');
    sendEmail.mockClear();

    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail-alias')}`])
      .send({ email: 'attacker@evil.com', message: 'hello' });

    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('REJECTS caller-supplied raw HTML with HTTP 400', async () => {
    prisma._store.user.push({ id: 'u-mail2', role: 'user', premium: false, email: 'me2@example.com' });
    const { sendEmail } = await import('../services/email.js');
    sendEmail.mockClear();

    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail2')}`])
      .send({ html: evil, message: evil });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not allowed/i);
    // Critical: the email must NEVER have been dispatched when the caller
    // supplied raw HTML. Any prior path that escaped-and-sent left the
    // door open to oddly-escaped content driving downstream renderers.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('SENDS the email when the payload is clean (template + message only)', async () => {
    prisma._store.user.push({ id: 'u-mail-ok', role: 'user', premium: false, email: 'ok@example.com' });
    const { sendEmail } = await import('../services/email.js');
    sendEmail.mockClear();

    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail-ok')}`])
      .send({ template: 'notification', message: 'Hello there' });

    expect(res.status).toBe(200);
    expect(res.body.sentTo).toBe('ok@example.com');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sentArg = sendEmail.mock.calls[0][0];
    expect(sentArg.to).toBe('ok@example.com');
    // Server-rendered HTML always escapes the user's message.
    expect(sentArg.html).toContain('Hello there');
    expect(sentArg.html).not.toContain('<script>');
  });

  it('400s on unknown templates', async () => {
    prisma._store.user.push({ id: 'u-mail3', role: 'user', premium: false, email: 'me3@example.com' });
    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail3')}`])
      .send({ template: 'phishing-campaign', message: 'click here' });
    expect(res.status).toBe(400);
  });

  it('400s when message is missing', async () => {
    prisma._store.user.push({ id: 'u-mail4', role: 'user', premium: false, email: 'me4@example.com' });
    const res = await request(app)
      .post('/api/ai/email')
      .set('Cookie', [`ss_token=${tokenFor('u-mail4')}`])
      .send({});
    expect(res.status).toBe(400);
  });
});


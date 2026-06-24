import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(403).json({ message: 'Admin required' });
    next();
  },
  optionalAuth: (req, _res, next) => next(),
}));

vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(async () => ({ id: 'mock-email-id' })),
  sendEmail: vi.fn(async () => ({ id: 'mock-email-id' })),
}));

process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

const { default: authRoutes } = await import('../routes/auth.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

describe('auth routes', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
  });

  it('register rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b' });
    expect(res.status).toBe(400);
  });

  it('register rejects short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('register hashes the password and returns sanitised user', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'alice@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    expect(res.body.user.password).toBeUndefined();
    const stored = prisma._store.user.find((u) => u.email === 'alice@example.com');
    expect(stored.password).not.toBe('longenough123');
    expect(await bcrypt.compare('longenough123', stored.password)).toBe(true);
  });

  it('register does NOT auto-promote when ADMIN_EMAILS is empty', async () => {
    delete process.env.ADMIN_EMAILS;
    const res = await request(app).post('/api/auth/register').send({ email: 'rando@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'rando@example.com');
    expect(stored.role).not.toBe('admin');
    expect(stored.premium).not.toBe(true);
  });

  it('register auto-promotes only env-allowlisted addresses', async () => {
    process.env.ADMIN_EMAILS = 'ops@example.com';
    const res = await request(app).post('/api/auth/register').send({ email: 'ops@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'ops@example.com');
    expect(stored.role).toBe('admin');
    expect(stored.premium).toBe(true);
    delete process.env.ADMIN_EMAILS;
  });

  it('register during Free Week gives the new user a full free week (premium_until ~7d out)', async () => {
    process.env.FREE_WEEK_ENABLED = 'true';
    const DAY = 24 * 60 * 60 * 1000;
    const res = await request(app).post('/api/auth/register').send({ email: 'joiner@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'joiner@example.com');
    const until = new Date(stored.premium_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 6.9 * DAY);
    expect(until).toBeLessThan(Date.now() + 7.1 * DAY);
    // The paid flag is never set — only the self-expiring trial window.
    expect(stored.premium).not.toBe(true);
    delete process.env.FREE_WEEK_ENABLED;
  });

  it('register outside Free Week leaves premium_until unset', async () => {
    delete process.env.FREE_WEEK_ENABLED;
    const res = await request(app).post('/api/auth/register').send({ email: 'normal@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'normal@example.com');
    expect(stored.premium_until == null).toBe(true);
  });

  it('login rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'noone@x', password: 'longenough123' });
    expect(res.status).toBe(401);
  });

  it('login rejects wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma._store.user.push({ id: 'u1', email: 'alice@example.com', password: passwordHash, role: 'user', premium: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('login sets cookie and returns user on success', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma._store.user.push({ id: 'u1', email: 'alice@example.com', password: passwordHash, role: 'user', premium: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/ss_token=/);
  });

  it('forgot-password stores hashed token and never returns it', async () => {
    prisma._store.user.push({ id: 'u1', email: 'alice@example.com', password: 'x', role: 'user', premium: false });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'alice@example.com' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    const reset = prisma._store.passwordReset.find((r) => r.userId === 'u1');
    expect(reset).toBeDefined();
    // The stored value is a SHA-256 hex digest, never the raw token.
    expect(reset.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('forgot-password returns generic success even for unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@x' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account/i);
  });

  it('reset-password rejects unknown / tampered tokens', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'newlongpass1' });
    expect(res.status).toBe(400);
  });
});

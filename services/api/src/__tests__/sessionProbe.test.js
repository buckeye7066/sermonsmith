import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(), sendEmail: vi.fn(),
}));
const prisma = createPrismaMock();
globalThis.__prisma = prisma;
// Exercise the real middleware and router, including token-version revocation.
const { signToken } = await import('../middleware/auth.js');
const { default: authRoutes } = await import('../routes/auth.js');
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/auth', authRoutes);
app.use((err, _req, res, _next) => res.status(500).json({ message: err.message }));
let user;
beforeEach(() => {
  prisma._reset();
  delete process.env.ADMIN_EMAILS;
  user = { id: 'session-user', email: 'session@example.com', role: 'user', premium: false,
    password: 'private-password-hash', tokenVersion: 0, profile: { full_name: 'Test Reader', role: 'admin' } };
  prisma._store.user.push(user);
});
const cookie = (token) => `ss_token=${token}`;

describe('optional startup session probe', () => {
  it('returns an uncached anonymous result without creating a session', async () => {
    const response = await request(app).get('/api/auth/session');
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).patch('/api/auth/me').send({ full_name: 'Intruder' })).status).toBe(401);
  });
  it('returns only the sanitized server-verified user for a valid cookie', async () => {
    const response = await request(app).get('/api/auth/session').set('Cookie', cookie(signToken(user)));
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(user.id);
    expect(response.body.role).toBe('user');
    expect(response.body.password).toBeUndefined();
    expect(response.body.profile.role).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(['invalid', 'expired', 'revoked', 'deleted', 'missing'])('never authenticates a %s session', async (kind) => {
    let token = signToken(user);
    if (kind === 'invalid') token = 'forged.token.value';
    if (kind === 'expired') token = jwt.sign({ userId: user.id, tv: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
    if (kind === 'revoked') user.tokenVersion = 1;
    if (kind === 'deleted') user.deletedAt = new Date();
    if (kind === 'missing') prisma._store.user.length = 0;
    const response = await request(app).get('/api/auth/session').set('Cookie', cookie(token));
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie(token))).status).toBe(401);
  });
  it('retains the suspension response rather than returning a privileged identity', async () => {
    user.is_banned = true;
    const response = await request(app).get('/api/auth/session').set('Cookie', cookie(signToken(user)));
    expect(response.status).toBe(403);
    expect(response.body.id).toBeUndefined();
  });
  it('does not disguise a database outage as expired credentials', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await request(app).get('/api/auth/session').set('Cookie', cookie(signToken(user)));
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database unavailable');
  });
});

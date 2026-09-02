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
  signToken: (userOrId) => {
    const isString = typeof userOrId === 'string';
    const payload = { userId: isString ? userOrId : userOrId.id };
    if (!isString && typeof userOrId.tokenVersion === 'number') payload.tv = userOrId.tokenVersion;
    return jwt.sign(payload, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' });
  },
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
const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

function tokenFor(id) {
  return jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

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

  it('register rejects malformed email addresses', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'longenough123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('register rejects short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'short@example.com', password: 'x' });
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

  it('register grants every new signup a ~7-day free trial (premium_until, always-on by default)', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const res = await request(app).post('/api/auth/register').send({ email: 'joiner@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'joiner@example.com');
    const until = new Date(stored.premium_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 6.9 * DAY);
    expect(until).toBeLessThan(Date.now() + 7.1 * DAY);
    // Only the self-expiring trial window is set — never the paid flag.
    expect(stored.premium).not.toBe(true);
    // Returned in the response body too, not just persisted.
    expect(res.body.user.premium_until).toBeTruthy();
    expect(res.body.user.subscription_tier).toBe('premium');
    expect(res.body.user.entitlements).toContain('community');
  });

  it('register grants a per-user trial window, not a shared/global one', async () => {
    const resA = await request(app).post('/api/auth/register').send({ email: 'trial-a@example.com', password: 'longenough123' });
    const resB = await request(app).post('/api/auth/register').send({ email: 'trial-b@example.com', password: 'longenough123' });
    const a = prisma._store.user.find((u) => u.email === 'trial-a@example.com');
    const b = prisma._store.user.find((u) => u.email === 'trial-b@example.com');
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(a.id).not.toBe(b.id);
    expect(a.premium_until).toBeTruthy();
    expect(b.premium_until).toBeTruthy();
    // Distinct per-user rows, not a single shared timestamp object.
    expect(a.premium_until).not.toBe(b.premium_until);
  });

  it('honors SIGNUP_TRIAL_PERIOD=month for a ~30-day trial', async () => {
    process.env.SIGNUP_TRIAL_PERIOD = 'month';
    const DAY = 24 * 60 * 60 * 1000;
    const res = await request(app).post('/api/auth/register').send({ email: 'monthly@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'monthly@example.com');
    const until = new Date(stored.premium_until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 29.9 * DAY);
    expect(until).toBeLessThan(Date.now() + 30.1 * DAY);
    delete process.env.SIGNUP_TRIAL_PERIOD;
  });

  it('SIGNUP_TRIAL_ENABLED=false disables the auto-trial entirely', async () => {
    process.env.SIGNUP_TRIAL_ENABLED = 'false';
    const res = await request(app).post('/api/auth/register').send({ email: 'notrial@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'notrial@example.com');
    expect(stored.premium_until == null).toBe(true);
    expect(res.body.user.subscription_tier).toBe('free');
    expect(res.body.user.entitlements).not.toContain('community');
    delete process.env.SIGNUP_TRIAL_ENABLED;
  });

  it('does not turn a self-asserted allowlisted registration email into a permanent grant', async () => {
    process.env.SIGNUP_TRIAL_ENABLED = 'false';
    const res = await request(app).post('/api/auth/register').send({
      email: 'buckeye7066@gmail.com',
      password: 'longenough123',
    });
    const stored = prisma._store.user.find((u) => u.email === 'buckeye7066@gmail.com');
    expect(res.status).toBe(200);
    expect(stored.promotionalEmail ?? null).toBeNull();
    expect(res.body.user.subscription_tier).toBe('free');
    expect(res.body.user.entitlements).not.toContain('community');
    delete process.env.SIGNUP_TRIAL_ENABLED;
  });

  it('an auto-promoted admin signup is not additionally stamped with a trial window', async () => {
    process.env.ADMIN_EMAILS = 'ops2@example.com';
    const res = await request(app).post('/api/auth/register').send({ email: 'ops2@example.com', password: 'longenough123' });
    expect(res.status).toBe(200);
    const stored = prisma._store.user.find((u) => u.email === 'ops2@example.com');
    expect(stored.premium_until == null).toBe(true);
    delete process.env.ADMIN_EMAILS;
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

  it('login rejects a banned account with 403 (even with correct password)', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma._store.user.push({ id: 'u1', email: 'banned@example.com', password: passwordHash, role: 'user', premium: false, is_banned: true });
    const res = await request(app).post('/api/auth/login').send({ email: 'banned@example.com', password: 'correct-password' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('login rejects a soft-deleted account with a generic 401 (no existence leak)', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma._store.user.push({ id: 'u1', email: 'gone@example.com', password: passwordHash, role: 'user', premium: false, deletedAt: new Date() });
    const res = await request(app).post('/api/auth/login').send({ email: 'gone@example.com', password: 'correct-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('does not grant Premium when a user copies a promotional phone into profile data', async () => {
    prisma._store.user.push({
      id: 'u-phone-claim',
      email: 'ordinary@example.com',
      password: 'hash',
      role: 'user',
      premium: false,
      premium_until: null,
      promotionalEmail: null,
      promotionalPhone: null,
      profile: {},
    });

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', [`ss_token=${tokenFor('u-phone-claim')}`])
      .send({
        phone: '(931) 998-1779',
        promotionalEmail: 'buckeye7066@gmail.com',
        profile: { phone: '(931) 998-1779', promotionalEmail: 'buckeye7066@gmail.com' },
      });

    expect(res.status).toBe(200);
    expect(res.body.subscription_tier).toBe('free');
    expect(res.body.entitlements).not.toContain('community');
    const stored = prisma._store.user.find((row) => row.id === 'u-phone-claim');
    expect(stored.profile.phone).toBe('(931) 998-1779');
    expect(stored.promotionalEmail).toBeNull();
  });

  it('allows an admin to assign the server-controlled promotional phone', async () => {
    prisma._store.user.push(
      { id: 'u-admin', email: 'admin@example.com', password: 'hash', role: 'admin', premium: true, profile: {} },
      { id: 'u-promo', email: 'promo@example.com', password: 'hash', role: 'user', premium: false, profile: {} },
    );

    const res = await request(app)
      .patch('/api/auth/users/u-promo')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ promotionalPhone: '+1 (931) 998-1779' });

    expect(res.status).toBe(200);
    expect(res.body.promotionalPhone).toBe('19319981779');
    expect(res.body.subscription_tier).toBe('premium');
  });

  it('allows an admin to verify a matching promotional email but rejects mismatches', async () => {
    prisma._store.user.push(
      { id: 'u-admin', email: 'admin@example.com', password: 'hash', role: 'admin', premium: true, profile: {} },
      { id: 'u-promo', email: 'buckeye7066@gmail.com', password: 'hash', role: 'user', premium: false, profile: {} },
      { id: 'u-other', email: 'other@example.com', password: 'hash', role: 'user', premium: false, profile: {} },
    );

    const granted = await request(app)
      .patch('/api/auth/users/u-promo')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ promotionalEmail: 'BUCKEYE7066@GMAIL.COM' });
    const rejected = await request(app)
      .patch('/api/auth/users/u-other')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ promotionalEmail: 'buckeye7066@gmail.com' });

    expect(granted.status).toBe(200);
    expect(granted.body.promotionalEmail).toBe('buckeye7066@gmail.com');
    expect(granted.body.subscription_tier).toBe('premium');
    expect(rejected.status).toBe(400);
    expect(prisma._store.user.find((row) => row.id === 'u-other').promotionalEmail).toBeUndefined();
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

  it('exports user data without password fields and includes typed migration rows', async () => {
    prisma._store.user.push({
      id: 'u-export',
      email: 'export@example.com',
      password: 'secret-hash',
      role: 'user',
      premium: false,
      profile: { theme: 'dark', role: 'admin' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma._store.entity.push({
      id: 'entity-1',
      type: 'Sermon',
      userId: 'u-export',
      data: {
        title: 'Generic Sermon',
        reported_by: ['u-reporter'],
        last_report: { reporterId: 'u-reporter', reason: 'Confidential report' },
        moderator_notes: 'Staff only',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma._store.sermon.push({
      id: 'sermon-1',
      userId: 'u-export',
      title: 'Typed Sermon',
      status: 'draft',
      content: { title: 'Typed Sermon' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma._store.sharedContent.push({
      id: 'typed-shared-1',
      userId: 'u-export',
      title: 'Reported typed content',
      moderatorNotes: 'Staff note',
      removedBy: 'u-admin',
      content: { body: 'Text', last_report: { reporterId: 'u-reporter' } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma._store.communityFollow.push(
      { id: 'follow-out', followerId: 'u-export', followingId: 'u-other', createdAt: new Date() },
      { id: 'follow-in', followerId: 'u-other', followingId: 'u-export', createdAt: new Date() },
    );
    prisma._store.communityGroupMember.push({
      id: 'membership-1', groupId: 'group-1', userId: 'u-export', role: 'member', userName: 'Export User', joinedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/auth/export')
      .set('Cookie', [`ss_token=${tokenFor('u-export')}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.profile.role).toBeUndefined();
    expect(res.body.user.theme).toBe('dark');
    expect(res.body.entities).toHaveLength(1);
    expect(res.body.entities[0].data).not.toHaveProperty('reported_by');
    expect(res.body.entities[0].data).not.toHaveProperty('last_report');
    expect(res.body.entities[0].data).not.toHaveProperty('moderator_notes');
    expect(res.body.typed.sermons).toHaveLength(1);
    expect(res.body.typed.sharedContents[0]).not.toHaveProperty('moderatorNotes');
    expect(res.body.typed.sharedContents[0]).not.toHaveProperty('removedBy');
    expect(res.body.typed.sharedContents[0].content).not.toHaveProperty('last_report');
    expect(res.body.community.following).toMatchObject([{ followingId: 'u-other' }]);
    expect(res.body.community.followers).toMatchObject([{ followerId: 'u-other' }]);
    expect(res.body.community.groupMemberships).toMatchObject([{ groupId: 'group-1', role: 'member' }]);
    expect(prisma._store.auditLog.some((row) => row.action === 'privacy.export')).toBe(true);
  });

  it('self-delete soft deletes the account, bumps tokenVersion, and clears the cookie', async () => {
    prisma._store.user.push({
      id: 'u-delete',
      email: 'delete@example.com',
      password: 'hash',
      role: 'user',
      premium: false,
      tokenVersion: 0,
      deletedAt: null,
    });
    prisma._store.user.push(
      { id: 'u-successor', email: 'next@example.com', role: 'user', premium: true, deletedAt: null },
      { id: 'u-follower', email: 'follower@example.com', role: 'user', premium: true, deletedAt: null },
    );
    prisma._store.entity.push(
      {
        id: 'group-transfer', type: 'StudyGroup', userId: 'u-delete',
        data: { name: 'Transfer me', member_count: 2 }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'group-empty', type: 'StudyGroup', userId: 'u-delete',
        data: { name: 'Delete me', member_count: 1 }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'group-empty-message', type: 'GroupMessage', userId: 'u-delete',
        data: { group_id: 'group-empty', message: 'Old' }, createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'delete-leader-transfer', groupId: 'group-transfer', userId: 'u-delete', role: 'leader', userName: 'Delete', joinedAt: new Date('2026-01-01') },
      { id: 'successor-member', groupId: 'group-transfer', userId: 'u-successor', role: 'member', userName: 'Next', joinedAt: new Date('2026-01-02') },
      { id: 'delete-leader-empty', groupId: 'group-empty', userId: 'u-delete', role: 'leader', userName: 'Delete', joinedAt: new Date('2026-01-01') },
    );
    prisma._store.communityFollow.push(
      { id: 'delete-follows', followerId: 'u-delete', followingId: 'u-successor', createdAt: new Date() },
      { id: 'follows-delete', followerId: 'u-follower', followingId: 'u-delete', createdAt: new Date() },
    );

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Cookie', [`ss_token=${tokenFor('u-delete')}`]);

    expect(res.status).toBe(204);
    const stored = prisma._store.user.find((u) => u.id === 'u-delete');
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored.tokenVersion).toBe(1);
    expect(res.headers['set-cookie']?.[0]).toMatch(/ss_token=/);
    expect(prisma._store.communityFollow).toHaveLength(0);
    expect(prisma._store.communityGroupMember.some((row) => row.userId === 'u-delete')).toBe(false);
    expect(prisma._store.communityGroupMember.find((row) => row.userId === 'u-successor')).toMatchObject({ role: 'leader' });
    expect(prisma._store.entity.find((row) => row.id === 'group-transfer')).toMatchObject({
      userId: 'u-successor',
      data: expect.objectContaining({ member_count: 1 }),
    });
    expect(prisma._store.entity.some((row) => row.id === 'group-empty' || row.data?.group_id === 'group-empty')).toBe(false);
    expect(prisma._store.auditLog.some((row) => row.action === 'privacy.account_delete_requested')).toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('admin soft-delete runs the same follow, membership, and ownership cleanup', async () => {
    prisma._store.user.push(
      { id: 'u-admin-delete', email: 'admin@example.com', role: 'admin', premium: true, tokenVersion: 0, deletedAt: null },
      { id: 'u-target-delete', email: 'target@example.com', role: 'user', premium: true, tokenVersion: 4, deletedAt: null },
      { id: 'u-next-leader', email: 'next@example.com', role: 'user', premium: true, tokenVersion: 0, deletedAt: null },
    );
    prisma._store.entity.push({
      id: 'admin-transfer-group', type: 'StudyGroup', userId: 'u-target-delete',
      data: { name: 'Transfer', member_count: 2 }, createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'admin-target-membership', groupId: 'admin-transfer-group', userId: 'u-target-delete', role: 'leader', userName: 'Target', joinedAt: new Date('2026-01-01') },
      { id: 'admin-next-membership', groupId: 'admin-transfer-group', userId: 'u-next-leader', role: 'leader', userName: 'Next', joinedAt: new Date('2026-01-02') },
    );
    prisma._store.communityFollow.push({
      id: 'admin-target-follow', followerId: 'u-next-leader', followingId: 'u-target-delete', createdAt: new Date(),
    });

    const res = await request(app)
      .delete('/api/auth/users/u-target-delete')
      .set('Cookie', [`ss_token=${tokenFor('u-admin-delete')}`]);

    expect(res.status).toBe(204);
    expect(prisma._store.user.find((row) => row.id === 'u-target-delete')).toMatchObject({
      tokenVersion: 5,
      deletedAt: expect.any(Date),
    });
    expect(prisma._store.communityFollow).toHaveLength(0);
    expect(prisma._store.communityGroupMember.some((row) => row.userId === 'u-target-delete')).toBe(false);
    expect(prisma._store.entity.find((row) => row.id === 'admin-transfer-group')).toMatchObject({
      userId: 'u-next-leader',
      data: expect.objectContaining({ member_count: 1 }),
    });
    expect(prisma._store.auditLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'admin.user_soft_delete',
        userId: 'u-admin-delete',
        targetId: 'u-target-delete',
      }),
    ]));
  });

  it('does not transfer a soft-deleted owner group to a banned member', async () => {
    prisma._store.user.push(
      { id: 'u-delete-banned-owner', email: 'owner@example.com', role: 'user', premium: true, tokenVersion: 0, deletedAt: null, is_banned: false },
      { id: 'u-banned-successor', email: 'banned@example.com', role: 'user', premium: true, tokenVersion: 0, deletedAt: null, is_banned: true },
    );
    prisma._store.entity.push({
      id: 'group-banned-successor', type: 'StudyGroup', userId: 'u-delete-banned-owner',
      data: { name: 'No usable successor', member_count: 2 }, createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'banned-owner-membership', groupId: 'group-banned-successor', userId: 'u-delete-banned-owner', role: 'leader', userName: 'Owner', joinedAt: new Date('2026-01-01') },
      { id: 'banned-successor-membership', groupId: 'group-banned-successor', userId: 'u-banned-successor', role: 'member', userName: 'Banned', joinedAt: new Date('2026-01-02') },
    );

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Cookie', [`ss_token=${tokenFor('u-delete-banned-owner')}`]);

    expect(res.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'group-banned-successor')).toBe(false);
    expect(prisma._store.communityGroupMember.some((row) => row.groupId === 'group-banned-successor')).toBe(false);
  });

  it('revoke-sessions bumps tokenVersion, audits the action, and reissues the cookie', async () => {
    prisma._store.user.push({
      id: 'u-revoke',
      email: 'revoke@example.com',
      password: 'hash',
      role: 'user',
      premium: false,
      tokenVersion: 2,
    });

    const res = await request(app)
      .post('/api/auth/revoke-sessions')
      .set('Cookie', [`ss_token=${tokenFor('u-revoke')}`]);

    expect(res.status).toBe(200);
    expect(res.body.user.tokenVersion).toBe(3);
    expect(res.body.user.password).toBeUndefined();
    const stored = prisma._store.user.find((u) => u.id === 'u-revoke');
    expect(stored.tokenVersion).toBe(3);
    expect(prisma._store.auditLog.some((row) => row.action === 'auth.sessions_revoked')).toBe(true);

    const cookie = res.headers['set-cookie']?.[0] || '';
    const token = cookie.match(/ss_token=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    expect(decoded.userId).toBe('u-revoke');
    expect(decoded.tv).toBe(3);
  });
});

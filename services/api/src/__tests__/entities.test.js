import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Wire the route module against our in-memory Prisma mock by hijacking the
// shared middleware/auth import.
const prisma = createPrismaMock();

vi.mock('../middleware/auth.js', () => ({
  prisma,
  AUTH_COOKIE: 'ss_token',
  cookieOptions: () => ({ httpOnly: true, secure: false, sameSite: 'lax' }),
  signToken: (id) => jwt.sign({ userId: id }, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithm: 'HS256', expiresIn: '1h' }),
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret-that-is-at-least-32-chars-long', { algorithms: ['HS256'] });
      req.userId = decoded.userId;
      const user = prisma._store.user.find((u) => u.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userRole = user.role;
      req.userPremium = !!user.premium;
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  },
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(403).json({ message: 'Admin access required' });
    next();
  },
  optionalAuth: (req, _res, next) => next(),
  requirePremium: (req, res, next) => {
    if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') return res.status(402).json({ message: 'Premium subscription required' });
    next();
  },
}));

const { default: entityRoutes } = await import('../routes/entities.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/entities', entityRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';

function tokenFor(userId) {
  return jwt.sign({ userId }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

describe('entities — tenant isolation', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-alice', email: 'a@x', role: 'user', premium: false });
    prisma._store.user.push({ id: 'u-bob', email: 'b@x', role: 'user', premium: false });
    prisma._store.user.push({ id: 'u-admin', email: 'c@x', role: 'admin', premium: true });
    // Each user owns one Sermon entity.
    prisma._store.entity.push({ id: 'e-alice-1', type: 'Sermon', userId: 'u-alice', data: { title: 'Alice sermon' }, createdAt: new Date(), updatedAt: new Date() });
    prisma._store.entity.push({ id: 'e-bob-1', type: 'Sermon', userId: 'u-bob', data: { title: 'Bob sermon' }, createdAt: new Date(), updatedAt: new Date() });
  });

  it('rejects anonymous list', async () => {
    const res = await request(app).get('/api/entities/Sermon');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous filter', async () => {
    const res = await request(app).post('/api/entities/Sermon/filter').send({});
    expect(res.status).toBe(401);
  });

  it('rejects anonymous get', async () => {
    const res = await request(app).get('/api/entities/Sermon/e-alice-1');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous create', async () => {
    const res = await request(app).post('/api/entities/Sermon').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('blocks free accounts from premium entity types at the generic API boundary', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`])
      .send({ title: 'Bypass attempt', content: 'Direct API call', post_type: 'discussion' });

    expect(res.status).toBe(402);
    expect(prisma._store.entity.some((row) => row.type === 'CommunityPost')).toBe(false);
  });

  it('cannot retrieve an owned Premium entity through an ungated URL type', async () => {
    prisma._store.entity.push({
      id: 'premium-owned-post', type: 'CommunityPost', userId: 'u-alice',
      data: { title: 'Premium record', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
    });

    const mismatched = await request(app)
      .get('/api/entities/Sermon/premium-owned-post')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const correctlyTyped = await request(app)
      .get('/api/entities/CommunityPost/premium-owned-post')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);

    expect(mismatched.status).toBe(404);
    expect(mismatched.body.title).toBeUndefined();
    expect(correctlyTyped.status).toBe(402);
  });

  it('keeps reporter and moderator metadata out of owner-facing generic responses', async () => {
    prisma._store.entity.push({
      id: 'reported-owned-content', type: 'SharedContent', userId: 'u-alice',
      data: {
        title: 'Owned note', content: 'Body', content_type: 'note', visibility: 'private',
        status: 'reported', reported_count: 1, reported_by: ['u-bob'],
        last_report: { reporterId: 'u-bob', reason: 'Private report' },
        moderator_notes: 'Internal only', removedBy: 'u-admin',
      },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const direct = await request(app)
      .get('/api/entities/SharedContent/reported-owned-content')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const filtered = await request(app)
      .post('/api/entities/SharedContent/filter')
      .send({})
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const reporterProbe = await request(app)
      .post('/api/entities/SharedContent/filter')
      .send({ reported_by: ['u-bob'] })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const updated = await request(app)
      .put('/api/entities/SharedContent/reported-owned-content')
      .send({ title: 'Updated title' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);

    for (const payload of [direct.body, filtered.body[0], updated.body]) {
      expect(payload).not.toHaveProperty('reported_by');
      expect(payload).not.toHaveProperty('last_report');
      expect(payload).not.toHaveProperty('moderator_notes');
      expect(payload).not.toHaveProperty('removedBy');
    }
    expect(reporterProbe.status).toBe(400);
    const stored = prisma._store.entity.find((row) => row.id === 'reported-owned-content');
    expect(stored.data.reported_by).toEqual(['u-bob']);
    expect(stored.data.last_report.reporterId).toBe('u-bob');
  });

  it('alice only sees her own sermons in list', async () => {
    const res = await request(app)
      .get('/api/entities/Sermon')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Alice sermon');
  });

  it('alice only sees her own sermons in filter', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon/filter')
      .send({})
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Alice sermon');
  });

  it('alice cannot fetch bob entity by id', async () => {
    const res = await request(app)
      .get('/api/entities/Sermon/e-bob-1')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
  });

  it('alice cannot update bob entity', async () => {
    const res = await request(app)
      .put('/api/entities/Sermon/e-bob-1')
      .send({ title: 'hacked' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
  });

  it('alice cannot delete bob entity', async () => {
    const res = await request(app)
      .delete('/api/entities/Sermon/e-bob-1')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
  });

  it('alice cannot impersonate bob via filter user_id', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon/filter')
      .send({ user_id: 'u-bob' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(200);
    // user_id is stripped, scope still narrows to alice's userId.
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Alice sermon');
  });

  it('non-admin cannot list users', async () => {
    const res = await request(app)
      .get('/api/entities/User')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
  });

  it('admin can list all users', async () => {
    const res = await request(app)
      .get('/api/entities/User')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('admin user inventory omits soft-deactivated accounts', async () => {
    prisma._store.user.push({
      id: 'u-deactivated', email: 'gone@x', role: 'user', premium: false,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/entities/User')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);

    expect(res.status).toBe(200);
    expect(res.body.map((user) => user.id)).not.toContain('u-deactivated');
  });

  it('does not let the generic entity route silently ignore a suspension request', async () => {
    const res = await request(app)
      .put('/api/entities/User/u-alice')
      .send({ is_banned: true })
      .set('Cookie', ['ss_token=' + tokenFor('u-admin')]);

    expect(res.status).toBe(409);
    expect(prisma._store.user.find((user) => user.id === 'u-alice').is_banned).toBeUndefined();
  });

  it('does not bypass account lifecycle cleanup through generic user deletion', async () => {
    const res = await request(app)
      .delete('/api/entities/User/u-alice')
      .set('Cookie', ['ss_token=' + tokenFor('u-admin')]);

    expect(res.status).toBe(409);
    expect(prisma._store.user.some((user) => user.id === 'u-alice')).toBe(true);
  });

  it('admin can list all sermons', async () => {
    const res = await request(app)
      .get('/api/entities/Sermon')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('create strips client-supplied user_id', async () => {
    const res = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'spoof', user_id: 'u-bob' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(200);
    const entity = prisma._store.entity.find((e) => e.id === res.body.id);
    expect(entity.userId).toBe('u-alice');
    expect(entity.data.user_id).toBe('u-alice');
  });
});

describe('entities — allowlist (regression for broken creates)', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-alice', email: 'a@x', role: 'user', premium: false });
    prisma._store.user.push({ id: 'u-admin', email: 'admin@x', role: 'admin', premium: true });
  });

  // Regression: these types were missing from ENTITY_SCHEMAS, so every
  // create() against them 400'd with "Unsupported entity type" — the
  // "Failed to add tag" bug, plus saving studies/plans/ratings/etc.
  it('allows creating a ResourceTag (was "Failed to add tag")', async () => {
    const res = await request(app)
      .post('/api/entities/ResourceTag')
      .send({ tag: 'grace', resource_type: 'sermon', color: 'blue' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(200);
    expect(res.body.tag).toBe('grace');
    expect(res.body.id).toBeTruthy();
  });

  it('allows creating a BibleStudy and a ReadingPlan', async () => {
    const study = await request(app)
      .post('/api/entities/BibleStudy')
      .send({ title: 'Romans overview', topic: 'grace' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(study.status).toBe(200);

    const plan = await request(app)
      .post('/api/entities/ReadingPlan')
      .send({ name: '30-day plan' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(plan.status).toBe(200);
  });

  it('keeps private saves free but blocks public Community publication without entitlement', async () => {
    const privateContent = await request(app)
      .post('/api/entities/SharedContent')
      .send({ title: 'Private note', content: 'My note', content_type: 'note', visibility: 'private' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(privateContent.status).toBe(200);

    const publicContent = await request(app)
      .post('/api/entities/SharedContent')
      .send({ title: 'Public note', content: 'My note', content_type: 'note', visibility: 'public' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(publicContent.status).toBe(402);
    expect(publicContent.body.message).toMatch(/Community requires Premium/i);

    const publicPlan = await request(app)
      .post('/api/entities/ReadingPlan')
      .send({ name: 'Published plan', is_public: true })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(publicPlan.status).toBe(402);

    const publishExisting = await request(app)
      .put(`/api/entities/SharedContent/${privateContent.body.id}`)
      .send({ visibility: 'public' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(publishExisting.status).toBe(402);
    expect(prisma._store.entity.find((row) => row.id === privateContent.body.id).data.visibility).toBe('private');
  });

  it('allows an entitled account to publish SharedContent and ReadingPlan rows', async () => {
    prisma._store.user.push({ id: 'u-premium', email: 'premium@x', role: 'user', premium: true });
    const shared = await request(app)
      .post('/api/entities/SharedContent')
      .send({ title: 'Public note', content: 'John 3:16', content_type: 'note', visibility: 'public' })
      .set('Cookie', [`ss_token=${tokenFor('u-premium')}`]);
    const plan = await request(app)
      .post('/api/entities/ReadingPlan')
      .send({
        name: 'Published plan', is_public: true, daily_readings: [],
        followers_count: 9000, average_rating: 5, ratings_count: 9000,
      })
      .set('Cookie', [`ss_token=${tokenFor('u-premium')}`]);
    expect(shared.status).toBe(200);
    expect(plan.status).toBe(200);
    expect(plan.body).toMatchObject({ followers_count: 0, average_rating: 0, ratings_count: 0 });
  });

  it('re-reads community-visible JSON after taking the shared mutation lock', async () => {
    prisma._store.user.push({ id: 'u-premium', email: 'premium@x', role: 'user', premium: true });
    prisma._store.entity.push({
      id: 'shared-locked',
      type: 'SharedContent',
      userId: 'u-premium',
      data: {
        title: 'Before', content: 'John 3:16', content_type: 'note', visibility: 'public',
        status: 'active', likes_count: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Simulate a moderation/interaction write landing after the route's first
    // ownership lookup but before its transaction acquires the lock.
    prisma.$queryRaw.mockImplementationOnce(async () => {
      const row = prisma._store.entity.find((entity) => entity.id === 'shared-locked');
      row.data = { ...row.data, status: 'removed', likes_count: 2 };
      return [{ ok: 1 }];
    });

    const updated = await request(app)
      .put('/api/entities/SharedContent/shared-locked')
      .send({ title: 'After' })
      .set('Cookie', [`ss_token=${tokenFor('u-premium')}`]);

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: 'After', status: 'removed', likes_count: 2 });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('still rejects a genuinely unknown entity type', async () => {
    const res = await request(app)
      .post('/api/entities/TotallyMadeUpType')
      .send({ foo: 'bar' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(400);
  });

  it('preserves owner CRUD for legacy SharedSeries rows', async () => {
    prisma._store.user.find((user) => user.id === 'u-alice').premium = true;
    const created = await request(app)
      .post('/api/entities/SharedSeries')
      .send({ series_title: 'Romans', series_description: 'A teaching series', views_count: 999 })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(created.status).toBe(200);
    expect(created.body.views_count).toBe(0);

    const updated = await request(app)
      .put(`/api/entities/SharedSeries/${created.body.id}`)
      .send({ series_title: 'Romans Revised', views_count: 999 })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(updated.status).toBe(200);
    expect(updated.body.series_title).toBe('Romans Revised');
    expect(updated.body.views_count).toBe(0);
    expect(prisma.$queryRaw).toHaveBeenCalled();

    const removed = await request(app)
      .delete(`/api/entities/SharedSeries/${created.body.id}`)
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === created.body.id)).toBe(false);
  });

  // Security: SharedLink is server-managed. It grants read access to a target
  // resource by slug and must only be minted by createShareableLink (which
  // verifies ownership). Forging one through the generic API let a user point
  // it at another user's private entity, so the generic create path rejects it.
  it('forbids creating a SharedLink through the generic entity API', async () => {
    const res = await request(app)
      .post('/api/entities/SharedLink')
      .send({ slug: 'forged', resourceId: 'someone-elses-resource' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
    expect(prisma._store.entity.some((e) => e.type === 'SharedLink')).toBe(false);
  });

  it('cannot bypass server-managed deletion with a mismatched URL type', async () => {
    prisma._store.entity.push({
      id: 'managed-post', type: 'CommunityPost', userId: 'u-alice',
      data: { title: 'Keep until dedicated cleanup', status: 'active' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await request(app)
      .delete('/api/entities/Sermon/managed-post')
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(404);
    expect(prisma._store.entity.some((row) => row.id === 'managed-post')).toBe(true);
  });

  it('forbids creating a SharedLink through the bulk entity API', async () => {
    const res = await request(app)
      .post('/api/entities/SharedLink/bulk')
      .send({ items: [{ slug: 'forged', resourceId: 'x' }] })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
    expect(prisma._store.entity.some((e) => e.type === 'SharedLink')).toBe(false);
  });

  it('blocks every generic read path for private-plan GroupProgress snapshots', async () => {
    prisma._store.entity.push({
      id: 'stale-progress-owner', type: 'GroupProgress', userId: 'u-admin',
      data: { group_id: 'g-1', plan_snapshot: { title: 'Private replacement plan' } },
      createdAt: new Date(), updatedAt: new Date(),
    });
    const cookie = ['ss_token=' + tokenFor('u-admin')];

    const [list, filtered, direct] = await Promise.all([
      request(app).get('/api/entities/GroupProgress').set('Cookie', cookie),
      request(app).post('/api/entities/GroupProgress/filter').set('Cookie', cookie).send({}),
      request(app).get('/api/entities/GroupProgress/stale-progress-owner').set('Cookie', cookie),
    ]);

    expect([list.status, filtered.status, direct.status]).toEqual([403, 403, 403]);
    expect(JSON.stringify([list.body, filtered.body, direct.body])).not.toContain('Private replacement plan');
  });

  it('does not allow the generic admin User update to bypass ban cleanup', async () => {
    const res = await request(app)
      .put('/api/entities/User/u-alice')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ is_banned: true, banned_at: new Date().toISOString() });

    expect(res.status).toBe(409);
    expect(prisma._store.user.find((row) => row.id === 'u-alice').is_banned).not.toBe(true);
  });
});

describe('entities — community forum types', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-carol', email: 'carol@x', role: 'user', premium: true });
  });

  // Public forum identities and counters are server-authored by the dedicated
  // Community routes; the generic document API must not mint either type.
  it('blocks generic CommunityPost creation', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .send({
        title: 'How should I study Romans?',
        content: 'Looking for a good approach to the book of Romans.',
        post_type: 'question',
        scripture_reference: 'Romans 1:1',
        user_name: 'Carol',
      })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(403);
  });

  it('blocks abbreviated generic CommunityPost creation paths too', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .send({ title: 'Just sharing', content: 'A testimony of grace.' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(403);
  });

  it('blocks generic CommunityReply creation', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityReply')
      .send({ post_id: 'p-1', content: 'Great question — start with the gospel framing.', user_name: 'Carol' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(403);
  });

  it('blocks generic CommunityPost creation before payload validation', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .send({ title: 'Empty body' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(403);
  });

  it('still rejects a genuinely unknown entity type (400)', async () => {
    const res = await request(app)
      .post('/api/entities/NotARealType')
      .send({ title: 'x' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(400);
  });
});

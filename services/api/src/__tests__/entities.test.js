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

  it('accepts canonical schedule dates and rejects ambiguous values', async () => {
    const scheduled = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Christmas Eve', scheduled_date: '2026-12-24T12:00:00.000Z', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const legacyDate = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Date only', scheduled_date: '2026-12-25', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const invalid = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Ambiguous', scheduled_date: 'next Sunday', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const leapDay = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Leap day', scheduled_date: '2024-02-29', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const impossibleDay = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Impossible day', scheduled_date: '2026-02-31', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const nonLeapDay = await request(app)
      .post('/api/entities/Sermon')
      .send({ title: 'Non-leap day', scheduled_date: '2026-02-29', status: 'draft' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(scheduled.status).toBe(200);
    expect(legacyDate.status).toBe(200);
    expect(leapDay.status).toBe(200);
    expect(invalid.status).toBe(400);
    expect(impossibleDay.status).toBe(400);
    expect(nonLeapDay.status).toBe(400);
  });

  it('stores reusable sermon and series templates with bounded content', async () => {
    const sermonTemplate = await request(app)
      .post('/api/entities/SermonTemplate')
      .send({
        name: 'Three-point outline',
        content: {
          title: 'Reusable outline',
          introduction: 'A reusable opening movement.',
          points: [{ title: 'First point' }],
        },
      })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const seriesTemplate = await request(app)
      .post('/api/entities/SeriesTemplate')
      .send({
        name: 'Four-week series',
        content: {
          title: 'Reusable series',
          length: 4,
          sermon_blueprints: [{ title: 'Week one', anchor_passage: 'John 1:1' }],
        },
      })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(sermonTemplate.status).toBe(200);
    expect(sermonTemplate.body.content.introduction).toBe('A reusable opening movement.');
    expect(seriesTemplate.status).toBe(200);
  });

  it('instantiates one complete series exactly once across concurrent retries', async () => {
    const template = await request(app)
      .post('/api/entities/SeriesTemplate')
      .send({
        name: 'Advent',
        content: {
          title: 'Advent series',
          sermon_blueprints: [{
            title: 'Hope',
            introduction: 'Waiting begins in hope.',
          }],
        },
      })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const requestId = '11111111-1111-4111-8111-111111111111';
    const instantiate = () => request(app)
      .post(`/api/entities/SeriesTemplate/${template.body.id}/instantiate`)
      .send({ request_id: requestId })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);

    const [first, retry] = await Promise.all([instantiate(), instantiate()]);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(first.body).toEqual(retry.body);
    expect(first.body.series.id).toBe(requestId);
    expect(first.body.sermons[0]).toMatchObject({
      title: 'Hope',
      introduction: 'Waiting begins in hope.',
      series_id: requestId,
      status: 'draft',
      scheduled_date: null,
    });
    expect(prisma._store.entity.filter((item) => item.type === 'SermonSeries')).toHaveLength(1);
    expect(prisma._store.entity.filter((item) => (
      item.type === 'Sermon' && item.data?.template_instantiation_id === requestId
    ))).toHaveLength(1);
  });

  it('rolls back the series when a dependent sermon cannot be stored', async () => {
    const template = await request(app)
      .post('/api/entities/SeriesTemplate')
      .send({
        name: 'Atomic series',
        content: { sermon_blueprints: [{ title: 'Dependent draft' }] },
      })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    const requestId = '22222222-2222-4222-8222-222222222222';
    const createEntity = prisma.entity.create.getMockImplementation();
    prisma.entity.create
      .mockImplementationOnce(createEntity)
      .mockRejectedValueOnce(new Error('dependent sermon write failed'));

    const result = await request(app)
      .post(`/api/entities/SeriesTemplate/${template.body.id}/instantiate`)
      .send({ request_id: requestId })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);

    expect(result.status).toBe(500);
    expect(prisma._store.entity.some((item) => item.id === requestId)).toBe(false);
    expect(prisma._store.entity.some((item) => item.data?.template_instantiation_id === requestId)).toBe(false);
  });

  it('rejects identity and lifecycle fields inside template content', async () => {
    const res = await request(app)
      .post('/api/entities/SermonTemplate')
      .send({
        name: 'Unsafe copy',
        content: { title: 'Copy', user_id: 'another-user', status: 'published' },
      })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(400);
  });

  it('still rejects a genuinely unknown entity type', async () => {
    const res = await request(app)
      .post('/api/entities/TotallyMadeUpType')
      .send({ foo: 'bar' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(400);
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

  it('forbids creating a SharedLink through the bulk entity API', async () => {
    const res = await request(app)
      .post('/api/entities/SharedLink/bulk')
      .send({ items: [{ slug: 'forged', resourceId: 'x' }] })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(403);
    expect(prisma._store.entity.some((e) => e.type === 'SharedLink')).toBe(false);
  });
});

describe('entities — community forum types', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-carol', email: 'carol@x', role: 'user', premium: false });
  });

  // Regression: the Forum page POSTs CommunityPost/CommunityReply, but those
  // types were absent from ENTITY_SCHEMAS, so every "New Post" 400'd with
  // "Unsupported entity type: CommunityPost".
  it('creates a CommunityPost', async () => {
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
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('How should I study Romans?');
    expect(res.body.post_type).toBe('question');
  });

  it('defaults CommunityPost.post_type to discussion when omitted', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .send({ title: 'Just sharing', content: 'A testimony of grace.' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(200);
    expect(res.body.post_type).toBe('discussion');
  });

  it('creates a CommunityReply', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityReply')
      .send({ post_id: 'p-1', content: 'Great question — start with the gospel framing.', user_name: 'Carol' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Great question — start with the gospel framing.');
  });

  it('rejects a CommunityPost with no content (400)', async () => {
    const res = await request(app)
      .post('/api/entities/CommunityPost')
      .send({ title: 'Empty body' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(400);
  });

  it('still rejects a genuinely unknown entity type (400)', async () => {
    const res = await request(app)
      .post('/api/entities/NotARealType')
      .send({ title: 'x' })
      .set('Cookie', [`ss_token=${tokenFor('u-carol')}`]);
    expect(res.status).toBe(400);
  });
});

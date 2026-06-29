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

  it('still rejects a genuinely unknown entity type', async () => {
    const res = await request(app)
      .post('/api/entities/TotallyMadeUpType')
      .send({ foo: 'bar' })
      .set('Cookie', [`ss_token=${tokenFor('u-alice')}`]);
    expect(res.status).toBe(400);
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

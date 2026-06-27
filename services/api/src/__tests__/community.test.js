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
  authenticateToken: async (req, res, next) => {
    const token = req.cookies?.ss_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      const user = prisma._store.user.find((u) => u.id === decoded.userId);
      if (!user) return res.status(401).json({ message: 'User account not found' });
      req.userId = user.id;
      req.userRole = user.role;
      req.userPremium = !!user.premium;
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  },
  optionalAuth: (_req, _res, next) => next(),
  requireAdmin: (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },
}));

const { default: communityRoutes } = await import('../routes/community.js');

function tokenFor(userId) {
  return jwt.sign({ userId }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/community', communityRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

function sharedContent(id, data = {}) {
  return {
    id,
    type: 'SharedContent',
    userId: data.userId || 'u-owner',
    data: {
      title: data.title || `Shared ${id}`,
      content: data.content || 'Body',
      content_type: data.content_type || 'note',
      visibility: data.visibility || 'public',
      status: data.status || 'active',
      ...data,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('community routes', () => {
  let app;

  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-reader', role: 'user', premium: false });
    prisma._store.user.push({ id: 'u-admin', role: 'admin', premium: true });
    prisma._store.user.push({ id: 'u-owner', role: 'user', premium: false });
  });

  it('hides removed public content from the shared-content feed', async () => {
    prisma._store.entity.push(sharedContent('visible'));
    prisma._store.entity.push(sharedContent('removed', { status: 'removed' }));

    const res = await request(app).get('/api/community/shared-content');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('visible');
  });

  it('lets authenticated users report public shared content', async () => {
    prisma._store.entity.push(sharedContent('report-me'));

    const res = await request(app)
      .post('/api/community/shared-content/report-me/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'theology', reason: 'Needs review' });

    expect(res.status).toBe(200);
    expect(res.body.reported_count).toBe(1);
    expect(res.body.last_report.category).toBe('theology');
    expect(prisma._store.auditLog.some((row) => row.action === 'community.report')).toBe(true);
  });

  it('requires admin access for the moderation queue', async () => {
    prisma._store.entity.push(sharedContent('queued', { reported_count: 2 }));

    const blocked = await request(app)
      .get('/api/community/moderation/queue')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .get('/api/community/moderation/queue')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(allowed.status).toBe(200);
    expect(allowed.body.map((row) => row.id)).toContain('queued');
  });

  it('lets admins remove content and immediately hides it from public reads', async () => {
    prisma._store.entity.push(sharedContent('moderate-me', { reported_count: 3, status: 'reported' }));

    const updated = await request(app)
      .patch('/api/community/moderation/SharedContent/moderate-me')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ status: 'removed', moderatorNotes: 'Personal data in content' });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('removed');
    expect(updated.body.removedBy).toBe('u-admin');

    const feed = await request(app).get('/api/community/shared-content');
    expect(feed.status).toBe(200);
    expect(feed.body).toHaveLength(0);
  });
});

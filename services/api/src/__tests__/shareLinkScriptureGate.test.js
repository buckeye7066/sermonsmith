import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPrismaMock } from './setup.js';

// Round-3 B1: share links are a public-exposure surface that does NOT go through
// the entity save gate. These tests pin that createShareableLink and
// /api/community/share/:slug both run the SAME centralized Scripture gate, so a
// gated resource with unverified references can neither be shared nor served —
// including a resource that was valid when shared and later edited to invalid.

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
  requireDevTools: (req, res, next) => next(),
}));

const { default: functionsRoutes } = await import('../routes/functions.js');
const { default: communityRoutes } = await import('../routes/community.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/functions', functionsRoutes);
  app.use('/api/community', communityRoutes);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ message: err.message }));
  return app;
}

const SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const tokenFor = (id) => jwt.sign({ userId: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
const asUser = (id) => [`ss_token=${tokenFor(id)}`];

function seedResource(id, type, userId, data) {
  prisma._store.entity.push({ id, type, userId, data, createdAt: new Date(), updatedAt: new Date() });
}
function seedLink(id, userId, data) {
  prisma._store.entity.push({ id, type: 'SharedLink', userId, data, createdAt: new Date(), updatedAt: new Date() });
}

describe('share-link Scripture gate (createShareableLink + /share/:slug)', () => {
  let app;
  beforeEach(() => {
    prisma._reset();
    app = buildApp();
    prisma._store.user.push({ id: 'u-owner', email: 'o@x', role: 'user', premium: false, profile: {} });
  });

  it('refuses to mint a share link for a Sermon with an invalid reference', async () => {
    seedResource('res-bad', 'Sermon', 'u-owner', { title: 'Bad', anchor_passage: 'Hezekiah 4:5' });
    const res = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-bad' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/could not be verified|cannot be shared/i);
    // No SharedLink was created.
    expect(prisma._store.entity.some((e) => e.type === 'SharedLink')).toBe(false);
  });

  it('mints a link for a clean resource', async () => {
    seedResource('res-ok', 'Sermon', 'u-owner', { title: 'Good', anchor_passage: 'John 3:16' });
    const res = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-ok' });
    expect(res.status).toBe(200);
    expect(res.body.shareUrl).toContain('link=');
  });

  it('rejects a resourceType that does not match the stored resource type', async () => {
    seedResource('res-mix', 'BibleStudy', 'u-owner', { title: 'Study', key_verses: ['John 3:16'] });
    const res = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-mix' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  it('does NOT serve a shared resource that was edited into an invalid state after sharing', async () => {
    // Valid when the link was minted...
    seedResource('res-drift', 'BibleStudy', 'u-owner', { title: 'Drift', key_verses: ['John 3:16'] });
    seedLink('link-drift', 'u-owner', { slug: 'slug-drift', resourceId: 'res-drift' });
    // ...then edited to reference a fabricated book.
    prisma._store.entity.find((e) => e.id === 'res-drift').data.key_verses = ['Hezekiah 4:5'];

    const res = await request(app).get('/api/community/share/slug-drift');
    expect(res.status).toBe(422);
    expect(res.body).not.toHaveProperty('resource');
  });

  it('serves a shared resource whose references still all verify', async () => {
    seedResource('res-live', 'BibleStudy', 'u-owner', { title: 'Live', key_verses: ['John 3:16'] });
    seedLink('link-live', 'u-owner', { slug: 'slug-live', resourceId: 'res-live' });
    const res = await request(app).get('/api/community/share/slug-live');
    expect(res.status).toBe(200);
    expect(res.body.resource.id).toBe('res-live');
  });

  it('refuses to mint / serve a share link for an invalid SharedSermon copy', async () => {
    // A legacy/forged SharedSermon carrying a fabricated reference.
    seedResource('ss-bad', 'SharedSermon', 'u-owner', { title: 'Copy', anchor_passage: 'Hezekiah 4:5' });
    const create = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'SharedSermon', resourceId: 'ss-bad' });
    expect(create.status).toBe(422);

    // And an already-minted link to it is not served.
    seedLink('link-ss', 'u-owner', { slug: 'slug-ss', resourceId: 'ss-bad' });
    const serve = await request(app).get('/api/community/share/slug-ss');
    expect(serve.status).toBe(422);
    expect(serve.body).not.toHaveProperty('resource');
  });

  it('moderation cannot flip an invalid SharedContent public, but can still hide it', async () => {
    seedResource('sc-mod', 'SharedContent', 'u-owner', {
      title: 'Bad', content: 'On Hezekiah 4:5', content_type: 'study', visibility: 'private',
    });
    // Making it public with unverified Scripture is blocked...
    const pub = await request(app)
      .patch('/api/community/moderation/SharedContent/sc-mod')
      .set('Cookie', asUser('u-owner'))
      .send({ visibility: 'public' });
    expect(pub.status).toBe(422);
    // ...but hiding/removing it (the normal moderation path) is never blocked.
    const hide = await request(app)
      .patch('/api/community/moderation/SharedContent/sc-mod')
      .set('Cookie', asUser('u-owner'))
      .send({ status: 'hidden' });
    expect(hide.status).toBe(200);
  });
});

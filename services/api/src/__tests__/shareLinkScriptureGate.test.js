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
  requireEntitlement: () => (_req, _res, next) => next(),
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
    prisma._store.user.push({ id: 'u-other', email: 'other@x', role: 'user', premium: false, profile: {} });
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
    expect(res.body.id).toBeTruthy();
    expect(res.body.slug).toMatch(/^sermon-[A-Za-z0-9_-]{24}$/);
  });

  it('requires the stored resource entitlement to mint a new share link', async () => {
    seedResource('ethics-free', 'EthicsAnalysis', 'u-owner', { title: 'Private analysis' });

    const denied = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'EthicsAnalysis', resourceId: 'ethics-free' });

    expect(denied.status).toBe(402);
    expect(denied.body.requiredEntitlement).toBe('ethics');
    expect(prisma._store.entity.some((entity) => entity.type === 'SharedLink')).toBe(false);

    prisma._store.user.find((user) => user.id === 'u-owner').premium = true;
    const allowed = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'EthicsAnalysis', resourceId: 'ethics-free' });
    expect(allowed.status).toBe(200);
  });

  it('lets an expired owner revoke an existing gated-resource link', async () => {
    seedResource('ethics-revoke', 'EthicsAnalysis', 'u-owner', { title: 'Private analysis' });
    seedLink('ethics-link', 'u-owner', { slug: 'ethics-slug', resourceId: 'ethics-revoke' });

    const revoked = await request(app)
      .delete('/api/functions/share-links/ethics-link')
      .set('Cookie', asUser('u-owner'));
    expect(revoked.status).toBe(204);
  });

  it('lets only the owner list and revoke a share link', async () => {
    seedResource('res-revoke', 'Sermon', 'u-owner', { title: 'Revoke', anchor_passage: 'John 3:16' });
    const created = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-revoke' });
    expect(created.status).toBe(200);

    const listed = await request(app)
      .get('/api/functions/share-links?resourceId=res-revoke')
      .set('Cookie', asUser('u-owner'));
    expect(listed.status).toBe(200);
    expect(listed.body.links.map((link) => link.id)).toContain(created.body.id);

    const foreignDelete = await request(app)
      .delete(`/api/functions/share-links/${created.body.id}`)
      .set('Cookie', asUser('u-other'));
    expect(foreignDelete.status).toBe(404);

    const revoked = await request(app)
      .delete(`/api/functions/share-links/${created.body.id}`)
      .set('Cookie', asUser('u-owner'));
    expect(revoked.status).toBe(204);
    expect((await request(app).get(`/api/community/share/${created.body.slug}`)).status).toBe(404);
    expect(prisma._store.auditLog.some((row) => row.action === 'sharing.link_revoke')).toBe(true);
  });

  it('paginates every owned share link instead of truncating after 100', async () => {
    seedResource('res-many-links', 'Sermon', 'u-owner', { title: 'Many links', anchor_passage: 'John 3:16' });
    for (let index = 0; index < 105; index += 1) {
      const createdAt = new Date(Date.UTC(2026, 8, 2, 12, index));
      prisma._store.entity.push({
        id: `share-link-${index}`,
        type: 'SharedLink',
        userId: 'u-owner',
        data: { resourceId: 'res-many-links', slug: `slug-${index}`, title: `Link ${index}` },
        createdAt,
        updatedAt: createdAt,
      });
    }

    const first = await request(app)
      .get('/api/functions/share-links?resourceId=res-many-links&offset=0&limit=100')
      .set('Cookie', asUser('u-owner'));
    const second = await request(app)
      .get('/api/functions/share-links?resourceId=res-many-links&offset=100&limit=100')
      .set('Cookie', asUser('u-owner'));

    expect(first.status).toBe(200);
    expect(first.body.links).toHaveLength(100);
    expect(first.body.next_offset).toBe(100);
    expect(second.body.links).toHaveLength(5);
    expect(second.body.next_offset).toBeNull();
    expect(new Set([...first.body.links, ...second.body.links].map((link) => link.id)).size).toBe(105);
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

  it('refuses to share/serve a Sermon whose fabricated ref uses a formatting variant', async () => {
    // Roman-numeral prefix bound to a fabricated book, hidden in a prose field.
    seedResource('res-var', 'Sermon', 'u-owner', {
      title: 'v', anchor_passage: 'John 3:16', big_idea: 'as II Hezekiah 4:5 shows',
    });
    const create = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-var' });
    expect(create.status).toBe(422);
    seedLink('link-var', 'u-owner', { slug: 'slug-var', resourceId: 'res-var' });
    expect((await request(app).get('/api/community/share/slug-var')).status).toBe(422);
  });

  it('refuses to share/serve a Sermon whose fabricated ref is LOWERCASE (case-insensitive extraction)', async () => {
    seedResource('res-lc', 'Sermon', 'u-owner', {
      title: 'lc', anchor_passage: 'John 3:16', theological_notes: 'as hezekiah 4:5 shows',
    });
    const create = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-lc' });
    expect(create.status).toBe(422);
    seedLink('link-lc', 'u-owner', { slug: 'slug-lc', resourceId: 'res-lc' });
    expect((await request(app).get('/api/community/share/slug-lc')).status).toBe(422);
  });

  it('refuses to share/serve a Sermon whose fabricated ref hides in a deep prose field', async () => {
    // The reference is valid in anchor_passage but fabricated in a point's
    // exegesis — the old field-limited validator missed this.
    seedResource('res-deep', 'Sermon', 'u-owner', {
      title: 'Deep', anchor_passage: 'John 3:16', points: [{ exegesis: 'Grounded in Hezekiah 4:5.' }],
    });
    const create = await request(app)
      .post('/api/functions/createShareableLink')
      .set('Cookie', asUser('u-owner'))
      .send({ resourceType: 'Sermon', resourceId: 'res-deep' });
    expect(create.status).toBe(422);

    seedLink('link-deep', 'u-owner', { slug: 'slug-deep', resourceId: 'res-deep' });
    const serve = await request(app).get('/api/community/share/slug-deep');
    expect(serve.status).toBe(422);
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

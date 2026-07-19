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
    expect(res.body.reported_by).toEqual(['u-reader']);
    expect(prisma._store.auditLog.some((row) => row.action === 'community.report')).toBe(true);
  });

  it('does not count duplicate reports from the same user', async () => {
    prisma._store.entity.push(sharedContent('duplicate-report'));

    const first = await request(app)
      .post('/api/community/shared-content/duplicate-report/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'spam', reason: 'Duplicate test' });
    const second = await request(app)
      .post('/api/community/shared-content/duplicate-report/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'spam', reason: 'Duplicate test again' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    const stored = prisma._store.entity.find((row) => row.id === 'duplicate-report');
    expect(stored.data.reported_count).toBe(1);
    expect(stored.data.reported_by).toEqual(['u-reader']);
    expect(prisma._store.auditLog.filter((row) => row.action === 'community.report')).toHaveLength(1);
  });

  it('treats repeated likes from the same user as idempotent', async () => {
    prisma._store.entity.push(sharedContent('like-me'));

    const first = await request(app)
      .post('/api/community/shared-content/like-me/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const second = await request(app)
      .post('/api/community/shared-content/like-me/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(first.status).toBe(200);
    expect(first.body.likes_count).toBe(1);
    expect(first.body.alreadyLiked).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.likes_count).toBe(1);
    expect(second.body.alreadyLiked).toBe(true);
    const stored = prisma._store.entity.find((row) => row.id === 'like-me');
    expect(stored.data.likes_count).toBe(1);
    expect(prisma._store.communityLike).toHaveLength(1);
  });

  it('treats repeated saves from the same user as idempotent', async () => {
    prisma._store.entity.push(sharedContent('save-me'));

    const first = await request(app)
      .post('/api/community/shared-content/save-me/save')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const second = await request(app)
      .post('/api/community/shared-content/save-me/save')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(first.status).toBe(200);
    expect(first.body.saves_count).toBe(1);
    expect(first.body.alreadySaved).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.saves_count).toBe(1);
    expect(second.body.alreadySaved).toBe(true);
    const stored = prisma._store.entity.find((row) => row.id === 'save-me');
    expect(stored.data.saves_count).toBe(1);
    expect(prisma._store.savedContent).toHaveLength(1);
  });

  it('serves the public forum feed across ALL users and hides removed posts', async () => {
    prisma._store.entity.push({ id: 'p-mine', type: 'CommunityPost', userId: 'u-reader', data: { title: 'Mine', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    prisma._store.entity.push({ id: 'p-theirs', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Theirs', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    prisma._store.entity.push({ id: 'p-removed', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Bad', status: 'removed' }, createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app).get('/api/community/posts');
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('p-mine');
    expect(ids).toContain('p-theirs'); // another user's post is visible (was not before)
    expect(ids).not.toContain('p-removed');
  });

  it('lets a member reply to ANOTHER user\'s post and bumps the count server-side', async () => {
    prisma._store.entity.push({ id: 'p-owner', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', replies_count: 0, status: 'active' }, createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app)
      .post('/api/community/posts/p-owner/reply')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]) // NOT the post owner
      .send({ content: 'Great question — here is my take.', user_name: 'Reader' });

    expect(res.status).toBe(200);
    expect(res.body.content).toMatch(/Great question/);
    expect(res.body.user_id).toBe('u-reader');
    // The post's reply count was incremented even though replier != owner.
    const post = prisma._store.entity.find((r) => r.id === 'p-owner');
    expect(post.data.replies_count).toBe(1);
    // The reply is readable on the public thread feed.
    const replies = await request(app).get('/api/community/posts/p-owner/replies');
    expect(replies.status).toBe(200);
    expect(replies.body).toHaveLength(1);
    expect(replies.body[0].user_id).toBe('u-reader');
  });

  it('rejects an empty reply and an anonymous reply', async () => {
    prisma._store.entity.push({ id: 'p-x', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    const empty = await request(app).post('/api/community/posts/p-x/reply').set('Cookie', [`ss_token=${tokenFor('u-reader')}`]).send({ content: '   ' });
    expect(empty.status).toBe(400);
    const anon = await request(app).post('/api/community/posts/p-x/reply').send({ content: 'hi' });
    expect(anon.status).toBe(401);
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

  it('serves a shared resource when the link creator owns it', async () => {
    prisma._store.entity.push({
      id: 'res-owned', type: 'Sermon', userId: 'u-owner',
      data: { title: 'My Sermon', big_idea: 'Grace' }, createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.entity.push({
      id: 'link-ok', type: 'SharedLink', userId: 'u-owner',
      data: { slug: 'slug-ok', resourceId: 'res-owned' }, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app).get('/api/community/share/slug-ok');
    expect(res.status).toBe(200);
    expect(res.body.resource.id).toBe('res-owned');
  });

  it('does NOT serve a resource the link creator does not own (forged-link IDOR)', async () => {
    // Victim's private sermon.
    prisma._store.entity.push({
      id: 'res-victim', type: 'Sermon', userId: 'u-owner',
      data: { title: 'Private', big_idea: 'Secret' }, createdAt: new Date(), updatedAt: new Date(),
    });
    // Attacker (u-reader) forged a SharedLink pointing at the victim's resource.
    prisma._store.entity.push({
      id: 'link-forged', type: 'SharedLink', userId: 'u-reader',
      data: { slug: 'slug-forged', resourceId: 'res-victim' }, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app).get('/api/community/share/slug-forged');
    expect(res.status).toBe(404);
    expect(res.body.resource).toBeUndefined();
  });

  // --- Round-4: AI forum replies routed through the Scripture gate ---

  it('rejects an AI (is_ai_response) reply containing fabricated Scripture', async () => {
    prisma._store.entity.push({ id: 'p-ai', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    const res = await request(app)
      .post('/api/community/posts/p-ai/reply')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ content: 'As Hezekiah 4:5 teaches us, hope endures.', is_ai_response: true });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/could not be verified/i);
    // No reply was persisted, and the post count was not bumped.
    expect(prisma._store.entity.some((e) => e.type === 'CommunityReply')).toBe(false);
  });

  it('accepts an AI reply whose references all verify', async () => {
    prisma._store.entity.push({ id: 'p-ai2', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    const res = await request(app)
      .post('/api/community/posts/p-ai2/reply')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ content: 'See John 3:16 and Romans 8:28.', is_ai_response: true });
    expect(res.status).toBe(200);
    expect(res.body.is_ai_response).toBe(true);
  });

  it('a user-authored reply with a fabricated-looking ref is NOT gated (out of scope)', async () => {
    prisma._store.entity.push({ id: 'p-user', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    const res = await request(app)
      .post('/api/community/posts/p-user/reply')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ content: 'I think Hezekiah 4:5 is my favorite (user opinion).' });
    expect(res.status).toBe(200);
  });

  it('omits an is_ai_response reply that was stored/edited into an invalid state from the thread', async () => {
    prisma._store.entity.push({ id: 'p-thread', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Q', status: 'active' }, createdAt: new Date(), updatedAt: new Date() });
    // A clean human reply and a fabricated AI reply persisted directly.
    prisma._store.entity.push({ id: 'r-user', type: 'CommunityReply', userId: 'u-reader', data: { post_id: 'p-thread', content: 'Amen.', is_ai_response: false }, createdAt: new Date(), updatedAt: new Date() });
    prisma._store.entity.push({ id: 'r-ai-bad', type: 'CommunityReply', userId: 'u-reader', data: { post_id: 'p-thread', content: 'Per Hezekiah 4:5 ...', is_ai_response: true }, createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app).get('/api/community/posts/p-thread/replies');
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('r-user');
    expect(ids).not.toContain('r-ai-bad');
  });

  // --- Round-4: public feeds re-validate at serve, failing closed ---

  it('omits an invalid public SharedContent row from the community feed', async () => {
    prisma._store.entity.push(sharedContent('sc-good', { content: 'Rooted in John 3:16.' }));
    prisma._store.entity.push(sharedContent('sc-bad', { content: 'Rooted in Hezekiah 4:5.' }));

    const res = await request(app).get('/api/community/shared-content');
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('sc-good');
    expect(ids).not.toContain('sc-bad');
  });

  it('like on an invalid public SharedContent records the like but withholds the content', async () => {
    prisma._store.entity.push(sharedContent('sc-int-bad', { content: 'Grounded in Hezekiah 4:5.' }));
    const res = await request(app)
      .post('/api/community/shared-content/sc-int-bad/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(res.status).toBe(200);
    // Interaction recorded...
    expect(res.body.liked).toBe(true);
    expect(res.body.likes_count).toBe(1);
    // ...but the fabricated content body is NOT returned.
    expect(res.body.content).toBeUndefined();
    expect(res.body.content_withheld).toBe(true);
  });

  it('report on an invalid public SharedContent withholds the content body', async () => {
    prisma._store.entity.push(sharedContent('sc-int-rep', { content: 'See Hezekiah 4:5.' }));
    const res = await request(app)
      .post('/api/community/shared-content/sc-int-rep/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'theology' });
    expect(res.status).toBe(200);
    expect(res.body.reported_count).toBe(1);
    expect(res.body.content).toBeUndefined();
    expect(res.body.content_withheld).toBe(true);
  });

  it('like on a VALID public SharedContent still returns the full row', async () => {
    prisma._store.entity.push(sharedContent('sc-int-ok', { content: 'Grounded in John 3:16.' }));
    const res = await request(app)
      .post('/api/community/shared-content/sc-int-ok/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Grounded in John 3:16.');
    expect(res.body.likes_count).toBe(1);
  });

  it('omits an invalid public ReadingPlan row from the reading-plans feed', async () => {
    prisma._store.entity.push({ id: 'rp-good', type: 'ReadingPlan', userId: 'u-owner', data: { name: 'Good', is_public: true, daily_readings: [{ day: 1, passages: ['Luke 2:1-20'] }] }, createdAt: new Date(), updatedAt: new Date() });
    prisma._store.entity.push({ id: 'rp-bad', type: 'ReadingPlan', userId: 'u-owner', data: { name: 'Bad', is_public: true, daily_readings: [{ day: 1, passages: ['Hezekiah 4:5'] }] }, createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app).get('/api/community/reading-plans');
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('rp-good');
    expect(ids).not.toContain('rp-bad');
  });
});

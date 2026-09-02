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
  requireEntitlement: () => (req, res, next) => {
    if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(402).json({ message: 'Premium subscription required' });
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
    prisma._store.user.push({ id: 'u-reader', role: 'user', premium: true, deletedAt: null, is_banned: false });
    prisma._store.user.push({ id: 'u-free', role: 'user', premium: false, deletedAt: null, is_banned: false });
    prisma._store.user.push({ id: 'u-admin', role: 'admin', premium: true });
    prisma._store.user.push({ id: 'u-owner', role: 'user', premium: true, deletedAt: null, is_banned: false });
  });

  it('hides removed public content from the shared-content feed', async () => {
    prisma._store.entity.push(sharedContent('visible'));
    prisma._store.entity.push(sharedContent('removed', { status: 'removed' }));

    const res = await request(app)
      .get('/api/community/shared-content')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

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

    const res = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('p-mine');
    expect(ids).toContain('p-theirs'); // another user's post is visible (was not before)
    expect(ids).not.toContain('p-removed');
  });

  it('creates forum posts with server-authored identity and counters', async () => {
    prisma._store.user.find((user) => user.id === 'u-reader').full_name = 'Reader Name';
    const res = await request(app)
      .post('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({
        title: 'A real discussion',
        content: 'How should we read this passage together?',
        post_type: 'question',
        user_name: 'Spoofed Name',
        likes_count: 9000,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user_id: 'u-reader',
      user_name: 'Reader Name',
      likes_count: 0,
      replies_count: 0,
    });
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
    const replies = await request(app)
      .get('/api/community/posts/p-owner/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
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

    const feed = await request(app)
      .get('/api/community/shared-content')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
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

    const res = await request(app)
      .get('/api/community/posts/p-thread/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('r-user');
    expect(ids).not.toContain('r-ai-bad');
  });

  // --- Round-4: public feeds re-validate at serve, failing closed ---

  it('omits an invalid public SharedContent row from the community feed', async () => {
    prisma._store.entity.push(sharedContent('sc-good', { content: 'Rooted in John 3:16.' }));
    prisma._store.entity.push(sharedContent('sc-bad', { content: 'Rooted in Hezekiah 4:5.' }));

    const res = await request(app)
      .get('/api/community/shared-content')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
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

    const res = await request(app)
      .get('/api/community/reading-plans')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(res.status).toBe(200);
    const ids = res.body.map((r) => r.id);
    expect(ids).toContain('rp-good');
    expect(ids).not.toContain('rp-bad');
  });

  it('blocks free accounts from community APIs even when they call the route directly', async () => {
    const forumRes = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const commentRes = await request(app)
      .get('/api/community/comments?content_type=sermon&content_id=shared-sermon')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(forumRes.status).toBe(402);
    expect(commentRes.status).toBe(402);
  });

  it('finds members without exposing private profile fields and supports follow/unfollow', async () => {
    prisma._store.user.push({
      id: 'u-pastor',
      email: 'private@example.com',
      name: 'Jordan Pastor',
      full_name: 'Jordan Pastor',
      role: 'user',
      premium: true,
      deletedAt: null,
      is_banned: false,
      createdAt: new Date(),
      profile: {
        denomination: 'Methodist',
        ministry_focus: ['Teaching'],
        phone: '555-111-2222',
        profile_privacy: { show_denomination: true, show_ministry_focus: true, show_email: false },
      },
    });

    const search = await request(app)
      .get('/api/community/members?q=Jordan')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(search.status).toBe(200);
    expect(search.body.members).toHaveLength(1);
    expect(search.body.members[0]).toMatchObject({
      id: 'u-pastor',
      name: 'Jordan Pastor',
      denomination: 'Methodist',
      ministryFocus: ['Teaching'],
    });
    expect(search.body.members[0].email).toBeUndefined();
    expect(search.body.members[0].phone).toBeUndefined();

    const follow = await request(app)
      .post('/api/community/members/u-pastor/follow')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(follow.status).toBe(200);
    expect(follow.body.following).toBe(true);
    expect(prisma._store.communityFollow).toHaveLength(1);

    const unfollow = await request(app)
      .delete('/api/community/members/u-pastor/follow')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(unfollow.status).toBe(200);
    expect(unfollow.body.following).toBe(false);
    expect(prisma._store.communityFollow).toHaveLength(0);
  });

  it('likes and unlikes forum posts without allowing duplicate counts', async () => {
    prisma._store.entity.push({
      id: 'p-like', type: 'CommunityPost', userId: 'u-owner',
      data: { title: 'Question', status: 'active', likes_count: 0 },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const first = await request(app)
      .post('/api/community/posts/p-like/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const second = await request(app)
      .post('/api/community/posts/p-like/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(first.body.likes_count).toBe(1);
    expect(second.body.likes_count).toBe(1);

    const unlike = await request(app)
      .delete('/api/community/posts/p-like/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(unlike.status).toBe(200);
    expect(unlike.body.likes_count).toBe(0);
    expect(unlike.body.likedByMe).toBe(false);
  });

  it('creates and joins study groups through membership-aware routes', async () => {
    const created = await request(app)
      .post('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ name: 'Gospel of John', description: 'Read John together', focus_book: 'John' });

    expect(created.status).toBe(201);
    expect(created.body.membership_role).toBe('leader');
    const groupId = created.body.id;
    expect(prisma._store.communityGroupMember).toHaveLength(1);

    const joined = await request(app)
      .post(`/api/community/study-groups/${groupId}/join`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(joined.status).toBe(200);
    expect(joined.body.member_count).toBe(2);

    // Joining twice is idempotent because the database membership has a
    // compound unique key and the route upserts it.
    const joinedAgain = await request(app)
      .post(`/api/community/study-groups/${groupId}/join`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(joinedAgain.status).toBe(200);
    expect(joinedAgain.body.member_count).toBe(2);
    expect(prisma._store.communityGroupMember).toHaveLength(2);

    const detail = await request(app)
      .get(`/api/community/study-groups/${groupId}`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(detail.status).toBe(200);
    expect(detail.body.members).toHaveLength(2);
    expect(detail.body.membership.role).toBe('member');
  });

  it('keeps private groups hidden until a leader adds an entitled member', async () => {
    const created = await request(app)
      .post('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ name: 'Private Pastors', description: 'Closed study', is_private: true });
    expect(created.status).toBe(201);
    expect(created.body.is_private).toBe(true);

    const hidden = await request(app)
      .get('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(hidden.status).toBe(200);
    expect(hidden.body.map((group) => group.id)).not.toContain(created.body.id);

    const openJoin = await request(app)
      .post(`/api/community/study-groups/${created.body.id}/join`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(openJoin.status).toBe(403);

    const added = await request(app)
      .post(`/api/community/study-groups/${created.body.id}/members`)
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ user_id: 'u-reader' });
    expect(added.status).toBe(200);
    expect(added.body.membership).toMatchObject({ user_id: 'u-reader', role: 'member' });

    const visible = await request(app)
      .get('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(visible.body.map((group) => group.id)).toContain(created.body.id);
  });

  it('shares group messages across members and rejects non-members', async () => {
    prisma._store.entity.push({
      id: 'group-chat', type: 'StudyGroup', userId: 'u-owner',
      data: { name: 'Prayer Group', description: 'Pray together', status: 'active', member_count: 2 },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'gm-owner', groupId: 'group-chat', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'gm-reader', groupId: 'group-chat', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const sent = await request(app)
      .post('/api/community/study-groups/group-chat/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ message: 'How can I pray for you?', message_type: 'prayer_request' });
    expect(sent.status).toBe(201);
    expect(sent.body.user_name).toBe('Reader');

    const ownerFeed = await request(app)
      .get('/api/community/study-groups/group-chat/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(ownerFeed.status).toBe(200);
    expect(ownerFeed.body).toHaveLength(1);
    expect(ownerFeed.body[0].message).toMatch(/pray/i);

    const outsider = await request(app)
      .get('/api/community/study-groups/group-chat/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(outsider.status).toBe(403);

    const forbiddenAnnouncement = await request(app)
      .post('/api/community/study-groups/group-chat/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ message: 'Official notice', message_type: 'announcement' });
    expect(forbiddenAnnouncement.status).toBe(403);
  });

  it('restricts meeting scheduling to leaders while allowing member RSVPs', async () => {
    prisma._store.entity.push({
      id: 'group-meeting', type: 'StudyGroup', userId: 'u-owner',
      data: { name: 'Romans', description: 'Study Romans', status: 'active' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'meeting-owner', groupId: 'group-meeting', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'meeting-reader', groupId: 'group-meeting', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );
    const payload = {
      title: 'Romans 8',
      scheduled_date: '2026-09-10T23:00:00.000Z',
      discussion_leader_id: 'u-owner',
    };

    const blocked = await request(app)
      .post('/api/community/study-groups/group-meeting/meetings')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send(payload);
    expect(blocked.status).toBe(403);

    const meeting = await request(app)
      .post('/api/community/study-groups/group-meeting/meetings')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send(payload);
    expect(meeting.status).toBe(201);
    expect(meeting.body.scheduled_date).toBe('2026-09-10T23:00:00.000Z');

    const rsvp = await request(app)
      .post(`/api/community/study-groups/group-meeting/meetings/${meeting.body.id}/rsvp`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ status: 'attending' });
    expect(rsvp.status).toBe(200);
    expect(rsvp.body.status).toBe('attending');
  });

  it('shows and upgrades legacy RSVPs that were stored without group_id', async () => {
    prisma._store.entity.push(
      {
        id: 'legacy-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Legacy group', description: 'Migrated', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'legacy-meeting', type: 'GroupMeeting', userId: 'u-owner',
        data: { group_id: 'legacy-group', title: 'Old meeting', scheduled_date: '2026-09-10T23:00:00.000Z', status: 'scheduled' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'legacy-rsvp', type: 'MeetingAttendance', userId: 'u-reader',
        data: { meeting_id: 'legacy-meeting', user_id: 'u-reader', user_name: 'Reader', status: 'maybe' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'legacy-owner', groupId: 'legacy-group', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'legacy-reader', groupId: 'legacy-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const listed = await request(app)
      .get('/api/community/study-groups/legacy-group/meetings')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(listed.status).toBe(200);
    expect(listed.body[0].my_rsvp).toBe('maybe');
    expect(prisma._store.entity.find((row) => row.id === 'legacy-rsvp').data.group_id).toBe('legacy-group');

    const updated = await request(app)
      .post('/api/community/study-groups/legacy-group/meetings/legacy-meeting/rsvp')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ status: 'attending' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('attending');
    expect(prisma._store.entity.filter((row) => row.type === 'MeetingAttendance')).toHaveLength(1);
  });

  it('lets leaders assign a real reading plan while blocking members and private-plan IDORs', async () => {
    prisma._store.entity.push(
      {
        id: 'group-progress', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'John', description: 'Study John', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'owner-plan', type: 'ReadingPlan', userId: 'u-owner',
        data: {
          name: 'John in a Week', duration_days: 7, is_public: false,
          daily_readings: [{ day: 1, passages: ['John 1:1-18'] }],
        },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'private-outsider-plan', type: 'ReadingPlan', userId: 'u-reader',
        data: { name: 'Private', duration_days: 3, is_public: false, daily_readings: [] },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'progress-owner', groupId: 'group-progress', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'progress-reader', groupId: 'group-progress', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const memberBlocked = await request(app)
      .put('/api/community/study-groups/group-progress/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ plan_id: 'owner-plan' });
    expect(memberBlocked.status).toBe(403);

    const privatePlanBlocked = await request(app)
      .put('/api/community/study-groups/group-progress/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ plan_id: 'private-outsider-plan' });
    expect(privatePlanBlocked.status).toBe(404);

    const assigned = await request(app)
      .put('/api/community/study-groups/group-progress/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ plan_id: 'owner-plan' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.plan).toMatchObject({ id: 'owner-plan', name: 'John in a Week' });
    expect(assigned.body.progress).toMatchObject({ total_days: 7, completed_days: [], current_day: 1 });
    expect(assigned.body.progress.plan_snapshot).toBeUndefined();

    const memberView = await request(app)
      .get('/api/community/study-groups/group-progress/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(memberView.status).toBe(200);
    expect(memberView.body.plan).toMatchObject({ id: 'owner-plan', name: 'John in a Week' });

    const completed = await request(app)
      .post('/api/community/study-groups/group-progress/progress/days/1/complete')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ completed_days: [1], completion_percentage: 14 });
  });

  it('shares sermons across accounts and records views, forks, and ratings server-side', async () => {
    prisma._store.entity.push({
      id: 'private-sermon',
      type: 'Sermon',
      userId: 'u-owner',
      data: {
        title: 'Grace That Forms Us',
        topic: 'Grace',
        big_idea: 'Grace trains the whole person.',
        points: [{ title: 'Grace teaches' }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const shared = await request(app)
      .post('/api/community/sermons/share')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ source_sermon_id: 'private-sermon', ai_tags: ['grace'], style_tags: ['teaching'] });
    expect(shared.status).toBe(201);

    const feed = await request(app)
      .get('/api/community/sermons?sort=recent')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(feed.status).toBe(200);
    expect(feed.body.map((row) => row.id)).toContain(shared.body.id);

    const viewed = await request(app)
      .post(`/api/community/sermons/${shared.body.id}/view`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(viewed.body.views_count).toBe(1);

    prisma._store.entity.push({
      id: 'reader-fork',
      type: 'Sermon',
      userId: 'u-reader',
      data: { title: 'My fork', source_shared_sermon_id: shared.body.id },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const forked = await request(app)
      .post(`/api/community/sermons/${shared.body.id}/fork`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ created_sermon_id: 'reader-fork' });
    expect(forked.status).toBe(200);
    expect(forked.body.forks_count).toBe(1);

    const rated = await request(app)
      .post(`/api/community/sermons/${shared.body.id}/rating`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ rating: 5, review_text: 'Useful and clear', used_in_ministry: true });
    expect(rated.status).toBe(200);
    expect(rated.body).toMatchObject({ average_rating: 5, ratings_count: 1 });

    const reviews = await request(app)
      .get(`/api/community/sermons/${shared.body.id}/ratings`)
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(reviews.status).toBe(200);
    expect(reviews.body.ratings).toHaveLength(1);
    expect(reviews.body.ratings[0].review_text).toBe('Useful and clear');
  });

  it('de-duplicates legacy ratings and serializes future rating writes per target', async () => {
    const newer = new Date('2026-09-02T12:00:00.000Z');
    const older = new Date('2026-09-01T12:00:00.000Z');
    prisma._store.entity.push(
      {
        id: 'rating-sermon', type: 'SharedSermon', userId: 'u-owner',
        data: { title: 'Rate me', status: 'active', ratings_count: 2, average_rating: 2 },
        createdAt: older, updatedAt: older,
      },
      {
        id: 'rating-old', type: 'SermonRating', userId: 'u-reader',
        data: { sermon_id: 'rating-sermon', user_id: 'u-reader', rating: 1 },
        createdAt: older, updatedAt: older,
      },
      {
        id: 'rating-new', type: 'SermonRating', userId: 'u-reader',
        data: { sermon_id: 'rating-sermon', user_id: 'u-reader', rating: 3 },
        createdAt: newer, updatedAt: newer,
      },
    );

    const before = await request(app)
      .get('/api/community/sermons/rating-sermon/ratings')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(before.status).toBe(200);
    expect(before.body.ratings).toHaveLength(1);
    expect(before.body.ratings[0].id).toBe('rating-new');

    const updated = await request(app)
      .post('/api/community/sermons/rating-sermon/rating')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ rating: 5, review_text: 'Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ average_rating: 5, ratings_count: 1 });
    expect(prisma._store.entity.filter((row) => row.type === 'SermonRating')).toHaveLength(1);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('lets owners withdraw shares after Premium expires and blocks other members', async () => {
    prisma._store.entity.push({
      id: 'withdraw-me', type: 'SharedSermon', userId: 'u-owner',
      data: { title: 'Withdraw me', status: 'active' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.user.find((user) => user.id === 'u-owner').premium = false;

    const mine = await request(app)
      .get('/api/community/sermons/mine')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(mine.status).toBe(200);
    expect(mine.body.map((row) => row.id)).toEqual(['withdraw-me']);

    const blocked = await request(app)
      .delete('/api/community/sermons/withdraw-me')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(blocked.status).toBe(403);

    const removed = await request(app)
      .delete('/api/community/sermons/withdraw-me')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'withdraw-me')).toBe(false);
  });

  it('serves community plans across accounts and records plan interactions', async () => {
    prisma._store.entity.push({
      id: 'public-plan',
      type: 'ReadingPlan',
      userId: 'u-owner',
      data: {
        name: 'A Week of Grace',
        description: 'Seven days reflecting on grace',
        is_public: true,
        daily_readings: [],
        followers_count: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const feed = await request(app)
      .get('/api/community/reading-plans')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(feed.status).toBe(200);
    expect(feed.body[0]).toMatchObject({ id: 'public-plan', creator_id: 'u-owner' });

    prisma._store.entity.push({
      id: 'forked-plan', type: 'ReadingPlan', userId: 'u-reader',
      data: { name: 'My Grace Plan', is_public: false, source_shared_plan_id: 'public-plan' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    const forked = await request(app)
      .post('/api/community/reading-plans/public-plan/fork')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ created_plan_id: 'forked-plan' });
    expect(forked.status).toBe(200);
    expect(forked.body.followers_count).toBe(1);

    const rated = await request(app)
      .post('/api/community/reading-plans/public-plan/rating')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ rating: 4, review_text: 'Good pacing', used_plan: true });
    expect(rated.status).toBe(200);
    expect(rated.body).toMatchObject({ average_rating: 4, ratings_count: 1 });
  });

  it('shows comments across users and enforces comment ownership', async () => {
    prisma._store.entity.push({
      id: 'comment-sermon', type: 'SharedSermon', userId: 'u-owner',
      data: { title: 'Hope', big_idea: 'Hope endures', status: 'active' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    const created = await request(app)
      .post('/api/community/comments')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ content_type: 'sermon', content_id: 'comment-sermon', comment: 'Thank you for sharing.' });
    expect(created.status).toBe(201);

    const ownerFeed = await request(app)
      .get('/api/community/comments?content_type=sermon&content_id=comment-sermon')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(ownerFeed.status).toBe(200);
    expect(ownerFeed.body).toHaveLength(1);
    expect(ownerFeed.body[0].comment).toMatch(/thank you/i);

    const liked = await request(app)
      .post(`/api/community/comments/${created.body.id}/like`)
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(liked.status).toBe(200);
    expect(liked.body).toMatchObject({ likes_count: 1, likedByMe: true });

    const forbiddenDelete = await request(app)
      .delete(`/api/community/comments/${created.body.id}`)
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(forbiddenDelete.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/community/comments/${created.body.id}`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(deleted.status).toBe(204);
  });

  it('allows an administrator to remove another member\'s abusive comment', async () => {
    prisma._store.entity.push(
      {
        id: 'admin-comment-sermon', type: 'SharedSermon', userId: 'u-owner',
        data: { title: 'Hope', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'abusive-comment', type: 'Comment', userId: 'u-reader',
        data: { content_type: 'sermon', content_id: 'admin-comment-sermon', comment: 'Remove me' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    const removed = await request(app)
      .delete('/api/community/comments/abusive-comment')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'abusive-comment')).toBe(false);
    expect(prisma._store.auditLog.some((row) => row.action === 'community.comment_remove')).toBe(true);
  });
});

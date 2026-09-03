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
    expect(res.body.last_report).toBeUndefined();
    expect(res.body.reported_by).toBeUndefined();
    const stored = prisma._store.entity.find((row) => row.id === 'report-me');
    expect(stored.data.last_report.category).toBe('theology');
    expect(stored.data.reported_by).toEqual(['u-reader']);
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

  it('honors private post/reply visibility and hides every reply to a moderated parent', async () => {
    prisma._store.entity.push(
      { id: 'p-public', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Public', status: 'active' }, createdAt: new Date(), updatedAt: new Date() },
      { id: 'p-private', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Private', status: 'active', visibility: 'private' }, createdAt: new Date(), updatedAt: new Date() },
      { id: 'p-hidden', type: 'CommunityPost', userId: 'u-owner', data: { title: 'Hidden', status: 'hidden' }, createdAt: new Date(), updatedAt: new Date() },
      { id: 'r-public', type: 'CommunityReply', userId: 'u-owner', data: { post_id: 'p-public', content: 'Visible', status: 'active' }, createdAt: new Date(), updatedAt: new Date() },
      { id: 'r-private', type: 'CommunityReply', userId: 'u-owner', data: { post_id: 'p-public', content: 'Private', status: 'active', visibility: 'private' }, createdAt: new Date(), updatedAt: new Date() },
      { id: 'r-hidden-parent', type: 'CommunityReply', userId: 'u-owner', data: { post_id: 'p-hidden', content: 'Must stay hidden', status: 'active' }, createdAt: new Date(), updatedAt: new Date() },
    );

    const posts = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const publicReplies = await request(app)
      .get('/api/community/posts/p-public/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const hiddenReplies = await request(app)
      .get('/api/community/posts/p-hidden/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(posts.body.map((row) => row.id)).toContain('p-public');
    expect(posts.body.map((row) => row.id)).not.toContain('p-private');
    expect(publicReplies.body.map((row) => row.id)).toEqual(['r-public']);
    expect(hiddenReplies.status).toBe(404);
    expect(hiddenReplies.body).not.toHaveProperty('content');
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

  it('uses a neutral public name when an account has no chosen display name', async () => {
    prisma._store.user.push({
      id: 'u-nameless', email: 'private-address@example.com', full_name: null, name: null,
      role: 'user', premium: true, deletedAt: null, is_banned: false,
    });

    const post = await request(app)
      .post('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-nameless')}`])
      .send({ title: 'Anonymous display', content: 'Keep my mailbox private.' });
    const group = await request(app)
      .post('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-nameless')}`])
      .send({ name: 'Privacy Group', description: 'A group without email display names.' });
    const detail = await request(app)
      .get(`/api/community/study-groups/${group.body.id}`)
      .set('Cookie', [`ss_token=${tokenFor('u-nameless')}`]);

    expect(post.status).toBe(201);
    expect(post.body.user_name).toBe('Member');
    expect(group.status).toBe(201);
    expect(detail.body.members[0].user_name).toBe('Member');
    expect(JSON.stringify({ post: post.body, detail: detail.body })).not.toContain('private-address@example.com');
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

  it('lets members report forum posts/replies once and puts both in moderation', async () => {
    prisma._store.entity.push(
      {
        id: 'reported-post', type: 'CommunityPost', userId: 'u-owner',
        data: { title: 'Post', content: 'Body', status: 'active', reported_count: 0 },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'reported-reply', type: 'CommunityReply', userId: 'u-owner',
        data: { post_id: 'reported-post', content: 'Reply', status: 'active', reported_count: 0 },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const postReport = await request(app)
      .post('/api/community/posts/reported-post/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'abuse', reason: 'Needs review' });
    const duplicate = await request(app)
      .post('/api/community/posts/reported-post/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'spam' });
    const replyReport = await request(app)
      .post('/api/community/posts/reported-post/replies/reported-reply/report')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ category: 'privacy' });

    expect(postReport.status).toBe(200);
    expect(postReport.body.reported_count).toBe(1);
    expect(duplicate.status).toBe(409);
    expect(replyReport.status).toBe(200);
    expect(prisma._store.entity.find((row) => row.id === 'reported-post').data.reported_by).toEqual(['u-reader']);
    expect(prisma._store.entity.find((row) => row.id === 'reported-reply').data.reported_by).toEqual(['u-reader']);

    const publicPosts = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    const publicReplies = await request(app)
      .get('/api/community/posts/reported-post/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(publicPosts.body.find((row) => row.id === 'reported-post')).not.toHaveProperty('reported_by');
    expect(publicPosts.body.find((row) => row.id === 'reported-post')).not.toHaveProperty('last_report');
    expect(publicReplies.body.find((row) => row.id === 'reported-reply')).not.toHaveProperty('reported_by');

    const queue = await request(app)
      .get('/api/community/moderation/queue')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(queue.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'reported-post', type: 'CommunityPost' }),
      expect.objectContaining({ id: 'reported-reply', type: 'CommunityReply' }),
    ]));
  });

  it('lets an expired/free author retract replies and posts with relation cleanup', async () => {
    prisma._store.entity.push(
      {
        id: 'owned-post', type: 'CommunityPost', userId: 'u-free',
        data: { title: 'Mine', status: 'active', replies_count: 2 },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'owned-reply', type: 'CommunityReply', userId: 'u-free',
        data: { post_id: 'owned-post', content: 'Mine' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'other-reply', type: 'CommunityReply', userId: 'u-owner',
        data: { post_id: 'owned-post', content: 'Other' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityLike.push(
      { id: 'like-post', userId: 'u-reader', contentId: 'owned-post', contentType: 'CommunityPost' },
      { id: 'like-reply', userId: 'u-reader', contentId: 'owned-reply', contentType: 'CommunityReply' },
    );

    const cannotDeleteOtherReply = await request(app)
      .delete('/api/community/posts/owned-post/replies/other-reply')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(cannotDeleteOtherReply.status).toBe(403);

    const replyDeleted = await request(app)
      .delete('/api/community/posts/owned-post/replies/owned-reply')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(replyDeleted.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'owned-reply')).toBe(false);
    expect(prisma._store.entity.find((row) => row.id === 'owned-post').data.replies_count).toBe(1);
    expect(prisma._store.communityLike.some((row) => row.contentId === 'owned-reply')).toBe(false);

    const postDeleted = await request(app)
      .delete('/api/community/posts/owned-post')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(postDeleted.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'owned-post' || row.data?.post_id === 'owned-post')).toBe(false);
    expect(prisma._store.communityLike.some((row) => row.contentId === 'owned-post')).toBe(false);
    expect(prisma._store.auditLog.some((row) => row.action === 'community.post_delete')).toBe(true);
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

  it('filters moderation candidates before limiting the queue', async () => {
    for (let index = 0; index < 205; index += 1) {
      prisma._store.entity.push({
        id: `ordinary-${index}`,
        type: 'CommunityPost',
        userId: 'u-owner',
        data: { title: `Ordinary ${index}`, status: 'active', reported_count: 0 },
        createdAt: new Date(Date.UTC(2026, 8, 3, 12, index)),
        updatedAt: new Date(Date.UTC(2026, 8, 3, 12, index)),
      });
    }
    prisma._store.entity.push({
      id: 'older-unresolved-report',
      type: 'SharedContent',
      userId: 'u-owner',
      data: { title: 'Needs review', status: 'reported', reported_count: 1 },
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    });

    const queue = await request(app)
      .get('/api/community/moderation/queue')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);

    expect(queue.status).toBe(200);
    expect(queue.body.map((row) => row.id)).toContain('older-unresolved-report');
    expect(queue.body.some((row) => row.id.startsWith('ordinary-'))).toBe(false);
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

  it('includes current forum posts and replies in the dedicated moderation surface', async () => {
    prisma._store.entity.push(
      {
        id: 'forum-parent', type: 'CommunityPost', userId: 'u-owner',
        data: { title: 'Parent', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'forum-abuse', type: 'CommunityPost', userId: 'u-reader',
        data: { title: 'Abusive post', status: 'reported', reported_count: 1 }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'reply-abuse', type: 'CommunityReply', userId: 'u-reader',
        data: { post_id: 'forum-parent', content: 'Abusive reply', status: 'reported', reported_count: 1 }, createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const queue = await request(app)
      .get('/api/community/moderation/queue')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(queue.status).toBe(200);
    expect(queue.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'forum-abuse', type: 'CommunityPost' }),
      expect.objectContaining({ id: 'reply-abuse', type: 'CommunityReply' }),
    ]));

    const postRemoved = await request(app)
      .patch('/api/community/moderation/CommunityPost/forum-abuse')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ status: 'removed' });
    const replyRemoved = await request(app)
      .patch('/api/community/moderation/CommunityReply/reply-abuse')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`])
      .send({ status: 'removed' });
    expect(postRemoved.status).toBe(200);
    expect(replyRemoved.status).toBe(200);

    const feed = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    const replies = await request(app)
      .get('/api/community/posts/forum-parent/replies')
      .set('Cookie', [`ss_token=${tokenFor('u-admin')}`]);
    expect(feed.body.map((row) => row.id)).not.toContain('forum-abuse');
    expect(replies.body.map((row) => row.id)).not.toContain('reply-abuse');
  });

  it('serves a shared resource when the link creator owns it', async () => {
    prisma._store.entity.push({
      id: 'res-owned', type: 'Sermon', userId: 'u-owner',
      data: {
        title: 'My Sermon',
        big_idea: 'Grace',
        reported_by: ['u-reader'],
        last_report: { reporterId: 'u-reader', reason: 'Private report details' },
        moderatorNotes: 'Internal moderation note',
        removed_by: 'u-admin',
      },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.entity.push({
      id: 'link-ok', type: 'SharedLink', userId: 'u-owner',
      data: { slug: 'slug-ok', resourceId: 'res-owned' }, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app).get('/api/community/share/slug-ok');
    expect(res.status).toBe(200);
    expect(res.body.resource.id).toBe('res-owned');
    expect(res.body.resource).not.toHaveProperty('reported_by');
    expect(res.body.resource).not.toHaveProperty('last_report');
    expect(res.body.resource).not.toHaveProperty('moderatorNotes');
    expect(res.body.resource).not.toHaveProperty('removed_by');
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

  it('does not let an old anonymous link bypass a later moderation removal', async () => {
    prisma._store.entity.push(
      {
        id: 'res-removed', type: 'Sermon', userId: 'u-owner',
        data: { title: 'Removed', status: 'removed' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'link-removed', type: 'SharedLink', userId: 'u-owner',
        data: { slug: 'slug-removed', resourceId: 'res-removed' }, createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const res = await request(app).get('/api/community/share/slug-removed');
    expect(res.status).toBe(404);
    expect(res.body.resource).toBeUndefined();
  });

  it('does not let anonymous links bypass forum visibility or parent moderation', async () => {
    prisma._store.entity.push(
      {
        id: 'private-forum-post', type: 'CommunityPost', userId: 'u-owner',
        data: { title: 'Private', visibility: 'private', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'private-forum-link', type: 'SharedLink', userId: 'u-owner',
        data: { slug: 'private-forum', resourceId: 'private-forum-post' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'hidden-parent', type: 'CommunityPost', userId: 'u-owner',
        data: { title: 'Hidden', visibility: 'public', status: 'removed' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'orphaned-public-reply', type: 'CommunityReply', userId: 'u-owner',
        data: { post_id: 'hidden-parent', content: 'No longer public', visibility: 'public', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'orphaned-reply-link', type: 'SharedLink', userId: 'u-owner',
        data: { slug: 'hidden-parent-reply', resourceId: 'orphaned-public-reply' }, createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const privatePost = await request(app).get('/api/community/share/private-forum');
    const hiddenParentReply = await request(app).get('/api/community/share/hidden-parent-reply');

    expect(privatePost.status).toBe(404);
    expect(hiddenParentReply.status).toBe(404);
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

  it('lets a lapsed member inventory and retract their own forum content', async () => {
    prisma._store.entity.push(
      {
        id: 'free-owned-post', type: 'CommunityPost', userId: 'u-free',
        data: { title: 'Old post', content: 'Please remove me', status: 'active', visibility: 'public' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'free-owned-reply', type: 'CommunityReply', userId: 'u-free',
        data: { post_id: 'free-owned-post', content: 'Old reply', status: 'active', visibility: 'public' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'another-post', type: 'CommunityPost', userId: 'u-owner',
        data: { title: 'Not mine', content: 'Keep', status: 'active', visibility: 'public' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const mine = await request(app)
      .get('/api/community/posts/mine')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(mine.status).toBe(200);
    expect(mine.body.posts.map((row) => row.id)).toEqual(['free-owned-post']);
    expect(mine.body.replies.map((row) => row.id)).toEqual(['free-owned-reply']);

    const removed = await request(app)
      .delete('/api/community/posts/free-owned-post')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'free-owned-post' || row.id === 'free-owned-reply')).toBe(false);
  });

  it('paginates the complete forum retraction inventory beyond 1,000 rows', async () => {
    for (let index = 0; index < 1001; index += 1) {
      prisma._store.entity.push({
        id: `historical-post-${index}`,
        type: 'CommunityPost',
        userId: 'u-free',
        data: { title: `Historical ${index}`, content: 'Published content', visibility: 'public' },
        createdAt: new Date(2020, 0, 1, 0, 0, index),
        updatedAt: new Date(2020, 0, 1, 0, 0, index),
      });
    }

    const oldestPage = await request(app)
      .get('/api/community/posts/mine?offset=1000&limit=100')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(oldestPage.status).toBe(200);
    expect(oldestPage.body.posts.map((row) => row.id)).toEqual(['historical-post-0']);
    expect(oldestPage.body.next_offset).toBeNull();
  });

  it('lets a lapsed owner inventory and withdraw a shared series', async () => {
    prisma._store.entity.push({
      id: 'old-shared-series', type: 'SharedSeries', userId: 'u-free',
      data: { title: 'Formerly shared series', visibility: 'public' },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const mine = await request(app)
      .get('/api/community/shared-series/mine')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const denied = await request(app)
      .delete('/api/community/shared-series/old-shared-series')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const removed = await request(app)
      .delete('/api/community/shared-series/old-shared-series')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(mine.status).toBe(200);
    expect(mine.body.series.map((row) => row.id)).toEqual(['old-shared-series']);
    expect(denied.status).toBe(403);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'old-shared-series')).toBe(false);
  });

  it('lets a lapsed owner inventory and retract every remaining public contribution type', async () => {
    prisma._store.entity.push(
      {
        id: 'expired-shared-content', type: 'SharedContent', userId: 'u-free',
        data: { title: 'Public study', content_type: 'study', visibility: 'public', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'expired-public-plan', type: 'ReadingPlan', userId: 'u-free',
        data: { name: 'Public plan', is_public: true, status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'expired-public-comment', type: 'Comment', userId: 'u-free',
        data: { content_type: 'plan', content_id: 'expired-public-plan', comment: 'Old public comment' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'foreign-shared-content', type: 'SharedContent', userId: 'u-owner',
        data: { title: 'Not mine', visibility: 'public', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const [content, plans, comments] = await Promise.all([
      request(app).get('/api/community/shared-content/mine').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
      request(app).get('/api/community/reading-plans/mine').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
      request(app).get('/api/community/comments/mine').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
    ]);
    expect(content.status).toBe(200);
    expect(content.body.shared_content.map((row) => row.id)).toEqual(['expired-shared-content']);
    expect(plans.status).toBe(200);
    expect(plans.body.reading_plans.map((row) => row.id)).toEqual(['expired-public-plan']);
    expect(comments.status).toBe(200);
    expect(comments.body.comments[0]).toMatchObject({ id: 'expired-public-comment', target_type: 'reading_plan' });

    const foreignDenied = await request(app)
      .delete('/api/community/shared-content/foreign-shared-content')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(foreignDenied.status).toBe(403);

    const [contentWithdrawn, planWithdrawn, commentDeleted] = await Promise.all([
      request(app).delete('/api/community/shared-content/expired-shared-content').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
      request(app).delete('/api/community/reading-plans/expired-public-plan/publication').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
      request(app).delete('/api/community/comments/expired-public-comment').set('Cookie', [`ss_token=${tokenFor('u-free')}`]),
    ]);
    expect([contentWithdrawn.status, planWithdrawn.status, commentDeleted.status]).toEqual([200, 200, 204]);
    expect(prisma._store.entity.find((row) => row.id === 'expired-shared-content').data.visibility).toBe('private');
    expect(prisma._store.entity.find((row) => row.id === 'expired-public-plan').data.is_public).toBe(false);
    expect(prisma._store.entity.some((row) => row.id === 'expired-public-comment')).toBe(false);
  });

  it('lets a lapsed reviewer retract a rating and recomputes the target aggregate', async () => {
    prisma._store.entity.push(
      {
        id: 'rated-after-expiry', type: 'SharedSermon', userId: 'u-owner',
        data: { title: 'Rated sermon', status: 'active', ratings_count: 2, average_rating: 4 },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'expired-rating', type: 'SermonRating', userId: 'u-free',
        data: { sermon_id: 'rated-after-expiry', rating: 5, review_text: 'Old review' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'remaining-rating', type: 'SermonRating', userId: 'u-reader',
        data: { sermon_id: 'rated-after-expiry', rating: 3, review_text: 'Keep me' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const mine = await request(app)
      .get('/api/community/ratings/mine')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const denied = await request(app)
      .delete('/api/community/ratings/expired-rating')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    const removed = await request(app)
      .delete('/api/community/ratings/expired-rating')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(mine.status).toBe(200);
    expect(mine.body.ratings[0]).toMatchObject({ id: 'expired-rating', target_title: 'Rated sermon' });
    expect(denied.status).toBe(403);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ ratings_count: 1, average_rating: 3 });
    expect(prisma._store.entity.find((row) => row.id === 'rated-after-expiry').data)
      .toMatchObject({ ratings_count: 1, average_rating: 3 });
  });

  it('removes a forged legacy rating without mutating its wrong-type target', async () => {
    prisma._store.entity.push(
      {
        id: 'private-foreign-note', type: 'Sermon', userId: 'u-owner',
        data: { title: 'Private note', average_rating: 99, ratings_count: 99 },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'forged-target-rating', type: 'SermonRating', userId: 'u-free',
        data: { sermon_id: 'private-foreign-note', rating: 1, review_text: 'Legacy forged target' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const removed = await request(app)
      .delete('/api/community/ratings/forged-target-rating')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ deleted: true });
    expect(prisma._store.entity.some((row) => row.id === 'forged-target-rating')).toBe(false);
    expect(prisma._store.entity.find((row) => row.id === 'private-foreign-note').data)
      .toEqual({ title: 'Private note', average_rating: 99, ratings_count: 99 });
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
        profile_privacy: {
          community_directory_opt_in: true,
          show_denomination: true,
          show_ministry_focus: true,
          show_email: false,
        },
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

  it('requires directory opt-in, defaults legacy privacy closed, and normalizes profile values', async () => {
    prisma._store.user.push(
      {
        id: 'u-no-directory-consent',
        email: 'legacy@example.com',
        name: 'Legacy Private',
        role: 'user',
        premium: true,
        deletedAt: null,
        is_banned: false,
        createdAt: new Date(),
        profile: { denomination: 'Should not be enumerable' },
      },
      {
        id: 'u-malformed-profile',
        email: 'malformed@example.com',
        name: 'Malformed Profile',
        role: 'user',
        premium: true,
        deletedAt: null,
        is_banned: false,
        createdAt: new Date(),
        profile: {
          denomination: { crash: true },
          ministry_focus: ['Teaching', { crash: true }, '  Prayer  ', 42],
          preferred_preaching_style: { crash: true },
          favorite_scripture_passages: ['John 3:16', { crash: true }],
          profile_privacy: {
            community_directory_opt_in: true,
            show_denomination: true,
            show_ministry_focus: true,
            show_preaching_style: true,
            show_favorite_passages: true,
          },
        },
      },
    );

    const search = await request(app)
      .get('/api/community/members')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(search.status).toBe(200);
    expect(search.body.members.map((member) => member.id)).not.toContain('u-no-directory-consent');
    expect(search.body.members).toContainEqual(expect.objectContaining({
      id: 'u-malformed-profile',
      denomination: '',
      ministryFocus: ['Teaching', 'Prayer'],
      preachingStyle: '',
      favoritePassages: ['John 3:16'],
    }));

    const privateDetail = await request(app)
      .get('/api/community/members/u-no-directory-consent')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(privateDetail.status).toBe(404);
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

  it('does not expose or mutate a hidden post through the unlike route', async () => {
    prisma._store.entity.push({
      id: 'hidden-liked-post', type: 'CommunityPost', userId: 'u-owner',
      data: { title: 'Moderated title', content: 'Moderated body', status: 'hidden', likes_count: 1 },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityLike.push({
      id: 'hidden-like', userId: 'u-reader', contentId: 'hidden-liked-post', contentType: 'CommunityPost',
    });

    const unlike = await request(app)
      .delete('/api/community/posts/hidden-liked-post/like')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(unlike.status).toBe(403);
    expect(unlike.body).not.toHaveProperty('content');
    expect(prisma._store.communityLike).toContainEqual(expect.objectContaining({ id: 'hidden-like' }));
    expect(prisma._store.entity.find((row) => row.id === 'hidden-liked-post').data.likes_count).toBe(1);
  });

  it('resolves a visible forum deep link outside the newest 50-row feed', async () => {
    const old = new Date('2020-01-01T00:00:00.000Z');
    prisma._store.entity.push({
      id: 'old-linked-post', type: 'CommunityPost', userId: 'u-owner',
      data: { title: 'Still linkable', content: 'Full older discussion', status: 'active', likes_count: 1 },
      createdAt: old, updatedAt: old,
    });
    prisma._store.communityLike.push({
      id: 'old-post-like', userId: 'u-reader', contentId: 'old-linked-post', contentType: 'CommunityPost',
    });
    for (let index = 0; index < 51; index += 1) {
      const createdAt = new Date(Date.UTC(2026, 8, 3, 12, index));
      prisma._store.entity.push({
        id: `newer-forum-${index}`, type: 'CommunityPost', userId: 'u-owner',
        data: { title: `Newer ${index}`, content: 'Feed post', status: 'active' },
        createdAt, updatedAt: createdAt,
      });
    }

    const feed = await request(app)
      .get('/api/community/posts')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const linked = await request(app)
      .get('/api/community/posts/old-linked-post')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(feed.body.map((post) => post.id)).not.toContain('old-linked-post');
    expect(linked.status).toBe(200);
    expect(linked.body).toMatchObject({
      id: 'old-linked-post', content: 'Full older discussion', likedByMe: true, user_id: 'u-owner',
    });
  });

  it('derives concurrent post-like counts from relational interactions', async () => {
    prisma._store.user.push({ id: 'u-reader-two', role: 'user', premium: true, deletedAt: null, is_banned: false });
    prisma._store.entity.push({
      id: 'p-concurrent', type: 'CommunityPost', userId: 'u-owner',
      data: { title: 'Concurrent', status: 'active', likes_count: 0 },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/community/posts/p-concurrent/like')
        .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]),
      request(app)
        .post('/api/community/posts/p-concurrent/like')
        .set('Cookie', [`ss_token=${tokenFor('u-reader-two')}`]),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma._store.communityLike).toHaveLength(2);
    expect(prisma._store.entity.find((row) => row.id === 'p-concurrent').data.likes_count).toBe(2);
    expect(prisma.$queryRaw).toHaveBeenCalled();
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

  it('filters private groups before the 50-group discovery limit', async () => {
    for (let index = 0; index < 55; index += 1) {
      prisma._store.entity.push({
        id: `new-private-${index}`, type: 'StudyGroup', userId: 'u-admin',
        data: { name: `Private ${index}`, is_private: true, status: 'active' },
        createdAt: new Date(Date.UTC(2026, 8, 2, 12, index)), updatedAt: new Date(),
      });
    }
    prisma._store.entity.push({
      id: 'older-public', type: 'StudyGroup', userId: 'u-owner',
      data: { name: 'Still discoverable', is_private: false, status: 'active' },
      createdAt: new Date('2025-01-01'), updatedAt: new Date(),
    });

    const listed = await request(app)
      .get('/api/community/study-groups')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(listed.status).toBe(200);
    expect(listed.body.map((group) => group.id)).toContain('older-public');
    expect(listed.body.some((group) => group.id.startsWith('new-private-'))).toBe(false);
  });

  it('lets a leader remove another member and revokes private-group access', async () => {
    prisma._store.entity.push({
      id: 'group-removal', type: 'StudyGroup', userId: 'u-owner',
      data: { name: 'Private group', is_private: true, status: 'active', member_count: 2 },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'remove-owner', groupId: 'group-removal', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'remove-reader', groupId: 'group-removal', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const removed = await request(app)
      .delete('/api/community/study-groups/group-removal/members/remove-reader')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ removed: true, member_count: 1 });

    const formerMemberRead = await request(app)
      .get('/api/community/study-groups/group-removal')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(formerMemberRead.status).toBe(403);
  });

  it('keeps group inventory, detail, leadership transfer, and removal reachable after expiry', async () => {
    prisma._store.entity.push({
      id: 'expired-owner-group', type: 'StudyGroup', userId: 'u-free',
      data: { name: 'Expired owner group', is_private: true, status: 'active', member_count: 2 },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'expired-leader', groupId: 'expired-owner-group', userId: 'u-free', role: 'leader', userName: 'Former subscriber', joinedAt: new Date() },
      { id: 'expired-member', groupId: 'expired-owner-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const mine = await request(app)
      .get('/api/community/study-groups/mine')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const detail = await request(app)
      .get('/api/community/study-groups/expired-owner-group')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const premiumActivity = await request(app)
      .get('/api/community/study-groups/expired-owner-group/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const promoted = await request(app)
      .patch('/api/community/study-groups/expired-owner-group/members/expired-member/promote')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    const removed = await request(app)
      .delete('/api/community/study-groups/expired-owner-group/members/expired-member')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(mine.status).toBe(200);
    expect(mine.body.groups[0]).toMatchObject({ id: 'expired-owner-group', membership_role: 'leader' });
    expect(detail.status).toBe(200);
    expect(detail.body.members.map((member) => member.id)).toContain('expired-member');
    expect(premiumActivity.status).toBe(402);
    expect(promoted.status).toBe(200);
    expect(removed.status).toBe(200);
  });

  it('transfers creator ownership when a promoted leader remains and does not re-add the leaver', async () => {
    prisma._store.entity.push({
      id: 'group-owner-leaves', type: 'StudyGroup', userId: 'u-free',
      data: { name: 'Private continuity', description: 'Transfer safely', is_private: true, status: 'active', member_count: 2 },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push(
      { id: 'leaving-owner', groupId: 'group-owner-leaves', userId: 'u-free', role: 'leader', userName: 'Former Owner', joinedAt: new Date('2026-01-01') },
      { id: 'remaining-leader', groupId: 'group-owner-leaves', userId: 'u-reader', role: 'leader', userName: 'Reader', joinedAt: new Date('2026-01-02') },
    );

    // Membership retraction remains available after promotional access ends.
    const left = await request(app)
      .delete('/api/community/study-groups/group-owner-leaves/membership')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(left.status).toBe(200);
    expect(left.body).toMatchObject({ left: true, group_deleted: false, member_count: 1 });
    expect(prisma._store.entity.find((row) => row.id === 'group-owner-leaves')).toMatchObject({
      userId: 'u-reader',
      data: expect.objectContaining({ member_count: 1 }),
    });
    expect(prisma._store.communityGroupMember.some((row) => row.userId === 'u-free')).toBe(false);
    expect(prisma.$queryRaw).toHaveBeenCalled();

    // Even if the former owner later regains Premium, private membership is
    // not reconstructed from the stale creator column.
    prisma._store.user.find((row) => row.id === 'u-free').premium = true;
    const formerOwnerRead = await request(app)
      .get('/api/community/study-groups/group-owner-leaves')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);
    expect(formerOwnerRead.status).toBe(403);
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

  it('lets only the author retract a group message even after Community access expires', async () => {
    prisma._store.entity.push(
      {
        id: 'message-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Private prayer', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'sensitive-message', type: 'GroupMessage', userId: 'u-reader',
        data: { group_id: 'message-group', user_id: 'u-reader', message: 'Sensitive request' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const denied = await request(app)
      .delete('/api/community/study-groups/message-group/messages/sensitive-message')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(denied.status).toBe(403);

    prisma._store.user.find((user) => user.id === 'u-reader').premium = false;
    const removed = await request(app)
      .delete('/api/community/study-groups/message-group/messages/sensitive-message')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'sensitive-message')).toBe(false);
    expect(prisma._store.auditLog).toContainEqual(expect.objectContaining({
      action: 'community.group_message_delete',
      targetId: 'sensitive-message',
    }));
  });

  it('returns the newest 100 group messages in chronological display order', async () => {
    prisma._store.entity.push({
      id: 'group-history', type: 'StudyGroup', userId: 'u-owner',
      data: { name: 'History', status: 'active' },
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma._store.communityGroupMember.push({
      id: 'history-member', groupId: 'group-history', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date(),
    });
    for (let index = 1; index <= 105; index += 1) {
      prisma._store.entity.push({
        id: `history-${index}`,
        type: 'GroupMessage',
        userId: 'u-reader',
        data: { group_id: 'group-history', message: `Message ${index}` },
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
      });
    }

    const feed = await request(app)
      .get('/api/community/study-groups/group-history/messages')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(feed.status).toBe(200);
    expect(feed.body).toHaveLength(100);
    expect(feed.body[0].message).toBe('Message 6');
    expect(feed.body.at(-1).message).toBe('Message 105');
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

  it('lets leaders edit meetings and cancel them with their RSVPs', async () => {
    prisma._store.entity.push(
      {
        id: 'managed-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Managed group', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'managed-meeting', type: 'GroupMeeting', userId: 'u-owner',
        data: {
          group_id: 'managed-group', title: 'Original title', status: 'scheduled',
          scheduled_date: '2026-09-10T23:00:00.000Z', discussion_leader_id: 'u-owner',
          discussion_leader_name: 'Owner',
        },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'managed-rsvp', type: 'MeetingAttendance', userId: 'u-reader',
        data: { group_id: 'managed-group', meeting_id: 'managed-meeting', status: 'attending' },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'managed-owner', groupId: 'managed-group', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'managed-reader', groupId: 'managed-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const blocked = await request(app)
      .patch('/api/community/study-groups/managed-group/meetings/managed-meeting')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ title: 'Unauthorized edit' });
    expect(blocked.status).toBe(403);

    const invalidLeader = await request(app)
      .patch('/api/community/study-groups/managed-group/meetings/managed-meeting')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ discussion_leader_id: 'u-free' });
    expect(invalidLeader.status).toBe(400);

    const edited = await request(app)
      .patch('/api/community/study-groups/managed-group/meetings/managed-meeting')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({
        title: 'Updated title',
        scheduled_date: '2026-09-12T01:30:00Z',
        discussion_leader_id: 'u-reader',
        discussion_leader_name: 'spoofed name',
      });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      id: 'managed-meeting',
      group_id: 'managed-group',
      title: 'Updated title',
      status: 'scheduled',
      scheduled_date: '2026-09-12T01:30:00.000Z',
      discussion_leader_id: 'u-reader',
      discussion_leader_name: 'Reader',
    });

    // Cancellation is deliberately retained as a lifecycle control after a
    // leader's paid or promotional Community access expires.
    prisma._store.user.find((user) => user.id === 'u-owner').premium = false;
    const removed = await request(app)
      .delete('/api/community/study-groups/managed-group/meetings/managed-meeting')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);
    expect(removed.status).toBe(204);
    expect(prisma._store.entity.some((row) => row.id === 'managed-meeting')).toBe(false);
    expect(prisma._store.entity.some((row) => row.id === 'managed-rsvp')).toBe(false);
    expect(prisma._store.auditLog).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'community.group_meeting_update', targetId: 'managed-meeting' }),
      expect.objectContaining({ action: 'community.group_meeting_delete', targetId: 'managed-meeting' }),
    ]));
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

  it('serializes RSVP writes and heals legacy duplicates for one meeting/user', async () => {
    prisma._store.entity.push(
      {
        id: 'rsvp-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'RSVP', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'rsvp-meeting', type: 'GroupMeeting', userId: 'u-owner',
        data: { group_id: 'rsvp-group', title: 'Meeting' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'rsvp-old', type: 'MeetingAttendance', userId: 'u-reader',
        data: { meeting_id: 'rsvp-meeting', status: 'maybe' },
        createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'rsvp-new', type: 'MeetingAttendance', userId: 'u-reader',
        data: { meeting_id: 'rsvp-meeting', status: 'attending' },
        createdAt: new Date('2026-01-02T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    );
    prisma._store.communityGroupMember.push({
      id: 'rsvp-member', groupId: 'rsvp-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date(),
    });

    const updated = await request(app)
      .post('/api/community/study-groups/rsvp-group/meetings/rsvp-meeting/rsvp')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ status: 'not_attending' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('not_attending');
    expect(prisma._store.entity.filter((row) => row.type === 'MeetingAttendance')).toHaveLength(1);
    expect(prisma.$queryRaw).toHaveBeenCalled();
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

    prisma.$queryRaw.mockClear();
    const assigned = await request(app)
      .put('/api/community/study-groups/group-progress/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ plan_id: 'owner-plan' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.plan).toMatchObject({ id: 'owner-plan', name: 'John in a Week' });
    expect(assigned.body.progress).toMatchObject({ total_days: 7, completed_days: [], current_day: 1 });
    expect(assigned.body.progress.plan_snapshot).toBeUndefined();
    expect(prisma._store.entity.find((row) => row.type === 'GroupProgress')).toMatchObject({
      userId: 'u-owner',
      data: expect.objectContaining({ assignment_format_version: 2 }),
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();

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

  it('does not trust assigned_by on a legacy progress row to expose an owner private plan', async () => {
    prisma._store.entity.push(
      {
        id: 'legacy-private-progress-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Legacy group', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'group-owner-private-plan', type: 'ReadingPlan', userId: 'u-owner',
        data: { name: 'Owner private notes', is_public: false, daily_readings: [] },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'forged-legacy-progress', type: 'GroupProgress', userId: 'u-reader',
        data: {
          group_id: 'legacy-private-progress-group',
          plan_id: 'group-owner-private-plan',
          assigned_by: 'u-owner',
          total_days: 7,
        },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'legacy-private-owner', groupId: 'legacy-private-progress-group', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'legacy-private-reader', groupId: 'legacy-private-progress-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const response = await request(app)
      .get('/api/community/study-groups/legacy-private-progress-group/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(response.status).toBe(200);
    expect(response.body.progress.id).toBe('forged-legacy-progress');
    expect(response.body.plan).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain('Owner private notes');
  });

  it('does not expose an unversioned legacy plan_snapshot supplied through generic JSON', async () => {
    prisma._store.entity.push(
      {
        id: 'legacy-snapshot-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Legacy snapshot group', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'forged-snapshot-progress', type: 'GroupProgress', userId: 'u-reader',
        data: {
          group_id: 'legacy-snapshot-group',
          plan_id: 'known-private-plan',
          assigned_by: 'u-owner',
          plan_snapshot: { id: 'known-private-plan', name: 'Forged private snapshot' },
          total_days: 7,
        },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push(
      { id: 'legacy-snapshot-owner', groupId: 'legacy-snapshot-group', userId: 'u-owner', role: 'leader', userName: 'Owner', joinedAt: new Date() },
      { id: 'legacy-snapshot-reader', groupId: 'legacy-snapshot-group', userId: 'u-reader', role: 'member', userName: 'Reader', joinedAt: new Date() },
    );

    const response = await request(app)
      .get('/api/community/study-groups/legacy-snapshot-group/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(response.status).toBe(200);
    expect(response.body.plan).toBeNull();
    expect(response.body.progress.plan_snapshot).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('Forged private snapshot');
  });

  it('re-homes a replaced group progress row to the current assigning leader', async () => {
    prisma._store.entity.push(
      {
        id: 'replacement-leader-group', type: 'StudyGroup', userId: 'u-reader',
        data: { name: 'Replacement leader group', status: 'active' },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'replacement-private-plan', type: 'ReadingPlan', userId: 'u-reader',
        data: { name: 'Replacement private plan', is_public: false, daily_readings: [] },
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'stale-former-leader-progress', type: 'GroupProgress', userId: 'u-owner',
        data: { group_id: 'replacement-leader-group', total_days: 3, completed_days: [] },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );
    prisma._store.communityGroupMember.push({
      id: 'replacement-leader-membership', groupId: 'replacement-leader-group', userId: 'u-reader',
      role: 'leader', userName: 'Reader', joinedAt: new Date(),
    });

    const response = await request(app)
      .put('/api/community/study-groups/replacement-leader-group/progress')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`])
      .send({ plan_id: 'replacement-private-plan' });

    expect(response.status).toBe(200);
    expect(prisma._store.entity.find((row) => row.id === 'stale-former-leader-progress')).toMatchObject({
      userId: 'u-reader',
      data: expect.objectContaining({ assignment_format_version: 2 }),
    });
  });

  it('re-reads progress after the group lock, preserves concurrent days, and heals legacy duplicates', async () => {
    prisma._store.entity.push(
      {
        id: 'locked-progress-group', type: 'StudyGroup', userId: 'u-owner',
        data: { name: 'Locked progress', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'progress-newest', type: 'GroupProgress', userId: 'u-owner',
        data: { group_id: 'locked-progress-group', total_days: 7, completed_days: [], current_day: 1 },
        createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02'),
      },
      {
        id: 'progress-legacy-duplicate', type: 'GroupProgress', userId: 'u-owner',
        data: { group_id: 'locked-progress-group', total_days: 7, completed_days: [], current_day: 1 },
        createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
      },
    );
    prisma._store.communityGroupMember.push({
      id: 'locked-progress-leader', groupId: 'locked-progress-group', userId: 'u-owner',
      role: 'leader', userName: 'Owner', joinedAt: new Date(),
    });
    // A day-one write lands after the handler begins but before it re-reads
    // under the advisory lock. Day two must merge with that fresh state.
    prisma.$queryRaw.mockImplementationOnce(async () => {
      const row = prisma._store.entity.find((entity) => entity.id === 'progress-newest');
      row.data = { ...row.data, completed_days: [1], current_day: 2, completion_percentage: 14 };
      return [{ ok: 1 }];
    });

    const completed = await request(app)
      .post('/api/community/study-groups/locked-progress-group/progress/days/2/complete')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`]);

    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ completed_days: [1, 2], completion_percentage: 29 });
    expect(prisma._store.entity.filter((row) => row.type === 'GroupProgress')).toHaveLength(1);
    expect(prisma._store.entity.find((row) => row.type === 'GroupProgress').id).toBe('progress-newest');
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
        points: [
          {
            title: 'Grace teaches',
            exegesis: null,
            content: 'Legacy point body',
            illustration: { unsafe: 'object' },
            application: 'Practice grace',
            supporting_scriptures: ['Titus 2:11', { reference: 'Ephesians 2:8' }, { unsafe: true }],
            private_nested_data: { should_not: 'publish' },
          },
          ['not', 'a', 'point'],
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const shared = await request(app)
      .post('/api/community/sermons/share')
      .set('Cookie', [`ss_token=${tokenFor('u-owner')}`])
      .send({ source_sermon_id: 'private-sermon', ai_tags: ['grace'], style_tags: ['teaching'] });
    expect(shared.status).toBe(201);
    expect(shared.body.points).toEqual([{
      title: 'Grace teaches',
      exegesis: 'Legacy point body',
      illustration: '',
      application: 'Practice grace',
      supporting_scriptures: ['Titus 2:11', 'Ephesians 2:8'],
    }]);

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

  it('ranks the complete shared-sermon set before returning the top 100', async () => {
    for (let index = 0; index < 251; index += 1) {
      prisma._store.entity.push({
        id: `recent-low-rated-${index}`,
        type: 'SharedSermon',
        userId: 'u-owner',
        data: { title: `Recent ${index}`, status: 'active', average_rating: 1 },
        createdAt: new Date(Date.UTC(2026, 8, 3, 12, index)),
        updatedAt: new Date(Date.UTC(2026, 8, 3, 12, index)),
      });
    }
    prisma._store.entity.push({
      id: 'oldest-highest-rated',
      type: 'SharedSermon',
      userId: 'u-owner',
      data: { title: 'Best overall', status: 'active', average_rating: 5 },
      createdAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: new Date('2020-01-01T00:00:00Z'),
    });

    const ranked = await request(app)
      .get('/api/community/sermons?sort=rating')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(ranked.status).toBe(200);
    expect(ranked.body).toHaveLength(100);
    expect(ranked.body[0].id).toBe('oldest-highest-rated');
  });

  it('ranks the complete public reading-plan set before returning the top 50', async () => {
    for (let index = 0; index < 251; index += 1) {
      const createdAt = new Date(Date.UTC(2026, 8, 3, 12, index));
      prisma._store.entity.push({
        id: `recent-low-plan-${index}`,
        type: 'ReadingPlan',
        userId: 'u-owner',
        data: { name: `Recent plan ${index}`, is_public: true, average_rating: 1, followers_count: 1 },
        createdAt,
        updatedAt: createdAt,
      });
    }
    prisma._store.entity.push({
      id: 'oldest-highest-plan',
      type: 'ReadingPlan',
      userId: 'u-owner',
      data: { name: 'Best plan overall', is_public: true, average_rating: 5, followers_count: 500 },
      createdAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: new Date('2020-01-01T00:00:00Z'),
    });

    const byRating = await request(app)
      .get('/api/community/reading-plans?sort=rating')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    const byPopularity = await request(app)
      .get('/api/community/reading-plans?sort=popular')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(byRating.status).toBe(200);
    expect(byRating.body).toHaveLength(50);
    expect(byRating.body[0]).toMatchObject({ id: 'oldest-highest-plan', creator_id: 'u-owner' });
    expect(byPopularity.body[0].id).toBe('oldest-highest-plan');
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

  it('neutralizes legacy email display names in sermon ratings', async () => {
    prisma._store.user.push({
      id: 'u-legacy-rating', email: 'legacy-rating@example.com', role: 'user', premium: true,
      full_name: null, name: null, deletedAt: null, is_banned: false,
    });
    prisma._store.entity.push(
      {
        id: 'legacy-rating-sermon', type: 'SharedSermon', userId: 'u-owner',
        data: { title: 'Rated sermon', status: 'active' }, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'legacy-email-rating', type: 'SermonRating', userId: 'u-legacy-rating',
        data: { sermon_id: 'legacy-rating-sermon', user_id: 'u-legacy-rating', user_name: 'legacy-rating@example.com', rating: 4 },
        createdAt: new Date(), updatedAt: new Date(),
      },
    );

    const ratings = await request(app)
      .get('/api/community/sermons/legacy-rating-sermon/ratings')
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);

    expect(ratings.status).toBe(200);
    expect(ratings.body.ratings[0].user_name).toBe('Member');
    expect(JSON.stringify(ratings.body)).not.toContain('legacy-rating@example.com');
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
    expect(mine.body.sermons.map((row) => row.id)).toEqual(['withdraw-me']);
    expect(mine.body.next_offset).toBeNull();

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

  it('paginates shared-sermon withdrawal inventory beyond the former 500-row cap', async () => {
    for (let index = 0; index < 501; index += 1) {
      prisma._store.entity.push({
        id: `historical-share-${index}`,
        type: 'SharedSermon',
        userId: 'u-free',
        data: { title: `Historical share ${index}`, status: 'active' },
        createdAt: new Date(2020, 0, 1, 0, 0, index),
        updatedAt: new Date(2020, 0, 1, 0, 0, index),
      });
    }

    const oldestPage = await request(app)
      .get('/api/community/sermons/mine?offset=500&limit=100')
      .set('Cookie', [`ss_token=${tokenFor('u-free')}`]);

    expect(oldestPage.status).toBe(200);
    expect(oldestPage.body.sermons.map((row) => row.id)).toEqual(['historical-share-0']);
    expect(oldestPage.body.next_offset).toBeNull();
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

    // Retraction remains available after the author's paid/promo window ends.
    prisma._store.user.find((row) => row.id === 'u-reader').premium = false;
    const deleted = await request(app)
      .delete(`/api/community/comments/${created.body.id}`)
      .set('Cookie', [`ss_token=${tokenFor('u-reader')}`]);
    expect(deleted.status).toBe(204);
    expect(prisma._store.communityLike.some((row) => row.contentId === created.body.id)).toBe(false);
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

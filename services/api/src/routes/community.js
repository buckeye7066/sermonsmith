import { Router } from 'express';
import { z } from 'zod';
import { prisma, authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Community / share routes.
//
// The previous design tried to make /SharedContent "public" by reading
// through the generic entity API. That API tenant-scopes non-public
// types to the authenticated user, so regular users only ever saw their
// own content under the "community" tab — the feature looked shipped but
// did not work.
//
// These routes are the public-facing surface for community-visible
// content. They never include private rows and never leak entity
// metadata the entity API would have hidden.
//
// `formatEntity` mirrors the shape the entity API emits so the frontend
// can reuse its existing card components without translation.
// ---------------------------------------------------------------------------
const router = Router();

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

const HIDDEN_COMMUNITY_STATUSES = new Set(['hidden', 'removed', 'rejected', 'deleted']);

function communityStatus(data) {
  return String(data?.status || 'active').toLowerCase();
}

function reportedCount(data) {
  return Number(data?.reported_count || data?.reportedCount || 0);
}

function isPublicCommunityData(data) {
  return data?.visibility === 'public' && !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(data));
}

function sharedContentInteractionKey(userId, contentId) {
  return { userId, contentId, contentType: 'SharedContent' };
}

async function recordCommunityAudit(action, userId, targetType, targetId, metadata = {}) {
  if (!prisma.auditLog?.create) return;
  try {
    await prisma.auditLog.create({
      data: { userId, action, targetType, targetId, metadata },
    });
  } catch {
    // Best-effort only.
  }
}

const reportSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  category: z.enum(['spam', 'abuse', 'theology', 'copyright', 'privacy', 'other']).default('other'),
});

const moderationSchema = z.object({
  status: z.enum(['active', 'reported', 'hidden', 'removed', 'rejected']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  moderatorNotes: z.string().trim().max(2000).optional(),
}).refine((value) => value.status || value.visibility || value.moderatorNotes !== undefined, {
  message: 'Provide status, visibility, or moderatorNotes',
});

router.get('/shared-content', optionalAuth, async (req, res, next) => {
  try {
    const contentType = req.query.type ? String(req.query.type) : null;
    const where = {
      type: 'SharedContent',
      data: { path: ['visibility'], equals: 'public' },
    };
    if (contentType && contentType !== 'all') {
      where.AND = [{ data: { path: ['content_type'], equals: contentType } }];
    }

    const rows = await prisma.entity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });

    res.json(rows.filter((row) => isPublicCommunityData(row.data || {})).map(formatEntity));
  } catch (err) {
    next(err);
  }
});

router.get('/share/:slug', optionalAuth, async (req, res, next) => {
  try {
    const link = await prisma.entity.findFirst({
      where: {
        type: 'SharedLink',
        data: { path: ['slug'], equals: req.params.slug },
      },
    });
    if (!link) return res.status(404).json({ message: 'Share link not found' });

    const data = link.data || {};
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return res.status(410).json({ message: 'Share link expired' });
    }

    const resource = await prisma.entity.findUnique({
      where: { id: data.resourceId },
      select: { id: true, type: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    if (!resource) return res.status(404).json({ message: 'Shared resource not found' });

    // IDOR guard: the sharer must own the resource they shared. Legitimate
    // links are minted by /api/functions/createShareableLink, which verifies
    // ownership at creation time — but a SharedLink row forged through any
    // other write path could point `resourceId` at ANOTHER user's private
    // entity. Never serve a resource the link's creator does not own.
    if (resource.userId !== link.userId) {
      return res.status(404).json({ message: 'Shared resource not found' });
    }

    // Increment views opportunistically; failure must not block the read.
    prisma.entity.update({
      where: { id: link.id },
      data: { data: { ...data, views: Number(data.views || 0) + 1 } },
    }).catch(() => null);

    res.json({ link: data, resource: formatEntity(resource) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Public forum + community feeds.
//
// The Forum and Community landing previously read posts/replies/groups/plans
// through the generic entity API, which tenant-scopes to the caller — so every
// member only ever saw THEIR OWN content and the community looked empty. These
// routes return community-visible rows across ALL users (hiding moderated
// ones), mirroring the shared-content pattern above.
// ---------------------------------------------------------------------------

router.get('/posts', optionalAuth, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'CommunityPost' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });
    res.json(
      rows
        .filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})))
        .map(formatEntity),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/replies', optionalAuth, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'CommunityReply', data: { path: ['post_id'], equals: req.params.id } },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });
    res.json(
      rows
        .filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})))
        .map(formatEntity),
    );
  } catch (err) {
    next(err);
  }
});

const replySchema = z.object({
  content: z.string().trim().min(1).max(5000),
  user_name: z.string().trim().max(120).optional(),
  is_ai_response: z.boolean().optional(),
});

// Post a reply to ANY public post. The reply is owned by the caller, and the
// post's replies_count is incremented server-side — the Forum previously did
// this via the tenant-scoped entity API, so replying to someone else's post
// 403'd on the count update (the reply was created but the UI showed an error).
router.post('/posts/:id/reply', authenticateToken, async (req, res, next) => {
  try {
    const parsed = replySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reply', issues: parsed.error.issues });
    }
    const post = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!post || post.type !== 'CommunityPost') {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(post.data || {}))) {
      return res.status(403).json({ message: 'This post is closed to replies' });
    }

    const isAi = parsed.data.is_ai_response === true;
    const reply = await prisma.entity.create({
      data: {
        type: 'CommunityReply',
        userId: req.userId,
        data: {
          post_id: req.params.id,
          user_id: req.userId,
          user_name: isAi ? 'AI Assistant' : (parsed.data.user_name || 'Member'),
          content: parsed.data.content,
          is_ai_response: isAi,
          created_date: new Date().toISOString(),
        },
      },
    });

    await prisma.entity.update({
      where: { id: post.id },
      data: { data: { ...post.data, replies_count: Number(post.data?.replies_count || 0) + 1 } },
    });

    res.json(formatEntity(reply));
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups', optionalAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'StudyGroup' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });
    res.json(
      rows
        .filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})))
        .map(formatEntity),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/reading-plans', optionalAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'ReadingPlan', data: { path: ['is_public'], equals: true } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
    });
    res.json(rows.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

router.post('/shared-content/:id/like', authenticateToken, async (req, res, next) => {
  try {
    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.type !== 'SharedContent') {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    const data = existing.data || {};
    if (!isPublicCommunityData(data)) {
      return res.status(403).json({ message: 'Cannot like private content' });
    }

    const key = sharedContentInteractionKey(req.userId, existing.id);
    const previous = await prisma.communityLike.findUnique({
      where: { userId_contentId_contentType: key },
    });
    if (previous) {
      return res.json({ ...formatEntity(existing), liked: true, alreadyLiked: true });
    }

    await prisma.communityLike.create({ data: key });

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, likes_count: Number(data.likes_count || 0) + 1 } },
    });

    res.json({ ...formatEntity(updated), liked: true, alreadyLiked: false });
  } catch (err) {
    if (err.code === 'P2002') {
      const current = await prisma.entity.findUnique({ where: { id: req.params.id } }).catch(() => null);
      return res.json({
        ...(current ? formatEntity(current) : { id: req.params.id }),
        liked: true,
        alreadyLiked: true,
      });
    }
    next(err);
  }
});

router.post('/shared-content/:id/report', authenticateToken, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid report', issues: parsed.error.issues });
    }

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.type !== 'SharedContent') {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    const data = existing.data || {};
    if (!isPublicCommunityData(data)) {
      return res.status(403).json({ message: 'Cannot report private or removed content' });
    }

    const reportedBy = Array.isArray(data.reported_by) ? data.reported_by : [];
    if (reportedBy.includes(req.userId) || data.last_report?.reporterId === req.userId) {
      return res.status(409).json({
        message: 'You have already reported this content',
        reported_count: reportedCount(data),
      });
    }

    const nextCount = reportedCount(data) + 1;
    const report = {
      ...parsed.data,
      reporterId: req.userId,
      reportedAt: new Date().toISOString(),
    };
    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: {
        data: {
          ...data,
          reported_count: nextCount,
          reportedCount: nextCount,
          reported_by: [...new Set([...reportedBy, req.userId])],
          last_report: report,
          status: nextCount >= 3 ? 'reported' : communityStatus(data),
        },
      },
    });

    await recordCommunityAudit('community.report', req.userId, 'SharedContent', existing.id, {
      category: parsed.data.category,
      reportedCount: nextCount,
    });
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/shared-content/:id/save', authenticateToken, async (req, res, next) => {
  try {
    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.type !== 'SharedContent') {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    const data = existing.data || {};
    if (!isPublicCommunityData(data)) {
      return res.status(403).json({ message: 'Cannot save private content' });
    }

    const key = sharedContentInteractionKey(req.userId, existing.id);
    const previous = await prisma.savedContent.findUnique({
      where: { userId_contentId_contentType: key },
    });
    if (previous) {
      return res.json({ ...formatEntity(existing), saved: true, alreadySaved: true });
    }

    await prisma.savedContent.create({ data: key });

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, saves_count: Number(data.saves_count || 0) + 1 } },
    });

    res.json({ ...formatEntity(updated), saved: true, alreadySaved: false });
  } catch (err) {
    if (err.code === 'P2002') {
      const current = await prisma.entity.findUnique({ where: { id: req.params.id } }).catch(() => null);
      return res.json({
        ...(current ? formatEntity(current) : { id: req.params.id }),
        saved: true,
        alreadySaved: true,
      });
    }
    next(err);
  }
});

router.get('/moderation/queue', authenticateToken, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { OR: [{ type: 'SharedContent' }, { type: 'ForumPost' }] },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, type: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });

    const queue = rows
      .filter((row) => {
        const status = communityStatus(row.data || {});
        return reportedCount(row.data || {}) > 0 || ['reported', 'hidden', 'removed', 'rejected'].includes(status);
      })
      .map((row) => ({ type: row.type, userId: row.userId, ...formatEntity(row) }));

    res.json(queue);
  } catch (err) {
    next(err);
  }
});

router.patch('/moderation/:type/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    if (!['SharedContent', 'ForumPost'].includes(req.params.type)) {
      return res.status(400).json({ message: 'Unsupported moderation type' });
    }
    const parsed = moderationSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid moderation update', issues: parsed.error.issues });
    }

    const existing = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.type !== req.params.type) {
      return res.status(404).json({ message: 'Community content not found' });
    }

    const patch = parsed.data;
    const removed = patch.status === 'removed';
    const data = {
      ...(existing.data || {}),
      ...patch,
      ...(patch.moderatorNotes !== undefined ? { moderator_notes: patch.moderatorNotes } : {}),
      ...(removed ? { removedAt: new Date().toISOString(), removedBy: req.userId } : {}),
    };

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data },
    });

    await recordCommunityAudit('community.moderate', req.userId, existing.type, existing.id, patch);
    res.json({ type: existing.type, userId: existing.userId, ...formatEntity(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;

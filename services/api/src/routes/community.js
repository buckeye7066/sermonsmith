import { Router } from 'express';
import { z } from 'zod';
import { prisma, authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';
import {
  assertGatedResourceExposable,
  isPublicContentServable,
  assertAiReplyExposable,
  SCRIPTURE_GATED_TYPES,
} from '../services/scriptureGate.js';

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

// Resolve a row owner's denomination (row.data.denomination → owner profile),
// memoized per feed request so a 50-row feed does at most one lookup per owner.
function makeDenominationResolver() {
  const cache = new Map();
  return async (row) => {
    if (row.data?.denomination) return row.data.denomination;
    const uid = row.userId;
    if (!uid) return '';
    if (cache.has(uid)) return cache.get(uid);
    const user = await prisma.user
      .findUnique({ where: { id: uid }, select: { profile: true } })
      .catch(() => null);
    const denom = (user?.profile?.denomination) || '';
    cache.set(uid, denom);
    return denom;
  };
}

// Fail-closed serve filter for public feeds: keep only rows whose CURRENT stored
// content still fully verifies. A gated row (or an is_ai_response reply) edited
// into an invalid state AFTER it went public is OMITTED (and audit-logged), so a
// public feed can never surface unverified/fabricated Scripture. Non-gated rows
// pass through untouched.
async function serveExposableRows(type, rows) {
  const resolveDenom = makeDenominationResolver();
  const kept = await Promise.all(rows.map(async (row) => {
    const denomination = await resolveDenom(row);
    if (isPublicContentServable({ type, data: row.data || {}, denomination })) return row;
    recordCommunityAudit('community.omitted_unverified_scripture', row.userId, type, row.id, {}).catch(() => {});
    return null;
  }));
  return kept.filter(Boolean);
}

// Interaction routes (like / report / save) echo the SharedContent row back so
// the UI can refresh its card. If that row's Scripture no longer verifies, fail
// closed: return the interaction STATUS (counters/flags) WITHOUT the content
// body, so a public row the feed now OMITS can't be re-fetched by id through an
// interaction response. Valid content is returned unchanged.
async function interactionResult(row, extra = {}) {
  const data = row.data || {};
  const denomination = data.denomination
    || (row.userId
      ? ((await prisma.user.findUnique({ where: { id: row.userId }, select: { profile: true } }).catch(() => null))?.profile?.denomination || '')
      : '');
  if (isPublicContentServable({ type: 'SharedContent', data, denomination })) {
    return { ...formatEntity(row), ...extra };
  }
  recordCommunityAudit('community.omitted_unverified_scripture', row.userId, 'SharedContent', row.id, {}).catch(() => {});
  return {
    id: row.id,
    content_type: data.content_type,
    visibility: data.visibility,
    status: data.status,
    likes_count: data.likes_count,
    saves_count: data.saves_count,
    reported_count: data.reported_count ?? data.reportedCount,
    reportedCount: data.reportedCount ?? data.reported_count,
    reported_by: data.reported_by,
    last_report: data.last_report,
    content_withheld: true,
    ...extra,
  };
}

async function recordCommunityAudit(action, userId, targetType, targetId, metadata = {}) {
  if (!prisma.auditLog?.create) return;
  try {
    await prisma.auditLog.create({
      data: { userId, action, targetType, targetId, metadata },
    });
  } catch (err) {
    console.error('Audit log creation failed', err);
    // Notify admin or log to a monitoring service here if needed.
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
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });

    const visible = rows.filter((row) => isPublicCommunityData(row.data || {}));
    // Fail closed: re-validate Scripture over each row's CURRENT stored content
    // and omit any that no longer verifies (edited-to-invalid after publish).
    const servable = await serveExposableRows('SharedContent', visible);
    res.json(servable.map(formatEntity));
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

    // Serve-time Scripture gate: the resource may have been valid when the link
    // was minted and later edited into an invalid private state (the merged-
    // record entity gate cannot see this external SharedLink). Re-validate the
    // CURRENT stored content and refuse to surface a gated resource whose
    // references no longer all verify — so a share link can never present
    // unverified/fabricated Scripture as trusted. Owner denomination → canon.
    const shareDenomination = resource.data?.denomination
      || (await prisma.user.findUnique({ where: { id: resource.userId }, select: { profile: true } }))?.profile?.denomination
      || '';
    assertGatedResourceExposable({ type: resource.type, resourceData: resource.data, denomination: shareDenomination });

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
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    const visible = rows.filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})));
    // Fail closed: an is_ai_response reply whose Scripture no longer verifies is
    // omitted (user-authored replies pass through untouched).
    const servable = await serveExposableRows('CommunityReply', visible);
    res.json(servable.map(formatEntity));
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
    // AI-generated replies are AI content posted straight to a public thread —
    // route them through the centralized Scripture gate (user-authored replies
    // are out of scope and pass through). Fabricated/unverified references are
    // rejected at creation; the validated refs are stored for transparency.
    let scriptureValidation;
    if (isAi) {
      const denomination = (await prisma.user
        .findUnique({ where: { id: req.userId }, select: { profile: true } })
        .catch(() => null))?.profile?.denomination || '';
      scriptureValidation = assertAiReplyExposable({ content: parsed.data.content, denomination });
    }
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
          ...(scriptureValidation ? { scripture_validation: scriptureValidation } : {}),
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
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    // Fail closed: omit any public plan whose CURRENT references no longer verify.
    const servable = await serveExposableRows('ReadingPlan', rows);
    res.json(servable.map(formatEntity));
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
      return res.json(await interactionResult(existing, { liked: true, alreadyLiked: true }));
    }

    await prisma.communityLike.create({ data: key });

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, likes_count: Number(data.likes_count || 0) + 1 } },
    });

    res.json(await interactionResult(updated, { liked: true, alreadyLiked: false }));
  } catch (err) {
    if (err.code === 'P2002') {
      const current = await prisma.entity.findUnique({ where: { id: req.params.id } }).catch(() => null);
      return res.json(current
        ? await interactionResult(current, { liked: true, alreadyLiked: true })
        : { id: req.params.id, liked: true, alreadyLiked: true });
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
      return res.status(403).json({ message: 'Cannot report private, removed, or non-public content' });
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
    res.json(await interactionResult(updated));
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
      return res.json(await interactionResult(existing, { saved: true, alreadySaved: true }));
    }

    await prisma.savedContent.create({ data: key });

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, saves_count: Number(data.saves_count || 0) + 1 } },
    });

    res.json(await interactionResult(updated, { saved: true, alreadySaved: false }));
  } catch (err) {
    if (err.code === 'P2002') {
      const current = await prisma.entity.findUnique({ where: { id: req.params.id } }).catch(() => null);
      return res.json(current
        ? await interactionResult(current, { saved: true, alreadySaved: true })
        : { id: req.params.id, saved: true, alreadySaved: true });
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

    const queue = Array.isArray(rows) ? rows
      .filter((row) => {
        const status = communityStatus(row.data || {});
        return reportedCount(row.data || {}) > 0 || ['reported', 'hidden', 'removed', 'rejected'].includes(status);
      })
      .map((row) => ({ type: row.type, userId: row.userId, ...formatEntity(row) })) : [];

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

    // A moderator explicitly making a gated resource public is a publish
    // transition through a non-entity route — run it through the SAME exposure
    // gate so unverified Scripture can't be surfaced this way either. Only the
    // explicit visibility:'public' transition is gated; hide/remove/status
    // actions (the normal moderation path) are never blocked by this.
    if (patch.visibility === 'public' && SCRIPTURE_GATED_TYPES.has(existing.type)) {
      const denom = existing.data?.denomination
        || (await prisma.user.findUnique({ where: { id: existing.userId }, select: { profile: true } }))?.profile?.denomination
        || '';
      assertGatedResourceExposable({ type: existing.type, resourceData: data, denomination: denom });
    }

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

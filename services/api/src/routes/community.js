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
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
    });
    if (!resource) return res.status(404).json({ message: 'Shared resource not found' });

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

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, likes_count: Number(data.likes_count || 0) + 1 } },
    });

    res.json(formatEntity(updated));
  } catch (err) {
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

    const updated = await prisma.entity.update({
      where: { id: existing.id },
      data: { data: { ...data, saves_count: Number(data.saves_count || 0) + 1 } },
    });

    res.json(formatEntity(updated));
  } catch (err) {
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

import { Router } from 'express';
import { z } from 'zod';
import {
  prisma,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireEntitlement,
} from '../middleware/auth.js';
import { ENTITLEMENTS, entitlementsFor } from '../lib/entitlements.js';
import { lockCommunityEntity, lockMeetingRsvp } from '../lib/communityEntityLock.js';
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
const requireCommunity = requireEntitlement(ENTITLEMENTS.COMMUNITY);

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

function uniqueRatingsByUser(rows) {
  const byUser = new Map();
  for (const row of rows || []) {
    const userId = row.userId || row.data?.user_id;
    if (userId && !byUser.has(userId)) byUser.set(userId, row);
  }
  return [...byUser.values()];
}

async function writeUniqueInteractionCounter({
  targetId,
  userId,
  contentType,
  counterField,
  active,
  modelName = 'communityLike',
  validateTarget,
}) {
  return prisma.$transaction(async (tx) => {
    await lockCommunityEntity(tx, targetId);
    const target = await tx.entity.findUnique({ where: { id: targetId } });
    if (validateTarget) await validateTarget(target);

    const model = tx[modelName];
    const key = { userId, contentId: targetId, contentType };
    const previous = await model.findUnique({
      where: { userId_contentId_contentType: key },
    });

    if (active && !previous) await model.create({ data: key });
    if (!active && previous) await model.deleteMany({ where: key });

    // Derive the cache from the relational source of truth after mutation.
    // Besides eliminating lost updates, this repairs any stale JSON counter
    // left by the pre-lock implementation.
    const count = await model.count({ where: { contentId: targetId, contentType } });
    const updated = await tx.entity.update({
      where: { id: target.id },
      data: { data: { ...(target.data || {}), [counterField]: count } },
    });

    return {
      target: updated,
      count,
      alreadyActive: Boolean(previous),
      changed: active ? !previous : Boolean(previous),
    };
  });
}

async function writeRatingAtomically({ type, targetField, targetId, userId, data }) {
  // Rating rows live in the legacy JSON Entity table, where Prisma cannot
  // express a compound UNIQUE constraint over a JSON path. A transaction-
  // scoped Postgres advisory lock serializes every rating write for the same
  // target across processes. Generic entity writes for rating types are
  // blocked, so this is the sole mutation path.
  return prisma.$transaction(async (tx) => {
    await lockCommunityEntity(tx, targetId);

    const ownedRows = await tx.entity.findMany({
      where: {
        type,
        userId,
        data: { path: [targetField], equals: targetId },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const existing = ownedRows[0] || null;
    const rating = existing
      ? await tx.entity.update({
        where: { id: existing.id },
        data: { data: { ...existing.data, ...data } },
      })
      : await tx.entity.create({ data: { type, userId, data } });

    // Clean up any duplicates created before writes were serialized. Reads
    // also de-duplicate by user below, so old data can never inflate totals.
    const duplicateIds = ownedRows.slice(1).map((row) => row.id);
    if (duplicateIds.length) {
      await tx.entity.deleteMany({ where: { id: { in: duplicateIds } } });
    }

    const allRows = await tx.entity.findMany({
      where: { type, data: { path: [targetField], equals: targetId } },
      orderBy: { updatedAt: 'desc' },
      take: 10_000,
    });
    const ratings = uniqueRatingsByUser(allRows);
    const average = ratings.length
      ? ratings.reduce((sum, row) => sum + Number(row.data?.rating || 0), 0) / ratings.length
      : 0;
    const target = await tx.entity.findUnique({ where: { id: targetId } });
    if (!target) throw Object.assign(new Error('Community content not found'), { status: 404 });
    await tx.entity.update({
      where: { id: target.id },
      data: { data: { ...target.data, average_rating: average, ratings_count: ratings.length } },
    });

    return { rating, average, count: ratings.length };
  });
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

function publicMember(user) {
  const profile = user?.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)
    ? user.profile
    : {};
  const privacy = profile.profile_privacy && typeof profile.profile_privacy === 'object'
    ? profile.profile_privacy
    : {};
  const visible = (key, fallback = true) => privacy[key] ?? fallback;

  return {
    id: user.id,
    name: user.full_name || user.name || 'SermonSmith member',
    avatar: user.avatar || null,
    denomination: visible('show_denomination')
      ? (profile.denomination || profile.denominational_background || '')
      : '',
    ministryFocus: visible('show_ministry_focus') && Array.isArray(profile.ministry_focus)
      ? profile.ministry_focus.slice(0, 12)
      : [],
    preachingStyle: visible('show_preaching_style')
      ? (profile.preferred_preaching_style || profile.preaching_style || '')
      : '',
    favoritePassages: visible('show_favorite_passages', false)
      && Array.isArray(profile.favorite_scripture_passages)
      ? profile.favorite_scripture_passages.slice(0, 12)
      : [],
    email: visible('show_email', false) ? user.email : undefined,
    allowDirectMessages: visible('allow_direct_messages') === true,
    joinedAt: user.createdAt,
    followerCount: Number(user._count?.followers || 0),
    followingCount: Number(user._count?.following || 0),
    followedByMe: Array.isArray(user.followers) && user.followers.length > 0,
  };
}

const memberSearchSchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

const studyGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  focus_book: z.string().trim().max(100).optional().default(''),
  theme: z.string().trim().max(100).optional().default(''),
  meeting_schedule: z.string().trim().max(300).optional().default(''),
  is_private: z.boolean().optional().default(false),
});

const groupMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  message_type: z.enum(['text', 'scripture_reference', 'prayer_request', 'announcement']).default('text'),
});

const communityPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  post_type: z.enum(['question', 'discussion', 'testimony', 'prayer_request']).default('discussion'),
  scripture_reference: z.string().trim().max(200).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
});

const groupMeetingSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(3000).optional().default(''),
  meeting_type: z.enum(['virtual', 'in_person', 'hybrid']).default('virtual'),
  scheduled_date: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid meeting date and time',
  }),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  location: z.string().trim().max(500).optional().default(''),
  discussion_leader_id: z.string().min(1).max(200),
  discussion_leader_name: z.string().trim().max(200).optional().default(''),
  study_passage: z.string().trim().max(300).optional().default(''),
  agenda: z.array(z.string().max(500)).max(30).optional().default([]),
});

const rsvpSchema = z.object({
  status: z.enum(['attending', 'maybe', 'not_attending']),
});

const groupPlanSchema = z.object({
  plan_id: z.string().min(1).max(200),
});

const groupMemberAddSchema = z.object({
  user_id: z.string().min(1).max(200),
});

const shareSermonSchema = z.object({
  source_sermon_id: z.string().min(1).max(200),
  ai_tags: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]),
  style_tags: z.array(z.string().trim().min(1).max(80)).max(10).optional().default([]),
  category: z.string().trim().max(100).optional().default(''),
});

const sermonRatingSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  review_text: z.string().trim().max(5000).optional().default(''),
  used_in_ministry: z.boolean().optional().default(false),
});

const planRatingSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  review_text: z.string().trim().max(5000).optional().default(''),
  used_plan: z.boolean().optional().default(false),
});

const commentSchema = z.object({
  comment: z.string().trim().min(1).max(5000),
});

async function findCommentTarget(contentType, contentId) {
  const expectedType = contentType === 'sermon'
    ? 'SharedSermon'
    : contentType === 'plan'
      ? 'ReadingPlan'
      : null;
  if (!expectedType) throw Object.assign(new Error('Unsupported comment target'), { status: 400 });
  const target = await prisma.entity.findUnique({ where: { id: contentId } });
  const hidden = !target
    || target.type !== expectedType
    || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(target.data || {}))
    || (expectedType === 'ReadingPlan' && target.data?.is_public !== true);
  if (hidden) throw Object.assign(new Error('Comment target not found'), { status: 404 });
  if (expectedType === 'SharedSermon' || expectedType === 'ReadingPlan') {
    const denomination = target.data?.denomination
      || (await prisma.user.findUnique({ where: { id: target.userId }, select: { profile: true } }))?.profile?.denomination
      || '';
    if (!isPublicContentServable({ type: expectedType, data: target.data || {}, denomination })) {
      throw Object.assign(new Error('Comment target not found'), { status: 404 });
    }
  }
  return target;
}

async function findSharedSermon(id) {
  const sermon = await prisma.entity.findUnique({ where: { id } });
  if (!sermon || sermon.type !== 'SharedSermon' || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(sermon.data || {}))) {
    throw Object.assign(new Error('Shared sermon not found'), { status: 404 });
  }
  return sermon;
}

async function findPublicReadingPlan(id) {
  const plan = await prisma.entity.findUnique({ where: { id } });
  if (!plan || plan.type !== 'ReadingPlan' || plan.data?.is_public !== true
    || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(plan.data || {}))) {
    throw Object.assign(new Error('Public reading plan not found'), { status: 404 });
  }
  const denomination = plan.data?.denomination
    || (await prisma.user.findUnique({ where: { id: plan.userId }, select: { profile: true } }))?.profile?.denomination
    || '';
  assertGatedResourceExposable({ type: 'ReadingPlan', resourceData: plan.data || {}, denomination });
  return plan;
}

function formatGroupMembership(row) {
  return {
    id: row.id,
    group_id: row.groupId,
    user_id: row.userId,
    user_name: row.userName,
    role: row.role,
    joined_date: row.joinedAt,
  };
}

async function findStudyGroup(id, client = prisma) {
  const group = await client.entity.findUnique({ where: { id } });
  if (!group || group.type !== 'StudyGroup' || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(group.data || {}))) {
    throw Object.assign(new Error('Study group not found'), { status: 404 });
  }
  return group;
}

async function displayNameForUser(userId, client = prisma) {
  const user = await client.user.findUnique({ where: { id: userId } });
  return user?.full_name || user?.name || user?.email || 'Member';
}

async function displayNamesForRows(rows) {
  const ids = [...new Set((rows || []).map((row) => row.userId).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, full_name: true, name: true, email: true },
  });
  return new Map(users.map((user) => [
    user.id,
    user.full_name || user.name || user.email || 'Member',
  ]));
}

async function membershipFor(group, userId, { repairOwner = true, client = prisma } = {}) {
  let membership = await client.communityGroupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  // Repair groups created before relational membership was introduced. The
  // Entity owner is the authoritative original creator and therefore leader.
  if (!membership && repairOwner && group.userId === userId) {
    membership = await client.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: {
        groupId: group.id,
        userId,
        role: 'leader',
        userName: await displayNameForUser(userId, client),
        joinedAt: new Date(),
      },
      update: {},
    });
  }
  return membership;
}

async function requireGroupMember(groupId, userId) {
  const group = await findStudyGroup(groupId);
  const membership = await membershipFor(group, userId);
  if (!membership) {
    throw Object.assign(new Error('Join this study group to access its content'), { status: 403 });
  }
  return { group, membership };
}

async function requireGroupLeader(groupId, userId) {
  const result = await requireGroupMember(groupId, userId);
  if (result.membership.role !== 'leader') {
    throw Object.assign(new Error('Study group leader access required'), { status: 403 });
  }
  return result;
}

async function updateGroupMemberCount(group, client = prisma) {
  const memberCount = await client.communityGroupMember.count({ where: { groupId: group.id } });
  const updated = await client.entity.update({
    where: { id: group.id },
    data: { data: { ...(group.data || {}), member_count: memberCount } },
  });
  return { group: updated, memberCount };
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
const MODERATABLE_TYPES = Object.freeze([
  'SharedContent',
  'ForumPost', // legacy rows
  'CommunityPost',
  'CommunityReply',
]);

function isCommunityAdmin(req) {
  return req.userRole === 'admin' || req.userRole === 'dev';
}

async function writeForumReport({ id, type, userId, report, postId = null }) {
  return prisma.$transaction(async (tx) => {
    await lockCommunityEntity(tx, id);
    const existing = await tx.entity.findUnique({ where: { id } });
    if (!existing || existing.type !== type
      || (postId && existing.data?.post_id !== postId)) {
      throw Object.assign(new Error(type === 'CommunityPost' ? 'Post not found' : 'Reply not found'), { status: 404 });
    }
    const data = existing.data || {};
    if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(data))) {
      throw Object.assign(new Error('This content is no longer reportable'), { status: 403 });
    }

    const reportedBy = Array.isArray(data.reported_by) ? data.reported_by : [];
    if (reportedBy.includes(userId)) {
      return { duplicate: true, reportedCount: reportedCount(data) };
    }

    const nextCount = reportedCount(data) + 1;
    const lastReport = {
      ...report,
      reporterId: userId,
      reportedAt: new Date().toISOString(),
    };
    await tx.entity.update({
      where: { id: existing.id },
      data: {
        data: {
          ...data,
          reported_count: nextCount,
          reportedCount: nextCount,
          reported_by: [...reportedBy, userId],
          last_report: lastReport,
          status: nextCount >= 3 ? 'reported' : communityStatus(data),
        },
      },
    });
    return { duplicate: false, reportedCount: nextCount };
  });
}

router.get('/shared-content', authenticateToken, requireCommunity, async (req, res, next) => {
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
    const authorNames = await displayNamesForRows(servable);
    res.json(servable.map((row) => ({
      ...formatEntity(row),
      user_id: row.userId,
      user_name: authorNames.get(row.userId) || 'Member',
    })));
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
// Member discovery and follows.
//
// These endpoints expose only fields allowed by the member's profile privacy
// settings. Email is never searchable and phone numbers are never returned.
// ---------------------------------------------------------------------------
router.get('/members', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = memberSearchSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid member search', issues: parsed.error.issues });
    }
    const { q, limit, offset } = parsed.data;
    const where = {
      id: { not: req.userId },
      deletedAt: null,
      is_banned: false,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { full_name: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        email: true,
        name: true,
        full_name: true,
        avatar: true,
        profile: true,
        createdAt: true,
        _count: { select: { followers: true, following: true } },
        followers: {
          where: { followerId: req.userId },
          select: { id: true },
          take: 1,
        },
      },
    });

    res.json({ members: users.map(publicMember), nextOffset: users.length === limit ? offset + limit : null });
  } catch (err) {
    next(err);
  }
});

router.get('/members/:id', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null, is_banned: false },
      select: {
        id: true,
        email: true,
        name: true,
        full_name: true,
        avatar: true,
        profile: true,
        createdAt: true,
        _count: { select: { followers: true, following: true } },
        followers: {
          where: { followerId: req.userId },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!user) return res.status(404).json({ message: 'Member not found' });
    res.json(publicMember(user));
  } catch (err) {
    next(err);
  }
});

router.post('/members/:id/follow', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: 'You cannot follow your own account' });
    }
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null, is_banned: false },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ message: 'Member not found' });

    await prisma.communityFollow.upsert({
      where: { followerId_followingId: { followerId: req.userId, followingId: target.id } },
      create: { followerId: req.userId, followingId: target.id },
      update: {},
    });
    await recordCommunityAudit('community.member_follow', req.userId, 'User', target.id);
    res.json({ following: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/members/:id/follow', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await prisma.communityFollow.deleteMany({
      where: { followerId: req.userId, followingId: req.params.id },
    });
    await recordCommunityAudit('community.member_unfollow', req.userId, 'User', req.params.id);
    res.json({ following: false });
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

router.get('/posts', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'CommunityPost' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    const visible = rows.filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})));
    const likes = visible.length ? await prisma.communityLike.findMany({
      where: {
        userId: req.userId,
        contentType: 'CommunityPost',
        contentId: { in: visible.map((row) => row.id) },
      },
      select: { contentId: true },
    }) : [];
    const liked = new Set(likes.map((row) => row.contentId));
    const authorNames = await displayNamesForRows(visible);
    res.json(visible.map((row) => ({
      ...formatEntity(row),
      user_id: row.userId,
      user_name: authorNames.get(row.userId) || 'Member',
      likedByMe: liked.has(row.id),
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/posts', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = communityPostSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid community post', issues: parsed.error.issues });
    }
    const row = await prisma.entity.create({
      data: {
        type: 'CommunityPost',
        userId: req.userId,
        data: {
          ...parsed.data,
          user_id: req.userId,
          user_name: await displayNameForUser(req.userId),
          status: 'active',
          replies_count: 0,
          likes_count: 0,
          is_resolved: false,
          created_date: new Date().toISOString(),
        },
      },
    });
    await recordCommunityAudit('community.post_create', req.userId, 'CommunityPost', row.id);
    res.status(201).json(formatEntity(row));
  } catch (err) {
    next(err);
  }
});

// Retraction is a privacy control, so it remains available after a member's
// subscription or promotional window expires. Deleting a post also removes
// its replies and every relation that points at either row.
router.delete('/posts/:id', authenticateToken, async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const post = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!post || post.type !== 'CommunityPost') {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      if (post.userId !== req.userId && !isCommunityAdmin(req)) {
        throw Object.assign(new Error('You can only delete your own post'), { status: 403 });
      }
      const replies = await tx.entity.findMany({
        where: { type: 'CommunityReply', data: { path: ['post_id'], equals: post.id } },
        select: { id: true },
        take: 10_000,
      });
      const contentIds = [post.id, ...replies.map((reply) => reply.id)];
      await tx.communityLike.deleteMany({ where: { contentId: { in: contentIds } } });
      await tx.savedContent.deleteMany({ where: { contentId: { in: contentIds } } });
      await tx.entity.deleteMany({
        where: { type: 'CommunityReply', data: { path: ['post_id'], equals: post.id } },
      });
      await tx.entity.delete({ where: { id: post.id } });
    });
    await recordCommunityAudit('community.post_delete', req.userId, 'CommunityPost', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/report', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid report', issues: parsed.error.issues });
    }
    const outcome = await writeForumReport({
      id: req.params.id,
      type: 'CommunityPost',
      userId: req.userId,
      report: parsed.data,
    });
    if (outcome.duplicate) {
      return res.status(409).json({ message: 'You have already reported this post', reported_count: outcome.reportedCount });
    }
    await recordCommunityAudit('community.forum_report', req.userId, 'CommunityPost', req.params.id, {
      category: parsed.data.category,
      reportedCount: outcome.reportedCount,
    });
    res.json({ reported: true, reported_count: outcome.reportedCount });
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/like', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'CommunityPost',
      counterField: 'likes_count',
      active: true,
      validateTarget: (post) => {
        if (!post || post.type !== 'CommunityPost') {
          throw Object.assign(new Error('Post not found'), { status: 404 });
        }
        if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(post.data || {}))) {
          throw Object.assign(new Error('This post cannot be liked'), { status: 403 });
        }
      },
    });
    res.json({ ...formatEntity(result.target), likedByMe: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id/like', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'CommunityPost',
      counterField: 'likes_count',
      active: false,
      validateTarget: (post) => {
        if (!post || post.type !== 'CommunityPost') {
          throw Object.assign(new Error('Post not found'), { status: 404 });
        }
      },
    });
    res.json({ ...formatEntity(result.target), likedByMe: false });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/replies', authenticateToken, requireCommunity, async (req, res, next) => {
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
    const authorNames = await displayNamesForRows(servable);
    res.json(servable.map((row) => ({
      ...formatEntity(row),
      user_id: row.userId,
      user_name: authorNames.get(row.userId) || 'Member',
    })));
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:postId/replies/:replyId', authenticateToken, async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Reply creation and reply-count maintenance use the parent post lock.
      await lockCommunityEntity(tx, req.params.postId);
      const post = await tx.entity.findUnique({ where: { id: req.params.postId } });
      const reply = await tx.entity.findUnique({ where: { id: req.params.replyId } });
      if (!post || post.type !== 'CommunityPost'
        || !reply || reply.type !== 'CommunityReply'
        || reply.data?.post_id !== post.id) {
        throw Object.assign(new Error('Reply not found'), { status: 404 });
      }
      if (reply.userId !== req.userId && !isCommunityAdmin(req)) {
        throw Object.assign(new Error('You can only delete your own reply'), { status: 403 });
      }

      await tx.communityLike.deleteMany({ where: { contentId: reply.id } });
      await tx.savedContent.deleteMany({ where: { contentId: reply.id } });
      await tx.entity.delete({ where: { id: reply.id } });
      const repliesCount = await tx.entity.count({
        where: { type: 'CommunityReply', data: { path: ['post_id'], equals: post.id } },
      });
      await tx.entity.update({
        where: { id: post.id },
        data: { data: { ...(post.data || {}), replies_count: repliesCount } },
      });
    });
    await recordCommunityAudit('community.reply_delete', req.userId, 'CommunityReply', req.params.replyId, {
      postId: req.params.postId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:postId/replies/:replyId/report', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid report', issues: parsed.error.issues });
    }
    const outcome = await writeForumReport({
      id: req.params.replyId,
      type: 'CommunityReply',
      userId: req.userId,
      report: parsed.data,
      postId: req.params.postId,
    });
    if (outcome.duplicate) {
      return res.status(409).json({ message: 'You have already reported this reply', reported_count: outcome.reportedCount });
    }
    await recordCommunityAudit('community.forum_report', req.userId, 'CommunityReply', req.params.replyId, {
      category: parsed.data.category,
      reportedCount: outcome.reportedCount,
      postId: req.params.postId,
    });
    res.json({ reported: true, reported_count: outcome.reportedCount });
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
router.post('/posts/:id/reply', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = replySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reply', issues: parsed.error.issues });
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
    const userName = await displayNameForUser(req.userId);
    const reply = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const post = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!post || post.type !== 'CommunityPost') {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(post.data || {}))) {
        throw Object.assign(new Error('This post is closed to replies'), { status: 403 });
      }
      const created = await tx.entity.create({
        data: {
          type: 'CommunityReply',
          userId: req.userId,
          data: {
            post_id: req.params.id,
            user_id: req.userId,
            user_name: userName,
            content: parsed.data.content,
            is_ai_response: isAi,
            ...(scriptureValidation ? { scripture_validation: scriptureValidation } : {}),
            created_date: new Date().toISOString(),
          },
        },
      });
      const repliesCount = await tx.entity.count({
        where: {
          type: 'CommunityReply',
          data: { path: ['post_id'], equals: post.id },
        },
      });
      await tx.entity.update({
        where: { id: post.id },
        data: { data: { ...post.data, replies_count: repliesCount } },
      });
      return created;
    });

    res.json(formatEntity(reply));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Shared sermon library. All cross-user reads and interaction counters live
// here; the generic Entity API remains owner-scoped by design.
// ---------------------------------------------------------------------------
router.get('/sermons', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const sort = String(req.query.sort || 'popular');
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedSermon' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const visible = rows.filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})));
    const servable = await serveExposableRows('SharedSermon', visible);
    const field = sort === 'rating'
      ? 'average_rating'
      : sort === 'views'
        ? 'views_count'
        : sort === 'recent'
          ? null
          : 'forks_count';
    const formatted = servable.map(formatEntity);
    if (field) formatted.sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// Personal publication management remains available when Premium expires so
// a user can always see and withdraw material they previously made public.
router.get('/sermons/mine', authenticateToken, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedSermon', userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(rows.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

router.post('/sermons/share', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = shareSermonSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid sermon share', issues: parsed.error.issues });
    }
    const source = await prisma.entity.findUnique({ where: { id: parsed.data.source_sermon_id } });
    if (!source || source.type !== 'Sermon' || source.userId !== req.userId) {
      return res.status(404).json({ message: 'Owned sermon not found' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const denomination = source.data?.denomination || user?.profile?.denomination || '';
    assertGatedResourceExposable({ type: 'Sermon', resourceData: source.data || {}, denomination });
    const data = {
      source_sermon_id: source.id,
      user_id: req.userId,
      user_name: user?.full_name || user?.name || user?.email || 'Member',
      title: source.data?.title || 'Untitled Sermon',
      topic: source.data?.topic || '',
      anchor_passage: source.data?.anchor_passage || '',
      big_idea: source.data?.big_idea || '',
      introduction: source.data?.introduction || '',
      points: Array.isArray(source.data?.points) ? source.data.points : [],
      conclusion: source.data?.conclusion || '',
      theological_notes: source.data?.theological_notes || '',
      denomination,
      ai_tags: parsed.data.ai_tags,
      style_tags: parsed.data.style_tags,
      category: parsed.data.category,
      average_rating: 0,
      ratings_count: 0,
      forks_count: 0,
      views_count: 0,
      status: 'active',
      created_date: new Date().toISOString(),
    };
    assertGatedResourceExposable({ type: 'SharedSermon', resourceData: data, denomination });
    const shared = await prisma.entity.create({
      data: { type: 'SharedSermon', userId: req.userId, data },
    });
    await recordCommunityAudit('community.sermon_share', req.userId, 'SharedSermon', shared.id, {
      sourceSermonId: source.id,
    });
    res.status(201).json(formatEntity(shared));
  } catch (err) {
    next(err);
  }
});

// Withdrawing something a member previously published is a privacy control,
// not a Premium benefit. Keep this route available to the owner even if their
// subscription or promotional window has since expired; admins/devs may also
// remove a share for support and moderation purposes.
router.delete('/sermons/:id', authenticateToken, async (req, res, next) => {
  try {
    const sermon = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!sermon || sermon.type !== 'SharedSermon') {
      return res.status(404).json({ message: 'Shared sermon not found' });
    }
    const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
    if (sermon.userId !== req.userId && !isAdmin) {
      return res.status(403).json({ message: 'You can only withdraw your own shared sermons' });
    }

    const comments = await prisma.entity.findMany({
      where: {
        type: 'Comment',
        AND: [
          { data: { path: ['content_type'], equals: 'sermon' } },
          { data: { path: ['content_id'], equals: sermon.id } },
        ],
      },
      select: { id: true },
      take: 10_000,
    });
    const interactionIds = [sermon.id, ...comments.map((comment) => comment.id)];

    await prisma.$transaction([
      prisma.communityLike.deleteMany({ where: { contentId: { in: interactionIds } } }),
      prisma.entity.deleteMany({
        where: {
          type: 'SermonRating',
          data: { path: ['sermon_id'], equals: sermon.id },
        },
      }),
      prisma.entity.deleteMany({
        where: {
          type: 'Comment',
          AND: [
            { data: { path: ['content_type'], equals: 'sermon' } },
            { data: { path: ['content_id'], equals: sermon.id } },
          ],
        },
      }),
      prisma.entity.deleteMany({
        where: {
          type: 'SharedLink',
          data: { path: ['resourceId'], equals: sermon.id },
        },
      }),
      prisma.entity.delete({ where: { id: sermon.id } }),
    ]);
    await recordCommunityAudit('community.sermon_unshare', req.userId, 'SharedSermon', sermon.id, {
      ownerId: sermon.userId,
      moderator: isAdmin && sermon.userId !== req.userId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/sermons/:id/view', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const sermon = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!sermon || sermon.type !== 'SharedSermon'
        || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(sermon.data || {}))) {
        throw Object.assign(new Error('Shared sermon not found'), { status: 404 });
      }
      return tx.entity.update({
        where: { id: sermon.id },
        data: { data: { ...sermon.data, views_count: Number(sermon.data?.views_count || 0) + 1 } },
      });
    });
    res.json({ id: updated.id, views_count: Number(updated.data?.views_count || 0) });
  } catch (err) {
    next(err);
  }
});

router.post('/sermons/:id/fork', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const sermon = await findSharedSermon(req.params.id);
    const createdSermonId = String(req.body?.created_sermon_id || '');
    const created = createdSermonId
      ? await prisma.entity.findUnique({ where: { id: createdSermonId } })
      : null;
    if (!created || created.type !== 'Sermon' || created.userId !== req.userId
      || created.data?.source_shared_sermon_id !== sermon.id) {
      return res.status(400).json({ message: 'A newly created fork owned by this account is required' });
    }
    const result = await writeUniqueInteractionCounter({
      targetId: sermon.id,
      userId: req.userId,
      contentType: 'SharedSermonFork',
      counterField: 'forks_count',
      active: true,
      validateTarget: (current) => {
        if (!current || current.type !== 'SharedSermon'
          || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(current.data || {}))) {
          throw Object.assign(new Error('Shared sermon not found'), { status: 404 });
        }
      },
    });
    res.json({
      id: sermon.id,
      forks_count: result.count,
      alreadyForked: result.alreadyActive,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sermons/:id/ratings', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await findSharedSermon(req.params.id);
    const rows = await prisma.entity.findMany({
      where: { type: 'SermonRating', data: { path: ['sermon_id'], equals: req.params.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const ratings = uniqueRatingsByUser(rows).map(formatEntity);
    res.json({ ratings, mine: ratings.find((rating) => rating.user_id === req.userId) || null });
  } catch (err) {
    next(err);
  }
});

router.post('/sermons/:id/rating', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const sermon = await findSharedSermon(req.params.id);
    const parsed = sermonRatingSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid sermon rating', issues: parsed.error.issues });
    }
    const userName = await displayNameForUser(req.userId);
    const data = {
      ...parsed.data,
      sermon_id: sermon.id,
      user_id: req.userId,
      user_name: userName,
    };
    const result = await writeRatingAtomically({
      type: 'SermonRating',
      targetField: 'sermon_id',
      targetId: sermon.id,
      userId: req.userId,
      data,
    });
    await recordCommunityAudit('community.sermon_rate', req.userId, 'SharedSermon', sermon.id, {
      rating: parsed.data.rating,
    });
    res.json({
      rating: formatEntity(result.rating),
      average_rating: result.average,
      ratings_count: result.count,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/comments', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const contentType = String(req.query.content_type || '');
    const contentId = String(req.query.content_id || '');
    if (!contentId) return res.status(400).json({ message: 'content_id is required' });
    await findCommentTarget(contentType, contentId);
    const rows = await prisma.entity.findMany({
      where: {
        type: 'Comment',
        AND: [
          { data: { path: ['content_type'], equals: contentType } },
          { data: { path: ['content_id'], equals: contentId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const likes = rows.length ? await prisma.communityLike.findMany({
      where: {
        userId: req.userId,
        contentType: 'Comment',
        contentId: { in: rows.map((row) => row.id) },
      },
    }) : [];
    const liked = new Set(likes.map((row) => row.contentId));
    res.json(rows.map((row) => ({ ...formatEntity(row), likedByMe: liked.has(row.id) })));
  } catch (err) {
    next(err);
  }
});

router.post('/comments', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const contentType = String(req.body?.content_type || '');
    const contentId = String(req.body?.content_id || '');
    const parsed = commentSchema.safeParse(req.body || {});
    if (!contentId || !parsed.success) {
      return res.status(400).json({ message: 'Invalid comment', issues: parsed.success ? undefined : parsed.error.issues });
    }
    await findCommentTarget(contentType, contentId);
    const row = await prisma.entity.create({
      data: {
        type: 'Comment',
        userId: req.userId,
        data: {
          content_type: contentType,
          content_id: contentId,
          user_id: req.userId,
          user_name: await displayNameForUser(req.userId),
          comment: parsed.data.comment,
          likes_count: 0,
          is_pinned: false,
          created_date: new Date().toISOString(),
        },
      },
    });
    res.status(201).json({ ...formatEntity(row), likedByMe: false });
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:id/like', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'Comment',
      counterField: 'likes_count',
      active: true,
      validateTarget: async (comment) => {
        if (!comment || comment.type !== 'Comment') {
          throw Object.assign(new Error('Comment not found'), { status: 404 });
        }
        await findCommentTarget(comment.data?.content_type, comment.data?.content_id);
      },
    });
    res.json({ ...formatEntity(result.target), likedByMe: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/comments/:id/like', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'Comment',
      counterField: 'likes_count',
      active: false,
      validateTarget: (comment) => {
        if (!comment || comment.type !== 'Comment') {
          throw Object.assign(new Error('Comment not found'), { status: 404 });
        }
      },
    });
    res.json({ ...formatEntity(result.target), likedByMe: false });
  } catch (err) {
    next(err);
  }
});

router.patch('/comments/:id/pin', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const comment = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!comment || comment.type !== 'Comment') return res.status(404).json({ message: 'Comment not found' });
    const target = await findCommentTarget(comment.data?.content_type, comment.data?.content_id);
    if (target.userId !== req.userId) {
      return res.status(403).json({ message: 'Only the content owner can pin comments' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, comment.id);
      const current = await tx.entity.findUnique({ where: { id: comment.id } });
      if (!current || current.type !== 'Comment') {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }
      return tx.entity.update({
        where: { id: current.id },
        data: { data: { ...current.data, is_pinned: !current.data?.is_pinned } },
      });
    });
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

router.delete('/comments/:id', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const comment = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!comment || comment.type !== 'Comment') return res.status(404).json({ message: 'Comment not found' });
    const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
    if (comment.userId !== req.userId && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }
    await prisma.$transaction([
      prisma.communityLike.deleteMany({ where: { contentId: comment.id, contentType: 'Comment' } }),
      prisma.entity.delete({ where: { id: comment.id } }),
    ]);
    if (isAdmin && comment.userId !== req.userId) {
      await recordCommunityAudit('community.comment_remove', req.userId, 'Comment', comment.id, {
        ownerId: comment.userId,
      });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const [rows, memberships] = await Promise.all([
      prisma.entity.findMany({
        where: { type: 'StudyGroup' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, type: true, userId: true, data: true, createdAt: true, updatedAt: true },
      }),
      prisma.communityGroupMember.findMany({ where: { userId: req.userId } }),
    ]);
    const membershipByGroup = new Map(memberships.map((row) => [row.groupId, row]));
    const visible = rows.filter((row) => {
      if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {}))) return false;
      const isMember = membershipByGroup.has(row.id) || row.userId === req.userId;
      return row.data?.is_private !== true || isMember;
    });
    const allMembers = visible.length
      ? await prisma.communityGroupMember.findMany({ where: { groupId: { in: visible.map((row) => row.id) } } })
      : [];
    const memberCounts = new Map();
    for (const membership of allMembers) {
      memberCounts.set(membership.groupId, Number(memberCounts.get(membership.groupId) || 0) + 1);
    }

    res.json(visible.map((row) => {
      const membership = membershipByGroup.get(row.id);
      const creatorIsViewer = row.userId === req.userId;
      return {
        ...formatEntity(row),
        member_count: memberCounts.get(row.id) ?? Number(row.data?.member_count || (creatorIsViewer ? 1 : 0)),
        is_member: !!membership || creatorIsViewer,
        membership_role: membership?.role || (creatorIsViewer ? 'leader' : null),
      };
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = studyGroupSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid study group', issues: parsed.error.issues });
    }
    const userName = await displayNameForUser(req.userId);
    const group = await prisma.$transaction(async (tx) => {
      const row = await tx.entity.create({
        data: {
          type: 'StudyGroup',
          userId: req.userId,
          data: {
            ...parsed.data,
            creator_id: req.userId,
            member_count: 1,
            status: 'active',
            created_date: new Date().toISOString(),
          },
        },
      });
      await tx.communityGroupMember.create({
        data: { groupId: row.id, userId: req.userId, role: 'leader', userName, joinedAt: new Date() },
      });
      return row;
    });
    await recordCommunityAudit('community.group_create', req.userId, 'StudyGroup', group.id);
    res.status(201).json({ ...formatEntity(group), is_member: true, membership_role: 'leader' });
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups/:id', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { group, membership } = await requireGroupMember(req.params.id, req.userId);
    const members = await prisma.communityGroupMember.findMany({
      where: { groupId: group.id },
      orderBy: { joinedAt: 'asc' },
    });
    res.json({
      group: { ...formatEntity(group), member_count: members.length, is_member: true, membership_role: membership.role },
      membership: formatGroupMembership(membership),
      members: members.map(formatGroupMembership),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/join', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const group = await findStudyGroup(req.params.id);
    if (group.data?.is_private === true) {
      return res.status(403).json({ message: 'This private study group does not accept open joins' });
    }
    const membership = await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.userId } },
      create: {
        groupId: group.id,
        userId: req.userId,
        role: group.userId === req.userId ? 'leader' : 'member',
        userName: await displayNameForUser(req.userId),
        joinedAt: new Date(),
      },
      update: {},
    });
    const { memberCount } = await updateGroupMemberCount(group);
    await recordCommunityAudit('community.group_join', req.userId, 'StudyGroup', group.id);
    res.json({ membership: formatGroupMembership(membership), member_count: memberCount });
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/members', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { group } = await requireGroupLeader(req.params.id, req.userId);
    const parsed = groupMemberAddSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group member', issues: parsed.error.issues });
    }
    const target = await prisma.user.findUnique({ where: { id: parsed.data.user_id } });
    if (!target || target.deletedAt || target.is_banned) {
      return res.status(404).json({ message: 'Community member not found' });
    }
    if (!entitlementsFor(target).includes(ENTITLEMENTS.COMMUNITY)) {
      return res.status(409).json({ message: 'That account does not currently have Community access' });
    }
    const membership = await prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: target.id } },
      create: {
        groupId: group.id,
        userId: target.id,
        role: group.userId === target.id ? 'leader' : 'member',
        userName: target.full_name || target.name || target.email || 'Member',
        joinedAt: new Date(),
      },
      update: {},
    });
    const { memberCount } = await updateGroupMemberCount(group);
    await recordCommunityAudit('community.group_member_add', req.userId, 'CommunityGroupMember', membership.id, {
      groupId: group.id,
      addedUserId: target.id,
    });
    res.json({ membership: formatGroupMembership(membership), member_count: memberCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/study-groups/:id/membership', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { group, membership } = await requireGroupMember(req.params.id, req.userId);
    const [memberCount, leaderCount] = await Promise.all([
      prisma.communityGroupMember.count({ where: { groupId: group.id } }),
      prisma.communityGroupMember.count({ where: { groupId: group.id, role: 'leader' } }),
    ]);
    if (membership.role === 'leader' && leaderCount <= 1 && memberCount > 1) {
      return res.status(409).json({ message: 'Promote another member before the last leader leaves' });
    }

    if (memberCount <= 1) {
      await prisma.$transaction(async (tx) => {
        await tx.communityGroupMember.deleteMany({ where: { groupId: group.id } });
        await tx.entity.deleteMany({ where: { data: { path: ['group_id'], equals: group.id } } });
        await tx.entity.delete({ where: { id: group.id } });
      });
      await recordCommunityAudit('community.group_delete_empty', req.userId, 'StudyGroup', group.id);
      return res.json({ left: true, group_deleted: true, member_count: 0 });
    }

    await prisma.communityGroupMember.delete({ where: { id: membership.id } });
    const { memberCount: nextCount } = await updateGroupMemberCount(group);
    await recordCommunityAudit('community.group_leave', req.userId, 'StudyGroup', group.id);
    res.json({ left: true, group_deleted: false, member_count: nextCount });
  } catch (err) {
    next(err);
  }
});

router.patch('/study-groups/:id/members/:memberId/promote', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupLeader(req.params.id, req.userId);
    const member = await prisma.communityGroupMember.findUnique({ where: { id: req.params.memberId } });
    if (!member || member.groupId !== req.params.id) {
      return res.status(404).json({ message: 'Group member not found' });
    }
    const updated = await prisma.communityGroupMember.update({
      where: { id: member.id },
      data: { role: 'leader' },
    });
    await recordCommunityAudit('community.group_promote', req.userId, 'CommunityGroupMember', member.id, {
      groupId: req.params.id,
      promotedUserId: member.userId,
    });
    res.json(formatGroupMembership(updated));
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups/:id/messages', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupMember(req.params.id, req.userId);
    const rows = await prisma.entity.findMany({
      where: {
        type: 'GroupMessage',
        data: { path: ['group_id'], equals: req.params.id },
      },
      // Fetch the newest page, then restore chronological display order. An
      // ascending query with `take: 100` permanently hid message 101 onward.
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json([...rows].reverse().map(formatEntity));
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/messages', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { membership } = await requireGroupMember(req.params.id, req.userId);
    const parsed = groupMessageSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group message', issues: parsed.error.issues });
    }
    if (parsed.data.message_type === 'announcement' && membership.role !== 'leader') {
      return res.status(403).json({ message: 'Only group leaders can post announcements' });
    }
    const row = await prisma.entity.create({
      data: {
        type: 'GroupMessage',
        userId: req.userId,
        data: {
          group_id: req.params.id,
          user_id: req.userId,
          user_name: membership.userName,
          ...parsed.data,
          created_date: new Date().toISOString(),
        },
      },
    });
    res.status(201).json(formatEntity(row));
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups/:id/meetings', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupMember(req.params.id, req.userId);
    const rows = await prisma.entity.findMany({
      where: { type: 'GroupMeeting', data: { path: ['group_id'], equals: req.params.id } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const attendance = rows.length ? await prisma.entity.findMany({
      where: {
        type: 'MeetingAttendance',
        userId: req.userId,
        OR: [
          { data: { path: ['group_id'], equals: req.params.id } },
          ...rows.map((meeting) => ({ data: { path: ['meeting_id'], equals: meeting.id } })),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }) : [];
    // Compatibility for RSVPs written before group_id was included. The
    // referenced meeting has already been scoped to this group above, so the
    // backfill cannot move an attendance row across groups.
    await Promise.all(attendance
      .filter((row) => !row.data?.group_id && rows.some((meeting) => meeting.id === row.data?.meeting_id))
      .map((row) => prisma.entity.update({
        where: { id: row.id },
        data: { data: { ...row.data, group_id: req.params.id } },
      })));
    // Newest wins for any duplicate rows left by the former non-serialized
    // implementation. The next write also removes those legacy duplicates.
    const rsvpByMeeting = new Map();
    for (const row of attendance) {
      if (!rsvpByMeeting.has(row.data?.meeting_id)) {
        rsvpByMeeting.set(row.data?.meeting_id, row.data?.status);
      }
    }
    res.json(rows.map((row) => ({ ...formatEntity(row), my_rsvp: rsvpByMeeting.get(row.id) || null })));
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/meetings', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupLeader(req.params.id, req.userId);
    const parsed = groupMeetingSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group meeting', issues: parsed.error.issues });
    }
    const discussionLeader = await prisma.communityGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: parsed.data.discussion_leader_id,
        },
      },
    });
    if (!discussionLeader) {
      return res.status(400).json({ message: 'Discussion leader must be a current group member' });
    }
    const row = await prisma.entity.create({
      data: {
        type: 'GroupMeeting',
        userId: req.userId,
        data: {
          ...parsed.data,
          scheduled_date: new Date(parsed.data.scheduled_date).toISOString(),
          group_id: req.params.id,
          status: 'scheduled',
          created_date: new Date().toISOString(),
        },
      },
    });
    res.status(201).json(formatEntity(row));
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/meetings/:meetingId/rsvp', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { membership } = await requireGroupMember(req.params.id, req.userId);
    const parsed = rsvpSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid RSVP', issues: parsed.error.issues });
    }
    const meeting = await prisma.entity.findUnique({ where: { id: req.params.meetingId } });
    if (!meeting || meeting.type !== 'GroupMeeting' || meeting.data?.group_id !== req.params.id) {
      return res.status(404).json({ message: 'Group meeting not found' });
    }
    const data = {
      group_id: req.params.id,
      meeting_id: meeting.id,
      user_id: req.userId,
      user_name: membership.userName,
      status: parsed.data.status,
    };
    const attendance = await prisma.$transaction(async (tx) => {
      await lockMeetingRsvp(tx, meeting.id, req.userId);
      const currentMeeting = await tx.entity.findUnique({ where: { id: meeting.id } });
      if (!currentMeeting || currentMeeting.type !== 'GroupMeeting'
        || currentMeeting.data?.group_id !== req.params.id) {
        throw Object.assign(new Error('Group meeting not found'), { status: 404 });
      }
      const existingRows = await tx.entity.findMany({
        where: {
          type: 'MeetingAttendance',
          userId: req.userId,
          data: { path: ['meeting_id'], equals: meeting.id },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      const existing = existingRows[0] || null;
      const current = existing
        ? await tx.entity.update({ where: { id: existing.id }, data: { data: { ...existing.data, ...data } } })
        : await tx.entity.create({ data: { type: 'MeetingAttendance', userId: req.userId, data } });

      // Heal duplicates created before RSVP writes were serialized.
      const duplicateIds = existingRows.slice(1).map((row) => row.id);
      if (duplicateIds.length) {
        await tx.entity.deleteMany({ where: { id: { in: duplicateIds } } });
      }
      return current;
    });
    res.json(formatEntity(attendance));
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups/:id/progress', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const { group } = await requireGroupMember(req.params.id, req.userId);
    const progress = await prisma.entity.findFirst({
      where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
    });
    if (!progress) return res.json({ progress: null, plan: null });

    let plan = null;
    const snapshot = progress.data?.plan_snapshot;
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      assertGatedResourceExposable({
        type: 'ReadingPlan',
        resourceData: snapshot,
        denomination: progress.data?.plan_denomination || snapshot.denomination || '',
      });
      plan = snapshot;
    } else if (progress.data?.plan_id) {
      // Legacy progress rows referenced a live ReadingPlan. Only expose it when
      // the plan is public or belongs to the group owner / recorded assigner;
      // otherwise a forged legacy plan_id could leak another user's private
      // plan to every group member.
      const candidate = await prisma.entity.findUnique({ where: { id: progress.data.plan_id } });
      const allowedOwner = candidate?.userId === group.userId
        || candidate?.userId === progress.data?.assigned_by;
      if (candidate?.type === 'ReadingPlan' && (candidate.data?.is_public === true || allowedOwner)) {
        const denomination = candidate.data?.denomination
          || (await prisma.user.findUnique({ where: { id: candidate.userId }, select: { profile: true } }))?.profile?.denomination
          || '';
        assertGatedResourceExposable({ type: 'ReadingPlan', resourceData: candidate.data || {}, denomination });
        plan = formatEntity(candidate);
      }
    }

    // plan_snapshot is an internal, intentionally shared copy. Return it once
    // as `plan`, not duplicated inside the progress object.
    const formattedProgress = formatEntity(progress);
    delete formattedProgress.plan_snapshot;
    delete formattedProgress.plan_denomination;
    res.json({
      progress: formattedProgress,
      plan,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/study-groups/:id/progress', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupLeader(req.params.id, req.userId);
    const parsed = groupPlanSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reading plan assignment', issues: parsed.error.issues });
    }

    const plan = await prisma.entity.findUnique({ where: { id: parsed.data.plan_id } });
    if (!plan || plan.type !== 'ReadingPlan'
      || (plan.userId !== req.userId && plan.data?.is_public !== true)) {
      return res.status(404).json({ message: 'Reading plan not found' });
    }

    const denomination = plan.data?.denomination
      || (await prisma.user.findUnique({ where: { id: plan.userId }, select: { profile: true } }))?.profile?.denomination
      || '';
    assertGatedResourceExposable({ type: 'ReadingPlan', resourceData: plan.data || {}, denomination });

    const dailyReadings = Array.isArray(plan.data?.daily_readings) ? plan.data.daily_readings : [];
    const requestedDays = Number(plan.data?.duration_days || plan.data?.total_days || dailyReadings.length || 1);
    const totalDays = Math.min(366, Math.max(1, Number.isFinite(requestedDays) ? Math.trunc(requestedDays) : 1));
    const planSnapshot = {
      ...(plan.data || {}),
      id: plan.id,
      created_date: plan.createdAt,
      updated_date: plan.updatedAt,
    };
    const nextData = {
      group_id: req.params.id,
      plan_id: plan.id,
      assigned_by: req.userId,
      assigned_date: new Date().toISOString(),
      plan_denomination: denomination,
      plan_snapshot: planSnapshot,
      total_days: totalDays,
      completed_days: [],
      current_day: 1,
      completion_percentage: 0,
    };
    const existing = await prisma.entity.findFirst({
      where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
    });
    const progress = existing
      ? await prisma.entity.update({ where: { id: existing.id }, data: { data: nextData } })
      : await prisma.entity.create({ data: { type: 'GroupProgress', userId: req.userId, data: nextData } });

    await recordCommunityAudit('community.group_plan_assign', req.userId, 'GroupProgress', progress.id, {
      groupId: req.params.id,
      planId: plan.id,
    });
    const formattedProgress = formatEntity(progress);
    delete formattedProgress.plan_snapshot;
    delete formattedProgress.plan_denomination;
    res.json({ progress: formattedProgress, plan: planSnapshot });
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/progress/days/:day/complete', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await requireGroupLeader(req.params.id, req.userId);
    const day = Number(req.params.day);
    if (!Number.isInteger(day) || day < 1 || day > 366) {
      return res.status(400).json({ message: 'Invalid reading-plan day' });
    }
    const progress = await prisma.entity.findFirst({
      where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
    });
    if (!progress) return res.status(404).json({ message: 'No reading plan is assigned to this group' });
    const totalDays = Math.max(1, Number(progress.data?.total_days || 1));
    const completedDays = [...new Set([...(progress.data?.completed_days || []), day])]
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= totalDays)
      .sort((a, b) => a - b);
    const updated = await prisma.entity.update({
      where: { id: progress.id },
      data: {
        data: {
          ...progress.data,
          completed_days: completedDays,
          current_day: Math.min(totalDays, Math.max(Number(progress.data?.current_day || 1), day + 1)),
          completion_percentage: Math.round((completedDays.length / totalDays) * 100),
        },
      },
    });
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

router.get('/reading-plans', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'ReadingPlan', data: { path: ['is_public'], equals: true } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    // Fail closed: omit any public plan whose CURRENT references no longer verify.
    const servable = await serveExposableRows('ReadingPlan', rows);
    const owners = new Map();
    await Promise.all(servable.map(async (row) => {
      if (!owners.has(row.userId)) owners.set(row.userId, await displayNameForUser(row.userId));
    }));
    const formatted = servable.map((row) => ({
      ...formatEntity(row),
      creator_id: row.userId,
      creator_name: owners.get(row.userId) || 'Member',
    }));
    const sort = String(req.query.sort || 'newest');
    if (sort === 'rating') {
      formatted.sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0));
    } else if (sort === 'popular') {
      formatted.sort((a, b) => Number(b.followers_count || 0) - Number(a.followers_count || 0));
    }
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

router.post('/reading-plans/:id/fork', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const plan = await findPublicReadingPlan(req.params.id);
    const createdPlanId = String(req.body?.created_plan_id || '');
    const created = createdPlanId ? await prisma.entity.findUnique({ where: { id: createdPlanId } }) : null;
    if (!created || created.type !== 'ReadingPlan' || created.userId !== req.userId
      || created.data?.source_shared_plan_id !== plan.id) {
      return res.status(400).json({ message: 'A newly created fork owned by this account is required' });
    }
    const result = await writeUniqueInteractionCounter({
      targetId: plan.id,
      userId: req.userId,
      contentType: 'ReadingPlanFork',
      counterField: 'followers_count',
      active: true,
      validateTarget: (current) => {
        if (!current || current.type !== 'ReadingPlan' || current.data?.is_public !== true
          || HIDDEN_COMMUNITY_STATUSES.has(communityStatus(current.data || {}))) {
          throw Object.assign(new Error('Public reading plan not found'), { status: 404 });
        }
      },
    });
    res.json({
      id: plan.id,
      followers_count: result.count,
      alreadyForked: result.alreadyActive,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/reading-plans/:id/ratings', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    await findPublicReadingPlan(req.params.id);
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedPlanRating', data: { path: ['plan_id'], equals: req.params.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const ratings = uniqueRatingsByUser(rows).map(formatEntity);
    res.json({ ratings, mine: ratings.find((rating) => rating.user_id === req.userId) || null });
  } catch (err) {
    next(err);
  }
});

router.post('/reading-plans/:id/rating', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const plan = await findPublicReadingPlan(req.params.id);
    const parsed = planRatingSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid plan rating', issues: parsed.error.issues });
    }
    const data = {
      ...parsed.data,
      plan_id: plan.id,
      user_id: req.userId,
      user_name: await displayNameForUser(req.userId),
    };
    const result = await writeRatingAtomically({
      type: 'SharedPlanRating',
      targetField: 'plan_id',
      targetId: plan.id,
      userId: req.userId,
      data,
    });
    res.json({
      rating: formatEntity(result.rating),
      average_rating: result.average,
      ratings_count: result.count,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/shared-content/:id/like', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'SharedContent',
      counterField: 'likes_count',
      active: true,
      validateTarget: (existing) => {
        if (!existing || existing.type !== 'SharedContent') {
          throw Object.assign(new Error('Shared content not found'), { status: 404 });
        }
        if (!isPublicCommunityData(existing.data || {})) {
          throw Object.assign(new Error('Cannot like private content'), { status: 403 });
        }
      },
    });
    res.json(await interactionResult(result.target, {
      liked: true,
      alreadyLiked: result.alreadyActive,
    }));
  } catch (err) {
    next(err);
  }
});

router.post('/shared-content/:id/report', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid report', issues: parsed.error.issues });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const existing = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.type !== 'SharedContent') {
        throw Object.assign(new Error('Shared content not found'), { status: 404 });
      }
      const data = existing.data || {};
      if (!isPublicCommunityData(data)) {
        throw Object.assign(new Error('Cannot report private, removed, or non-public content'), { status: 403 });
      }

      const reportedBy = Array.isArray(data.reported_by) ? data.reported_by : [];
      if (reportedBy.includes(req.userId) || data.last_report?.reporterId === req.userId) {
        return { duplicate: true, reportedCount: reportedCount(data) };
      }

      const nextCount = reportedCount(data) + 1;
      const report = {
        ...parsed.data,
        reporterId: req.userId,
        reportedAt: new Date().toISOString(),
      };
      const updated = await tx.entity.update({
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
      return { duplicate: false, reportedCount: nextCount, updated };
    });

    if (outcome.duplicate) {
      return res.status(409).json({
        message: 'You have already reported this content',
        reported_count: outcome.reportedCount,
      });
    }

    await recordCommunityAudit('community.report', req.userId, 'SharedContent', req.params.id, {
      category: parsed.data.category,
      reportedCount: outcome.reportedCount,
    });
    res.json(await interactionResult(outcome.updated));
  } catch (err) {
    next(err);
  }
});

router.post('/shared-content/:id/save', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const result = await writeUniqueInteractionCounter({
      targetId: req.params.id,
      userId: req.userId,
      contentType: 'SharedContent',
      counterField: 'saves_count',
      active: true,
      modelName: 'savedContent',
      validateTarget: (existing) => {
        if (!existing || existing.type !== 'SharedContent') {
          throw Object.assign(new Error('Shared content not found'), { status: 404 });
        }
        if (!isPublicCommunityData(existing.data || {})) {
          throw Object.assign(new Error('Cannot save private content'), { status: 403 });
        }
      },
    });
    res.json(await interactionResult(result.target, {
      saved: true,
      alreadySaved: result.alreadyActive,
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/moderation/queue', authenticateToken, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: { in: MODERATABLE_TYPES } },
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
    if (!MODERATABLE_TYPES.includes(req.params.type)) {
      return res.status(400).json({ message: 'Unsupported moderation type' });
    }
    const parsed = moderationSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid moderation update', issues: parsed.error.issues });
    }

    const patch = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const existing = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.type !== req.params.type) {
        throw Object.assign(new Error('Community content not found'), { status: 404 });
      }

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
          || (await tx.user.findUnique({ where: { id: existing.userId }, select: { profile: true } }))?.profile?.denomination
          || '';
        assertGatedResourceExposable({ type: existing.type, resourceData: data, denomination: denom });
      }

      const updated = await tx.entity.update({
        where: { id: existing.id },
        data: { data },
      });
      return { existing, updated };
    });

    await recordCommunityAudit('community.moderate', req.userId, result.existing.type, result.existing.id, patch);
    res.json({ type: result.existing.type, userId: result.existing.userId, ...formatEntity(result.updated) });
  } catch (err) {
    next(err);
  }
});

export default router;

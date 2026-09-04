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
import { withoutPrivateCommunityMetadata } from '../lib/communityPrivacy.js';
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

function formatPublicEntity(e) {
  const publicData = withoutPrivateCommunityMetadata(e.data);
  if (Object.prototype.hasOwnProperty.call(publicData, 'user_name')) {
    publicData.user_name = safeCommunityDisplayName(publicData.user_name);
  }
  return {
    id: e.id,
    ...publicData,
    created_date: e.createdAt,
    updated_date: e.updatedAt,
  };
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

async function deleteOwnRatingAtomically({ ratingId, userId }) {
  const initial = await prisma.entity.findUnique({ where: { id: ratingId } });
  const targetField = initial?.type === 'SermonRating'
    ? 'sermon_id'
    : initial?.type === 'SharedPlanRating'
      ? 'plan_id'
      : null;
  const expectedTargetType = initial?.type === 'SermonRating'
    ? 'SharedSermon'
    : initial?.type === 'SharedPlanRating'
      ? 'ReadingPlan'
      : null;
  if (!targetField) {
    throw Object.assign(new Error('Rating not found'), { status: 404 });
  }
  if (initial.userId !== userId) {
    throw Object.assign(new Error('You can only delete your own rating'), { status: 403 });
  }
  const targetId = initial.data?.[targetField];
  if (!targetId) {
    throw Object.assign(new Error('Rating target not found'), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    await lockCommunityEntity(tx, targetId);
    const current = await tx.entity.findUnique({ where: { id: ratingId } });
    if (!current || current.type !== initial.type) {
      throw Object.assign(new Error('Rating not found'), { status: 404 });
    }
    if (current.userId !== userId || current.data?.[targetField] !== targetId) {
      throw Object.assign(new Error('You can only delete your own rating'), { status: 403 });
    }

    // Remove every legacy duplicate owned by this reviewer so none can remain
    // public or continue contributing to the aggregate.
    const ownedRows = await tx.entity.findMany({
      where: {
        type: current.type,
        userId,
        data: { path: [targetField], equals: targetId },
      },
      take: 10_000,
    });
    const ownedIds = ownedRows.map((row) => row.id);
    if (ownedIds.length) await tx.entity.deleteMany({ where: { id: { in: ownedIds } } });

    // A legacy generic rating could point its JSON id at an arbitrary entity.
    // Retraction must still remove that owner's public review, but it must not
    // turn the forged reference into permission to mutate a foreign row.
    const target = await tx.entity.findUnique({ where: { id: targetId } });
    if (!target || target.type !== expectedTargetType) {
      return {
        deleted: ownedIds.length,
        average: null,
        count: null,
        targetId,
        targetUpdated: false,
      };
    }

    const remainingRows = await tx.entity.findMany({
      where: { type: current.type, data: { path: [targetField], equals: targetId } },
      orderBy: { updatedAt: 'desc' },
      take: 10_000,
    });
    const ratings = uniqueRatingsByUser(remainingRows);
    const average = ratings.length
      ? ratings.reduce((sum, row) => sum + Number(row.data?.rating || 0), 0) / ratings.length
      : 0;
    await tx.entity.update({
      where: { id: target.id },
      data: { data: { ...target.data, average_rating: average, ratings_count: ratings.length } },
    });
    return {
      deleted: ownedIds.length,
      average,
      count: ratings.length,
      targetId,
      targetUpdated: true,
    };
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

function isForumPubliclyVisible(data) {
  return data?.visibility !== 'private'
    && !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(data));
}

function safeCommunityDisplayName(...values) {
  for (const value of values) {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (candidate && !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(candidate)) return candidate;
  }
  return 'Member';
}

function safeProfileText(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized.slice(0, 500);
  }
  return '';
}

function safeProfileList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((entry) => entry.slice(0, 200));
}

function safePublishedText(value, maxLength = 20_000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizePublishedSermonPoints(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((point) => point && typeof point === 'object' && !Array.isArray(point))
    .slice(0, 20)
    .map((point) => ({
      title: safePublishedText(point.title, 500),
      exegesis: safePublishedText(point.exegesis ?? point.content),
      illustration: safePublishedText(point.illustration),
      application: safePublishedText(point.application),
      supporting_scriptures: (Array.isArray(point.supporting_scriptures) ? point.supporting_scriptures : [])
        .map((entry) => {
          if (typeof entry === 'string') return safePublishedText(entry, 300);
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
          return safePublishedText(entry.reference ?? entry.ref ?? entry.citation, 300);
        })
        .filter(Boolean)
        .slice(0, 30),
    }));
}

const DIRECTORY_OPT_IN_FILTER = Object.freeze({
  path: ['profile_privacy', 'community_directory_opt_in'],
  equals: true,
});

function publicMember(user) {
  const profile = user?.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)
    ? user.profile
    : {};
  const privacy = profile.profile_privacy
    && typeof profile.profile_privacy === 'object'
    && !Array.isArray(profile.profile_privacy)
    ? profile.profile_privacy
    : {};
  // Privacy is closed by default. Legacy profiles predate the directory and
  // must not become enumerable merely because a new surface was deployed.
  const visible = (key) => privacy[key] === true;

  return {
    id: user.id,
    name: safeCommunityDisplayName(user.full_name, user.name),
    avatar: typeof user.avatar === 'string' ? user.avatar : null,
    denomination: visible('show_denomination')
      ? safeProfileText(profile.denomination, profile.denominational_background)
      : '',
    ministryFocus: visible('show_ministry_focus')
      ? safeProfileList(profile.ministry_focus)
      : [],
    preachingStyle: visible('show_preaching_style')
      ? safeProfileText(profile.preferred_preaching_style, profile.preaching_style)
      : '',
    favoritePassages: visible('show_favorite_passages')
      ? safeProfileList(profile.favorite_scripture_passages)
      : [],
    email: visible('show_email') && typeof user.email === 'string' ? user.email : undefined,
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

const lifecyclePageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
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

const groupMeetingUpdateSchema = groupMeetingSchema
  .omit({ discussion_leader_name: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one meeting field to update',
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
    user_name: safeCommunityDisplayName(row.userName),
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
  return safeCommunityDisplayName(user?.full_name, user?.name);
}

async function displayNamesForRows(rows) {
  const ids = [...new Set((rows || []).map((row) => row.userId).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, full_name: true, name: true },
  });
  return new Map(users.map((user) => [
    user.id,
    safeCommunityDisplayName(user.full_name, user.name),
  ]));
}

async function formatRatingsForCommunity(rows) {
  const ratings = uniqueRatingsByUser(rows);
  const currentNames = await displayNamesForRows(ratings);
  return ratings.map((row) => ({
    ...formatPublicEntity(row),
    user_id: row.userId,
    // Never trust a legacy denormalized display name. Older clients used an
    // email fallback; prefer the current account name and neutralize anything
    // email-shaped when the account no longer exists.
    user_name: currentNames.get(row.userId)
      || safeCommunityDisplayName(row.data?.user_name),
  }));
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

async function requireGroupMember(groupId, userId, client = prisma) {
  const group = await findStudyGroup(groupId, client);
  const membership = await membershipFor(group, userId, { client });
  if (!membership) {
    throw Object.assign(new Error('Join this study group to access its content'), { status: 403 });
  }
  return { group, membership };
}

async function requireGroupLeader(groupId, userId, client = prisma) {
  const result = await requireGroupMember(groupId, userId, client);
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
    return { ...formatPublicEntity(row), ...extra };
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
    if (!isForumPubliclyVisible(data)) {
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
      ...formatPublicEntity(row),
      user_id: row.userId,
      user_name: authorNames.get(row.userId) || 'Member',
    })));
  } catch (err) {
    next(err);
  }
});

// Publication ownership outlives a subscription. Keep an auth-only inventory
// and withdrawal path so an author can always make previously public material
// private without regaining Community access.
router.get('/shared-content/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid shared-content page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: {
        type: 'SharedContent',
        userId: req.userId,
        data: { path: ['visibility'], equals: 'public' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({
      shared_content: rows.map(formatEntity),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/shared-content/:id', authenticateToken, async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const current = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!current || current.type !== 'SharedContent') {
        throw Object.assign(new Error('Shared content not found'), { status: 404 });
      }
      if (current.userId !== req.userId) {
        throw Object.assign(new Error('You can only withdraw your own shared content'), { status: 403 });
      }
      return tx.entity.update({
        where: { id: current.id },
        data: { data: { ...(current.data || {}), visibility: 'private' } },
      });
    });
    await recordCommunityAudit('community.shared_content_withdraw', req.userId, 'SharedContent', updated.id);
    res.json(formatEntity(updated));
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

    const resourceId = typeof data.resourceId === 'string' ? data.resourceId : '';
    if (!resourceId) return res.status(404).json({ message: 'Shared resource not found' });
    const resource = await prisma.entity.findUnique({
      where: { id: resourceId },
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
    if (HIDDEN_COMMUNITY_STATUSES.has(communityStatus(resource.data || {}))) {
      return res.status(404).json({ message: 'Shared resource not found' });
    }
    if (resource.type === 'CommunityPost' && !isForumPubliclyVisible(resource.data || {})) {
      return res.status(404).json({ message: 'Shared resource not found' });
    }
    if (resource.type === 'CommunityReply') {
      if (!isForumPubliclyVisible(resource.data || {})) {
        return res.status(404).json({ message: 'Shared resource not found' });
      }
      const parentId = typeof resource.data?.post_id === 'string' ? resource.data.post_id : '';
      if (!parentId) return res.status(404).json({ message: 'Shared resource not found' });
      const parent = await prisma.entity.findUnique({ where: { id: parentId } });
      if (!parent || parent.type !== 'CommunityPost' || !isForumPubliclyVisible(parent.data || {})) {
        return res.status(404).json({ message: 'Shared resource not found' });
      }
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

    res.json({ link: data, resource: formatPublicEntity(resource) });
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
      // Directory participation is explicit. Existing/legacy accounts are
      // private until they opt in from Profile Settings.
      profile: DIRECTORY_OPT_IN_FILTER,
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
      where: {
        id: req.params.id,
        deletedAt: null,
        is_banned: false,
        profile: DIRECTORY_OPT_IN_FILTER,
      },
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
      where: {
        id: req.params.id,
        deletedAt: null,
        is_banned: false,
        profile: DIRECTORY_OPT_IN_FILTER,
      },
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

// Retraction inventory is intentionally auth-only rather than Premium-only.
// A lapsed member must still be able to discover and remove material they
// previously published, including replies whose parent is now hidden.
router.get('/posts/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid community content page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: { type: { in: ['CommunityPost', 'CommunityReply'] }, userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    const replies = rows.filter((row) => row.type === 'CommunityReply');
    const parentIds = [...new Set(replies.map((row) => row.data?.post_id).filter(Boolean))];
    const parents = parentIds.length
      ? await prisma.entity.findMany({
        where: { id: { in: parentIds }, type: 'CommunityPost' },
        select: { id: true, data: true },
      })
      : [];
    const parentTitles = new Map(parents.map((row) => [row.id, row.data?.title || 'Discussion']));

    res.json({
      posts: rows
        .filter((row) => row.type === 'CommunityPost')
        .map((row) => formatPublicEntity(row)),
      replies: replies.map((row) => ({
        ...formatPublicEntity(row),
        parent_title: parentTitles.get(row.data?.post_id) || 'Unavailable discussion',
      })),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
  } catch (err) {
    next(err);
  }
});

// Ratings are public contributions, so their owner must be able to discover
// and retract them after Community access expires. This inventory is owner-
// scoped and deliberately does not expose anybody else's review history.
router.get('/ratings/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid rating page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: { type: { in: ['SermonRating', 'SharedPlanRating'] }, userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    const targetIds = [...new Set(rows
      .map((row) => row.type === 'SermonRating' ? row.data?.sermon_id : row.data?.plan_id)
      .filter(Boolean))];
    const targets = targetIds.length
      ? await prisma.entity.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, type: true, data: true },
      })
      : [];
    const targetsById = new Map(targets.map((row) => [row.id, row]));

    res.json({
      ratings: rows.map((row) => {
        const targetId = row.type === 'SermonRating' ? row.data?.sermon_id : row.data?.plan_id;
        const target = targetsById.get(targetId);
        return {
          ...formatEntity(row),
          target_id: targetId || null,
          target_type: row.type === 'SermonRating' ? 'sermon' : 'reading_plan',
          target_title: target?.data?.title || target?.data?.name || 'Unavailable community content',
        };
      }),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/ratings/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await deleteOwnRatingAtomically({ ratingId: req.params.id, userId: req.userId });
    await recordCommunityAudit('community.rating_retract', req.userId, 'CommunityRating', req.params.id, {
      targetId: result.targetId,
      duplicateRowsRemoved: result.deleted,
      targetUpdated: result.targetUpdated,
    });
    res.json({
      deleted: true,
      ...(result.targetUpdated ? {
        average_rating: result.average,
        ratings_count: result.count,
      } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// Legacy series shares still use the generic Entity table. Give their owners a
// dedicated lifecycle surface so withdrawing a publication is never coupled
// to an active subscription.
router.get('/shared-series/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid shared-series page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedSeries', userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({
      series: rows.map(formatEntity),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/shared-series/:id', authenticateToken, async (req, res, next) => {
  try {
    const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
    const removed = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const current = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!current || current.type !== 'SharedSeries') {
        throw Object.assign(new Error('Shared series not found'), { status: 404 });
      }
      if (current.userId !== req.userId && !isAdmin) {
        throw Object.assign(new Error('You can only withdraw your own shared series'), { status: 403 });
      }
      await tx.entity.deleteMany({
        where: { type: 'SharedLink', data: { path: ['resourceId'], equals: current.id } },
      });
      await tx.entity.delete({ where: { id: current.id } });
      return current;
    });
    await recordCommunityAudit('community.series_unshare', req.userId, 'SharedSeries', removed.id, {
      ownerId: removed.userId,
      moderator: isAdmin && removed.userId !== req.userId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/posts', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const rows = await prisma.entity.findMany({
      where: { type: 'CommunityPost' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    const visible = rows.filter((row) => isForumPubliclyVisible(row.data || {}));
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
      ...formatPublicEntity(row),
      user_id: row.userId,
      user_name: authorNames.get(row.userId) || 'Member',
      likedByMe: liked.has(row.id),
    })));
  } catch (err) {
    next(err);
  }
});

// Resolve a visible thread independently of the 50-row feed window so copied
// and bookmarked forum URLs remain usable as the community grows.
router.get('/posts/:id', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const post = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!post || post.type !== 'CommunityPost' || !isForumPubliclyVisible(post.data || {})) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const like = await prisma.communityLike.findUnique({
      where: {
        userId_contentId_contentType: {
          userId: req.userId,
          contentId: post.id,
          contentType: 'CommunityPost',
        },
      },
    });
    const authorNames = await displayNamesForRows([post]);
    res.json({
      ...formatPublicEntity(post),
      user_id: post.userId,
      user_name: authorNames.get(post.userId) || 'Member',
      likedByMe: Boolean(like),
    });
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
        if (!isForumPubliclyVisible(post.data || {})) {
          throw Object.assign(new Error('This post cannot be liked'), { status: 403 });
        }
      },
    });
    res.json({ ...formatPublicEntity(result.target), likedByMe: true });
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
        if (!isForumPubliclyVisible(post.data || {})) {
          // Match the public read routes: callers must not be able to use an
          // interaction endpoint as an existence oracle for moderated posts.
          throw Object.assign(new Error('Post not found'), { status: 404 });
        }
      },
    });
    // Unlike responses contain only the interaction state needed by the UI.
    // Never re-serialize a forum body from this lifecycle endpoint.
    res.json({
      id: result.target.id,
      likes_count: result.target.data?.likes_count || 0,
      likedByMe: false,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/replies', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const post = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!post || post.type !== 'CommunityPost' || !isForumPubliclyVisible(post.data || {})) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const rows = await prisma.entity.findMany({
      where: { type: 'CommunityReply', data: { path: ['post_id'], equals: req.params.id } },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    const visible = rows.filter((row) => isForumPubliclyVisible(row.data || {}));
    // Fail closed: an is_ai_response reply whose Scripture no longer verifies is
    // omitted (user-authored replies pass through untouched).
    const servable = await serveExposableRows('CommunityReply', visible);
    const authorNames = await displayNamesForRows(servable);
    res.json(servable.map((row) => ({
      ...formatPublicEntity(row),
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
      if (!isForumPubliclyVisible(post.data || {})) {
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
const SHARED_SERMON_RESULT_LIMIT = 100;
const SHARED_SERMON_SCAN_PAGE_SIZE = 250;

function sharedSermonSortField(sort) {
  if (sort === 'rating') return 'average_rating';
  if (sort === 'views') return 'views_count';
  if (sort === 'recent') return null;
  return 'forks_count';
}

function finiteMetric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareRankedCommunityItems(field, a, b) {
  const metricDifference = finiteMetric(b[field]) - finiteMetric(a[field]);
  if (metricDifference !== 0) return metricDifference;
  const dateDifference = new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
  if (Number.isFinite(dateDifference) && dateDifference !== 0) return dateDifference;
  return String(a.id).localeCompare(String(b.id));
}

async function rankedSharedSermons(sort) {
  const field = sharedSermonSortField(sort);
  const ranked = [];
  let offset = 0;

  // Counters live in legacy JSON, so Prisma cannot order by them before
  // applying `take`. Traverse bounded pages and retain only the best 100;
  // this ranks the complete visible set without loading it all at once.
  while (true) {
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedSermon' },
      orderBy: { createdAt: 'desc' },
      take: SHARED_SERMON_SCAN_PAGE_SIZE,
      skip: offset,
    });
    if (!rows.length) break;

    const visible = rows.filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {})));
    const servable = await serveExposableRows('SharedSermon', visible);
    ranked.push(...servable.map(formatPublicEntity));

    if (field) {
      ranked.sort((a, b) => compareRankedCommunityItems(field, a, b));
      ranked.splice(SHARED_SERMON_RESULT_LIMIT);
    } else if (ranked.length >= SHARED_SERMON_RESULT_LIMIT) {
      return ranked.slice(0, SHARED_SERMON_RESULT_LIMIT);
    }

    offset += rows.length;
    if (rows.length < SHARED_SERMON_SCAN_PAGE_SIZE) break;
  }

  return field
    ? ranked.sort((a, b) => compareRankedCommunityItems(field, a, b)).slice(0, SHARED_SERMON_RESULT_LIMIT)
    : ranked.slice(0, SHARED_SERMON_RESULT_LIMIT);
}

router.get('/sermons', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const sort = String(req.query.sort || 'popular');
    res.json(await rankedSharedSermons(sort));
  } catch (err) {
    next(err);
  }
});

// Personal publication management remains available when Premium expires so
// a user can always see and withdraw material they previously made public.
router.get('/sermons/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid shared-sermon page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: { type: 'SharedSermon', userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({
      sermons: rows.map(formatEntity),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
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
      user_name: safeCommunityDisplayName(user?.full_name, user?.name),
      title: source.data?.title || 'Untitled Sermon',
      topic: source.data?.topic || '',
      anchor_passage: source.data?.anchor_passage || '',
      big_idea: source.data?.big_idea || '',
      introduction: source.data?.introduction || '',
      points: normalizePublishedSermonPoints(source.data?.points),
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
    const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
    const sermon = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const current = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!current || current.type !== 'SharedSermon') {
        throw Object.assign(new Error('Shared sermon not found'), { status: 404 });
      }
      if (current.userId !== req.userId && !isAdmin) {
        throw Object.assign(new Error('You can only withdraw your own shared sermons'), { status: 403 });
      }
      const comments = await tx.entity.findMany({
        where: {
          type: 'Comment',
          AND: [
            { data: { path: ['content_type'], equals: 'sermon' } },
            { data: { path: ['content_id'], equals: current.id } },
          ],
        },
        select: { id: true },
        take: 10_000,
      });
      const interactionIds = [current.id, ...comments.map((comment) => comment.id)];
      await tx.communityLike.deleteMany({ where: { contentId: { in: interactionIds } } });
      await tx.entity.deleteMany({
        where: { type: 'SermonRating', data: { path: ['sermon_id'], equals: current.id } },
      });
      await tx.entity.deleteMany({
        where: {
          type: 'Comment',
          AND: [
            { data: { path: ['content_type'], equals: 'sermon' } },
            { data: { path: ['content_id'], equals: current.id } },
          ],
        },
      });
      await tx.entity.deleteMany({
        where: { type: 'SharedLink', data: { path: ['resourceId'], equals: current.id } },
      });
      await tx.entity.delete({ where: { id: current.id } });
      return current;
    });
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
    const ratings = await formatRatingsForCommunity(rows);
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

// Comments remain public contributions even after the author's subscription
// lapses. This owner-only inventory deliberately avoids resolving the current
// target title: a plan/sermon owner may since have made that target private.
router.get('/comments/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid comment page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: { type: 'Comment', userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({
      comments: rows.map((row) => ({
        ...formatEntity(row),
        target_type: row.data?.content_type === 'plan' ? 'reading_plan' : 'sermon',
      })),
      next_offset: rows.length === limit ? offset + rows.length : null,
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

router.delete('/comments/:id', authenticateToken, async (req, res, next) => {
  try {
    const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
    const deleted = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const comment = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!comment || comment.type !== 'Comment') {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }
      if (comment.userId !== req.userId && !isAdmin) {
        throw Object.assign(new Error('You can only delete your own comments'), { status: 403 });
      }
      await tx.communityLike.deleteMany({ where: { contentId: comment.id, contentType: 'Comment' } });
      await tx.entity.delete({ where: { id: comment.id } });
      return comment;
    });
    if (isAdmin && deleted.userId !== req.userId) {
      await recordCommunityAudit('community.comment_remove', req.userId, 'Comment', deleted.id, {
        ownerId: deleted.userId,
      });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/study-groups', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const memberships = await prisma.communityGroupMember.findMany({ where: { userId: req.userId } });
    const membershipByGroup = new Map(memberships.map((row) => [row.groupId, row]));
    const memberGroupIds = [...membershipByGroup.keys()];
    const where = {
      type: 'StudyGroup',
      OR: [
        { userId: req.userId },
        { data: { path: ['is_private'], equals: false } },
        ...(memberGroupIds.length ? [{ id: { in: memberGroupIds } }] : []),
      ],
    };
    const visible = [];
    const pageSize = 50;
    let skip = 0;
    // Visibility belongs in the database predicate so a wall of newer private
    // groups cannot crowd valid results out of the first page. Continue past
    // moderated rows as well until the caller has 50 actually visible groups.
    while (visible.length < 50) {
      const page = await prisma.entity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip,
        select: { id: true, type: true, userId: true, data: true, createdAt: true, updatedAt: true },
      });
      visible.push(...page.filter((row) => !HIDDEN_COMMUNITY_STATUSES.has(communityStatus(row.data || {}))));
      skip += page.length;
      if (page.length < pageSize) break;
    }
    visible.splice(50);
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

// Lifecycle inventory: unlike discovery/activity routes, this is intentionally
// auth-only. A lapsed owner/member still needs the identifiers and roles needed
// to leave a group or remove people from a private group they lead.
router.get('/study-groups/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid study-group page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const memberships = await prisma.communityGroupMember.findMany({ where: { userId: req.userId } });
    const membershipByGroup = new Map(memberships.map((row) => [row.groupId, row]));
    const memberGroupIds = [...membershipByGroup.keys()];
    const rows = await prisma.entity.findMany({
      where: {
        type: 'StudyGroup',
        OR: [
          { userId: req.userId },
          ...(memberGroupIds.length ? [{ id: { in: memberGroupIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const groups = [];
    for (const row of rows) {
      const membership = membershipByGroup.get(row.id)
        || await membershipFor(row, req.userId);
      if (!membership) continue;
      groups.push({
        ...formatEntity(row),
        is_member: true,
        membership_role: membership.role,
      });
    }
    res.json({
      groups,
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
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

router.get('/study-groups/:id', authenticateToken, async (req, res, next) => {
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
    const result = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const group = await findStudyGroup(req.params.id, tx);
      if (group.data?.is_private === true) {
        throw Object.assign(new Error('This private study group does not accept open joins'), { status: 403 });
      }
      const membership = await tx.communityGroupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: req.userId } },
        create: {
          groupId: group.id,
          userId: req.userId,
          role: group.userId === req.userId ? 'leader' : 'member',
          userName: await displayNameForUser(req.userId, tx),
          joinedAt: new Date(),
        },
        update: {},
      });
      const { memberCount } = await updateGroupMemberCount(group, tx);
      return { group, membership, memberCount };
    });
    await recordCommunityAudit('community.group_join', req.userId, 'StudyGroup', result.group.id);
    res.json({ membership: formatGroupMembership(result.membership), member_count: result.memberCount });
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/members', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const parsed = groupMemberAddSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group member', issues: parsed.error.issues });
    }
    const result = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const { group } = await requireGroupLeader(req.params.id, req.userId, tx);
      const target = await tx.user.findUnique({ where: { id: parsed.data.user_id } });
      if (!target || target.deletedAt || target.is_banned) {
        throw Object.assign(new Error('Community member not found'), { status: 404 });
      }
      if (!entitlementsFor(target).includes(ENTITLEMENTS.COMMUNITY)) {
        throw Object.assign(new Error('That account does not currently have Community access'), { status: 409 });
      }
      const membership = await tx.communityGroupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: target.id } },
        create: {
          groupId: group.id,
          userId: target.id,
          role: group.userId === target.id ? 'leader' : 'member',
          userName: safeCommunityDisplayName(target.full_name, target.name),
          joinedAt: new Date(),
        },
        update: {},
      });
      const { memberCount } = await updateGroupMemberCount(group, tx);
      return { group, target, membership, memberCount };
    });
    await recordCommunityAudit('community.group_member_add', req.userId, 'CommunityGroupMember', result.membership.id, {
      groupId: result.group.id,
      addedUserId: result.target.id,
    });
    res.json({ membership: formatGroupMembership(result.membership), member_count: result.memberCount });
  } catch (err) {
    next(err);
  }
});

// Removing access to a private group is a security/lifecycle control, so a
// leader may use it even after their own paid or promotional access expires.
router.delete('/study-groups/:id/members/:memberId', authenticateToken, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const { group } = await requireGroupLeader(req.params.id, req.userId, tx);
      const member = await tx.communityGroupMember.findUnique({ where: { id: req.params.memberId } });
      if (!member || member.groupId !== group.id) {
        throw Object.assign(new Error('Group member not found'), { status: 404 });
      }
      if (member.userId === req.userId) {
        throw Object.assign(new Error('Use Leave Group to remove your own membership'), { status: 409 });
      }
      if (member.userId === group.userId) {
        throw Object.assign(new Error('The group owner cannot be removed by another leader'), { status: 409 });
      }

      await tx.communityGroupMember.delete({ where: { id: member.id } });
      const { memberCount } = await updateGroupMemberCount(group, tx);
      return { group, member, memberCount };
    });
    await recordCommunityAudit('community.group_member_remove', req.userId, 'CommunityGroupMember', result.member.id, {
      groupId: result.group.id,
      removedUserId: result.member.userId,
    });
    res.json({ removed: true, member_count: result.memberCount });
  } catch (err) {
    next(err);
  }
});

// Leaving is a privacy/lifecycle action and remains available after a trial or
// promotion expires. Serialize it with every other group ownership mutation so
// the creator cannot be silently re-added by membershipFor after departure.
router.delete('/study-groups/:id/membership', authenticateToken, async (req, res, next) => {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const { group, membership } = await requireGroupMember(req.params.id, req.userId, tx);
      const memberships = await tx.communityGroupMember.findMany({
        where: { groupId: group.id },
        orderBy: { joinedAt: 'asc' },
      });
      const otherMemberships = memberships.filter((row) => row.userId !== req.userId);
      const otherUsers = otherMemberships.length
        ? await tx.user.findMany({ where: { id: { in: otherMemberships.map((row) => row.userId) } } })
        : [];
      const activeUserIds = new Set(otherUsers
        .filter((user) => !user.deletedAt && !user.is_banned)
        .map((user) => user.id));
      const remaining = otherMemberships.filter((row) => activeUserIds.has(row.userId));
      const staleIds = otherMemberships
        .filter((row) => !activeUserIds.has(row.userId))
        .map((row) => row.id);
      if (staleIds.length) await tx.communityGroupMember.deleteMany({ where: { id: { in: staleIds } } });

      if (remaining.length === 0) {
        const meetings = await tx.entity.findMany({
          where: { type: 'GroupMeeting', data: { path: ['group_id'], equals: group.id } },
          select: { id: true },
        });
        await tx.communityGroupMember.deleteMany({ where: { groupId: group.id } });
        for (const meeting of meetings) {
          await tx.entity.deleteMany({
            where: { type: 'MeetingAttendance', data: { path: ['meeting_id'], equals: meeting.id } },
          });
        }
        await tx.entity.deleteMany({ where: { data: { path: ['group_id'], equals: group.id } } });
        await tx.entity.delete({ where: { id: group.id } });
        return { groupId: group.id, deleted: true, memberCount: 0 };
      }

      const successor = remaining.find((row) => row.role === 'leader');
      const leavingLeadership = membership.role === 'leader' || group.userId === req.userId;
      if (leavingLeadership && !successor) {
        throw Object.assign(new Error('Promote another member before the last leader leaves'), { status: 409 });
      }

      await tx.communityGroupMember.delete({ where: { id: membership.id } });
      await tx.entity.update({
        where: { id: group.id },
        data: {
          ...(group.userId === req.userId ? { userId: successor.userId } : {}),
          data: { ...(group.data || {}), member_count: remaining.length },
        },
      });
      return { groupId: group.id, deleted: false, memberCount: remaining.length };
    });

    await recordCommunityAudit(
      outcome.deleted ? 'community.group_delete_empty' : 'community.group_leave',
      req.userId,
      'StudyGroup',
      outcome.groupId,
    );
    res.json({ left: true, group_deleted: outcome.deleted, member_count: outcome.memberCount });
  } catch (err) {
    next(err);
  }
});

// Leadership transfer is also a lifecycle operation: it is required before a
// final leader can leave a non-empty group, so it cannot disappear at expiry.
router.patch('/study-groups/:id/members/:memberId/promote', authenticateToken, async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      await requireGroupLeader(req.params.id, req.userId, tx);
      const member = await tx.communityGroupMember.findUnique({ where: { id: req.params.memberId } });
      if (!member || member.groupId !== req.params.id) {
        throw Object.assign(new Error('Group member not found'), { status: 404 });
      }
      return tx.communityGroupMember.update({
        where: { id: member.id },
        data: { role: 'leader' },
      });
    });
    await recordCommunityAudit('community.group_promote', req.userId, 'CommunityGroupMember', updated.id, {
      groupId: req.params.id,
      promotedUserId: updated.userId,
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
    res.json([...rows].reverse().map(formatPublicEntity));
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
          user_name: safeCommunityDisplayName(membership.userName),
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

// Message retraction is an ownership/privacy control, so it remains available
// after Community access expires and even after the author leaves the group.
// Reading or posting still requires current membership and Community access.
router.delete('/study-groups/:id/messages/:messageId', authenticateToken, async (req, res, next) => {
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.messageId);
      const message = await tx.entity.findUnique({ where: { id: req.params.messageId } });
      if (!message || message.type !== 'GroupMessage' || message.data?.group_id !== req.params.id) {
        throw Object.assign(new Error('Group message not found'), { status: 404 });
      }
      if (message.userId !== req.userId) {
        throw Object.assign(new Error('You can only delete your own group messages'), { status: 403 });
      }
      await tx.entity.delete({ where: { id: message.id } });
      return message;
    });
    await recordCommunityAudit('community.group_message_delete', req.userId, 'GroupMessage', deleted.id, {
      groupId: req.params.id,
    });
    res.status(204).end();
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
    const parsed = groupMeetingSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group meeting', issues: parsed.error.issues });
    }
    const row = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      await requireGroupLeader(req.params.id, req.userId, tx);
      const discussionLeader = await tx.communityGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: req.params.id,
            userId: parsed.data.discussion_leader_id,
          },
        },
      });
      if (!discussionLeader) {
        throw Object.assign(new Error('Discussion leader must be a current group member'), { status: 400 });
      }
      return tx.entity.create({
        data: {
          type: 'GroupMeeting',
          userId: req.userId,
          data: {
            ...parsed.data,
            discussion_leader_name: safeCommunityDisplayName(discussionLeader.userName),
            scheduled_date: new Date(parsed.data.scheduled_date).toISOString(),
            group_id: req.params.id,
            status: 'scheduled',
            created_date: new Date().toISOString(),
          },
        },
      });
    });
    await recordCommunityAudit('community.group_meeting_create', req.userId, 'GroupMeeting', row.id, {
      groupId: req.params.id,
    });
    res.status(201).json(formatEntity(row));
  } catch (err) {
    next(err);
  }
});

// Editing an already-published meeting is a leader lifecycle control, just
// like cancellation below. It remains available when paid access expires so
// stale times, links, or locations never become permanently uncorrectable.
router.patch('/study-groups/:id/meetings/:meetingId', authenticateToken, async (req, res, next) => {
  try {
    const parsed = groupMeetingUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid group meeting update', issues: parsed.error.issues });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Group mutations always lock group first, then the child entity. Keeping
      // this order consistent avoids deadlocks with cancellation and teardown.
      await lockCommunityEntity(tx, req.params.id);
      await lockCommunityEntity(tx, req.params.meetingId);
      await requireGroupLeader(req.params.id, req.userId, tx);

      const meeting = await tx.entity.findUnique({ where: { id: req.params.meetingId } });
      if (!meeting || meeting.type !== 'GroupMeeting' || meeting.data?.group_id !== req.params.id) {
        throw Object.assign(new Error('Group meeting not found'), { status: 404 });
      }

      const patch = { ...parsed.data };
      if (patch.scheduled_date) {
        patch.scheduled_date = new Date(patch.scheduled_date).toISOString();
      }
      if (patch.discussion_leader_id) {
        const discussionLeader = await tx.communityGroupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: req.params.id,
              userId: patch.discussion_leader_id,
            },
          },
        });
        if (!discussionLeader) {
          throw Object.assign(new Error('Discussion leader must be a current group member'), { status: 400 });
        }
        patch.discussion_leader_name = safeCommunityDisplayName(discussionLeader.userName);
      }

      return tx.entity.update({
        where: { id: meeting.id },
        data: {
          data: {
            ...(meeting.data || {}),
            ...patch,
            group_id: req.params.id,
            updated_date: new Date().toISOString(),
          },
        },
      });
    });

    await recordCommunityAudit('community.group_meeting_update', req.userId, 'GroupMeeting', updated.id, {
      groupId: req.params.id,
    });
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

// Cancellation is a lifecycle action: an authenticated leader must still be
// able to remove an obsolete meeting and its RSVPs after paid access expires.
router.delete('/study-groups/:id/meetings/:meetingId', authenticateToken, async (req, res, next) => {
  try {
    const removed = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      await lockCommunityEntity(tx, req.params.meetingId);
      await requireGroupLeader(req.params.id, req.userId, tx);

      const meeting = await tx.entity.findUnique({ where: { id: req.params.meetingId } });
      if (!meeting || meeting.type !== 'GroupMeeting' || meeting.data?.group_id !== req.params.id) {
        throw Object.assign(new Error('Group meeting not found'), { status: 404 });
      }
      await tx.entity.deleteMany({
        where: {
          type: 'MeetingAttendance',
          data: { path: ['meeting_id'], equals: meeting.id },
        },
      });
      await tx.entity.delete({ where: { id: meeting.id } });
      return meeting;
    });

    await recordCommunityAudit('community.group_meeting_delete', req.userId, 'GroupMeeting', removed.id, {
      groupId: req.params.id,
    });
    res.status(204).end();
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
      user_name: safeCommunityDisplayName(membership.userName),
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
    const [progress] = await prisma.entity.findMany({
      where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    if (!progress) return res.json({ progress: null, plan: null });

    let plan = null;
    const snapshot = progress.data?.plan_snapshot;
    const trustedSnapshot = progress.data?.assignment_format_version === 2
      && snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
    if (trustedSnapshot) {
      assertGatedResourceExposable({
        type: 'ReadingPlan',
        resourceData: snapshot,
        denomination: progress.data?.plan_denomination || snapshot.denomination || '',
      });
      plan = snapshot;
    } else if (progress.data?.plan_id) {
      // Legacy progress rows referenced a live ReadingPlan and their JSON
      // `assigned_by` value was client-writable. For a private plan require two
      // independent trusted ownership facts: the plan belongs to the current
      // authoritative group owner AND the top-level progress row was written by
      // that owner. Public plans remain shareable. Never trust assigned_by.
      const candidate = await prisma.entity.findUnique({ where: { id: progress.data.plan_id } });
      const trustedPrivatePlan = candidate?.userId === group.userId
        && progress.userId === group.userId;
      if (candidate?.type === 'ReadingPlan'
          && (candidate.data?.is_public === true || trustedPrivatePlan)) {
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
    const parsed = groupPlanSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reading plan assignment', issues: parsed.error.issues });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      await requireGroupLeader(req.params.id, req.userId, tx);

      const plan = await tx.entity.findUnique({ where: { id: parsed.data.plan_id } });
      if (!plan || plan.type !== 'ReadingPlan'
        || (plan.userId !== req.userId && plan.data?.is_public !== true)) {
        throw Object.assign(new Error('Reading plan not found'), { status: 404 });
      }

      const denomination = plan.data?.denomination
        || (await tx.user.findUnique({ where: { id: plan.userId }, select: { profile: true } }))?.profile?.denomination
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
        assignment_format_version: 2,
        plan_denomination: denomination,
        plan_snapshot: planSnapshot,
        total_days: totalDays,
        completed_days: [],
        current_day: 1,
        completion_percentage: 0,
      };
      const existingRows = await tx.entity.findMany({
        where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      });
      const progress = existingRows[0]
        ? await tx.entity.update({
          where: { id: existingRows[0].id },
          data: { userId: req.userId, data: nextData },
        })
        : await tx.entity.create({ data: { type: 'GroupProgress', userId: req.userId, data: nextData } });
      const duplicateIds = existingRows.slice(1).map((row) => row.id);
      if (duplicateIds.length) await tx.entity.deleteMany({ where: { id: { in: duplicateIds } } });
      return { progress, planSnapshot, planId: plan.id };
    });

    await recordCommunityAudit('community.group_plan_assign', req.userId, 'GroupProgress', result.progress.id, {
      groupId: req.params.id,
      planId: result.planId,
    });
    const formattedProgress = formatEntity(result.progress);
    delete formattedProgress.plan_snapshot;
    delete formattedProgress.plan_denomination;
    res.json({ progress: formattedProgress, plan: result.planSnapshot });
  } catch (err) {
    next(err);
  }
});

router.post('/study-groups/:id/progress/days/:day/complete', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    const day = Number(req.params.day);
    if (!Number.isInteger(day) || day < 1 || day > 366) {
      return res.status(400).json({ message: 'Invalid reading-plan day' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      await requireGroupLeader(req.params.id, req.userId, tx);
      const progressRows = await tx.entity.findMany({
        where: { type: 'GroupProgress', data: { path: ['group_id'], equals: req.params.id } },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      });
      const progress = progressRows[0];
      if (!progress) {
        throw Object.assign(new Error('No reading plan is assigned to this group'), { status: 404 });
      }
      const totalDays = Math.max(1, Number(progress.data?.total_days || 1));
      if (day > totalDays) {
        throw Object.assign(new Error('Reading-plan day is outside this plan'), { status: 400 });
      }
      const completedDays = [...new Set([...(progress.data?.completed_days || []), day])]
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= totalDays)
        .sort((a, b) => a - b);
      const current = await tx.entity.update({
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
      const duplicateIds = progressRows.slice(1).map((row) => row.id);
      if (duplicateIds.length) await tx.entity.deleteMany({ where: { id: { in: duplicateIds } } });
      return current;
    });
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

router.get('/reading-plans/mine', authenticateToken, async (req, res, next) => {
  try {
    const parsed = lifecyclePageSchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reading-plan page', issues: parsed.error.issues });
    }
    const { limit, offset } = parsed.data;
    const rows = await prisma.entity.findMany({
      where: {
        type: 'ReadingPlan',
        userId: req.userId,
        data: { path: ['is_public'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({
      reading_plans: rows.map(formatEntity),
      next_offset: rows.length === limit ? offset + rows.length : null,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/reading-plans/:id/publication', authenticateToken, async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await lockCommunityEntity(tx, req.params.id);
      const current = await tx.entity.findUnique({ where: { id: req.params.id } });
      if (!current || current.type !== 'ReadingPlan') {
        throw Object.assign(new Error('Reading plan not found'), { status: 404 });
      }
      if (current.userId !== req.userId) {
        throw Object.assign(new Error('You can only withdraw your own reading plan'), { status: 403 });
      }
      return tx.entity.update({
        where: { id: current.id },
        data: { data: { ...(current.data || {}), is_public: false } },
      });
    });
    await recordCommunityAudit('community.reading_plan_withdraw', req.userId, 'ReadingPlan', updated.id);
    res.json(formatEntity(updated));
  } catch (err) {
    next(err);
  }
});

const READING_PLAN_RESULT_LIMIT = 50;
const READING_PLAN_SCAN_PAGE_SIZE = 250;

function readingPlanSortField(sort) {
  if (sort === 'rating') return 'average_rating';
  if (sort === 'popular') return 'followers_count';
  return null;
}

async function rankedPublicReadingPlans(sort) {
  const field = readingPlanSortField(sort);
  const ranked = [];
  let offset = 0;

  // Rating/follower counters live in JSON and cannot be ordered reliably by
  // Prisma before `take`. Scan bounded pages, validate every public candidate,
  // and retain only the best 50 so an older high-ranked plan cannot disappear
  // behind 50 newer low-ranked rows.
  while (true) {
    const rows = await prisma.entity.findMany({
      where: { type: 'ReadingPlan', data: { path: ['is_public'], equals: true } },
      orderBy: { createdAt: 'desc' },
      take: READING_PLAN_SCAN_PAGE_SIZE,
      skip: offset,
      select: { id: true, userId: true, data: true, createdAt: true, updatedAt: true },
    });
    if (!rows.length) break;

    const servable = await serveExposableRows('ReadingPlan', rows);
    ranked.push(...servable.map((row) => ({
      ...formatPublicEntity(row),
      creator_id: row.userId,
    })));

    if (field) {
      ranked.sort((a, b) => compareRankedCommunityItems(field, a, b));
      ranked.splice(READING_PLAN_RESULT_LIMIT);
    } else if (ranked.length >= READING_PLAN_RESULT_LIMIT) {
      break;
    }

    offset += rows.length;
    if (rows.length < READING_PLAN_SCAN_PAGE_SIZE) break;
  }

  const finalists = field
    ? ranked.sort((a, b) => compareRankedCommunityItems(field, a, b)).slice(0, READING_PLAN_RESULT_LIMIT)
    : ranked.slice(0, READING_PLAN_RESULT_LIMIT);
  const owners = await displayNamesForRows(finalists.map((plan) => ({ userId: plan.creator_id })));
  return finalists.map((plan) => ({
    ...plan,
    creator_name: owners.get(plan.creator_id) || 'Member',
  }));
}

router.get('/reading-plans', authenticateToken, requireCommunity, async (req, res, next) => {
  try {
    res.json(await rankedPublicReadingPlans(String(req.query.sort || 'newest')));
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
    const ratings = await formatRatingsForCommunity(rows);
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
      // Apply the queue predicate before `take`; ordinary recent forum traffic
      // must never crowd an older unresolved report out of moderation.
      where: {
        type: { in: MODERATABLE_TYPES },
        OR: [
          { data: { path: ['reported_count'], gt: 0 } },
          { data: { path: ['reportedCount'], gt: 0 } },
          ...['reported', 'hidden', 'removed', 'rejected'].map((status) => ({
            data: { path: ['status'], equals: status },
          })),
        ],
      },
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

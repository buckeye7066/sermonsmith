import { Router } from 'express';
import { z } from 'zod';
import { prisma, authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  SCRIPTURE_GATED_TYPES,
  gateEntityWrite,
  assertAiReplyExposable,
  normalizeRetiredWorkflowInput,
} from '../services/scriptureGate.js';
import {
  attachQuotationVerification,
  buildQuotationVerification,
} from '../services/quotationVerification.js';
import { translationMetadata } from '../services/bibleSources.js';
import { getCachedBiblePassage } from './functions.js';

// Tenant-isolated entity API.
//
// Production-readiness fix (2026-05-13): the previous implementation used
// `optionalAuth` on list/filter/get routes which let ANY (anonymous!)
// caller read ANY user's entities. Every endpoint here now requires
// authentication and scopes the query by `userId`. Admins (and the `dev`
// role) may pass `?all=1` to fan out across users for support tasks; this
// is logged via the userId trail in the response.

const router = Router();

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;

// Public entity types intentionally exposed without ownership checks.
// `Verse` is the imported Bible (read-only reference data); `SharedLink`
// metadata is fetched via slug lookup from a separate route, not from this
// generic API.
const PUBLIC_TYPES = new Set(['Verse']);

// Server-managed types that must NOT be minted through the generic entity
// create/bulk path. `SharedLink` grants read access to a target resource by
// slug; it is only safe to create via /api/functions/createShareableLink,
// which verifies the caller owns the resource being shared. Allowing it here
// let any user forge a link pointing at another user's private entity. The
// /share/:slug route now also re-checks sharer ownership (defense in depth).
const SERVER_MANAGED_TYPES = new Set(['SharedLink', 'EntityRevision', 'MediaJob']);
const REVISIONED_TYPES = new Set(['Sermon', 'Series', 'SermonSeries', 'BibleStudy']);
const MAX_REVISIONS_RETURNED = 100;

function formatEntity(e) {
  return { id: e.id, ...e.data, created_date: e.createdAt, updated_date: e.updatedAt };
}

// Same RESERVED_PROFILE_KEYS hardening as /api/auth — a malicious user could
// otherwise store `profile.role = "admin"` and have an admin lookup of their
// account leak elevated role/premium back to the frontend.
const RESERVED_PROFILE_KEYS = new Set([
  'id',
  'email',
  'password',
  'role',
  'premium',
  'premium_override',
  'subscription_tier',
  'premium_until',
  'tokenVersion',
  'token_version',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function cleanProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !RESERVED_PROFILE_KEYS.has(key))
  );
}

function sanitizeUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { password, profile, ...safeUser } = u;
  const safeProfile = cleanProfile(profile);
  return { ...safeProfile, ...safeUser, profile: safeProfile };
}

function resolveOrderBy(raw) {
  if (!raw) return { createdAt: 'desc' };
  if (typeof raw === 'string') {
    const desc = raw.startsWith('-');
    const field = desc ? raw.slice(1) : raw;
    const col = field === 'created_date' ? 'createdAt' : field === 'updated_date' ? 'updatedAt' : 'createdAt';
    return { [col]: desc ? 'desc' : 'asc' };
  }
  return { createdAt: 'desc' };
}

function clampLimit(raw) {
  const n = typeof raw === 'number' ? raw : DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, n), MAX_PAGE_SIZE);
}

function isAdmin(req) {
  return req.userRole === 'admin' || req.userRole === 'dev';
}

// ---------------------------------------------------------------------------
// Entity type allowlist + per-type Zod validation.
//
// The generic entity API previously accepted arbitrary :type values and
// arbitrary JSON for `data`. That made migrations, moderation, abuse
// handling, and analytics intractable — a single user could spam unknown
// entity types or oversized JSON blobs.
//
// Each known type now has a Zod schema that bounds field shape and length.
// .passthrough() lets us carry additional client-side fields forward
// (sermon outlines, study notes, etc.) without forcing a schema change for
// every UI tweak — but it does NOT let payloads break the documented
// invariants for fields the schema names.
//
// Unknown types are rejected outright with HTTP 400.
// ---------------------------------------------------------------------------
function isRealCalendarDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

const ScheduledDateSchema = z.union([
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD')
    .refine(isRealCalendarDate, 'Expected a real calendar date'),
  z.string()
    .datetime({ offset: true })
    .refine(isRealCalendarDate, 'Expected a real calendar date'),
]);

const SermonSchema = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  anchor_passage: z.string().max(200).optional(),
  big_idea: z.string().max(2000).optional(),
  points: z.array(z.any()).max(20).optional(),
  conclusion: z.string().max(20000).optional(),
  theological_notes: z.string().max(20000).optional(),
  scheduled_date: ScheduledDateSchema.nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).passthrough();

const SermonTemplateContentSchema = z.object({
  title: z.string().max(200).optional(),
  topic: z.string().max(200).optional(),
  anchor_passage: z.string().max(200).optional(),
  big_idea: z.string().max(2000).optional(),
  introduction: z.string().max(20000).optional(),
  points: z.array(z.any()).max(20).optional(),
  conclusion: z.string().max(20000).optional(),
  theological_notes: z.string().max(20000).optional(),
  tone: z.string().max(100).optional(),
  audience: z.string().max(200).optional(),
  denomination: z.string().max(120).optional(),
}).strict();

const SeriesTemplateContentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  denomination: z.string().max(120).optional(),
  length: z.coerce.number().int().min(1).max(52).optional(),
  sermon_blueprints: z.array(SermonTemplateContentSchema).max(52).optional(),
}).strict();

const InstantiateSeriesTemplateSchema = z.object({
  request_id: z.string().uuid(),
}).strict();

// Reader writes Highlight/Note/Bookmark records keyed off a Bible verse.
// Pulling the shared identifier shape out keeps the three schemas in sync
// and lets the Reader UI evolve the verse_id format without schema churn.
const BibleReferenceSchema = z.object({
  verse_id: z.string().min(1).max(200).optional(),
  book_name: z.string().min(1).max(80).optional(),
  chapter: z.coerce.number().int().min(1).max(150).optional(),
  verse: z.coerce.number().int().min(1).max(176).optional(),
}).passthrough();

const ENTITY_SCHEMAS = {
  Sermon: SermonSchema,
  Series: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }).passthrough(),
  StudyNote: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(50000).optional(),
    scripture_reference: z.string().max(200).optional(),
  }).passthrough(),
  Quiz: z.object({
    title: z.string().min(1).max(200),
    questions: z.array(z.any()).max(100).optional(),
  }).passthrough(),
  Message: z.object({
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(5000),
    message_type: z.enum(['bug_report', 'feature_request', 'question', 'feedback', 'other']).default('other'),
    status: z.enum(['new', 'in_progress', 'resolved', 'closed']).default('new'),
  }).passthrough(),
  SharedContent: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(20000),
    visibility: z.enum(['private', 'public']).default('private'),
    content_type: z.enum(['note', 'highlight', 'study', 'sermon']),
  }).passthrough(),
  SharedLink: z.object({}).passthrough(),
  ForumPost: z.object({
    title: z.string().min(1).max(200),
    body: z.string().max(20000).optional(),
  }).passthrough(),
  // The community Forum page (apps/web/src/pages/Forum.jsx) reads/writes these
  // two types. They were missing from the registry, so every "New Post" POST
  // 400'd with "Unsupported entity type: CommunityPost". Field names mirror the
  // client form exactly (content/post_type/scripture_reference). passthrough()
  // keeps the denormalized counters (replies_count/likes_count) and flags.
  CommunityPost: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(20000),
    post_type: z.enum(['question', 'discussion', 'testimony', 'prayer_request']).default('discussion'),
    scripture_reference: z.string().max(200).optional(),
    tags: z.array(z.string().max(60)).max(20).optional(),
    user_name: z.string().max(200).optional(),
  }).passthrough(),
  CommunityReply: z.object({
    post_id: z.string().min(1).max(200),
    content: z.string().min(1).max(20000),
    user_name: z.string().max(200).optional(),
    is_ai_response: z.boolean().optional(),
    is_accepted_answer: z.boolean().optional(),
  }).passthrough(),
  StudyGroup: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }).passthrough(),
  ActivityLog: z.object({}).passthrough(),
  UserActivity: z.object({}).passthrough(),
  Highlight: BibleReferenceSchema.extend({
    color: z.string().min(1).max(40),
  }).passthrough(),
  Note: BibleReferenceSchema.extend({
    content: z.string().min(1).max(50000),
  }).passthrough(),
  Bookmark: BibleReferenceSchema.extend({
    label: z.string().max(200).optional(),
  }).passthrough(),
  PrayerRequest: z.object({}).passthrough(),
  Plan: z.object({}).passthrough(),
  PlanProgress: z.object({}).passthrough(),
  Verse: z.object({}).passthrough(),

  // ---------------------------------------------------------------------------
  // Feature / relational entity types used by the frontend.
  //
  // These were previously absent from the allowlist, so EVERY create() against
  // them failed with HTTP 400 "Unsupported entity type" — adding a resource
  // tag (TagManager), saving a Bible study or reading plan, rating a sermon,
  // posting/replying in the community, group collaboration, etc. Reads of
  // unknown types silently returned [] (which is why empty states looked
  // fine), masking the broken writes. They stay permissive (.passthrough)
  // because the UI owns their exact shape; we only bound the obviously
  // unbounded text fields so the size/abuse guarantees the allowlist exists
  // to provide still hold.
  // ---------------------------------------------------------------------------
  ResourceTag: z.object({
    tag: z.string().min(1).max(100),
    resource_type: z.string().max(40).optional(),
    resource_id: z.string().max(200).optional(),
    color: z.string().max(40).optional(),
    ai_suggested: z.boolean().optional(),
  }).passthrough(),
  BibleStudy: z.object({
    title: z.string().min(1).max(300),
    topic: z.string().max(300).optional(),
    overview: z.string().max(50000).optional(),
  }).passthrough(),
  ReadingPlan: z.object({
    title: z.string().max(300).optional(),
    name: z.string().max(300).optional(),
    description: z.string().max(20000).optional(),
  }).passthrough(),
  Collection: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }).passthrough(),
  CollectionItem: z.object({}).passthrough(),
  EthicsAnalysis: z.object({
    title: z.string().max(300).optional(),
    topic: z.string().max(300).optional(),
  }).passthrough(),
  SermonRating: z.object({
    rating: z.coerce.number().min(0).max(5).optional(),
    review: z.string().max(5000).optional(),
  }).passthrough(),
  SermonSeries: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }).passthrough(),
  SermonTemplate: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    content: SermonTemplateContentSchema,
  }).strict(),
  SeriesTemplate: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    content: SeriesTemplateContentSchema,
  }).strict(),
  SharedSermon: z.object({}).passthrough(),
  SharedSeries: z.object({}).passthrough(),
  SharedPlanRating: z.object({
    rating: z.coerce.number().min(0).max(5).optional(),
    review: z.string().max(5000).optional(),
  }).passthrough(),
  // CommunityPost / CommunityReply are defined above (stricter schemas).
  Comment: z.object({
    content: z.string().max(20000).optional(),
    body: z.string().max(20000).optional(),
  }).passthrough(),
  SermonComment: z.object({
    content: z.string().max(20000).optional(),
    body: z.string().max(20000).optional(),
  }).passthrough(),
  SermonCollaborator: z.object({}).passthrough(),
  SeriesCollaborator: z.object({}).passthrough(),
  SermonEdit: z.object({}).passthrough(),
  GroupMessage: z.object({
    content: z.string().max(20000).optional(),
    message: z.string().max(20000).optional(),
  }).passthrough(),
  GroupProgress: z.object({}).passthrough(),
  GroupMeeting: z.object({
    title: z.string().max(300).optional(),
  }).passthrough(),
  MeetingAttendance: z.object({}).passthrough(),
  GroupMembership: z.object({}).passthrough(),
  ResourceLink: z.object({}).passthrough(),
};

// ---------------------------------------------------------------------------
// Server-side Scripture integrity gate.
//
// Until now the server stored whatever `scripture_validation` and `status`
// the client sent — a buggy or malicious client (or any AI feature that
// skips client-side validation) could persist a forged all-valid validation
// blob or mark unvalidated AI output `published`. The durable write is the
// one choke point every save path crosses, so trust state is computed HERE,
// with the exact same shared validator the web client uses.
//
// Rules for scripture-gated types:
//   - `scripture_validation` is always recomputed server-side; a client-
//     supplied blob is ignored.
//   - Fields from the retired attestation workflow are stripped.
//   - A record whose references do not all verify cannot be `published`
//     or publicly shared (422 — the user can fix the references and retry).
//   - Private drafts remain editable and keep their normal `draft` status.
//
// Canon: references are validated against the canon of the record's
// denomination (payload → stored record → user profile), so a Catholic
// sermon citing Wisdom is honestly `chapter_checked`, not "invalid book".
//
// Extended (2026-07-18) beyond `Sermon` to EVERY persisted AI-generated type
// that can carry Scripture references. Sermons keep the sermon-shaped
// validator (unchanged); the other types are swept with the shape-agnostic
// `validateAiContent`, which deep-walks the whole record — so the Bible-study
// `study_sections[].scripture`/`key_verses[]`, quiz
// `questions[].scripture_reference`, reading-plan `daily_readings[].passages[]`,
// and the double-nested EthicsAnalysis `data.result…key_scriptures[].reference`
// are all revalidated server-side at the durable write. The forged-blob and
// field-stripping guarantees now cover these types too; a UI shape
// change can't quietly drop a field out of validation.
// ---------------------------------------------------------------------------
// Gate constants + core (SCRIPTURE_GATED_TYPES, isPublicOrPublished,
// gateEntityWrite)
// live in ../services/scriptureGate.js so the entity save gate, the share-link
// routes, and the community routes all share ONE implementation and cannot
// drift. See that module.

async function denominationForRequest(req, ownerUserId, ...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  const user = await prisma.user.findUnique({
    where: { id: ownerUserId || req.userId },
    select: { profile: true },
  });
  const fromProfile = user?.profile?.denomination;
  return typeof fromProfile === 'string' ? fromProfile : '';
}

/**
 * Thin request-shaped wrapper around the centralized gate core. Resolves the
 * denomination string (payload → stored record → user profile — the one part
 * that needs the DB) and delegates every gate decision to `gateEntityWrite` in
 * ../services/scriptureGate.js, which the share-link and community routes also
 * call. Throws 422 on an attempt to publish OR publicly share a record whose
 * references do not all verify.
 */
async function applyScriptureGate(req, type, incoming, existingData = null, ownerUserId = req.userId) {
  // AI-generated community replies are gated even though CommunityReply is not a
  // first-class gated entity type. The dedicated /community/posts/:id/reply route
  // gates is_ai_response replies, but the generic entity API would otherwise
  // persist one straight from client content — so re-run the same reply gate
  // here (fabricated Scripture rejected, validated refs stored). User-authored
  // replies pass through untouched.
  if (type === 'CommunityReply' && (incoming?.is_ai_response === true || existingData?.is_ai_response === true)) {
    const denomination = await denominationForRequest(
      req,
      ownerUserId,
      incoming?.denomination,
      existingData?.denomination,
    );
    const merged = { ...(existingData || {}), ...incoming };
    const refs = assertAiReplyExposable({ content: merged.content, denomination });
    return { ...incoming, scripture_validation: refs };
  }
  if (!SCRIPTURE_GATED_TYPES.has(type)) return incoming;
  const denomination = await denominationForRequest(
    req,
    ownerUserId,
    incoming?.denomination,
    existingData?.denomination,
  );
  let gated = gateEntityWrite({ type, incoming, existingData, denomination });

  // Provider wording verification is separate from canon reference validation.
  // Wire it into every Sermon durable write so AI/user quotations cannot persist
  // as silently "verified" when only the reference shape was checked.
  if (type === 'Sermon') {
    const merged = { ...(existingData || {}), ...gated };
    const translationId = String(
      merged.translationId || merged.translation || 'kjv',
    ).toLowerCase();
    const verification = await buildQuotationVerification(merged, {
      translationId,
      translationMetadata,
      getProviderPassage: async ({ reference, translationId: tid }) => {
        try {
          const data = await getCachedBiblePassage({ ref: reference, translationId: tid });
          return {
            text: data?.text || '',
            reference: data?.reference || reference,
            provider: data?.translation_name || data?.provider || 'bible-api',
            retrievedAt: new Date().toISOString(),
            providerVersion: data?.cacheHit != null ? 'cache-or-live' : null,
            unavailable: !data?.text,
          };
        } catch {
          return { text: '', unavailable: true, reference };
        }
      },
    });
    gated = attachQuotationVerification(gated, verification);
  }
  return gated;
}

function validateEntityPayload(type, body) {
  const schema = ENTITY_SCHEMAS[type];
  if (!schema) {
    throw Object.assign(
      new Error(`Unsupported entity type: ${type}`),
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(normalizeRetiredWorkflowInput(type, body || {}));
  if (!parsed.success) {
    throw Object.assign(
      new Error(`Invalid ${type} payload: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`),
      { status: 400, issues: parsed.error.issues },
    );
  }
  return parsed.data;
}

function revisionPayload(entity, reason = 'update') {
  return {
    source_type: entity.type,
    source_id: entity.id,
    reason,
    snapshot: structuredClone(entity.data || {}),
    source_updated_date: entity.updatedAt instanceof Date
      ? entity.updatedAt.toISOString()
      : entity.updatedAt,
  };
}

function ownerScopedSourceWhere(req) {
  return isAdmin(req)
    ? { id: req.params.id, type: req.params.type }
    : { id: req.params.id, type: req.params.type, userId: req.userId };
}

async function instantiatedSeriesResult({ requestId, templateId, userId }) {
  const series = await prisma.entity.findFirst({
    where: {
      id: requestId,
      type: 'SermonSeries',
      userId,
      AND: [
        { data: { path: ['template_instantiation_id'], equals: requestId } },
        { data: { path: ['template_id'], equals: templateId } },
      ],
    },
  });
  if (!series) return null;
  const sermons = await prisma.entity.findMany({
    where: {
      type: 'Sermon',
      userId,
      AND: [
        { data: { path: ['template_instantiation_id'], equals: requestId } },
        { data: { path: ['template_id'], equals: templateId } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  return { series: formatEntity(series), sermons: sermons.map(formatEntity) };
}

// One idempotent server transaction owns the series plus every sermon draft.
// The caller-generated request UUID is also the series primary key, so a lost
// response can be retried safely and concurrent duplicates converge on the
// same complete result instead of creating orphaned or duplicate drafts.
router.post('/SeriesTemplate/:id/instantiate', authenticateToken, async (req, res, next) => {
  try {
    const parsedRequest = InstantiateSeriesTemplateSchema.safeParse(req.body || {});
    if (!parsedRequest.success) {
      return res.status(400).json({ message: 'A valid request_id UUID is required.' });
    }
    const requestId = parsedRequest.data.request_id;
    const template = await prisma.entity.findFirst({
      where: { id: req.params.id, type: 'SeriesTemplate', userId: req.userId },
    });
    if (!template) return res.status(404).json({ message: 'Series template not found' });

    const replay = await instantiatedSeriesResult({
      requestId,
      templateId: template.id,
      userId: req.userId,
    });
    if (replay) return res.json(replay);

    const content = structuredClone(template.data?.content || {});
    const blueprints = Array.isArray(content.sermon_blueprints) ? content.sermon_blueprints : [];
    delete content.sermon_blueprints;
    const seriesData = validateEntityPayload('SermonSeries', {
      ...content,
      title: content.title || template.data?.name || 'Untitled series',
      description: content.description ?? template.data?.description ?? '',
      length: content.length || blueprints.length || 1,
      status: 'in_progress',
      template_id: template.id,
      template_instantiation_id: requestId,
    });
    const sermonData = await Promise.all(blueprints.map(async (blueprint, index) => {
      const draft = validateEntityPayload('Sermon', {
        ...structuredClone(blueprint),
        title: blueprint?.title || `Sermon ${index + 1}`,
        status: 'draft',
        scheduled_date: null,
        series_id: requestId,
        series_order: index + 1,
        template_id: template.id,
        template_instantiation_id: requestId,
      });
      return applyScriptureGate(req, 'Sermon', draft);
    }));
    const createdAt = new Date().toISOString();

    try {
      const created = await prisma.$transaction(async (tx) => {
        const series = await tx.entity.create({
          data: {
            id: requestId,
            type: 'SermonSeries',
            userId: req.userId,
            data: { ...seriesData, user_id: req.userId, created_date: createdAt },
          },
        });
        const sermons = [];
        for (const sermon of sermonData) {
          sermons.push(await tx.entity.create({
            data: {
              type: 'Sermon',
              userId: req.userId,
              data: { ...sermon, user_id: req.userId, created_date: createdAt },
            },
          }));
        }
        return { series: formatEntity(series), sermons: sermons.map(formatEntity) };
      });
      return res.json(created);
    } catch (error) {
      if (error?.code === 'P2002') {
        const concurrentReplay = await instantiatedSeriesResult({
          requestId,
          templateId: template.id,
          userId: req.userId,
        });
        if (concurrentReplay) return res.json(concurrentReplay);
        throw Object.assign(new Error('That request identifier is already in use.'), { status: 409 });
      }
      throw error;
    }
  } catch (err) {
    return next(err);
  }
});

// Revision routes are dedicated so immutable snapshots can never be minted,
// changed, or removed through generic entity CRUD.
router.get('/:type/:id/revisions', authenticateToken, async (req, res, next) => {
  try {
    if (!REVISIONED_TYPES.has(req.params.type)) {
      return res.status(400).json({ message: `Revision history is not supported for '${req.params.type}'.` });
    }
    const source = await prisma.entity.findFirst({ where: ownerScopedSourceWhere(req) });
    if (!source) return res.status(404).json({ message: 'Not found' });

    const revisions = await prisma.entity.findMany({
      where: {
        type: 'EntityRevision',
        userId: source.userId,
        AND: [
          { data: { path: ['source_type'], equals: source.type } },
          { data: { path: ['source_id'], equals: source.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_REVISIONS_RETURNED,
    });
    return res.json(revisions.map(formatEntity));
  } catch (err) {
    return next(err);
  }
});

router.post('/:type/:id/revisions/:revisionId/restore', authenticateToken, async (req, res, next) => {
  try {
    if (!REVISIONED_TYPES.has(req.params.type)) {
      return res.status(400).json({ message: `Revision history is not supported for '${req.params.type}'.` });
    }
    const source = await prisma.entity.findFirst({ where: ownerScopedSourceWhere(req) });
    if (!source) return res.status(404).json({ message: 'Not found' });

    const revision = await prisma.entity.findFirst({
      where: {
        id: req.params.revisionId,
        type: 'EntityRevision',
        userId: source.userId,
        AND: [
          { data: { path: ['source_type'], equals: source.type } },
          { data: { path: ['source_id'], equals: source.id } },
        ],
      },
    });
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    const snapshot = revision.data?.snapshot;
    const validated = validateEntityPayload(source.type, snapshot);
    // A restore is a complete replacement, not a patch. Supplying the current
    // record here would merge fields added after the snapshot back into it.
    const gated = await applyScriptureGate(req, source.type, validated, null, source.userId);
    const now = new Date().toISOString();
    const restoredData = {
      ...gated,
      user_id: source.userId,
      created_date: source.data?.created_date || source.createdAt?.toISOString?.() || now,
      updated_date: now,
    };
    const restored = await prisma.$transaction(async (tx) => {
      // Guard the snapshot we are about to replace. If another save lands
      // after the source/history reads above, updateMany affects zero rows and
      // the transaction leaves both the newer content and history untouched.
      const updated = await tx.entity.updateMany({
        where: { id: source.id, updatedAt: source.updatedAt },
        data: { data: restoredData },
      });
      if (updated.count !== 1) {
        throw Object.assign(
          new Error('This item changed while the revision was being restored. Reload and try again.'),
          { status: 409 },
        );
      }
      await tx.entity.create({
        data: {
          type: 'EntityRevision',
          userId: source.userId,
          data: { ...revisionPayload(source, 'before_restore'), created_by: req.userId },
        },
      });
      return tx.entity.findUnique({ where: { id: source.id } });
    });
    return res.json(formatEntity(restored));
  } catch (err) {
    return next(err);
  }
});

// --- Filter (must be registered before /:type/:id to avoid route collision) ---
router.post('/:type/filter', authenticateToken, async (req, res, next) => {
  try {
    const { _limit, _offset, _orderBy, ...filterFields } = req.body;
    const take = clampLimit(_limit);
    const skip = typeof _offset === 'number' ? _offset : 0;
    const orderBy = resolveOrderBy(_orderBy);

    if (req.params.type === 'User') {
      // Listing users is admin-only.
      if (!isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, name: true, full_name: true, avatar: true,
          role: true, premium: true, premium_until: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
          is_banned: true, banned_at: true,
        },
        orderBy,
        take,
        skip,
      });
      return res.json(users.map(sanitizeUser));
    }
    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' is available only through its dedicated API.` });
    }

    const where = { type: req.params.type };
    if (!PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      where.userId = req.userId;
    }

    const conditions = [];
    for (const [key, value] of Object.entries(filterFields)) {
      if (key === 'user_id' || key === 'userId') {
        // Non-admin callers can never use user_id to read someone else's
        // entities; the auth-context userId is already pinned above. But
        // admins legitimately need this for support tasks (e.g. fetching
        // a target user's last activity from AdminMessages) so we honour
        // the filter for them only.
        if (isAdmin(req) && value) {
          where.userId = String(value);
        }
        continue;
      }
      if (value !== undefined && value !== null) {
        conditions.push({ data: { path: [key], equals: value } });
      }
    }
    if (conditions.length > 0) where.AND = conditions;

    const entities = await prisma.entity.findMany({
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
      where,
      orderBy,
      take,
      skip,
    });
    res.json(entities.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Bulk create (uses transaction for atomicity) ---
const MAX_BULK_ITEMS = 200;

router.post('/:type/bulk', authenticateToken, async (req, res, next) => {
  try {
    // Public reference types (Verse) must not be writable by ordinary users —
    // those rows are world-readable, so a non-admin could otherwise inject
    // fake "Bible" data that every user sees.
    if (PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      return res.status(403).json({ message: `Creating '${req.params.type}' entities is not permitted.` });
    }
    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' cannot be created through the generic entity API.` });
    }

    const items = req.body.items || req.body;
    const arr = Array.isArray(items) ? items : [items];
    // Bound the batch so one request can't open a giant transaction that holds
    // locks / drains the connection pool for everyone else.
    if (arr.length > MAX_BULK_ITEMS) {
      return res.status(400).json({ message: `Too many items; max ${MAX_BULK_ITEMS} per bulk request.` });
    }
    const now = new Date().toISOString();

    // Validate every item BEFORE we open the transaction so a partial
    // batch never lands in the DB.
    const validated = await Promise.all(arr.map((rawItem) => {
      // Strip client-supplied user_id / userId so a caller can't claim
      // they're creating an entity on someone else's behalf.
      // eslint-disable-next-line no-unused-vars
      const { user_id, userId, id, ...item } = rawItem || {};
      return applyScriptureGate(req, req.params.type, validateEntityPayload(req.params.type, item));
    }));

    const created = await prisma.$transaction(
      validated.map((item) =>
        prisma.entity.create({
          data: {
            type: req.params.type,
            userId: req.userId,
            data: { ...item, user_id: req.userId, created_date: now },
          },
        })
      )
    );

    res.json(created.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Create ---
router.post('/:type', authenticateToken, async (req, res, next) => {
  try {
    // Public reference types (Verse) are read-only for non-admins — see bulk.
    if (PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      return res.status(403).json({ message: `Creating '${req.params.type}' entities is not permitted.` });
    }
    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' cannot be created through the generic entity API.` });
    }
    // eslint-disable-next-line no-unused-vars
    const { user_id, userId, id, ...rawBody } = req.body || {};
    const body = await applyScriptureGate(
      req,
      req.params.type,
      validateEntityPayload(req.params.type, rawBody),
    );
    const entity = await prisma.entity.create({
      data: {
        type: req.params.type,
        userId: req.userId,
        data: { ...body, user_id: req.userId, created_date: new Date().toISOString() },
      },
    });
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- List (with default pagination) ---
router.get('/:type', authenticateToken, async (req, res, next) => {
  try {
    const take = clampLimit(Number(req.query.limit) || DEFAULT_PAGE_SIZE);
    const skip = Number(req.query.offset) || 0;

    if (req.params.type === 'User') {
      if (!isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
      const users = await prisma.user.findMany({
        select: {
          id: true, email: true, name: true, full_name: true, avatar: true,
          role: true, premium: true, premium_until: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
          is_banned: true, banned_at: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
      return res.json(users.map(sanitizeUser));
    }
    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' is available only through its dedicated API.` });
    }

    const where = { type: req.params.type };
    if (!PUBLIC_TYPES.has(req.params.type) && !isAdmin(req)) {
      where.userId = req.userId;
    }

    const entities = await prisma.entity.findMany({
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    res.json(entities.map(formatEntity));
  } catch (err) {
    next(err);
  }
});

// --- Get single ---
router.get('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      if (!isAdmin(req) && req.params.id !== req.userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(sanitizeUser(user));
    }
    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' is available only through its dedicated API.` });
    }

    const entity = await prisma.entity.findUnique({ where: { id: req.params.id } });
    if (!entity) return res.status(404).json({ message: 'Not found' });

    if (!PUBLIC_TYPES.has(entity.type) && entity.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- Update ---
router.put('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      return requireAdmin(req, res, async () => {
        try {
          // Block client-supplied role/premium/email/password from a
          // generic entity-update path; admins must use /api/auth/users.
          const { password: _p, role: _r, premium: _pr, email: _e, ...safe } = req.body || {};
          const user = await prisma.user.update({ where: { id: req.params.id }, data: safe });
          res.json(sanitizeUser(user));
        } catch (err) { next(err); }
      });
    }

    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' cannot be updated through the generic entity API.` });
    }

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, data: true, userId: true, createdAt: true, updatedAt: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // Reject a type/id mismatch BEFORE any validation. Previously the handler
    // fetched by id and then validated + gated using the URL's `:type`. A caller
    // could PUT /api/entities/<non-gated-type>/<gatedRowId> so the gated row was
    // validated with a permissive schema and skipped the Scripture gate
    // entirely, then merged the patch into the gated record. The stored type is
    // authoritative: the URL type must match it, and ALL downstream validation
    // and gating is driven from `existing.type`, never `req.params.type`.
    if (existing.type !== req.params.type) {
      return res.status(404).json({ message: 'Not found' });
    }
    const storedType = existing.type;

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only update your own items' });
    }

    // eslint-disable-next-line no-unused-vars
    const { user_id, userId, id, ...rawPatch } = req.body || {};

    // Validate the patch against the entity-type schema. We allow partial
    // updates by validating ONLY the keys the caller is sending against a
    // `.partial()` version of the schema. The full record on disk remains
    // valid because we already validated it on create.
    const schema = ENTITY_SCHEMAS[storedType];
    let patch = normalizeRetiredWorkflowInput(storedType, rawPatch);
    if (schema) {
      const partial = schema.partial();
      const parsed = partial.safeParse(patch);
      if (!parsed.success) {
        return res.status(400).json({
          message: `Invalid ${storedType} update: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          issues: parsed.error.issues,
        });
      }
      patch = parsed.data;
    }

    patch = await applyScriptureGate(req, storedType, patch, existing.data, existing.userId);
    // Scripture-gated updates return the complete sanitized record so fields
    // retired from older deployments are actually removed, not restored by a
    // second merge with the stored JSON here.
    const nextData = SCRIPTURE_GATED_TYPES.has(storedType)
      ? patch
      : { ...existing.data, ...patch };

    const updateOperation = prisma.entity.update({
      where: { id: req.params.id },
      data: { data: { ...nextData, updated_date: new Date().toISOString() } },
    });
    let entity;
    if (REVISIONED_TYPES.has(storedType)) {
      [entity] = await prisma.$transaction([
        updateOperation,
        prisma.entity.create({
          data: {
            type: 'EntityRevision',
            userId: existing.userId,
            data: { ...revisionPayload(existing), created_by: req.userId },
          },
        }),
      ]);
    } else {
      entity = await updateOperation;
    }
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- Delete ---
router.delete('/:type/:id', authenticateToken, async (req, res, next) => {
  try {
    if (req.params.type === 'User') {
      return requireAdmin(req, res, async () => {
        try {
          await prisma.user.delete({ where: { id: req.params.id } });
          res.status(204).send();
        } catch (err) { next(err); }
      });
    }


    if (SERVER_MANAGED_TYPES.has(req.params.type)) {
      return res.status(403).json({ message: `'${req.params.type}' cannot be deleted through the generic entity API.` });
    }

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, userId: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // The stored row type is authoritative. Without this check, disguising a
    // server-managed row behind a mutable URL type could bypass the guard
    // above because deletion itself is keyed only by the globally unique ID.
    if (existing.type !== req.params.type) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only delete your own items' });
    }

    const deleteSource = prisma.entity.delete({ where: { id: req.params.id } });
    if (REVISIONED_TYPES.has(existing.type)) {
      await prisma.$transaction([
        prisma.entity.deleteMany({
          where: {
            type: 'EntityRevision',
            userId: existing.userId,
            AND: [
              { data: { path: ['source_type'], equals: existing.type } },
              { data: { path: ['source_id'], equals: existing.id } },
            ],
          },
        }),
        deleteSource,
      ]);
    } else {
      await deleteSource;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

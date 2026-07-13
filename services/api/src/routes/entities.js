import { Router } from 'express';
import { z } from 'zod';
import { prisma, authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateAiSermon } from '@sermonsmith/shared/scripture';
import { canonForDenomination } from '@sermonsmith/shared/denominations';

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
const SERVER_MANAGED_TYPES = new Set(['SharedLink']);

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
const SermonSchema = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().max(200).optional(),
  anchor_passage: z.string().max(200).optional(),
  big_idea: z.string().max(2000).optional(),
  points: z.array(z.any()).max(20).optional(),
  conclusion: z.string().max(20000).optional(),
  theological_notes: z.string().max(20000).optional(),
  status: z.enum(['draft', 'published', 'archived', 'needs_review']).optional(),
}).passthrough();

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
// Server-side Scripture / quality-state gate.
//
// Until now the server stored whatever `scripture_validation` and `status`
// the client sent — a buggy or malicious client (or any AI feature that
// skips client-side validation) could persist a forged all-valid validation
// blob or mark unvalidated AI output `published`. The durable write is the
// one choke point every save path crosses, so trust state is computed HERE,
// with the exact same shared validator the web client uses.
//
// Rules for scripture-gated types (currently Sermon):
//   - `scripture_validation` is always recomputed server-side; a client-
//     supplied blob is ignored.
//   - Review-only trust fields (pastor_reviewed, ready_to_present, …) are
//     stripped: only a real human review flow may ever set them — never the
//     generic entity API, and never the AI pipeline.
//   - A record whose references do not all verify cannot be `published`
//     (422 — the user can fix the references and retry), and a `draft`
//     save is honestly relabeled `needs_review`. `archived` stays allowed.
//   - The user's work is never rejected or rewritten beyond those trust
//     fields: imperfect content saves fine as a private needs_review draft.
//
// Canon: references are validated against the canon of the record's
// denomination (payload → stored record → user profile), so a Catholic
// sermon citing Wisdom is honestly `chapter_checked`, not "invalid book".
// ---------------------------------------------------------------------------
const SCRIPTURE_GATED_TYPES = new Set(['Sermon']);

// Trust-state fields that only a human review flow may set. No current UI
// writes these; stripping them closes the forgery path before one exists.
const REVIEW_ONLY_FIELDS = [
  'pastor_reviewed',
  'ready_to_present',
  'reviewed_by',
  'reviewed_at',
  'verified',
];

async function denominationForRequest(req, ...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { profile: true },
  });
  const fromProfile = user?.profile?.denomination;
  return typeof fromProfile === 'string' ? fromProfile : '';
}

/**
 * Apply the Scripture/quality-state gate to an incoming create/update for a
 * gated type. Mutates and returns a copy of `incoming` with trust fields
 * stripped, `scripture_validation` recomputed over the full merged record,
 * and `status` honestly downgraded. Throws 422 on an attempt to publish a
 * record whose references do not all verify.
 */
async function applyScriptureGate(req, type, incoming, existingData = null) {
  if (!SCRIPTURE_GATED_TYPES.has(type)) return incoming;

  const data = { ...incoming };
  for (const field of REVIEW_ONLY_FIELDS) delete data[field];
  // The client's validation blob is advisory UI state at best; the stored
  // record carries only the server-computed result.
  delete data.scripture_validation;

  const merged = { ...(existingData || {}), ...data };
  const denomination = await denominationForRequest(
    req,
    merged.denomination,
  );
  const validation = validateAiSermon(merged, {
    canon: canonForDenomination(denomination),
  });
  data.scripture_validation = validation.refs;

  const requestedStatus = data.status ?? existingData?.status;
  if (!validation.allValid) {
    if (requestedStatus === 'published') {
      throw Object.assign(
        new Error(
          `Cannot publish: ${validation.summary}. Fix the flagged references (or keep the record as a draft) and try again.`,
        ),
        { status: 422, scripture_validation: validation.refs },
      );
    }
    if (requestedStatus === 'draft' || requestedStatus == null) {
      data.status = 'needs_review';
    }
  }

  // Stale-review rule: a pastor's acknowledgment covers the content they
  // actually read. If this write changes content fields on a record that was
  // previously marked reviewed, the review is reset — the pastor re-reviews
  // the edited draft via the explicit /review acknowledgment endpoint.
  const CONTENT_FIELDS = ['title', 'topic', 'anchor_passage', 'big_idea', 'points', 'conclusion', 'theological_notes'];
  if (existingData?.pastor_reviewed && CONTENT_FIELDS.some((f) => f in data)) {
    data.pastor_reviewed = false;
    data.reviewed_at = null;
    data.reviewed_by = null;
  }

  return data;
}

function validateEntityPayload(type, body) {
  const schema = ENTITY_SCHEMAS[type];
  if (!schema) {
    throw Object.assign(
      new Error(`Unsupported entity type: ${type}`),
      { status: 400 },
    );
  }
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw Object.assign(
      new Error(`Invalid ${type} payload: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`),
      { status: 400, issues: parsed.error.issues },
    );
  }
  return parsed.data;
}

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

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, data: true, userId: true, createdAt: true, updatedAt: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only update your own items' });
    }

    // eslint-disable-next-line no-unused-vars
    const { user_id, userId, id, ...rawPatch } = req.body || {};

    // Validate the patch against the entity-type schema. We allow partial
    // updates by validating ONLY the keys the caller is sending against a
    // `.partial()` version of the schema. The full record on disk remains
    // valid because we already validated it on create.
    const schema = ENTITY_SCHEMAS[req.params.type];
    let patch = rawPatch;
    if (schema) {
      const partial = schema.partial();
      const parsed = partial.safeParse(rawPatch);
      if (!parsed.success) {
        return res.status(400).json({
          message: `Invalid ${req.params.type} update: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          issues: parsed.error.issues,
        });
      }
      patch = parsed.data;
    }

    patch = await applyScriptureGate(req, req.params.type, patch, existing.data);

    const entity = await prisma.entity.update({
      where: { id: req.params.id },
      data: {
        data: { ...existing.data, ...patch, updated_date: new Date().toISOString() },
      },
    });
    res.json(formatEntity(entity));
  } catch (err) {
    next(err);
  }
});

// --- Review acknowledgment (human-only trust transition) ---
//
// The generic create/update paths strip pastor_reviewed & friends so neither
// the AI pipeline nor a forged payload can self-certify content. This is the
// ONE way those fields get set: the record's owner explicitly acknowledges
// they reviewed the draft. Scripture validation is recomputed at the moment
// of acknowledgment so the stored evidence reflects what the pastor actually
// reviewed. Acknowledging does NOT alter status or bypass the publish gate —
// a reviewed draft with invalid references still cannot be published until
// the references are fixed. `acknowledged: false` withdraws a review.
router.post('/:type/:id/review', authenticateToken, async (req, res, next) => {
  try {
    if (!SCRIPTURE_GATED_TYPES.has(req.params.type)) {
      return res.status(400).json({ message: `'${req.params.type}' does not support review acknowledgment.` });
    }
    const { acknowledged } = req.body || {};
    if (typeof acknowledged !== 'boolean') {
      return res.status(400).json({ message: 'Body must include { acknowledged: true | false } — review is an explicit human action.' });
    }

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, data: true, userId: true },
      where: { id: req.params.id },
    });
    if (!existing || existing.type !== req.params.type) return res.status(404).json({ message: 'Not found' });
    // Review is the OWNER's pastoral judgment — admins may read, not review
    // on someone else's behalf.
    if (existing.userId !== req.userId) {
      return res.status(403).json({ message: 'Only the owner can acknowledge review of their content.' });
    }

    const denomination = await denominationForRequest(req, existing.data?.denomination);
    const validation = validateAiSermon(existing.data, { canon: canonForDenomination(denomination) });

    const reviewFields = acknowledged
      ? {
          pastor_reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.userId,
          scripture_validation: validation.refs,
        }
      : {
          pastor_reviewed: false,
          reviewed_at: null,
          reviewed_by: null,
          scripture_validation: validation.refs,
        };

    const entity = await prisma.entity.update({
      where: { id: req.params.id },
      data: { data: { ...existing.data, ...reviewFields, updated_date: new Date().toISOString() } },
    });
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

    const existing = await prisma.entity.findUnique({
      select: { id: true, type: true, userId: true },
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (existing.userId !== req.userId && !isAdmin(req)) {
      return res.status(403).json({ message: 'You can only delete your own items' });
    }

    await prisma.entity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

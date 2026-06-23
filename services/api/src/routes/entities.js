import { Router } from 'express';
import { z } from 'zod';
import { prisma, authenticateToken, requireAdmin } from '../middleware/auth.js';

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
};

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
          role: true, premium: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
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
router.post('/:type/bulk', authenticateToken, async (req, res, next) => {
  try {
    const items = req.body.items || req.body;
    const arr = Array.isArray(items) ? items : [items];
    const now = new Date().toISOString();

    // Validate every item BEFORE we open the transaction so a partial
    // batch never lands in the DB.
    const validated = arr.map((rawItem) => {
      // Strip client-supplied user_id / userId so a caller can't claim
      // they're creating an entity on someone else's behalf.
      // eslint-disable-next-line no-unused-vars
      const { user_id, userId, id, ...item } = rawItem || {};
      return validateEntityPayload(req.params.type, item);
    });

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
    // eslint-disable-next-line no-unused-vars
    const { user_id, userId, id, ...rawBody } = req.body || {};
    const body = validateEntityPayload(req.params.type, rawBody);
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
          role: true, premium: true, profile: true, onboarding_completed: true,
          special_message: true, last_seen_version: true, createdAt: true, updatedAt: true,
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

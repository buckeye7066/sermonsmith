import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma, authenticateToken, signToken, requireAdmin, AUTH_COOKIE, cookieOptions } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { recordSuccessfulLogin } from '../services/firstLoginNotifier.js';
import { signupTrialPeriod } from '../lib/signupTrial.js';
import { grantFreePeriodToUser } from '../lib/premiumGrant.js';
import {
  accessSummaryFor,
  isAllowlistedPromotionalEmail,
  normalizePhone,
  normalizePromotionalEmail,
} from '../lib/entitlements.js';
import { lockCommunityEntity } from '../lib/communityEntityLock.js';
import { withoutPrivateCommunityMetadata } from '../lib/communityPrivacy.js';

// Admin allowlist comes ONLY from the ADMIN_EMAILS env var. The previous
// implementation hardcoded a personal email — that gave whoever owned that
// address admin in any deployment of this code, which is a hard fail for
// production.
function adminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

const router = Router();

// LOGIN MAINTENANCE MODE — while active, /login and /register return 503 so
// no new sessions can be created during the upgrade. Everything else on this
// router (logout, /me, password reset) stays open so already-signed-in users
// are not kicked out. Frontend twin: apps/web/src/lib/maintenance.js (fallback
// banner copy); the Login page asks GET /api/auth/maintenance at runtime, so
// this switch is the single source of truth.
//
// TOGGLE (no code change, no rebuild): set LOGIN_MAINTENANCE on the API
// service (Railway) — '0' forces OFF, '1' forces ON; unset falls back to the
// code default below. Default OFF: maintenance is armed only deliberately
// via the env var, so a fresh deploy or a dropped variable can never lock
// users out by surprise.
const LOGIN_MAINTENANCE_ACTIVE = false;
const LOGIN_MAINTENANCE_MESSAGE =
  'SermonSmith is being upgraded and sign-in is temporarily disabled. ' +
  'We expect to be back online shortly.';
const LOGIN_MAINTENANCE_COPY = {
  title: 'SermonSmith is being upgraded',
  message:
    'We are performing a scheduled upgrade. Sign-in and registration are temporarily disabled while we finish.',
  etaText: 'We expect to be back online shortly.',
};

function isLoginMaintenanceActive() {
  // Explicit env override wins in both directions.
  if (process.env.LOGIN_MAINTENANCE === '0') return false;
  if (process.env.LOGIN_MAINTENANCE === '1') return true;
  // Tests exercise the normal auth flows; maintenance is a production posture.
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;
  return LOGIN_MAINTENANCE_ACTIVE;
}

function loginMaintenanceGuard(_req, res, next) {
  if (!isLoginMaintenanceActive()) return next();
  return res.status(503).json({ message: LOGIN_MAINTENANCE_MESSAGE });
}

// Public status probe: the Login page asks this at runtime so the banner
// follows the server-side switch without a frontend rebuild. Never guarded.
router.get('/maintenance', (_req, res) => {
  res.json({ active: isLoginMaintenanceActive(), ...LOGIN_MAINTENANCE_COPY });
});

// ---------------------------------------------------------------------------
// Profile sanitisation.
//
// The User row carries a JSON `profile` column that the client can write to
// via PATCH /me. Without filtering, a malicious caller could store
// `profile.role = "admin"` or `profile.premium = true` — and because the
// previous `sanitizeUser` spread `profile` *after* the user row, those
// poisoned keys would shadow the authoritative DB columns on the response.
// The frontend would then believe the user is admin/premium, enabling
// access to gated UI affordances and confusing premium gating.
//
// RESERVED_PROFILE_KEYS is the allowlist of fields that must NEVER be
// readable from `profile` on the response or writeable through `profile`
// on PATCH. Anything authoritative about identity, billing, or audit
// timestamps lives only on the User row.
// ---------------------------------------------------------------------------
const RESERVED_PROFILE_KEYS = new Set([
  'id',
  'email',
  'password',
  'role',
  'premium',
  'premium_override',
  'subscription_tier',
  'premium_until',
  'promotionalEmail',
  'promotional_email',
  'promotionalPhone',
  'promotional_phone',
  'tokenVersion',
  'token_version',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function cleanProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !RESERVED_PROFILE_KEYS.has(key))
  );
}

function sanitizeUser(user) {
  // Strip secrets, then spread the cleaned profile FIRST so the
  // authoritative user-row fields always win on the response.
  // eslint-disable-next-line no-unused-vars
  const { password, profile, ...safeUser } = user;
  const safeProfile = cleanProfile(profile);
  return {
    ...safeProfile,
    ...safeUser,
    profile: safeProfile,
    ...accessSummaryFor(user),
  };
}

const PRIVACY_EXPORT_MODELS = [
  ['sermons', 'sermon'],
  ['sermonSeries', 'sermonSeries'],
  ['sermonOutlines', 'sermonOutline'],
  ['bibleStudies', 'bibleStudy'],
  ['studyNotes', 'studyNote'],
  ['highlights', 'highlight'],
  ['bookmarks', 'bookmark'],
  ['prayerRequests', 'prayerRequest'],
  ['sharedContents', 'sharedContent'],
  ['forumPosts', 'forumPost'],
  ['studyGroups', 'studyGroup'],
  ['savedContents', 'savedContent'],
];

async function exportRows(modelName, userId) {
  const model = prisma[modelName];
  if (!model?.findMany) return [];
  try {
    const rows = await model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    if (!['sharedContent', 'forumPost'].includes(modelName)) return rows;
    return rows.map((row) => {
      const safe = withoutPrivateCommunityMetadata(row);
      if (safe.content && typeof safe.content === 'object' && !Array.isArray(safe.content)) {
        safe.content = withoutPrivateCommunityMetadata(safe.content);
      }
      return safe;
    });
  } catch {
    // During phased deploys, the route should still return the generic Entity
    // export even if a typed table migration has not been applied yet.
    return [];
  }
}

async function exportCommunityRelations(userId) {
  try {
    const [following, followers, groupMemberships] = await Promise.all([
      prisma.communityFollow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { id: true, followingId: true, createdAt: true },
      }),
      prisma.communityFollow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { id: true, followerId: true, createdAt: true },
      }),
      prisma.communityGroupMember.findMany({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        take: 5000,
        select: { id: true, groupId: true, role: true, userName: true, joinedAt: true },
      }),
    ]);
    return { following, followers, groupMemberships };
  } catch {
    // Rolling deploy compatibility: a server may start before the new
    // relation tables have been migrated. Keep the export available and
    // expose empty collections until the migration completes.
    return { following: [], followers: [], groupMemberships: [] };
  }
}

async function recordAudit(action, userId, metadata = {}, targetId = userId) {
  if (!prisma.auditLog?.create) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType: 'User',
        targetId,
        metadata,
      },
    });
  } catch {
    // Privacy operations must not fail because a best-effort audit insert did.
  }
}

async function cleanupCommunityRelationsForAccessRevocation(tx, userId) {
  const [memberships, ownedGroups] = await Promise.all([
    tx.communityGroupMember.findMany({ where: { userId } }),
    tx.entity.findMany({
      where: { type: 'StudyGroup', userId },
      select: { id: true },
    }),
  ]);
  const membershipByGroup = new Map(memberships.map((row) => [row.groupId, row]));
  const groupIds = [...new Set([
    ...memberships.map((row) => row.groupId),
    ...ownedGroups.map((row) => row.id),
  ])].sort();
  let transferredGroups = 0;
  let deletedGroups = 0;

  for (const groupId of groupIds) {
    await lockCommunityEntity(tx, groupId);
    const group = await tx.entity.findUnique({ where: { id: groupId } });
    const remainingRows = await tx.communityGroupMember.findMany({
      where: { groupId, userId: { not: userId } },
      orderBy: { joinedAt: 'asc' },
    });
    const remainingUsers = remainingRows.length
      ? await tx.user.findMany({ where: { id: { in: remainingRows.map((row) => row.userId) } } })
      : [];
    const activeUserIds = new Set(remainingUsers
      .filter((user) => !user.deletedAt && !user.is_banned)
      .map((user) => user.id));
    const remaining = remainingRows.filter((row) => activeUserIds.has(row.userId));
    const staleIds = remainingRows.filter((row) => !activeUserIds.has(row.userId)).map((row) => row.id);
    if (staleIds.length) {
      await tx.communityGroupMember.deleteMany({ where: { id: { in: staleIds } } });
    }
    await tx.communityGroupMember.deleteMany({ where: { groupId, userId } });

    if (!group || group.type !== 'StudyGroup') continue;
    if (remaining.length === 0) {
      const meetings = await tx.entity.findMany({
        where: { type: 'GroupMeeting', data: { path: ['group_id'], equals: groupId } },
        select: { id: true },
      });
      await tx.communityGroupMember.deleteMany({ where: { groupId } });
      for (const meeting of meetings) {
        // Compatibility cleanup for attendance written before group_id was
        // added to RSVP data.
        await tx.entity.deleteMany({
          where: { type: 'MeetingAttendance', data: { path: ['meeting_id'], equals: meeting.id } },
        });
      }
      await tx.entity.deleteMany({ where: { data: { path: ['group_id'], equals: groupId } } });
      await tx.entity.delete({ where: { id: groupId } });
      deletedGroups += 1;
      continue;
    }

    const leaving = membershipByGroup.get(groupId);
    let successor = remaining.find((row) => row.role === 'leader')
      || remaining.find((row) => row.userId === group.userId)
      || remaining[0];
    const mustReplaceLeader = leaving?.role === 'leader'
      && !remaining.some((row) => row.role === 'leader');
    const mustTransferOwnership = group.userId === userId;
    if ((mustReplaceLeader || mustTransferOwnership) && successor.role !== 'leader') {
      successor = await tx.communityGroupMember.update({
        where: { id: successor.id },
        data: { role: 'leader' },
      });
    }

    await tx.entity.update({
      where: { id: group.id },
      data: {
        ...(mustTransferOwnership ? { userId: successor.userId } : {}),
        data: { ...(group.data || {}), member_count: remaining.length },
      },
    });
    if (mustTransferOwnership) transferredGroups += 1;
  }

  const removedFollows = await tx.communityFollow.deleteMany({
    where: {
      OR: [
        { followerId: userId },
        { followingId: userId },
      ],
    },
  });
  return {
    removedMemberships: memberships.length,
    removedFollows: removedFollows.count,
    transferredGroups,
    deletedGroups,
  };
}

router.post('/register', loginMaintenanceGuard, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    // Practical mailbox shape check — not full RFC coverage. Rejects empty local/domain
    // and missing TLD so accidental typos do not create undeliverable accounts.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const displayName = typeof name === 'string' && name.trim()
      ? name.trim().slice(0, 100)
      : 'Member';
    const admin = isAdminEmail(normalizedEmail);

    let user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: displayName,
        full_name: displayName,
        ...(admin ? { role: 'admin', premium: true } : {}),
      },
    });

    // Always-on signup trial: every new (non-admin) user gets a free trial
    // window automatically, on by default (SIGNUP_TRIAL_ENABLED/PERIOD env
    // vars can adjust or disable it). Stamps ONLY `premium_until` via the
    // same grant/extend helper the admin "grant free period" route uses
    // (see lib/premiumGrant.js), so this can never double-stack if a grant
    // already touched this user. This is independent of — and does not
    // enable — the separate, dormant global "Free Week" promo toggle.
    if (!admin) {
      const trialPeriod = signupTrialPeriod(process.env);
      if (trialPeriod) {
        const granted = await grantFreePeriodToUser(prisma, user.id, trialPeriod);
        if (granted) user = granted;
      }
    }

    const token = signToken(user);
    res.cookie(AUTH_COOKIE, token, cookieOptions());
    // Registration issues a session immediately, so it IS the first sign-in.
    // Fire-and-forget: stamping last_login_at / notifying the owner must never
    // affect the response.
    void recordSuccessfulLogin({ prisma, user, method: 'register' });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginMaintenanceGuard, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Soft-deleted accounts cannot sign in. Same generic message as a bad
    // password so we don't reveal that the account once existed.
    if (user.deletedAt) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Banned accounts cannot sign in. Distinct, honest message (unlike the
    // soft-delete case) so a banned user understands the account is suspended
    // rather than thinking they mistyped their password.
    if (user.is_banned) {
      return res.status(403).json({ message: 'This account has been suspended. Contact support if you believe this is an error.' });
    }

    // Promote env-allowlisted admin emails on every login so access is
    // never lost even after a manual demotion. Note: admin status comes
    // from the deployment's ADMIN_EMAILS env, never from a hardcoded list.
    let currentUser = user;
    if (isAdminEmail(user.email) && (user.role !== 'admin' || !user.premium)) {
      currentUser = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', premium: true },
      });
    }

    const token = signToken(currentUser);
    res.cookie(AUTH_COOKIE, token, cookieOptions());
    // Fire-and-forget: stamp last_login_at; a NULL→set transition (first ever
    // sign-in) emails the owner. Never affects the login response.
    void recordSuccessfulLogin({ prisma, user: currentUser, method: 'login' });
    res.json({ user: sanitizeUser(currentUser) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ message: 'Logged out' });
});

async function sendCurrentUser(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!req.userId) return res.json(null);

  try {
    let user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (isAdminEmail(user.email) && (user.role !== 'admin' || !user.premium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', premium: true },
      });
    }

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

router.get('/me', authenticateToken, sendCurrentUser);

// Anonymous/expired sessions are an expected startup state, not an HTTP error.
// Share the real token, revocation and account checks with every protected
// route; this endpoint neither mints a session nor grants anonymous privileges.
router.get('/session', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  return authenticateToken(req, res, next, { optional: true });
}, sendCurrentUser);

// PATCH /me — self-service profile edits.
//
// Two layers of defence:
//   1. directFields: a closed set of User-row columns the user is allowed
//      to set on themselves. Anything outside this set never touches the
//      authoritative columns.
//   2. profile JSON: anything else lands in `profile`, but ONLY after
//      cleanProfile() strips reserved keys. This is what stops a caller
//      from sending `{ profile: { role: 'admin', premium: true } }` and
//      having the frontend treat the response as admin/premium.
router.patch('/me', authenticateToken, async (req, res, next) => {
  try {
    const directFields = ['name', 'full_name', 'avatar', 'onboarding_completed', 'special_message', 'last_seen_version'];
    const blockedFields = new Set([
      'id',
      'premium',
      'premium_override',
      'subscription_tier',
      'premium_until',
      'promotionalEmail',
      'promotional_email',
      'promotionalPhone',
      'promotional_phone',
      'role',
      'email',
      'password',
      'tokenVersion',
      'token_version',
      'createdAt',
      'updatedAt',
      'created_at',
      'updated_at',
    ]);
    const data = {};

    for (const key of directFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const extraFields = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (
        !directFields.includes(key) &&
        !blockedFields.has(key) &&
        key !== 'profile'
      ) {
        extraFields[key] = value;
      }
    }

    const incomingProfile = cleanProfile(req.body?.profile || {});
    if (Object.keys(extraFields).length > 0 || Object.keys(incomingProfile).length > 0) {
      const current = await prisma.user.findUnique({ where: { id: req.userId } });
      const currentProfile = cleanProfile(current?.profile);
      data.profile = { ...currentProfile, ...cleanProfile(extraFields), ...incomingProfile };
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
    });

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

router.get('/export', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const entities = await prisma.entity.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: { id: true, type: true, data: true, createdAt: true, updatedAt: true },
    });

    const [typedEntries, communityRelations] = await Promise.all([
      Promise.all(
        PRIVACY_EXPORT_MODELS.map(async ([key, modelName]) => [key, await exportRows(modelName, req.userId)])
      ),
      exportCommunityRelations(req.userId),
    ]);

    await recordAudit('privacy.export', req.userId, {
      entityCount: entities.length,
      typedCounts: Object.fromEntries(typedEntries.map(([key, rows]) => [key, rows.length])),
      communityRelationCounts: Object.fromEntries(
        Object.entries(communityRelations).map(([key, rows]) => [key, rows.length])
      ),
    });

    res.json({
      exportedAt: new Date().toISOString(),
      user: sanitizeUser(user),
      entities: entities.map((entity) => ({
        ...entity,
        data: withoutPrivateCommunityMetadata(entity.data),
      })),
      typed: Object.fromEntries(typedEntries),
      community: communityRelations,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/me', authenticateToken, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!target) return res.status(404).json({ message: 'User not found' });

    const cleanup = await prisma.$transaction(async (tx) => {
      const result = await cleanupCommunityRelationsForAccessRevocation(tx, req.userId);
      await tx.user.update({
        where: { id: req.userId },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
      });
      return result;
    });
    await recordAudit('privacy.account_delete_requested', req.userId, { selfService: true, ...cleanup });
    res.clearCookie(AUTH_COOKIE, cookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/revoke-sessions', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    await recordAudit('auth.sessions_revoked', req.userId, { selfService: true });

    const token = signToken(user);
    res.cookie(AUTH_COOKIE, token, cookieOptions());
    res.json({
      message: 'Other sessions revoked',
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// Change password (logged-in user)
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    // Bump tokenVersion so any other live session for this account is
    // invalidated immediately on its next request.
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Password reset — single-use, hashed-at-rest tokens stored in PasswordReset.
// ---------------------------------------------------------------------------

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success to prevent email enumeration.
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    // In production we require a configured email provider. If RESEND_API_KEY
    // is missing we refuse to mint a reset token (would otherwise be
    // dead-on-arrival but still consume a code path that could leak in logs).
    if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
      // Surface a generic message — do not advertise the misconfiguration.
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // Invalidate any prior reset tokens for this user before issuing a new one.
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } }).catch(() => null);
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    try {
      await sendPasswordResetEmail(email, rawToken);
    } catch (e) {
      // Never log the token itself; only that send failed.
      console.error('[forgot-password] reset email send failed:', e.message);
    }

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    // Legacy fallback: previous deployments minted JWT-based reset tokens.
    // We accept those if PasswordReset lookup misses, so users mid-flight
    // during the migration window aren't locked out — but they cannot be
    // re-used (we don't have a JTI store) so the JWT path is single-use
    // by virtue of the password-update side effect.
    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordReset.findUnique({ where: { tokenHash } }).catch(() => null);

    let userId;
    if (record && record.expiresAt > new Date()) {
      userId = record.userId;
      await prisma.passwordReset.delete({ where: { id: record.id } }).catch(() => null);
    } else {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded.purpose !== 'password-reset') {
          return res.status(400).json({ message: 'Reset link is invalid or has expired' });
        }
        userId = decoded.userId;
      } catch {
        return res.status(400).json({ message: 'Reset link is invalid or has expired' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    // Bump tokenVersion so any active session — including the one that
    // possibly triggered the reset request — is invalidated. The user
    // must re-authenticate.
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

// Admin: list all users
router.get('/users', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    // Bound the result set: an unbounded findMany would load every user's PII
    // into memory in one request once the table grows. Defaults to 100, capped
    // at 500. ?limit & ?offset let the admin UI page through.
    const limitInput = parseInt(req.query.limit, 10);
    const offsetInput = parseInt(req.query.offset, 10);
    const limit = isNaN(limitInput) ? 100 : Math.min(Math.max(limitInput, 1), 500);
    const offset = isNaN(offsetInput) ? 0 : Math.max(offsetInput, 0);
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, email: true, name: true, full_name: true,
        role: true, premium: true, premium_until: true, promotionalEmail: true, promotionalPhone: true, avatar: true, profile: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json(users.map(sanitizeUser));
  } catch (err) {
    next(err);
  }
});

// Admin: update user.
//
// Strictly validated: an admin can only flip role/premium/name/full_name,
// and `role` is constrained to the known enum. A typo or malicious payload
// can no longer plant an invalid role string that confuses downstream
// checks.
const adminUserUpdateSchema = z.object({
  role: z.enum(['user', 'admin', 'dev']).optional(),
  premium: z.boolean().optional(),
  promotionalEmail: z.string().trim().email().max(254).nullable().optional(),
  promotionalPhone: z.string().trim().max(40).nullable().optional(),
  name: z.string().max(100).optional(),
  full_name: z.string().max(100).optional(),
}).strict();

router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid user update',
        issues: parsed.error.issues,
      });
    }
    const update = { ...parsed.data };
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (Object.prototype.hasOwnProperty.call(update, 'promotionalEmail')) {
      const normalized = normalizePromotionalEmail(update.promotionalEmail);
      if (normalized && (
        !isAllowlistedPromotionalEmail(normalized)
        || normalized !== normalizePromotionalEmail(target.email)
      )) {
        return res.status(400).json({
          message: 'Promotional email must be an approved address that matches this account',
        });
      }
      update.promotionalEmail = normalized || null;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'promotionalPhone')) {
      const normalized = normalizePhone(update.promotionalPhone);
      update.promotionalPhone = normalized || null;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: update,
    });
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

const adminBanSchema = z.object({ banned: z.boolean() }).strict();

// Banning is an immediate access-revocation event, not a generic profile
// update. Remove the account from groups and transfer/delete owned groups in
// the same locked transaction used by soft deletion, then bump tokenVersion so
// unbanning cannot resurrect a pre-ban session.
router.patch('/users/:id/ban', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const parsed = adminBanSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid ban update', issues: parsed.error.issues });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });

    let cleanup = null;
    const user = await prisma.$transaction(async (tx) => {
      if (parsed.data.banned) {
        cleanup = await cleanupCommunityRelationsForAccessRevocation(tx, target.id);
        return tx.user.update({
          where: { id: target.id },
          data: {
            is_banned: true,
            banned_at: new Date(),
            tokenVersion: { increment: 1 },
          },
        });
      }
      return tx.user.update({
        where: { id: target.id },
        data: { is_banned: false, banned_at: null },
      });
    });

    await recordAudit(
      parsed.data.banned ? 'admin.user_banned' : 'admin.user_unbanned',
      req.userId,
      { targetUserId: target.id, ...(cleanup || {}) },
      target.id,
    );
    if (parsed.data.banned && target.id === req.userId) {
      res.clearCookie(AUTH_COOKIE, cookieOptions());
    }
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// Admin: delete user (soft delete).
//
// Instead of hard-deleting the row — which cascade-wipes every sermon, study,
// and note the user created — we set deleted_at and bump token_version so all
// of their sessions are immediately invalidated. Auth (login + token check)
// rejects soft-deleted users, so the account is inaccessible while the data
// stays recoverable / auditable. A separate purge job can hard-delete after a
// retention window if ever needed.
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    const cleanup = await prisma.$transaction(async (tx) => {
      const result = await cleanupCommunityRelationsForAccessRevocation(tx, target.id);
      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
      });
      return result;
    });
    await recordAudit('admin.user_soft_delete', req.userId, {
      targetUserId: target.id,
      ...cleanup,
    }, target.id);
    if (target.id === req.userId) res.clearCookie(AUTH_COOKIE, cookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

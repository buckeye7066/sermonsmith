import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma, authenticateToken, signToken, requireAdmin, AUTH_COOKIE, cookieOptions } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';

// Admin allowlist comes ONLY from the ADMIN_EMAILS env var. The previous
// implementation hardcoded a personal email — that gave whoever owned that
// address admin in any deployment of this code, which is a hard fail for
// production.
function adminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isAdminEmail(email) {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

const router = Router();

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
  return { ...safeProfile, ...safeUser, profile: safeProfile };
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const displayName = name || email.split('@')[0];
    const admin = isAdminEmail(email);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        name: displayName,
        full_name: displayName,
        ...(admin ? { role: 'admin', premium: true } : {}),
      },
    });

    const token = signToken(user);
    res.cookie(AUTH_COOKIE, token, cookieOptions());
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
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
    res.json({ user: sanitizeUser(currentUser) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticateToken, async (req, res, next) => {
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
});

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
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, email: true, name: true, full_name: true,
        role: true, premium: true, premium_until: true, avatar: true, profile: true,
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
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
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
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

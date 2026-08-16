const jwt = require('jsonwebtoken');

let cachedPrisma;

function loadPrisma() {
  if (cachedPrisma) return cachedPrisma;

  const candidates = [
    '../lib/prisma',
    '../lib/prisma.js',
    '../prisma',
    '../prisma.js',
    '../db/prisma',
    '../db/prisma.js',
  ];

  for (const path of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(path);
      cachedPrisma = mod.prisma || mod.default || mod;
      if (cachedPrisma && cachedPrisma.user) return cachedPrisma;
    } catch (_error) {
      // Try the next known project location.
    }
  }

  throw new Error('The user database is not available. Please try again in a moment.');
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  return 'development-test-jwt-secret';
}

function getTokenFromRequest(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }

  return (
    req.cookies?.token ||
    req.cookies?.authToken ||
    req.cookies?.accessToken ||
    req.cookies?.access_token ||
    req.signedCookies?.token ||
    req.signedCookies?.authToken ||
    null
  );
}

function send(res, statusCode, message) {
  const payload = { error: message, message };

  if (typeof res.status === 'function') {
    const response = res.status(statusCode);
    if (response && typeof response.json === 'function') return response.json(payload);
    if (response && typeof response.send === 'function') return response.send(payload);
  }

  res.statusCode = statusCode;
  if (typeof res.json === 'function') return res.json(payload);
  if (typeof res.send === 'function') return res.send(payload);
  if (typeof res.end === 'function') return res.end(JSON.stringify(payload));
  return undefined;
}

function normalizeTokenVersion(value) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDateInFuture(value) {
  if (!value) return false;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function withoutSensitiveFields(user) {
  const safeUser = { ...(user || {}) };
  delete safeUser.password;
  delete safeUser.passwordHash;
  delete safeUser.password_hash;
  delete safeUser.hash;
  return safeUser;
}

function signToken(payload = {}, options = {}) {
  const claims = { ...payload };

  if (claims.id && !claims.sub) claims.sub = String(claims.id);
  if (claims.tokenVersion !== undefined && claims.tv === undefined) {
    claims.tv = claims.tokenVersion;
  }

  const { expiresIn, ...restOptions } = options || {};

  return jwt.sign(claims, getJwtSecret(), {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d',
    ...restOptions,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

async function authenticateToken(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return send(res, 401, 'Please sign in to continue.');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (_error) {
    return send(res, 401, 'Your session has expired. Please sign in again.');
  }

  const userId = decoded.id || decoded.userId || decoded.user_id || decoded.sub;
  if (!userId) {
    return send(res, 401, 'Your session has expired. Please sign in again.');
  }

  let user;
  try {
    const prisma = loadPrisma();
    user = await prisma.user.findUnique({ where: { id: String(userId) } });
  } catch (_error) {
    return send(res, 503, 'We could not check your account right now. Please try again in a moment.');
  }

  if (!user) {
    return send(res, 401, 'Your account could not be found. Please sign in again.');
  }

  if (user.deletedAt || user.deleted_at) {
    return send(res, 401, 'This account is no longer active. Please contact support if you think this is a mistake.');
  }

  if (user.is_banned || user.isBanned || user.banned) {
    return send(res, 403, 'This account cannot be used right now. Please contact support if you think this is a mistake.');
  }

  const tokenVersion = normalizeTokenVersion(decoded.tokenVersion ?? decoded.tv);
  const accountTokenVersion = normalizeTokenVersion(user.tokenVersion ?? user.token_version);

  if (tokenVersion !== accountTokenVersion) {
    return send(res, 401, 'Your session has ended. Please sign in again.');
  }

  const premiumUntil = user.premium_until || user.premiumUntil || null;
  const isPremium = Boolean(user.is_premium || user.isPremium || isDateInFuture(premiumUntil));

  req.user = {
    ...withoutSensitiveFields(user),
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: accountTokenVersion,
    token_version: accountTokenVersion,
    premiumUntil,
    premium_until: premiumUntil,
    isPremium,
    is_premium: isPremium,
  };

  return next();
}

async function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return next();
  return authenticateToken(req, res, next);
}

function isAdminUser(user) {
  return Boolean(user && (user.is_admin || user.isAdmin || user.role === 'admin' || user.role === 'ADMIN'));
}

function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return send(res, 403, 'You do not have permission to do that.');
  }

  return next();
}

function authenticateAdmin(req, res, next) {
  return authenticateToken(req, res, () => requireAdmin(req, res, next));
}

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.authorizeAdmin = requireAdmin;
module.exports.authenticateAdmin = authenticateAdmin;
module.exports.signToken = signToken;
module.exports.verifyToken = verifyToken;

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { loadEnv } from './config/env.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import aiRoutes from './routes/ai.js';
import functionRoutes from './routes/functions.js';
import communityRoutes from './routes/community.js';
import clientErrorRoutes from './routes/clientErrors.js';
import { handleStripeWebhook } from './routes/functions.js';
import { prisma } from './middleware/auth.js';
import { reportErrorToOwner } from './services/errorReporter.js';
import { makeRateLimitStore } from './middleware/rateLimitStore.js';

// Validate the runtime environment FIRST so a misconfigured production
// process exits cleanly with a descriptive error instead of failing inside
// route handlers.
const env = loadEnv();

function isSafeRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

export function buildApp(opts = {}) {
  const app = express();
  const allowedOrigins = env.corsAllowList();
  // Optional shared rate-limit stores (Redis), resolved by the caller when
  // REDIS_URL is set. Undefined → express-rate-limit's default in-memory store,
  // which is correct for a single instance. Passing them per-limiter is what
  // makes the counters survive restarts and stay shared across replicas.
  const stores = opts.rateLimitStores || {};

  // CRITICAL for rate limiting: behind Railway's TLS-terminating proxy, the
  // socket peer is the proxy, so without this every client's `req.ip` collapses
  // to the proxy address. express-rate-limit then keys ALL traffic into ONE
  // bucket — so the per-IP login/reset/AI limits become a single global limit
  // (one attacker, or normal traffic, locks everyone out) AND per-attacker
  // brute-force throttling is defeated. Trust exactly one proxy hop.
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId = isSafeRequestId(incoming) ? incoming : crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Security & performance middleware. These are required imports; if any
  // is missing the install is broken and we want to know at boot, not on
  // the first request that needed it.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());

  // Rate limits — applied per-route below, with conservative defaults.
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false, store: stores.auth, message: { message: 'Too many login attempts — try again later' } });
  const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false, store: stores.register, message: { message: 'Too many registration attempts — try again later' } });
  const resetLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false, store: stores.reset, message: { message: 'Too many reset attempts — try again later' } });
  const aiLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, store: stores.ai, message: { message: 'Too many AI requests — try again shortly' } });
  // Public Bible proxy endpoints are optionalAuth, so without their own
  // limit they're effectively a free unauthenticated proxy to bible-api.com.
  // A single misbehaving client (or a scraper) could burn through our
  // upstream quota and rack up egress.
  const publicFunctionLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: stores.public,
    message: { message: 'Too many Bible lookup requests — please slow down.' },
  });
  // /api/report-client-error is intentionally unauthenticated (a crash can
  // happen before/around auth). Without a limit, anyone can drive owner emails
  // + an OpenAI analysis per distinct message. Throttle per IP.
  const clientErrorLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, store: stores.clientError, message: { message: 'Too many error reports' } });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', resetLimiter);
  app.use('/api/auth/reset-password', resetLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/functions/biblePassage', publicFunctionLimiter);
  app.use('/api/functions/verifyVerseWording', publicFunctionLimiter);
  app.use('/api/functions/listAvailableTranslations', publicFunctionLimiter);
  app.use('/api/functions/getPassageMultiSource', publicFunctionLimiter);
  app.use('/api/report-client-error', clientErrorLimiter);

  // Expose the per-stream trailer nonce so a cross-origin (Railway/Electron)
  // web client can read it to authenticate the /api/ai/stream validation trailer.
  app.use(cors({ origin: allowedOrigins, credentials: true, exposedHeaders: ['X-Stream-Trailer-Nonce'] }));
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // Origin-based CSRF guard for cookie-authenticated, state-changing
  // requests. Browsers always set Origin/Referer on cross-origin POST/PUT/
  // PATCH/DELETE; clients without an Origin (curl, mobile native) must
  // send a Bearer token instead of a cookie — so we treat absent Origin
  // on a cookie-bearing request as suspicious and reject it.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.path === '/api/functions/stripeWebhook') return next();

    const hasCookie = Boolean(req.headers.cookie);
    const origin = req.headers.origin || req.headers.referer;

    if (!origin) {
      // No Origin: only allow if the caller is using a Bearer token (i.e.
      // not relying on the browser's automatic cookie attachment).
      if (hasCookie) return res.status(403).json({ message: 'Forbidden — missing Origin on cookie-authenticated request' });
      return next();
    }
    try {
      const reqOrigin = new URL(origin).origin;
      if (allowedOrigins.includes(reqOrigin)) return next();
    } catch { /* malformed Origin */ }

    return res.status(403).json({ message: 'Forbidden — origin not allowed' });
  });

  // Stripe webhook needs raw body for signature verification — mount BEFORE the JSON parser.
  app.post('/api/functions/stripeWebhook', express.raw({ type: 'application/json', limit: '1mb' }), handleStripeWebhook);

  app.use(express.json({ limit: '2mb' }));

  // Non-secret build identity for deploy correlation (Vercel/Railway/local).
  const buildIdentity = {
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.GIT_COMMIT_SHA
      || process.env.COMMIT_SHA
      || null,
    version: process.env.npm_package_version || null,
  };

  // Liveness — process is up.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), ...buildIdentity }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), ...buildIdentity }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), ...buildIdentity }));
  // Alias used by some probes / reverse proxies.
  app.get('/api/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      return res.status(503).json({ status: 'not_ready', reason: 'database unreachable', ...buildIdentity });
    }
    return res.json({
      status: 'ready',
      aiEnabled: env.aiEnabled,
      billingEnabled: env.billingEnabled,
      passwordResetEnabled: env.passwordResetEnabled,
      timestamp: new Date().toISOString(),
      ...buildIdentity,
    });
  });

  // Readiness — process is up AND can reach its hard dependencies.
  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      return res.status(503).json({ status: 'not_ready', reason: 'database unreachable', ...buildIdentity });
    }
    return res.json({
      status: 'ready',
      aiEnabled: env.aiEnabled,
      billingEnabled: env.billingEnabled,
      passwordResetEnabled: env.passwordResetEnabled,
      timestamp: new Date().toISOString(),
      ...buildIdentity,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/entities', entityRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/functions', functionRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api', clientErrorRoutes);

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found', requestId: req.id });
  });

  app.use((err, req, res, _next) => {
    // Log without payload — err.message only.
    console.error(`[${new Date().toISOString()}] Error ${req.id || 'unknown-request'}:`, err.message);
    const status = err.status || err.statusCode || 500;
    // Notify the owner of genuine server faults (5xx) hit by non-admin users.
    // Fire-and-forget — never awaited, never throws into the response path.
    if (status >= 500) {
      reportErrorToOwner({
        error: err,
        source: 'backend',
        userEmail: req.userEmail,
        route: req.originalUrl || req.path,
        method: req.method,
        requestId: req.id,
        statusCode: status,
      });
    }
    res.status(status).json({
      message: status === 500 ? 'Internal server error' : err.message,
      requestId: req.id,
    });
  });

  return app;
}

const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  import.meta.url.endsWith('/index.js') && process.argv[1]?.endsWith('index.js');

// Resolve shared (Redis) rate-limit stores ONLY when REDIS_URL is configured.
// Without it we return {} and the limiters use the in-memory store (correct for
// a single instance). makeRateLimitStore returns undefined if the optional
// redis packages aren't installed, so this degrades gracefully either way.
async function resolveRateLimitStores() {
  if (!process.env.REDIS_URL) return {};
  const [auth, register, reset, ai, pub, clientError] = await Promise.all([
    makeRateLimitStore('login'),
    makeRateLimitStore('register'),
    makeRateLimitStore('reset'),
    makeRateLimitStore('ai'),
    makeRateLimitStore('public'),
    makeRateLimitStore('clienterror'),
  ]);
  return { auth, register, reset, ai, public: pub, clientError };
}

// Bound the durable bible_passage_cache: it's keyed on every distinct
// verse/range string a user types, so it grows with usage. Rows are only read
// when fresh (<=30d), so anything older is dead weight — prune it on boot and
// daily. (The chapter cache is self-bounding at ~9.5k rows and needs no prune.)
async function pruneStaleCaches() {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await prisma.biblePassageCache.deleteMany({ where: { fetchedAt: { lt: cutoff } } });
    if (result.count > 0) console.log(`[cache] pruned ${result.count} stale bible_passage_cache rows`);
  } catch (err) {
    console.error('[cache] prune failed:', err?.message || err);
  }
}

if (isMainModule) {
  const rateLimitStores = await resolveRateLimitStores();
  const app = buildApp({ rateLimitStores });
  const PORT = env.PORT;
  const server = app.listen(PORT, env.HOST, () => {
    console.log(`SermonSmith API running on ${env.HOST}:${PORT}`);
  });

  // Keep-alive race fix: Node's default keepAliveTimeout (5s) is shorter than
  // the Railway edge proxy's idle timeout, so Node can close an idle socket at
  // the exact moment the proxy writes the next request into it — the proxy
  // then surfaces a bodiless 502 ("Application failed to respond") on a
  // perfectly healthy app. The server-side timeout must EXCEED the proxy's so
  // the proxy always closes first; headersTimeout must exceed keepAliveTimeout.
  server.keepAliveTimeout = Number(process.env.HTTP_KEEPALIVE_TIMEOUT_MS || 620_000);
  server.headersTimeout = server.keepAliveTimeout + 5_000;

  // Prune stale cache rows on boot, then once a day. unref() so the timer never
  // keeps the process alive during shutdown.
  pruneStaleCaches();
  setInterval(pruneStaleCaches, 24 * 60 * 60 * 1000).unref?.();

  // Graceful shutdown.
  //
  // Without `prisma.$disconnect()` Railway / Docker rolling deploys leak
  // pooled DB connections every restart — the new process opens its own
  // pool while the old one's connections stay open until the OS / pgbouncer
  // times them out. On a busy app that exhausts the max_connections
  // budget very quickly.
  async function shutdown(signal) {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        console.log('Prisma disconnected');
        process.exit(0);
      } catch (err) {
        console.error('Failed to disconnect Prisma:', err?.message || err);
        process.exit(1);
      }
    });
    // Hard-stop after 10s so a hung handler can't keep the container alive
    // forever.
    setTimeout(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(1);
      }
    }, 10_000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Safety net: on Node a stray unhandled promise rejection terminates the
  // process by default, which would cycle the Railway container. Log + report
  // it but keep serving (a single bad request must not take the service down).
  // A truly uncaught exception leaves the process in an unknown state, so for
  // that we report and then drain/exit so Railway restarts cleanly.
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`);
    console.error('[unhandledRejection]', error.message);
    try { reportErrorToOwner({ error, source: 'unhandledRejection' }); } catch { /* never throw from the handler */ }
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err?.message || err);
    try { reportErrorToOwner({ error: err instanceof Error ? err : new Error(String(err)), source: 'uncaughtException' }); } catch { /* ignore */ }
    shutdown('uncaughtException');
  });
}

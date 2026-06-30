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

// Validate the runtime environment FIRST so a misconfigured production
// process exits cleanly with a descriptive error instead of failing inside
// route handlers.
const env = loadEnv();

function isSafeRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

export function buildApp() {
  const app = express();
  const allowedOrigins = env.corsAllowList();

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
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts — try again later' } });
  const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many registration attempts — try again later' } });
  const resetLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many reset attempts — try again later' } });
  const aiLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many AI requests — try again shortly' } });
  // Public Bible proxy endpoints are optionalAuth, so without their own
  // limit they're effectively a free unauthenticated proxy to bible-api.com.
  // A single misbehaving client (or a scraper) could burn through our
  // upstream quota and rack up egress.
  const publicFunctionLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many Bible lookup requests — please slow down.' },
  });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', resetLimiter);
  app.use('/api/auth/reset-password', resetLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/functions/biblePassage', publicFunctionLimiter);
  app.use('/api/functions/listAvailableTranslations', publicFunctionLimiter);
  app.use('/api/functions/getPassageMultiSource', publicFunctionLimiter);

  app.use(cors({ origin: allowedOrigins, credentials: true }));
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

  // Liveness — process is up.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Readiness — process is up AND can reach its hard dependencies.
  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      return res.status(503).json({ status: 'not_ready', reason: 'database unreachable' });
    }
    return res.json({
      status: 'ready',
      aiEnabled: env.aiEnabled,
      billingEnabled: env.billingEnabled,
      passwordResetEnabled: env.passwordResetEnabled,
      timestamp: new Date().toISOString(),
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

if (isMainModule) {
  const app = buildApp();
  const PORT = env.PORT;
  const server = app.listen(PORT, env.HOST, () => {
    console.log(`SermonSmith API running on ${env.HOST}:${PORT}`);
  });

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
}

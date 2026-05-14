import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { loadEnv } from './config/env.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import aiRoutes from './routes/ai.js';
import functionRoutes from './routes/functions.js';
import { handleStripeWebhook } from './routes/functions.js';
import { prisma } from './middleware/auth.js';

// Validate the runtime environment FIRST so a misconfigured production
// process exits cleanly with a descriptive error instead of failing inside
// route handlers.
const env = loadEnv();

export function buildApp() {
  const app = express();
  const allowedOrigins = env.corsAllowList();

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

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/forgot-password', resetLimiter);
  app.use('/api/auth/reset-password', resetLimiter);
  app.use('/api/ai', aiLimiter);

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

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  app.use((err, _req, res, _next) => {
    // Log without payload — err.message only.
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      message: status === 500 ? 'Internal server error' : err.message,
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

  function shutdown(signal) {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

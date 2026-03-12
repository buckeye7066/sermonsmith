import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import aiRoutes from './routes/ai.js';
import functionRoutes from './routes/functions.js';
import { handleStripeWebhook } from './routes/functions.js';

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Security & performance middleware (optional packages — graceful fallback)
// ---------------------------------------------------------------------------
try {
  const { default: helmet } = await import('helmet');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
} catch { /* helmet not installed */ }

try {
  const { default: compression } = await import('compression');
  app.use(compression());
} catch { /* compression not installed */ }

try {
  const { default: rateLimit } = await import('express-rate-limit');
  app.use('/api/ai', rateLimit({ windowMs: 60_000, max: 30, message: { message: 'Too many AI requests — try again shortly' } }));
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 20, message: { message: 'Too many login attempts — try again later' } }));
  app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60_000, max: 10, message: { message: 'Too many registration attempts — try again later' } }));
} catch { /* express-rate-limit not installed */ }

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// CSRF protection — validate Origin header on state-changing requests.
// Combined with SameSite=Lax cookies, this provides defense-in-depth
// against cross-site request forgery.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  // Safe methods don't need CSRF protection
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next(); // Non-browser clients (curl, mobile) have no Origin

  try {
    const reqOrigin = new URL(origin).origin;
    if (allowedOrigins.includes(reqOrigin)) return next();
  } catch { /* malformed Origin */ }

  return res.status(403).json({ message: 'Forbidden — origin not allowed' });
});

// Stripe webhook needs raw body for signature verification — mount before JSON parser
app.post('/api/functions/stripeWebhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/functions', functionRoutes);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`SermonSmith API running on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Centralised environment validation for @sermonsmith/api.
 *
 * Goals (production-readiness pass):
 *  - Single source of truth for required env vars.
 *  - Hard fail at startup in production when required secrets are missing
 *    or below minimum entropy.
 *  - In non-production: warn but allow degraded operation so local dev/CI
 *    can still run without a fully-loaded environment.
 *  - No env value is logged in clear; only names/lengths.
 */

import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.string().optional(),

  // Database
  DATABASE_URL: z.string().min(1).optional(),

  // Auth
  JWT_SECRET: z.string().min(1).optional(),
  COOKIE_SECRET: z.string().min(1).optional(),

  // CORS
  CORS_ORIGIN: z.string().optional(),
  FRONTEND_URL: z.string().optional(),

  // OpenAI / AI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Optional knobs
  ADMIN_EMAILS: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).optional(),

  // Feature flags — when "1", explicitly disables a feature so missing keys
  // are not a hard fail in production.
  DISABLE_AI: z.string().optional(),
  DISABLE_BILLING: z.string().optional(),
  DISABLE_PASSWORD_RESET: z.string().optional(),
});

const PRODUCTION_REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET', 'CORS_ORIGIN'];

function isWeakSecret(value) {
  if (!value) return true;
  if (value.length < MIN_SECRET_LENGTH) return true;
  const lowered = value.toLowerCase();
  if (lowered.includes('change-in-production')) return true;
  if (lowered.includes('your-') && lowered.includes('-secret')) return true;
  return false;
}

export function loadEnv(opts = {}) {
  const source = opts.source || process.env;
  const warn = opts.warn || ((msg) => console.warn(`[env] ${msg}`));

  const parsed = baseSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[env] invalid environment: ${issues}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';

  const missing = [];
  const weak = [];

  if (isProd) {
    for (const key of PRODUCTION_REQUIRED) {
      if (!env[key]) missing.push(key);
    }
    if (env.JWT_SECRET && isWeakSecret(env.JWT_SECRET)) weak.push('JWT_SECRET');
    if (env.COOKIE_SECRET && isWeakSecret(env.COOKIE_SECRET)) weak.push('COOKIE_SECRET');

    // Feature-gated requirements: only enforce keys for features that are
    // actually enabled in this deployment.
    const aiEnabled = source.DISABLE_AI !== '1';
    const billingEnabled = source.DISABLE_BILLING !== '1';
    const resetEnabled = source.DISABLE_PASSWORD_RESET !== '1';

    if (aiEnabled && !env.OPENAI_API_KEY) {
      missing.push('OPENAI_API_KEY (set DISABLE_AI=1 to disable AI routes)');
    }
    if (billingEnabled) {
      if (!env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY (set DISABLE_BILLING=1 to disable billing)');
      if (!env.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET (set DISABLE_BILLING=1 to disable billing)');
    }
    if (resetEnabled && !env.RESEND_API_KEY) {
      missing.push('RESEND_API_KEY (set DISABLE_PASSWORD_RESET=1 to disable email-driven reset)');
    }
  } else {
    for (const key of PRODUCTION_REQUIRED) {
      if (!env[key]) warn(`${key} is not set (allowed in ${env.NODE_ENV}, REQUIRED in production)`);
    }
  }

  if (missing.length > 0 || weak.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing required vars: ${missing.join(', ')}`);
    if (weak.length > 0) parts.push(`secrets too short or placeholders (need >= ${MIN_SECRET_LENGTH} chars): ${weak.join(', ')}`);
    const message = `[env] production environment is unsafe — ${parts.join('; ')}`;
    if (isProd) {
      throw new Error(message);
    }
  }

  return {
    ...env,
    isProduction: isProd,
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',

    aiEnabled: source.DISABLE_AI !== '1',
    billingEnabled: source.DISABLE_BILLING !== '1',
    passwordResetEnabled: source.DISABLE_PASSWORD_RESET !== '1',

    corsAllowList() {
      const raw = env.CORS_ORIGIN || (isProd ? '' : 'http://localhost:5173');
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    },

    adminEmails() {
      const raw = env.ADMIN_EMAILS || '';
      return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    },
  };
}

export const ENV_CONSTANTS = { MIN_SECRET_LENGTH, PRODUCTION_REQUIRED };

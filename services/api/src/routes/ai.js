import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, prisma } from '../middleware/auth.js';

const router = Router();

// Production-readiness fix: lazy-load OpenAI so the API can boot without
// the SDK installed (e.g., in CI or in a deployment that has DISABLE_AI=1).
let _openai = null;
async function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('OpenAI API key not configured'), { status: 503 });
  }
  if (process.env.DISABLE_AI === '1') {
    throw Object.assign(new Error('AI features are disabled in this deployment'), { status: 503 });
  }
  if (!_openai) {
    const { default: OpenAI } = await import('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Hard caps so a single client cannot ask for an unbounded completion and
// drain quota / rack up cost. Premium accounts can request more, but never
// above the absolute ceiling.
const ABSOLUTE_MAX_TOKENS = 4096;
const FREE_MAX_TOKENS = 1500;
const PREMIUM_MAX_TOKENS = 4096;
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90_000);

// Hard request-size caps so a malicious or buggy client can't ship a
// novel-length prompt and rack up token cost (or melt the worker
// serializing it). 24K characters is a safe upper bound for a sermon-
// builder prompt; the structured-schema cap is generous because Larry's
// schemas grow as the UI evolves.
const MAX_PROMPT_CHARS = Number(process.env.AI_MAX_PROMPT_CHARS || 24000);
const MAX_SYSTEM_PROMPT_CHARS = Number(process.env.AI_MAX_SYSTEM_PROMPT_CHARS || 12000);
const MAX_SCHEMA_CHARS = Number(process.env.AI_MAX_SCHEMA_CHARS || 12000);

const invokeRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  system_prompt: z.string().max(MAX_SYSTEM_PROMPT_CHARS).optional(),
  response_json_schema: z.any().optional(),
  model: z.string().max(100).optional(),
  max_tokens: z.union([z.number(), z.string()]).optional(),
  temperature: z.union([z.number(), z.string()]).optional(),
}).superRefine((value, ctx) => {
  if (value.response_json_schema !== undefined) {
    try {
      const schemaSize = JSON.stringify(value.response_json_schema).length;
      if (schemaSize > MAX_SCHEMA_CHARS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['response_json_schema'],
          message: `response_json_schema is too large; max ${MAX_SCHEMA_CHARS} characters`,
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['response_json_schema'],
        message: 'response_json_schema must be JSON-serializable',
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Model allowlist.
//
// The /invoke route previously trusted whatever model string the client
// sent. That meant a free-tier user could ask the server to use any model
// the OpenAI account had access to, including expensive flagship or
// experimental ones — pure cost/abuse exposure.
//
// We now whitelist server-side: free accounts get exactly the cheap
// default; premium accounts can choose a small allowlist. Unknown models
// 403 with a clear message instead of being silently forwarded.
//
// Configurable via env in case the deployment wants to add a model
// without touching code (comma-separated lists, e.g.
// AI_FREE_MODELS=gpt-4o-mini,gpt-3.5-turbo).
// ---------------------------------------------------------------------------
function modelSet(envName, fallbackList) {
  const raw = process.env[envName];
  if (!raw) return new Set(fallbackList);
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? new Set(list) : new Set(fallbackList);
}
const FREE_MODELS = modelSet('AI_FREE_MODELS', ['gpt-4o-mini']);
const PREMIUM_MODELS = modelSet('AI_PREMIUM_MODELS', ['gpt-4o-mini', 'gpt-4o']);

function resolveModel(requested, isPremium) {
  const fallback = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const model = String(requested || fallback).trim();
  const allowed = isPremium ? PREMIUM_MODELS : FREE_MODELS;
  if (!allowed.has(model)) {
    throw Object.assign(
      new Error(`Model '${model}' is not available for this account.`),
      { status: 403 },
    );
  }
  return model;
}

// Persistent per-user, per-day AI counter. Backed by the AiUsage table so
// the limit survives process restarts and applies across multiple replicas.
//
// The original implementation kept an in-memory Map which silently reset on
// every restart and was effectively un-enforced in any multi-process / multi-
// pod deployment. The DB-backed version uses a single upsert per call.
//
// `prismaOverride` is for tests (in-memory mock); production uses the
// shared singleton imported from middleware/auth.js.
const DAILY_LIMIT_FREE = 30;
const DAILY_LIMIT_PREMIUM = 500;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function consumeUsageDb(userId, premium, prismaOverride) {
  const db = prismaOverride || prisma;
  const bucket = todayKey();
  const limit = premium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE;

  // Atomic upsert with increment — safe against concurrent calls because the
  // unique (userId, bucket) constraint serialises the underlying SQL.
  const row = await db.aiUsage.upsert({
    where: { userId_bucket: { userId, bucket } },
    create: { userId, bucket, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return { allowed: row.count <= limit, count: row.count, limit };
}

// Legacy export kept only for the existing __test surface; never called from
// route handlers any more.
function consumeUsage(_userId, premium) {
  const limit = premium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE;
  return { allowed: true, count: 0, limit };
}

function clampTokens(requested, premium) {
  const ceiling = premium ? PREMIUM_MAX_TOKENS : Math.min(FREE_MAX_TOKENS, ABSOLUTE_MAX_TOKENS);
  const requestedNum = Number(requested);
  if (!Number.isFinite(requestedNum) || requestedNum <= 0) return Math.min(FREE_MAX_TOKENS, ceiling);
  return Math.min(Math.floor(requestedNum), ceiling);
}

function clampTemperature(requested) {
  const n = Number(requested);
  if (!Number.isFinite(n)) return 0.7;
  return Math.max(0, Math.min(2, n));
}

function withTimeout(promise, ms, label = 'OpenAI call') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { status: 504 })), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export function buildJsonSchemaInstruction(responseJsonSchema) {
  return [
    'Respond ONLY with valid JSON matching this schema.',
    'Do not include markdown, prose, or code fences in the response body.',
    'Schema:',
    '```json',
    JSON.stringify(responseJsonSchema, null, 2),
    '```',
  ].join('\n');
}

// Retry transient OpenAI failures (429 rate-limit, 5xx overloaded/server) with
// exponential backoff + jitter. We deliberately do NOT retry our own 504
// timeout (the client is already waiting at the edge of AI_TIMEOUT_MS) nor 4xx
// other than 429 (those are deterministic — a retry just wastes the user's
// quota and our money). The whole retry loop runs INSIDE withTimeout so total
// latency stays bounded by AI_TIMEOUT_MS instead of multiplying per attempt.
const AI_MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 2);
export async function callWithRetry(fn, { retries = AI_MAX_RETRIES, baseMs = 500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600 && status !== 504);
      if (!retryable || attempt >= retries) throw err;
      const delay = baseMs * 2 ** attempt + Math.floor(Math.random() * 150);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// LLM invocation
router.post('/invoke', authenticateToken, async (req, res, next) => {
  try {
    const parsed = invokeRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid AI request',
        issues: parsed.error.issues,
      });
    }
    const { prompt, system_prompt, response_json_schema, model, max_tokens, temperature } = parsed.data;

    // Resolve model and clamp tokens/temperature BEFORE consuming usage so a
    // misconfigured allowlist or bad model name doesn't burn a daily count.
    const resolvedModel = resolveModel(model, req.userPremium);
    const clampedTokens = clampTokens(max_tokens, req.userPremium);
    const clampedTemperature = clampTemperature(temperature);

    // Same logic for OpenAI: if the SDK is missing or DISABLE_AI is set, the
    // call would 503 anyway — we don't want to also subtract one from the
    // user's daily quota for a server-side misconfiguration.
    const openai = await getOpenAI();

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    const messages = [];
    if (system_prompt) messages.push({ role: 'system', content: system_prompt });
    messages.push({ role: 'user', content: prompt });

    const params = {
      model: resolvedModel,
      messages,
      max_tokens: clampedTokens,
      temperature: clampedTemperature,
    };

    if (response_json_schema) {
      params.response_format = { type: 'json_object' };
      const schemaIdx = system_prompt ? 0 : messages.length - 1;
      messages[schemaIdx].content += `\n\n${buildJsonSchemaInstruction(response_json_schema)}`;
    }

    const completion = await withTimeout(
      callWithRetry(() => openai.chat.completions.create(params)),
      AI_TIMEOUT_MS,
      '/ai/invoke',
    );
    const content = completion.choices[0]?.message?.content || '';

    if (response_json_schema) {
      try {
        return res.json(JSON.parse(content));
      } catch {
        // Fail loud on malformed JSON when the client asked for structured
        // output. The previous behaviour returned `{ response: <text> }`,
        // which the SermonBuilder/SeriesBuilder then treated as a valid
        // structured object and crashed on `.points.map(...)` etc. A 502 +
        // preview lets the UI surface a retryable error instead.
        return res.status(502).json({
          message: 'AI returned invalid JSON. Please retry.',
          responsePreview: content.slice(0, 500),
        });
      }
    }
    res.json(content);
  } catch (err) {
    next(err);
  }
});

// Image generation.
//
// DALL-E calls are significantly more expensive per request than text
// completions, so the route is premium-only by default. Admins/devs are
// allowed through for testing.
router.post('/image', authenticateToken, async (req, res, next) => {
  try {
    const { prompt, size } = req.body;
    if (!prompt) return res.status(400).json({ message: 'prompt is required' });

    if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(402).json({
        message: 'Image generation requires Premium.',
      });
    }

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    const openai = await getOpenAI();
    const response = await withTimeout(
      openai.images.generate({ model: 'dall-e-3', prompt, n: 1, size: size || '1024x1024' }),
      AI_TIMEOUT_MS,
      '/ai/image',
    );

    res.json({ url: response.data[0].url });
  } catch (err) {
    next(err);
  }
});

// Email integration.
//
// Locked down for production:
//   - Only sends to the AUTHENTICATED user's own email address. Arbitrary
//     `to:` addresses in the request body are IGNORED. This stops the route
//     from being abused as a generic phishing / spam gateway.
//   - The HTML body is built from a fixed template and the user's plain-text
//     `message`. Caller-supplied `html` is REJECTED — the previous version
//     interpolated user HTML directly into the email which let any
//     authenticated account ship arbitrary HTML to its own inbox at minimum
//     (and historically to any address before the auth fix).
//   - A small allow-list of `template` ids selects pre-defined subject lines.
//     Anything else 400s.
const EMAIL_TEMPLATES = {
  notification: {
    subject: 'SermonSmith notification',
    intro: 'You asked SermonSmith to email you the following note:',
  },
  reminder: {
    subject: 'SermonSmith reminder',
    intro: 'Your SermonSmith reminder:',
  },
  export: {
    subject: 'Your SermonSmith export',
    intro: 'Here is the export you requested:',
  },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.post('/email', authenticateToken, async (req, res, next) => {
  try {
    if (req.body && (req.body.html || req.body.to || req.body.email)) {
      // Hard fail on any attempt to override the recipient or supply raw HTML.
      // The API always emails the authenticated user with a server-rendered template.
      return res.status(400).json({
        message: 'Providing custom "html" or recipient fields is not allowed. This endpoint always emails the authenticated user with a server-rendered template.',
      });
    }

    const templateId = String(req.body?.template || 'notification');
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      return res.status(400).json({
        message: `Unknown template '${templateId}'. Allowed: ${Object.keys(EMAIL_TEMPLATES).join(', ')}`,
      });
    }

    const message = String(req.body?.message || req.body?.body || req.body?.text || '').slice(0, 5000);
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    if (!req.userEmail) {
      // Should never happen — authenticateToken refuses unknown users — but
      // fail closed if email is somehow missing on the user record.
      return res.status(400).json({ message: 'Authenticated user has no email on file' });
    }

    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
    const html = `<!doctype html><html><body>
      <p>${escapeHtml(template.intro)}</p>
      <blockquote style="border-left:4px solid #ccc;padding-left:12px;color:#333">${safeMessage}</blockquote>
      <hr><p style="font-size:12px;color:#666">Sent by SermonSmith on your behalf.</p>
    </body></html>`;

    const { sendEmail } = await import('../services/email.js');
    await sendEmail({
      to: req.userEmail, // hard-coded to the authenticated user
      subject: template.subject,
      html,
      text: `${template.intro}\n\n${message}\n\n— Sent by SermonSmith on your behalf.`,
    });
    res.json({ success: true, sentTo: req.userEmail });
  } catch (err) {
    next(err);
  }
});

router.post('/sms', authenticateToken, async (_req, res) => {
  // Intentionally returns 501 instead of pretending to send; the original
  // handler returned `success: true` which was misleading.
  res.status(501).json({ success: false, message: 'SMS sending is not implemented in this deployment.' });
});

router.post('/upload', authenticateToken, async (_req, res) => {
  res.status(501).json({ success: false, message: 'File upload is not implemented in this deployment.' });
});

router.post('/extract', authenticateToken, async (_req, res) => {
  res.status(501).json({ success: false, message: 'File extraction is not implemented in this deployment.' });
});

// Exposed for tests.
export const __test = {
  clampTokens,
  clampTemperature,
  consumeUsage,
  consumeUsageDb,
  resolveModel,
  invokeRequestSchema,
  buildJsonSchemaInstruction,
  EMAIL_TEMPLATES,
};

export default router;

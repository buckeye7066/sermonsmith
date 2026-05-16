import { Router } from 'express';
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
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30_000);

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

// LLM invocation
router.post('/invoke', authenticateToken, async (req, res, next) => {
  try {
    const { prompt, system_prompt, response_json_schema, model, max_tokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'prompt is required' });
    }

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    const openai = await getOpenAI();

    const messages = [];
    if (system_prompt) messages.push({ role: 'system', content: system_prompt });
    messages.push({ role: 'user', content: prompt });

    const params = {
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: clampTokens(max_tokens, req.userPremium),
      temperature: clampTemperature(temperature),
    };

    if (response_json_schema) {
      params.response_format = { type: 'json_object' };
      const schemaIdx = system_prompt ? 0 : messages.length - 1;
      messages[schemaIdx].content += `\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}`;
    }

    const completion = await withTimeout(openai.chat.completions.create(params), AI_TIMEOUT_MS, '/ai/invoke');
    const content = completion.choices[0]?.message?.content || '';

    if (response_json_schema) {
      try {
        return res.json(JSON.parse(content));
      } catch {
        return res.json({ response: content });
      }
    }
    res.json(content);
  } catch (err) {
    next(err);
  }
});

// Image generation
router.post('/image', authenticateToken, async (req, res, next) => {
  try {
    const { prompt, size } = req.body;
    if (!prompt) return res.status(400).json({ message: 'prompt is required' });

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
export const __test = { clampTokens, clampTemperature, consumeUsage, consumeUsageDb, EMAIL_TEMPLATES };

export default router;

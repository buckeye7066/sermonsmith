import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

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

// Per-process in-memory daily counter (best-effort). The single source of
// truth for billing remains the OpenAI dashboard; this is a guard rail
// against accidental or malicious abuse from a single client.
const DAILY_LIMIT_FREE = 30;
const DAILY_LIMIT_PREMIUM = 500;
const usageByUser = new Map(); // userId -> { day: 'YYYY-MM-DD', count: number }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function consumeUsage(userId, premium) {
  const today = todayKey();
  const cur = usageByUser.get(userId);
  const fresh = !cur || cur.day !== today;
  const count = fresh ? 1 : cur.count + 1;
  usageByUser.set(userId, { day: today, count });
  const limit = premium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE;
  return { allowed: count <= limit, count, limit };
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

    const usage = consumeUsage(req.userId, req.userPremium);
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

    const usage = consumeUsage(req.userId, req.userPremium);
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

// Email integration — uses the shared email service. Notice we no longer
// allow callers to email arbitrary bodies to arbitrary recipients without
// authentication; the route requires an authenticated user, and only the
// `to` address is honoured (not raw HTML interpolated from the body).
router.post('/email', authenticateToken, async (req, res, next) => {
  try {
    const { sendEmail } = await import('../services/email.js');
    const to = req.body.to || req.body.email;
    if (!to) return res.status(400).json({ message: 'to/email is required' });
    await sendEmail({
      to,
      subject: req.body.subject || 'SermonSmith Notification',
      html: req.body.html || `<p>${req.body.body || req.body.message || ''}</p>`,
      text: req.body.text || req.body.body || req.body.message || '',
    });
    res.json({ success: true });
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
export const __test = { clampTokens, clampTemperature, consumeUsage };

export default router;

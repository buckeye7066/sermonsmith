import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { SERVER_AI_INVARIANTS } from '@sermonsmith/shared/aiFeatures';
import { extractScriptureRefs, validateScriptureRefs } from '@sermonsmith/shared/scripture';

// Canon-independent Scripture screen for streamed output. A streamed completion
// is written to the client token-by-token BEFORE any validation can run, so the
// UI would otherwise render fabricated references (e.g. "Hezekiah 4:5") as a
// finished, trusted preview. We screen the accumulated text for references that
// are wrong in EVERY canon — a fabricated book, an impossible chapter/verse, or
// an unparseable citation — and never for canon-dependent states
// (`unsupported_canon` / `chapter_checked`) since the AI request does not carry
// the reader's denomination. Any hit marks the stream result NOT ok, so the
// client (StreamLLM) throws and falls back to /invoke instead of keeping the
// streamed preview as a completed, validated result.
const FABRICATED_REF_STATUSES = new Set(['invalid_book', 'out_of_range', 'unparseable']);
export function screenStreamedScripture(text) {
  const refs = validateScriptureRefs(extractScriptureRefs(text));
  const fabricated = refs.filter((r) => FABRICATED_REF_STATUSES.has(r.status));
  return { ok: fabricated.length === 0, checked: refs.length, fabricated: fabricated.length };
}

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
// Raised from 4096 → 8192: deep structured outputs (e.g. the Worldview
// Explorer's 7-section analysis schema) routinely exceeded a 4096-token
// completion and got truncated mid-JSON, which then failed JSON.parse and
// surfaced as "Failed to generate analysis". gpt-4o / gpt-4o-mini both support
// well above this, so the ceiling is the real constraint, not the model.
const ABSOLUTE_MAX_TOKENS = Number(process.env.AI_ABSOLUTE_MAX_TOKENS || 8192);
// Raised 1500 → 4096. The core sermon / study / series generators emit large
// structured JSON that did not fit in 1500 tokens, so completions were
// truncated mid-JSON → JSON.parse fails → 502 for EVERY user. The web client
// almost never passes max_tokens, so even premium silently fell back to the
// 1500 default (see clampTokens). 4096 fits a full sermon/study outline on
// gpt-4o-mini at trivial cost; tune via AI_FREE_MAX_TOKENS.
const FREE_MAX_TOKENS = Number(process.env.AI_FREE_MAX_TOKENS || 4096);
const PREMIUM_MAX_TOKENS = Number(process.env.AI_PREMIUM_MAX_TOKENS || 8192);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90_000);

// Image-generation model. Hardcoding 'dall-e-3' broke image generation on
// accounts that don't have DALL-E at all (many newer projects only have the
// `gpt-image-*` family — "the model 'dall-e-3' does not exist"). We default to
// the broadly-available gpt-image-1, allow an explicit override, and
// auto-resolve across the account's real models if the preferred one is
// missing (see generateImage()).
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
// Preference order tried when the configured model isn't available. gpt-image
// first (current generation), DALL-E as legacy fallback.
const IMAGE_MODEL_FALLBACKS = ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2'];
// Cache of the last model that actually worked, so we don't re-probe dead
// models on every request.
let _resolvedImageModel = null;

export function isModelMissingError(err) {
  const msg = String(err?.message || err?.error?.message || '');
  return err?.status === 404 || err?.code === 'model_not_found' || /does not exist|model_not_found|unknown model|invalid model/i.test(msg);
}

// OpenAI image responses differ by model: DALL-E returns a hosted `url`,
// gpt-image returns base64 `b64_json`. Normalize to something an <img src> can
// render either way.
export function imageSrcFromResponse(response) {
  const item = response?.data?.[0] || {};
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

// Generate an image, resolving the model robustly: try the preferred model,
// and if it's not available to this account, discover the account's models and
// fall through the preference list. Returns { src, model }.
async function generateImage(openai, { prompt, size }) {
  const preferred = process.env.OPENAI_IMAGE_MODEL || _resolvedImageModel || OPENAI_IMAGE_MODEL;
  const tried = new Set();

  const attempt = async (model) => {
    tried.add(model);
    const response = await withTimeout(
      openai.images.generate({ model, prompt, n: 1, size: size || '1024x1024' }),
      AI_TIMEOUT_MS,
      '/ai/image',
    );
    _resolvedImageModel = model;
    return { src: imageSrcFromResponse(response), model };
  };

  try {
    return await attempt(preferred);
  } catch (err) {
    if (!isModelMissingError(err)) throw err;
    // Preferred model unavailable — discover what this account actually has.
    let available = null;
    try {
      const list = await openai.models.list();
      available = new Set((list.data || []).map((m) => m.id));
    } catch {
      available = null; // couldn't list; fall through blindly
    }
    const candidates = IMAGE_MODEL_FALLBACKS.filter((m) => !tried.has(m) && (!available || available.has(m)));
    for (const model of candidates) {
      try {
        return await attempt(model);
      } catch (e) {
        if (!isModelMissingError(e)) throw e;
      }
    }
    throw err; // nothing usable
  }
}

// Hard request-size caps so a malicious or buggy client can't ship a
// novel-length prompt and rack up token cost (or melt the worker
// serializing it). 24K characters is a safe upper bound for a sermon-
// builder prompt; the structured-schema cap is generous because Larry's
// schemas grow as the UI evolves.
const MAX_PROMPT_CHARS = Number(process.env.AI_MAX_PROMPT_CHARS || 24000);
const MAX_SYSTEM_PROMPT_CHARS = Number(process.env.AI_MAX_SYSTEM_PROMPT_CHARS || 12000);
const MAX_SCHEMA_CHARS = Number(process.env.AI_MAX_SCHEMA_CHARS || 12000);

// ASCII Record Separator (0x1E). When a /stream client opts in with
// `stream_result: true`, the streamed text is followed by `\n` + this char +
// a one-line JSON object `{ ok, truncated }` describing whether the full
// response parsed as the requested JSON. The control character never occurs
// in legitimate model text output, so the client can split on it safely.
// Keep in sync with STREAM_RESULT_SEPARATOR in apps/web/src/api/apiClient.js.
const STREAM_RESULT_SEPARATOR = '\u001E';

// Image requests: bound the prompt (OpenAI image models cap prompts at ~4000
// chars anyway) and allowlist `size` so an arbitrary string never reaches the
// provider. Covers DALL-E 2/3 and gpt-image dimensions; the client currently
// sends no size (defaults to 1024x1024 in generateImage).
const imageRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024', '1536x1024', '1024x1536', 'auto']).optional(),
}).passthrough();

const invokeRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
  system_prompt: z.string().max(MAX_SYSTEM_PROMPT_CHARS).optional(),
  response_json_schema: z.any().optional(),
  feature: z.string().trim().min(1).max(80).optional(),
  model: z.string().max(100).optional(),
  max_tokens: z.union([z.number(), z.string()]).optional(),
  temperature: z.union([z.number(), z.string()]).optional(),
  // Opt-in (new clients): /stream appends a machine-readable result trailer
  // after the streamed text so the client learns whether the final payload
  // parsed as the requested JSON — the streaming path's equivalent of
  // /invoke's 502-on-invalid-JSON. Old clients that don't send this flag get
  // the exact legacy byte stream.
  stream_result: z.boolean().optional(),
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

export function hashText(value) {
  if (value === undefined || value === null || value === '') return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function estimateTokenCount(...parts) {
  const chars = parts
    .flat()
    .filter((p) => p !== undefined && p !== null)
    .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
    .join('\n')
    .length;
  return Math.max(1, Math.ceil(chars / 4));
}

function classifyAiFailure(err) {
  if (err?.status) return `http_${err.status}`;
  if (err?.response?.status) return `http_${err.response.status}`;
  if (err?.name) return err.name;
  return 'unknown';
}

async function auditAiCall({
  userId,
  feature,
  model,
  prompt,
  response,
  startTime,
  status,
  failureType,
  tokenEstimate,
}) {
  if (!prisma.aiAuditLog?.create) return;
  try {
    await prisma.aiAuditLog.create({
      data: {
        userId,
        feature: feature || 'general',
        model: model || null,
        promptHash: hashText(prompt),
        responseHash: hashText(response),
        tokenEstimate: tokenEstimate ?? estimateTokenCount(prompt, response),
        durationMs: startTime ? Date.now() - startTime : null,
        status,
        failureType: failureType || null,
      },
    });
  } catch {
    // Never let observability break the AI request path.
  }
}

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
// The deployment's configured default model must ALWAYS be allowed — otherwise
// setting OPENAI_MODEL to anything outside the default allowlist (e.g.
// gpt-4.1-mini) makes resolveModel 403 every single generation even though the
// key is valid. Auto-include it in both tiers.
const CONFIGURED_MODEL = (process.env.OPENAI_MODEL || '').trim();
if (CONFIGURED_MODEL) {
  FREE_MODELS.add(CONFIGURED_MODEL);
  PREMIUM_MODELS.add(CONFIGURED_MODEL);
}

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

// Give a daily-quota unit back when the AI call we already counted ends up
// failing for a reason that is NOT the user's fault (transient OpenAI 5xx /
// timeout / our own misconfiguration). Without this, every flaky upstream error
// permanently costs the user one of their 30/500 daily generations. Best-effort:
// never let a refund failure mask the original error.
export async function refundUsageDb(userId, prismaOverride) {
  const db = prismaOverride || prisma;
  const bucket = todayKey();
  try {
    await db.aiUsage.update({
      where: { userId_bucket: { userId, bucket } },
      data: { count: { decrement: 1 } },
    });
  } catch {
    // Row missing or DB hiccup — nothing to refund; swallow.
  }
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
  // No explicit request → give the tier's FULL ceiling. Almost every structured
  // call site omits max_tokens; defaulting to 1500 silently truncated them mid-
  // JSON. OpenAI bills actual completion tokens (not the ceiling), so this only
  // stops cut-offs — it does not raise cost for naturally-short responses.
  if (!Number.isFinite(requestedNum) || requestedNum <= 0) return ceiling;
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

// Tolerant JSON extraction for structured-output calls. `json_object` mode
// normally yields strict JSON, but a model can still (a) wrap it in a ```json
// fence, or (b) get cut off by the token ceiling mid-object. We strip fences
// and, as a last resort, slice the outermost {...}/[...] block before giving
// up — so a stray fence never turns a perfectly good response into a 502.
export function extractJson(raw) {
  if (typeof raw !== 'string') return { ok: false };
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) text = fence[1].trim();
  try { return { ok: true, value: JSON.parse(text) }; } catch { /* try salvage */ }
  const first = text.search(/[{[]/);
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (first !== -1 && last > first) {
    try { return { ok: true, value: JSON.parse(text.slice(first, last + 1)) }; } catch { /* fall through */ }
  }
  return { ok: false };
}

const auditSummarySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

function bumpCounter(target, key, amount = 1) {
  const safeKey = key || 'unknown';
  target[safeKey] = (target[safeKey] || 0) + amount;
}

function summarizeAiAudits(rows, { days, since }) {
  const byFeature = {};
  const byStatus = {};
  const byModel = {};
  const byFailureType = {};
  let totalTokenEstimate = 0;
  let totalDurationMs = 0;
  let durationSamples = 0;

  for (const row of rows) {
    bumpCounter(byFeature, row.feature || 'general');
    bumpCounter(byStatus, row.status || 'unknown');
    bumpCounter(byModel, row.model || 'unknown');
    if (row.failureType) bumpCounter(byFailureType, row.failureType);
    totalTokenEstimate += Number(row.tokenEstimate || 0);
    if (Number.isFinite(row.durationMs)) {
      totalDurationMs += Number(row.durationMs);
      durationSamples++;
    }
  }

  return {
    windowDays: days,
    since: since.toISOString(),
    totalCalls: rows.length,
    totalTokenEstimate,
    averageDurationMs: durationSamples ? Math.round(totalDurationMs / durationSamples) : null,
    byFeature,
    byStatus,
    byModel,
    byFailureType,
    recentFailures: rows
      .filter((row) => row.status !== 'success')
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        feature: row.feature,
        model: row.model,
        status: row.status,
        failureType: row.failureType,
        durationMs: row.durationMs,
        tokenEstimate: row.tokenEstimate,
      })),
  };
}

router.get('/audit/summary', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const parsed = auditSummarySchema.safeParse(req.query || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid audit summary query', issues: parsed.error.issues });
    }

    const { days } = parsed.data;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.aiAuditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    res.json(summarizeAiAudits(rows, { days, since }));
  } catch (err) {
    next(err);
  }
});

// LLM invocation
router.post('/invoke', authenticateToken, async (req, res, next) => {
  let auditBase = null;
  let audited = false;
  let usageConsumed = false;
  try {
    const parsed = invokeRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid AI request',
        issues: parsed.error.issues,
      });
    }
    const { prompt, system_prompt, response_json_schema, feature, model, max_tokens, temperature } = parsed.data;

    // Resolve model and clamp tokens/temperature BEFORE consuming usage so a
    // misconfigured allowlist or bad model name doesn't burn a daily count.
    const resolvedModel = resolveModel(model, req.userPremium);
    const clampedTokens = clampTokens(max_tokens, req.userPremium);
    const clampedTemperature = clampTemperature(temperature);
    auditBase = {
      userId: req.userId,
      feature: feature || 'general',
      model: resolvedModel,
      prompt: [
        system_prompt,
        prompt,
        response_json_schema ? JSON.stringify(response_json_schema) : null,
      ].filter(Boolean).join('\n'),
      startTime: Date.now(),
    };

    // Same logic for OpenAI: if the SDK is missing or DISABLE_AI is set, the
    // call would 503 anyway — we don't want to also subtract one from the
    // user's daily quota for a server-side misconfiguration.
    const openai = await getOpenAI();

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    usageConsumed = true;
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    // The server's own invariants ALWAYS lead the conversation. The client's
    // system prompt (persona, feature instructions) follows as a separate
    // system message and cannot remove or outrank the server policy.
    const messages = [{ role: 'system', content: SERVER_AI_INVARIANTS }];
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
      // Append the JSON instruction to the CLIENT layer (its system prompt
      // when present, else the user message) - never to the server policy.
      const schemaIdx = system_prompt ? 1 : messages.length - 1;
      messages[schemaIdx].content += `\n\n${buildJsonSchemaInstruction(response_json_schema)}`;
    }

    const completion = await withTimeout(
      callWithRetry(() => openai.chat.completions.create(params)),
      AI_TIMEOUT_MS,
      '/ai/invoke',
    );
    let content = completion.choices[0]?.message?.content || '';
    let finishReason = completion.choices[0]?.finish_reason;

    if (response_json_schema) {
      // Tolerant parse (fence-stripping + outer-object salvage) so a stray
      // code fence doesn't 502 an otherwise-valid response.
      let parsed = extractJson(content);

      // One repair attempt when the model returned prose / malformed JSON (but
      // NOT when truncated — a retry would just truncate again). This catches
      // the intermittent "AI returned invalid JSON" failures without burning an
      // extra quota unit (daily usage was already counted above).
      if (!parsed.ok && finishReason !== 'length') {
        try {
          const repairMessages = [
            ...messages,
            { role: 'assistant', content: content.slice(0, 2000) },
            { role: 'user', content: 'Your previous response was not valid JSON. Respond with ONLY the JSON object matching the requested schema — no prose, no explanation, no markdown code fences.' },
          ];
          const repair = await withTimeout(
            // Force temperature 0 on the repair pass: we want the single most
            // probable, well-formed JSON completion, not creative variation.
            // This is the deterministic root-cause fix for the intermittent
            // "AI returned invalid JSON" 502 — the retry now strongly favors
            // valid JSON instead of re-rolling at the original temperature.
            callWithRetry(() => openai.chat.completions.create({ ...params, messages: repairMessages, temperature: 0 })),
            AI_TIMEOUT_MS,
            '/ai/invoke(repair)',
          );
          const repairContent = repair.choices[0]?.message?.content || '';
          const repairParsed = extractJson(repairContent);
          if (repairParsed.ok) {
            content = repairContent;
            finishReason = repair.choices[0]?.finish_reason;
            parsed = repairParsed;
          }
        } catch {
          // Keep the original failure; the 502 below still fires.
        }
      }

      if (parsed.ok) {
        // Scripture parity with /stream: screen the response for references
        // that are fabricated in EVERY canon and fail closed (422) so the
        // client cannot render/save the draft as a clean, completed result
        // before the durable entity save gate ever runs.
        const scripture = screenStreamedScripture(content);
        if (!scripture.ok) {
          await auditAiCall({
            ...auditBase,
            response: content,
            status: 'unverified_scripture',
            failureType: 'unverified_scripture',
            tokenEstimate: estimateTokenCount(auditBase.prompt, content),
          });
          audited = true;
          return res.status(422).json({
            message: 'The AI draft contained Scripture references that could not be verified. Please retry.',
            scripture_unverified: true,
            scripture,
            responsePreview: content.slice(0, 500),
          });
        }
        await auditAiCall({
          ...auditBase,
          response: content,
          status: 'success',
          tokenEstimate: estimateTokenCount(auditBase.prompt, content),
        });
        audited = true;
        return res.json(parsed.value);
      }
      // Fail loud on malformed JSON when the client asked for structured
      // output. The previous behaviour returned `{ response: <text> }`,
      // which the SermonBuilder/SeriesBuilder then treated as a valid
      // structured object and crashed on `.points.map(...)` etc. A 502 +
      // preview lets the UI surface a retryable error instead. When the model
      // was cut off by the token ceiling we say so explicitly, since "retry"
      // alone won't help if the request is simply too large.
      await auditAiCall({
        ...auditBase,
        response: content,
        status: 'invalid_json',
        failureType: finishReason === 'length' ? 'truncated' : 'invalid_json',
        tokenEstimate: estimateTokenCount(auditBase.prompt, content),
      });
      audited = true;
      return res.status(502).json({
        message: finishReason === 'length'
          ? 'The AI response was too long and was cut off before it finished. Please try a narrower or more specific request.'
          : 'AI returned invalid JSON. Please retry.',
        truncated: finishReason === 'length',
        responsePreview: content.slice(0, 500),
      });
    }
    // Same fabricated-Scripture screen for plain-text (non-schema) completions.
    const scripture = screenStreamedScripture(content);
    if (!scripture.ok) {
      await auditAiCall({
        ...auditBase,
        response: content,
        status: 'unverified_scripture',
        failureType: 'unverified_scripture',
        tokenEstimate: estimateTokenCount(auditBase.prompt, content),
      });
      audited = true;
      return res.status(422).json({
        message: 'The AI draft contained Scripture references that could not be verified. Please retry.',
        scripture_unverified: true,
        scripture,
        responsePreview: content.slice(0, 500),
      });
    }
    await auditAiCall({
      ...auditBase,
      response: content,
      status: 'success',
      tokenEstimate: estimateTokenCount(auditBase.prompt, content),
    });
    audited = true;
    res.json(content);
  } catch (err) {
    // The call we already counted failed (OpenAI 5xx/timeout/misconfig, not a
    // 429 — that path returns, it doesn't throw). Refund the quota unit so a
    // flaky upstream doesn't eat the user's daily allowance.
    if (usageConsumed) await refundUsageDb(req.userId);
    if (auditBase && !audited) {
      await auditAiCall({
        ...auditBase,
        status: 'failure',
        failureType: classifyAiFailure(err),
      });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Streaming LLM invocation.
//
// Same gating/quota/model rules as /invoke, but proxies OpenAI token-by-token
// so the UI can render content as it's written ("watch Larry write") instead
// of staring at a 20-60s spinner. Streams the raw model text as a chunked
// text/plain response; the client accumulates it and (for json_object calls)
// partial-parses to render fields progressively. Errors BEFORE the first byte
// return a normal JSON error; once streaming has started we can only end the
// (partial) stream, so the client treats a truncated body as a soft failure.
// ---------------------------------------------------------------------------
router.post('/stream', authenticateToken, async (req, res, next) => {
  let usageConsumed = false;
  let started = false;
  let auditBase = null;
  try {
    const parsed = invokeRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid AI request', issues: parsed.error.issues });
    }
    const { prompt, system_prompt, response_json_schema, feature, model, max_tokens, temperature, stream_result } = parsed.data;
    const resolvedModel = resolveModel(model, req.userPremium);
    const clampedTokens = clampTokens(max_tokens, req.userPremium);
    const clampedTemperature = clampTemperature(temperature);
    const openai = await getOpenAI();

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    usageConsumed = true;
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    // The server's own invariants ALWAYS lead the conversation. The client's
    // system prompt (persona, feature instructions) follows as a separate
    // system message and cannot remove or outrank the server policy.
    const messages = [{ role: 'system', content: SERVER_AI_INVARIANTS }];
    if (system_prompt) messages.push({ role: 'system', content: system_prompt });
    messages.push({ role: 'user', content: prompt });

    const params = {
      model: resolvedModel,
      messages,
      max_tokens: clampedTokens,
      temperature: clampedTemperature,
      stream: true,
    };
    if (response_json_schema) {
      params.response_format = { type: 'json_object' };
      // Append the JSON instruction to the CLIENT layer (its system prompt
      // when present, else the user message) - never to the server policy.
      const schemaIdx = system_prompt ? 1 : messages.length - 1;
      messages[schemaIdx].content += `\n\n${buildJsonSchemaInstruction(response_json_schema)}`;
    }

    auditBase = {
      userId: req.userId,
      feature: feature || 'general',
      model: resolvedModel,
      prompt: [system_prompt, prompt, response_json_schema ? JSON.stringify(response_json_schema) : null].filter(Boolean).join('\n'),
      startTime: Date.now(),
    };

    // Open the upstream stream. A failure here (before any byte is sent) is a
    // normal error path — refund the quota and return JSON.
    const completion = await callWithRetry(() => openai.chat.completions.create(params));

    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // ask proxies not to buffer the stream
    started = true;

    let full = '';
    let finishReason = null;
    for await (const chunk of completion) {
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        res.write(delta);
      }
      if (chunk?.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    // Converge on the same final JSON-integrity check /invoke applies. The
    // bytes are already sent, so we cannot 502 — but we CAN tell the truth:
    // audit the real outcome (a malformed/truncated stream was previously
    // recorded as `success`), and for opted-in clients append a result
    // trailer (RS control char + JSON) so the client knows the final payload
    // did not parse and can fall back instead of keeping the partial preview
    // as a "completed" sermon.
    const truncated = finishReason === 'length';
    let outcome = { status: 'success', failureType: null, ok: true };
    if (response_json_schema) {
      const finalParse = extractJson(full);
      if (!finalParse.ok) {
        outcome = {
          status: 'invalid_json',
          failureType: truncated ? 'truncated' : 'invalid_json',
          ok: false,
        };
      }
    }
    // Screen the streamed text for fabricated Scripture regardless of schema —
    // the tokens are already on the wire, so the trailer is how the client
    // learns the preview must not be kept/marked as a validated result. A
    // fabricated reference fails the whole result (client falls back to
    // /invoke, whose save then re-runs the durable Scripture gate).
    const scripture = screenStreamedScripture(full);
    if (!scripture.ok && outcome.ok) {
      outcome = { status: 'unverified_scripture', failureType: 'unverified_scripture', ok: false };
    }
    if (stream_result) {
      res.write(`\n${STREAM_RESULT_SEPARATOR}${JSON.stringify({ ok: outcome.ok, truncated, scripture })}`);
    }
    res.end();

    await auditAiCall({
      ...auditBase,
      response: full,
      status: outcome.status,
      failureType: outcome.failureType || undefined,
      tokenEstimate: estimateTokenCount(auditBase.prompt, full),
    });
  } catch (err) {
    // Quota was counted but nothing streamed → give it back (transient upstream
    // failure, not the user's fault).
    if (usageConsumed && !started) await refundUsageDb(req.userId);
    if (auditBase && started) {
      await auditAiCall({ ...auditBase, status: 'failure', failureType: classifyAiFailure(err) });
    }
    if (started) {
      // Headers already sent — just end the partial stream.
      try { res.end(); } catch { /* already closed */ }
      return;
    }
    next(err);
  }
});

// Image generation.
//
// DALL-E calls are significantly more expensive per request than text
// completions, so the route is premium-only by default. Admins/devs are
// allowed through for testing.
router.post('/image', authenticateToken, async (req, res, next) => {
  let auditBase = null;
  let audited = false;
  let usageConsumed = false;
  try {
    const parsedImage = imageRequestSchema.safeParse(req.body || {});
    if (!parsedImage.success) {
      return res.status(400).json({ message: 'Invalid image request', issues: parsedImage.error.issues });
    }
    const { prompt, size } = parsedImage.data;

    if (!req.userPremium && req.userRole !== 'admin' && req.userRole !== 'dev') {
      return res.status(402).json({
        message: 'Image generation requires Premium.',
      });
    }

    const usage = await consumeUsageDb(req.userId, req.userPremium);
    usageConsumed = true;
    if (!usage.allowed) {
      return res.status(429).json({ message: `Daily AI limit reached (${usage.limit}). Upgrade or try again tomorrow.` });
    }

    auditBase = {
      userId: req.userId,
      feature: 'image',
      model: process.env.OPENAI_IMAGE_MODEL || _resolvedImageModel || OPENAI_IMAGE_MODEL,
      prompt,
      startTime: Date.now(),
    };
    const openai = await getOpenAI();
    const { src, model } = await generateImage(openai, { prompt, size });
    if (!src) {
      throw Object.assign(new Error('Image provider returned no image data'), { status: 502 });
    }

    await auditAiCall({
      ...auditBase,
      model,
      response: 'image-generated',
      status: 'success',
      tokenEstimate: estimateTokenCount(prompt),
    });
    audited = true;
    // `url` may be a hosted URL (DALL-E) or a data: URL (gpt-image) — both work
    // directly as an <img src>.
    res.json({ url: src, model });
  } catch (err) {
    // Refund the counted unit on a genuine failure (model-missing/provider
    // error) so a broken image backend doesn't drain the user's daily quota.
    if (usageConsumed) await refundUsageDb(req.userId);
    if (auditBase && !audited) {
      await auditAiCall({
        ...auditBase,
        status: 'failure',
        failureType: classifyAiFailure(err),
      });
    }
    // If we exhausted every candidate model, give an actionable message rather
    // than a generic 500.
    if (isModelMissingError(err)) {
      return res.status(502).json({
        message: 'Image generation is unavailable: no supported image model is enabled for this OpenAI account. An admin can set OPENAI_IMAGE_MODEL to a model the account has access to.',
      });
    }
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
  refundUsageDb,
  resolveModel,
  invokeRequestSchema,
  imageRequestSchema,
  hashText,
  estimateTokenCount,
  buildJsonSchemaInstruction,
  EMAIL_TEMPLATES,
  isModelMissingError,
  imageSrcFromResponse,
  screenStreamedScripture,
};

export default router;

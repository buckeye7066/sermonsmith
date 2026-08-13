/**
 * Error reporter — when a non-admin user hits an error, capture it, analyze
 * the likely cause + fix with the LLM, and email the owner immediately.
 *
 * Hard rules:
 *   - NEVER email when the logged-in user is the owner/admin (anyone in
 *     ADMIN_EMAILS, or buckeye7066@gmail.com). Owners debug from logs; they
 *     don't need an email about their own clicks.
 *   - Fire-and-forget: callers MUST NOT await reportErrorToOwner(). The whole
 *     body is wrapped so it can never throw into a request path or crash the
 *     process via an unhandled rejection.
 *   - Throttled + capped so a hot error loop can't spam the inbox.
 *
 * Optional env:
 *   ERROR_REPORT_EMAIL — recipient (default dr.johnwhite@axiombiolabs.org)
 *   OPENAI_API_KEY     — enables AI analysis; falls back to a heuristic when absent
 *   OPENAI_MODEL       — analysis model (default gpt-4o-mini)
 *   DISABLE_AI=1       — skip the AI call entirely (heuristic only)
 */

import { sendEmail } from './email.js';
import { isAdminEmail } from '../routes/auth.js';

const OWNER_EMAIL = 'buckeye7066@gmail.com';
const DEFAULT_RECIPIENT = 'dr.johnwhite@axiombiolabs.org';

// ---------------------------------------------------------------------------
// Throttling.
//
// Per-signature: the same error from the same place is emailed at most once
// per THROTTLE_MS. Global: never more than MAX_PER_HOUR emails in a rolling
// hour so a novel-but-looping error storm can't flood the inbox either.
// ---------------------------------------------------------------------------
const THROTTLE_MS = 600_000; // 10 minutes
const MAX_PER_HOUR = 30;
const HOUR_MS = 3_600_000;

/** signature -> last-sent epoch ms */
const _lastSent = new Map();
/** rolling list of epoch-ms timestamps for sent emails in the last hour */
let _sentTimestamps = [];

function signatureFor({ source, route, error }) {
  const name = error?.name || 'Error';
  const msg = (error?.message || '').slice(0, 120);
  return `${source}|${route || ''}|${name}|${msg}`;
}

// Drop stale entries opportunistically so the maps don't grow unbounded.
function pruneThrottleState(now) {
  for (const [key, ts] of _lastSent) {
    if (now - ts > THROTTLE_MS) _lastSent.delete(key);
  }
  _sentTimestamps = _sentTimestamps.filter((ts) => now - ts < HOUR_MS);
}

/**
 * Decide whether this error may be sent right now, and (if so) record it as
 * sent. Returns true when an email should go out.
 */
function admitForSend(signature, now) {
  pruneThrottleState(now);

  const last = _lastSent.get(signature);
  if (last && now - last < THROTTLE_MS) return false;

  if (_sentTimestamps.length >= MAX_PER_HOUR) return false;

  _lastSent.set(signature, now);
  _sentTimestamps.push(now);
  return true;
}

// ---------------------------------------------------------------------------
// HTML escaping (these values are user/route/error-derived).
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSubject(value) {
  return String(value ?? '').replace(/[\r\n]/g, ' ').slice(0, 200);
}

// ---------------------------------------------------------------------------
// AI analysis (best-effort).
//
// We lazily import the OpenAI SDK exactly like routes/ai.js so the API still
// boots and reports errors even when AI is unconfigured/disabled — in that
// case we fall back to a heuristic.
// ---------------------------------------------------------------------------
let _openai = null;
async function getOpenAI() {
  if (!process.env.OPENAI_API_KEY || process.env.DISABLE_AI === '1') return null;
  if (!_openai) {
    const { default: OpenAI } = await import('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const ANALYSIS_TIMEOUT_MS = 15_000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`analysis timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const VALID_SEVERITY = new Set(['low', 'medium', 'high']);

function normalizeSeverity(value) {
  const s = String(value || '').toLowerCase();
  return VALID_SEVERITY.has(s) ? s : 'medium';
}

// Heuristic fallback when the LLM is unavailable or fails. Keyed off the
// error name/message and HTTP status so the owner still gets an actionable
// first guess.
function heuristicAnalysis(error, ctx) {
  const name = error?.name || 'Error';
  const msg = String(error?.message || '');
  const lower = msg.toLowerCase();
  const status = Number(ctx?.statusCode) || 0;

  const out = (cause, fix, severity) => ({ cause, fix, severity });

  if (name === 'TypeError') {
    return out(
      'A value was undefined/null or the wrong type when accessed (e.g. reading a property of undefined).',
      'Add a null/undefined guard or optional chaining at the access site; verify the upstream data shape that feeds it.',
      'high',
    );
  }
  if (name === 'ReferenceError') {
    return out(
      'A variable or import was referenced before it was defined or was misspelled.',
      'Check the identifier name and that the module/symbol is imported and in scope.',
      'high',
    );
  }
  if (name === 'SyntaxError' || /unexpected token|json\.parse/i.test(lower)) {
    return out(
      'Malformed input was parsed — often invalid JSON from an upstream response.',
      'Validate/guard the parse, and inspect the upstream payload that was parsed.',
      'medium',
    );
  }
  if (/prisma|p\d{4}|database|econnrefused|ecanceled|deadlock|connection pool|too many connections/i.test(lower) || name === 'PrismaClientKnownRequestError') {
    return out(
      'A database/Prisma error — connection refused, pool exhaustion, constraint violation, or a query error.',
      'Check DATABASE_URL and DB reachability, connection-pool sizing, and the failing query/constraint; review recent migrations.',
      'high',
    );
  }
  if (/timeout|timed out|etimedout|aborterror|socket hang up/i.test(lower)) {
    return out(
      'An upstream call (DB, OpenAI, or external API) exceeded its timeout.',
      'Increase the timeout if legitimate, add a retry/backoff, and confirm the upstream service is healthy.',
      'medium',
    );
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|csrf|not allowed/i.test(lower)) {
    return out(
      'An auth/authorization failure — expired session, missing token, CSRF/origin rejection, or insufficient role.',
      'Verify the session cookie/JWT flow, CORS/Origin allowlist, and the route\'s required role.',
      'medium',
    );
  }
  if (status === 404 || /not found/i.test(lower)) {
    return out(
      'A resource or route was not found.',
      'Confirm the requested id/route exists and the client is calling the correct path.',
      'low',
    );
  }
  if (/validation|invalid|zod|required|must be/i.test(lower)) {
    return out(
      'Input validation failed — the request body/params did not match the expected schema.',
      'Align the client payload with the server schema; surface a clear validation message to the user.',
      'low',
    );
  }
  return out(
    `Unclassified ${name}. See the stack trace for the throw site.`,
    'Reproduce with the route/method below, then trace from the top stack frame in app code.',
    'medium',
  );
}

async function analyzeError(error, ctx) {
  const fallback = heuristicAnalysis(error, ctx);
  let openai;
  try {
    openai = await getOpenAI();
  } catch {
    openai = null;
  }
  if (!openai) return fallback;

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const stack = String(error?.stack || '').slice(0, 2000);
    const prompt = [
      'You are debugging the SermonSmith app (React web + Express/Prisma/PostgreSQL API, OpenAI for AI features).',
      'Given the error below, respond with STRICT JSON only — no prose, no code fences — of the exact shape:',
      '{"cause": string, "fix": string, "severity": "low"|"medium"|"high"}',
      '"cause" = the most likely root cause; "fix" = the concrete code/config fix.',
      '',
      `source: ${ctx?.source || 'unknown'}`,
      `route: ${ctx?.route || 'unknown'}  method: ${ctx?.method || 'unknown'}  status: ${ctx?.statusCode ?? 'n/a'}`,
      `error.name: ${error?.name || 'Error'}`,
      `error.message: ${(error?.message || '').slice(0, 600)}`,
      `error.stack:\n${stack}`,
    ].join('\n');

    const completion = await withTimeout(
      openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      ANALYSIS_TIMEOUT_MS,
    );

    const content = completion?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const first = content.search(/[{[]/);
      const last = content.lastIndexOf('}');
      if (first !== -1 && last > first) parsed = JSON.parse(content.slice(first, last + 1));
    }
    if (parsed && (parsed.cause || parsed.fix)) {
      return {
        cause: String(parsed.cause || fallback.cause),
        fix: String(parsed.fix || fallback.fix),
        severity: normalizeSeverity(parsed.severity || fallback.severity),
      };
    }
  } catch (e) {
    console.error('[errorReporter] AI analysis failed, using heuristic:', e && e.message ? e.message.replace(/OPENAI_API_KEY=[^&\s]+/g, 'OPENAI_API_KEY=[REDACTED]') : e);
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Public entry point — fire-and-forget. Never await this from a caller.
// ---------------------------------------------------------------------------
export function reportErrorToOwner({ error, source, userEmail, route, method, requestId, statusCode, extra } = {}) {
  // Kick off an internal async IIFE so the caller never blocks and a thrown
  // rejection is always contained here.
  (async () => {
    try {
      // Owner/admin exclusion — never email the owner about their own errors.
      if (userEmail && (isAdminEmail(userEmail) || userEmail.toLowerCase() === OWNER_EMAIL)) {
        return;
      }

      const safeError = error || new Error('Unknown error');
      const signature = signatureFor({ source, route, error: safeError });
      if (!admitForSend(signature, Date.now())) return;

      const ctx = { source, route, method, statusCode };
      const { cause, fix, severity } = await analyzeError(safeError, ctx);

      const errName = safeError.name || 'Error';
      const errMsg = safeError.message || String(safeError);
      const shortMsg = safeSubject(errMsg).slice(0, 140);
      const who = userEmail || 'anonymous';
      const timestamp = new Date().toISOString();
      const stack = String(safeError.stack || '(no stack)');

      const subject = safeSubject(`[SermonSmith] Error for ${who}: ${errName}: ${shortMsg}`);

      const text = [
        `SermonSmith error report`,
        ``,
        `Time:        ${timestamp}`,
        `User:        ${who}`,
        `Source:      ${source || 'unknown'}`,
        `Route:       ${method || ''} ${route || 'unknown'}`,
        `Request ID:  ${requestId || 'n/a'}`,
        `Status:      ${statusCode ?? 'n/a'}`,
        `Error:       ${errName}: ${errMsg}`,
        ``,
        `Severity:    ${severity}`,
        `Likely cause: ${cause}`,
        `Suggested fix: ${fix}`,
        ``,
        extra ? `Extra: ${JSON.stringify(extra)}` : '',
        ``,
        `Stack:`,
        stack,
      ].filter((line) => line !== undefined).join('\n');

      const severityColor = severity === 'high' ? '#dc2626' : severity === 'medium' ? '#d97706' : '#2563eb';

      const html = `
        <div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #111;">
          <h2 style="color: #4f46e5; margin-bottom: 4px;">SermonSmith Error Report</h2>
          <p style="margin: 0 0 16px; color: #6b7280; font-size: 13px;">${escapeHtml(timestamp)}</p>
          <table style="border-collapse: collapse; font-size: 14px; width: 100%;">
            <tr><td style="padding: 4px 8px; color: #6b7280;">User</td><td style="padding: 4px 8px;"><strong>${escapeHtml(who)}</strong></td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Source</td><td style="padding: 4px 8px;">${escapeHtml(source || 'unknown')}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Route</td><td style="padding: 4px 8px;">${escapeHtml(method || '')} ${escapeHtml(route || 'unknown')}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Request ID</td><td style="padding: 4px 8px;">${escapeHtml(requestId || 'n/a')}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Status</td><td style="padding: 4px 8px;">${escapeHtml(statusCode ?? 'n/a')}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Error</td><td style="padding: 4px 8px;"><strong>${escapeHtml(errName)}</strong>: ${escapeHtml(errMsg)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #6b7280;">Severity</td><td style="padding: 4px 8px; color: ${severityColor}; font-weight: 700; text-transform: uppercase;">${escapeHtml(severity)}</td></tr>
          </table>
          <h3 style="margin: 20px 0 4px; color: #111;">Likely cause</h3>
          <p style="margin: 0; font-size: 14px;">${escapeHtml(cause)}</p>
          <h3 style="margin: 20px 0 4px; color: #111;">Suggested fix</h3>
          <p style="margin: 0; font-size: 14px;">${escapeHtml(fix)}</p>
          ${extra ? `<h3 style="margin: 20px 0 4px; color: #111;">Extra</h3><pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${escapeHtml(JSON.stringify(extra, null, 2))}</pre>` : ''}
          <h3 style="margin: 20px 0 4px; color: #111;">Stack</h3>
          <pre style="background:#f3f4f6;padding:12px;border-radius:6px;overflow:auto;font-size:12px;white-space:pre-wrap;">${escapeHtml(stack)}</pre>
        </div>
      `;

      // Recipient resolution: explicit ERROR_REPORT_EMAIL wins; otherwise the
      // deployment's first ADMIN_EMAILS entry (so a fresh operator's production
      // errors go to THEM, not to a hardcoded third party); the hardcoded
      // address remains only as a last-resort default for this deployment.
      const adminFallback = String(process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
      const to = process.env.ERROR_REPORT_EMAIL || adminFallback || DEFAULT_RECIPIENT;
      await sendEmail({ to, subject, html, text });
    } catch (e) {
      console.error('[errorReporter]', e);
    }
  })();
}

// Exposed for tests.
export const __test = {
  signatureFor,
  heuristicAnalysis,
  normalizeSeverity,
  admitForSend,
  _resetThrottle() {
    _lastSent.clear();
    _sentTimestamps = [];
  },
};

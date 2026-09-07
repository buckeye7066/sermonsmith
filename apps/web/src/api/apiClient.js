/**
 * SermonSmith API client.
 * Provides auth, entity CRUD, AI integrations, and cloud function calls
 * against the self-hosted Express/Prisma backend (Railway).
 *
 * Authentication uses httpOnly cookies set by the server — no tokens
 * are stored in localStorage or sessionStorage (OWASP best practice).
 */

import { coerceToSchema } from '@/lib/aiStructured';
import { outputContractFor } from '@sermonsmith/shared/aiContracts';

// ---------------------------------------------------------------------------
// API base URL resolution.
//
// Vite inlines `import.meta.env.VITE_API_URL` at build time, which means
// the Electron desktop app's first-run prompt (where the user types their
// API URL) cannot influence the already-bundled renderer just by setting
// `process.env.VITE_API_URL` in the main process. We resolve the base
// dynamically:
//
//   1. If we're running inside Electron and a config has been saved,
//      `window.electron.getApiUrl()` returns it.
//   2. Otherwise we fall back to the bundled VITE_API_URL.
//   3. Otherwise (custom-domain proxy setup) we fall back to the same
//      origin as the document.
//
// We cache the resolved base in module scope after the first call so we
// don't pay an IPC round-trip on every request.
// ---------------------------------------------------------------------------
const BUNDLED_API_URL = import.meta.env.VITE_API_URL || '';

let _cachedApiBase = null;
async function getApiBaseUrl() {
  if (_cachedApiBase !== null) return _cachedApiBase;

  let resolved = '';
  try {
    if (typeof window !== 'undefined' && window.electron?.getApiUrl) {
      const configured = await window.electron.getApiUrl();
      if (configured) resolved = configured;
    }
  } catch {
    // Electron bridge unavailable or threw — fall through to bundled value.
  }

  if (!resolved) resolved = BUNDLED_API_URL;
  if (!resolved && typeof window !== 'undefined') resolved = window.location.origin;
  if (!resolved) resolved = 'http://localhost:3101';

  _cachedApiBase = resolved.replace(/\/+$/, '');
  return _cachedApiBase;
}

// Test-only: lets unit/integration code blow the cache when it monkey-patches
// window.electron between runs.
export function __resetApiBaseCache() {
  _cachedApiBase = null;
}

// ---------------------------------------------------------------------------
// Unauthorized (session-expired) handling
//
// A single app-level handler may register here. apiFetch invokes it whenever
// the server answers 401 on a call that is NOT part of the auth handshake
// itself (login / register / me / logout). AuthContext registers it to clear
// auth state and bounce the user to /Login with an honest "session expired"
// message — see lib/AuthContext.jsx.
//
// We keep this as a plain module-scope callback (not React state) so the
// framework-agnostic client stays decoupled from React. Every feature page
// already routes its requests through apiFetch, so wiring the redirect here
// fixes the whole class of "silent 401 behind a generic error" bugs in one
// place instead of page-by-page.
// ---------------------------------------------------------------------------
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = typeof fn === 'function' ? fn : null;
}

// Auth-handshake paths whose 401s are *expected* and handled inline by the
// caller: a wrong password on /login, the "not logged in" answer on the
// startup /me probe, an already-expired cookie on /logout. Firing the global
// session-expired flow for these would, e.g., redirect the login page to
// itself after a bad-password attempt.
function isAuthHandshakePath(path, method = 'GET') {
  const pathname = path.split('?')[0].replace(/\/$/, '');
  const verb = String(method).toUpperCase();
  return (verb === 'GET' && ['/api/auth/me', '/api/auth/session'].includes(pathname))
    || (verb === 'POST' && [
      '/api/auth/login', '/api/auth/register', '/api/auth/logout',
      '/api/auth/forgot-password', '/api/auth/reset-password',
    ].includes(pathname));
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const AI_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_AI_REQUEST_TIMEOUT_MS || 90_000);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function requestTimeoutFor(path, timeoutMs) {
  if (Number.isFinite(timeoutMs)) return timeoutMs;
  return path.startsWith('/api/ai/') ? AI_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

// Retry policy.
//
// The previous implementation auto-retried every failed request twice on
// network errors and 5xx — that's safe for idempotent GETs, but it
// silently double- or triple-charged the user's AI quota when an OpenAI
// 504 happened mid-flight, double-created entities, and double-issued
// Stripe checkout / billing-portal sessions. We now only retry when:
//
//   - the path is GET / HEAD, OR
//   - the caller explicitly opted in via `retry: true`.
//
// AI calls are NEVER retried automatically because each attempt consumes
// a daily-usage slot and bills tokens. Callers can still pass
// `retry: false` to override even for safe verbs.
function shouldRetry(path, options) {
  if (options.retry === false) return false;
  if (path.startsWith('/api/ai/')) return false;

  const method = String(options.method || 'GET').toUpperCase();

  if (options.retry === true) return true;
  return method === 'GET' || method === 'HEAD';
}

export async function apiFetch(path, options = {}, _retryCount = 0) {
  const { retry, timeoutMs, absoluteUrl, credentials, ...fetchOptions } = options;

  const headers = {
    ...(absoluteUrl ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };

  // Only create an internal AbortController when the caller hasn't supplied their own signal.
  // This avoids allocating a wasted controller (and its timeout) for every caller-cancelled request.
  const ownController = fetchOptions.signal ? null : new AbortController();
  const requestTimeout = requestTimeoutFor(path, timeoutMs);
  const timeout = ownController
    ? setTimeout(() => ownController.abort(), requestTimeout)
    : null;
  const signal = ownController ? ownController.signal : fetchOptions.signal;

  // Absolute public URLs (e.g. mobile OTA feed on the production CDN host)
  // still go through this client so timeout / retry / error behavior stays
  // centralized (AGENTS.md Rule 1). Auth cookies are omitted by default for
  // cross-origin public feeds unless the caller opts in.
  const isAbsolute = typeof absoluteUrl === 'string' && /^https?:\/\//i.test(absoluteUrl);
  const url = isAbsolute
    ? absoluteUrl
    : `${await getApiBaseUrl()}${path}`;
  const creds = credentials !== undefined
    ? credentials
    : (isAbsolute ? 'omit' : 'include');

  let res;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
      credentials: creds,
      // Auth responses are session-specific; never replay a previous identity
      // or expired-session result from the browser's HTTP cache.
      ...(!isAbsolute && path.startsWith('/api/auth/') ? { cache: 'no-store' } : {}),
    });
  } catch (err) {
    if (timeout) clearTimeout(timeout);
    // Retry on network errors / timeouts only when the call is safely
    // idempotent. AI / paid POSTs are explicitly excluded by shouldRetry.
    if (
      _retryCount < MAX_RETRIES &&
      err.name !== 'AbortError' &&
      shouldRetry(path, { ...options, retry })
    ) {
      const jitter = Math.random() * RETRY_DELAY_MS;
      const backoff = Math.min(RETRY_DELAY_MS * Math.pow(2, _retryCount), 10_000);
      await new Promise(r => setTimeout(r, backoff + jitter));
      return apiFetch(path, options, _retryCount + 1);
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!res.ok) {
    if (
      res.status >= 500 &&
      _retryCount < MAX_RETRIES &&
      shouldRetry(path, { ...options, retry })
    ) {
      const jitter = Math.random() * RETRY_DELAY_MS;
      const backoff = Math.min(RETRY_DELAY_MS * Math.pow(2, _retryCount), 10_000);
      await new Promise(r => setTimeout(r, backoff + jitter));
      return apiFetch(path, options, _retryCount + 1);
    }
    // For absolute public feeds, callers may need the raw Response (non-JSON
    // bodies). Prefer JSON error bodies when present.
    let body = null;
    try {
      body = await res.json();
    } catch (err) {
      console.error('Failed to parse error response:', err);
      body = { message: res.statusText };
    }
    const error = new Error(body?.message || `API error ${res.status}`);
    error.status = res.status;
    error.data = body;
    const expectedAuthFailure = !isAbsolute && res.status === 401
      && isAuthHandshakePath(path, fetchOptions.method);
    if (!expectedAuthFailure) {
      console.error('API fetch error:', error.message, 'Status:', res.status, 'Path:', path);
    }

    // Surface a real, mid-session 401 to the app-level handler so the UI can
    // tell the user their session expired and route them to login — instead
    // of each page swallowing it into a vague "couldn't do X" message. We skip
    // the auth-handshake endpoints (their 401s are expected and handled by the
    // caller). The handler itself decides whether we were actually logged in.
    if (res.status === 401 && !isAbsolute && !isAuthHandshakePath(path, fetchOptions.method)) {
      try { _onUnauthorized?.(path); } catch { /* a broken handler must never mask the API error */ }
    }

    throw error;
  }

  if (res.status === 204) return null;
  // Absolute-URL callers that need the Response itself pass { rawResponse: true }.
  if (options.rawResponse) return res;
  const contentType = res.headers?.get?.('content-type') || '';
  if (contentType.includes('application/json') || !isAbsolute) {
    return res.json();
  }
  return res;
}

// ---------------------------------------------------------------------------
// Entity CRUD (generic document store)
// ---------------------------------------------------------------------------

// Pages call these methods with positional sort/limit/offset arguments
// like `filter(query, '-created_date', 50)` and `list('-created_date')`.
// The previous implementation silently discarded those — pages then
// rendered unsorted, oversized lists and the bug looked like a backend
// regression. The signatures here intentionally mirror what the pages
// already pass.
function createEntityMethods(entityName) {
  const base = `/api/entities/${entityName}`;
  const safeId = (id) => encodeURIComponent(String(id));
  return {
    create: (data) =>
      apiFetch(base, { method: 'POST', body: JSON.stringify(data) }),

    list: (orderBy = '-created_date', limit = 200, offset = 0) =>
      apiFetch(`${base}/filter`, {
        method: 'POST',
        body: JSON.stringify({ _orderBy: orderBy, _limit: limit, _offset: offset }),
      }),

    get: (id) => apiFetch(`${base}/${safeId(id)}`),

    update: (id, data) =>
      apiFetch(`${base}/${safeId(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id) =>
      apiFetch(`${base}/${safeId(id)}`, { method: 'DELETE' }),

    revisions: (id, limit = 100, offset = 0) =>
      apiFetch(`${base}/${safeId(id)}/revisions?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),

    restoreRevision: (id, revisionId) =>
      apiFetch(`${base}/${safeId(id)}/revisions/${safeId(revisionId)}/restore`, {
        method: 'POST',
      }),

    instantiate: (id, requestId) =>
      apiFetch(`${base}/${safeId(id)}/instantiate`, {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId }),
        // This endpoint is server-idempotent on request_id, so retrying a
        // dropped response cannot duplicate a series or any sermon drafts.
        retry: true,
      }),

    filter: (query = {}, orderBy = '-created_date', limit = 200, offset = 0) =>
      apiFetch(`${base}/filter`, {
        method: 'POST',
        body: JSON.stringify({
          ...(query || {}),
          _orderBy: orderBy,
          _limit: limit,
          _offset: offset,
        }),
      }),

    bulkCreate: (items) =>
      apiFetch(`${base}/bulk`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),

    // Explicit human review acknowledgment (scripture-gated types only).
    // The generic create/update paths strip pastor_reviewed server-side;
    // this endpoint is the one legitimate way to set or withdraw it.
    review: (id, acknowledged, checklist = []) =>
      apiFetch(`${base}/${safeId(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          acknowledged: !!acknowledged,
          ...(acknowledged ? { checklist } : {}),
        }),
      }),
  };
}

const entitiesProxy = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'then') return undefined;
    return createEntityMethods(String(prop));
  },
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const auth = {
  // Startup uses the optional read-only probe; explicit identity checks keep
  // the protected /me contract for existing callers.
  me: ({ optional = false } = {}) => apiFetch(optional ? '/api/auth/session' : '/api/auth/me'),
  // Public login-maintenance status probe (no auth required).
  maintenance: ()         => apiFetch('/api/auth/maintenance'),
  updateMe: (data)        => apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  exportData: ()          => apiFetch('/api/auth/export'),
  deleteAccount: ()       => apiFetch('/api/auth/me', { method: 'DELETE' }),
  deleteUser: (id)        => apiFetch(`/api/auth/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setUserBanned: (id, banned) => apiFetch(`/api/auth/users/${encodeURIComponent(id)}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned: Boolean(banned) }),
  }),
  revokeSessions: ()      => apiFetch('/api/auth/revoke-sessions', { method: 'POST' }),

  login: (email, password) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email, password, name) =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  redirectToLogin: (returnUrl) => {
    const target = returnUrl
      ? `/Login?return=${encodeURIComponent(returnUrl)}`
      : '/Login';
    window.location.href = target;
  },

  changePassword: (currentPassword, newPassword) =>
    apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (email) =>
    apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, newPassword) =>
    apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  logout: async (returnUrl) => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout request failed (cookie may already be expired):', err.message);
    }
    if (returnUrl) window.location.href = returnUrl;
  },
};

// ---------------------------------------------------------------------------
// Integrations (LLM, image generation, email, etc.)
// ---------------------------------------------------------------------------

// ASCII Record Separator (0x1E). New /stream responses append `\n` + this
// char + a one-line JSON `{ ok, truncated }` result trailer when the request
// opts in via `stream_result: true`. Keep in sync with
// STREAM_RESULT_SEPARATOR in services/api/src/routes/ai.js.
const STREAM_RESULT_SEPARATOR = String.fromCharCode(0x1e);

// The authentic trailer is prefixed with a PER-STREAM crypto-random nonce the
// server delivers OUT OF BAND in this response header (before any model bytes).
// The model never sees it and it changes every stream, so a static value echoed
// from model output or a prior stream is useless. The client requires this exact
// nonce immediately after the LAST RS before parsing the trailer JSON; combined
// with the server's RS-strip of model deltas, the frame is unforgeable. Header
// name kept in sync with STREAM_TRAILER_NONCE_HEADER in services/api/src/routes/ai.js.
const STREAM_TRAILER_NONCE_HEADER = 'X-Stream-Trailer-Nonce';

// Duplicate-key detector for a small JSON trailer. JSON.parse silently keeps the
// LAST value for a repeated key, so a tampered `{"ok":false,"ok":true}` (or its
// unicode-escaped spelling `{"ok":false,"ok":true}`) would otherwise parse
// to ok:true. We scan the raw text, tracking one key-set per open object (arrays
// have no keys), and report a repeat AT A GIVEN LEVEL. Each key token is DECODED
// with JSON.parse before the Set lookup so the detector normalizes escapes
// EXACTLY as the value parser does — an escaped duplicate collides and can never
// slip past while last-wins keeps its later value.
function trailerHasDuplicateKeys(text) {
  const stack = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === '{') { stack.push(new Set()); i++; continue; }
    if (ch === '}') { stack.pop(); i++; continue; }
    if (ch === '[') { stack.push(null); i++; continue; } // array level: no keys
    if (ch === ']') { stack.pop(); i++; continue; }
    if (ch === '"') {
      // Find the end of the quoted string, respecting \\ and \" escapes.
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '"') break;
        j += 1;
      }
      let k = j + 1;
      while (k < n && /\s/.test(text[k])) k += 1;
      if (text[k] === ':') { // this string is an object KEY
        const top = stack[stack.length - 1];
        if (top instanceof Set) {
          // Decode via JSON.parse so escaped spellings normalize like the value
          // parser (e.g. "ok" -> "ok"); on a malformed token treat the raw
          // slice as the key (the overall JSON.parse fails anyway → rejected).
          let key;
          try { key = JSON.parse(text.slice(i, j + 1)); } catch { key = text.slice(i, j + 1); }
          if (top.has(key)) return true;
          top.add(key);
        }
        i = k + 1; continue;
      }
      i = j + 1; continue; // it was a string VALUE
    }
    i += 1;
  }
  return false;
}

// EXACT, consistent, positive success-trailer check. Resolve ONLY on a clean,
// well-formed success trailer: no unknown keys, no duplicate keys, verdict
// fields strictly boolean and present, and evidence CONSISTENT with the verdict
// (scripture.ok:true requires fabricated:0 and numeric, non-negative counts).
// Anything else fails closed.
const TRAILER_TOP_KEYS = new Set(['ok', 'truncated', 'scripture']);
const TRAILER_SCRIPTURE_KEYS = new Set(['ok', 'checked', 'fabricated']);
function isFullyValidSuccessTrailer(result, rawText) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  if (trailerHasDuplicateKeys(rawText)) return false;
  if (Object.keys(result).length !== TRAILER_TOP_KEYS.size || Object.keys(result).some((key) => !TRAILER_TOP_KEYS.has(key))) return false;
  if (result.ok !== true || result.truncated !== false) return false;

  const s = result.scripture;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  if (Object.keys(s).some((key) => !TRAILER_SCRIPTURE_KEYS.has(key))) return false;
  if (s.ok !== true) return false;
  // The server's screen ALWAYS emits {ok, checked, fabricated}, so a success
  // trailer MUST carry consistent numeric evidence — no evidence-stripping
  // downgrade (a bare {ok:true} that skips the fabricated===0 check is rejected).
  if (!Object.prototype.hasOwnProperty.call(s, 'checked')
      || !Object.prototype.hasOwnProperty.call(s, 'fabricated')) return false;
  if (!Number.isSafeInteger(s.checked) || s.checked < 0) return false;
  if (!Number.isSafeInteger(s.fabricated) || s.fabricated !== 0) return false;
  return true;
}

function serverWorkflowRequest(p, { streaming = false } = {}) {
  // Default only inside this trusted application adapter for old in-app call
  // sites. The API still receives an explicit workflow URL and never trusts a
  // body label; source text cannot alter the selected workflow.
  const workflow = String(p?.feature || 'sermon').trim().toLowerCase();
  const outputContract = p?.response_json_schema
    ? outputContractFor(workflow, p.response_json_schema)
    : null;
  if (p?.response_json_schema && !outputContract) {
    throw new Error(`No trusted structured-output contract is registered for the ${workflow} workflow.`);
  }
  const body = {
    input: p?.prompt,
    ...(outputContract ? { output_contract: outputContract } : {}),
    ...(p?.model !== undefined ? { model: p.model } : {}),
    ...(p?.max_tokens !== undefined ? { max_tokens: p.max_tokens } : {}),
    ...(p?.temperature !== undefined ? { temperature: p.temperature } : {}),
    ...(streaming ? { stream_result: true } : {}),
  };
  return {
    path: `/api/ai/workflows/${encodeURIComponent(workflow)}`,
    body,
  };
}

const integrations = {
  Core: {
    // When the caller declares a `response_json_schema`, coerce the response to
    // that schema's types at this single boundary. The model can return a valid
    // JSON object whose FIELD TYPES still drift from the schema (an object where
    // a string was promised, a scalar where an array was). Rendering such a
    // value throws React error #31 and blanks the page. Coercing here protects
    // every page at once instead of relying on per-page normalizers.
    InvokeLLM: async (p) => {
      const workflow = serverWorkflowRequest(p);
      const result = await apiFetch(`${workflow.path}/invoke`, {
        method: 'POST',
        body: JSON.stringify(workflow.body),
      });
      if (p && p.response_json_schema) {
        try { return coerceToSchema(result, p.response_json_schema); } catch { /* fall back to raw */ }
      }
      return result;
    },

    // Streaming variant of InvokeLLM. Reads the chunked text response and calls
    // `onDelta(fullTextSoFar, chunk)` as tokens arrive; resolves with the full
    // text. Throws on a pre-stream error (4xx/5xx) just like apiFetch so callers
    // can fall back to InvokeLLM. NOT auto-retried (each call bills the user).
    //
    // Validator parity with /invoke: we send `stream_result: true`, so the
    // server appends a result trailer (RS control char + JSON `{ok,truncated}`)
    // after the streamed text. If the server reports the final payload did not
    // parse as the requested JSON, this THROWS — the streaming path's
    // equivalent of /invoke's 502 — so callers fall back to InvokeLLM instead
    // of silently keeping a partial preview as the "completed" result. Old
    // servers that don't know the flag simply send no trailer (legacy pass-
    // through). The trailer is stripped from both onDelta text and the
    // resolved value.
    StreamLLM: async (p, onDelta) => {
      const apiBase = await getApiBaseUrl();
      const workflow = serverWorkflowRequest(p, { streaming: true });
      // Idle-timeout guard: unlike apiFetch, a stalled stream would otherwise
      // hang the builder forever. Abort if no chunk arrives within STREAM_IDLE_MS
      // (reset on every chunk). On abort the fetch/read rejects and the caller
      // falls back to InvokeLLM.
      const STREAM_IDLE_MS = 60_000;
      const controller = new AbortController();
      let idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_MS);
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_MS);
      };
      // A network failure here rejects naturally — callers fall back to InvokeLLM.
      let res;
      try {
        res = await fetch(`${apiBase}${workflow.path}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(workflow.body),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(idleTimer);
        throw err;
      }
      if (!res.ok || !res.body) {
        clearTimeout(idleTimer);
        const body = await res.json().catch(() => ({ message: `API error ${res.status}` }));
        const error = new Error(body.message || `API error ${res.status}`);
        error.status = res.status;
        error.data = body;
        if (res.status === 401 && !isAuthHandshakePath(`${workflow.path}/stream`)) {
          try { _onUnauthorized?.(`${workflow.path}/stream`); } catch { /* never mask */ }
        }
        throw error;
      }

      // Per-stream nonce delivered out of band in the response header — the model
      // never sees it, so it authenticates the trailer as server-produced.
      const trailerNonce = res.headers.get(STREAM_TRAILER_NONCE_HEADER);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          resetIdle();
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            full += chunk;
            if (typeof onDelta === 'function') {
              // Never surface the result trailer (or a partial prefix of it)
              // in the live preview.
              const visible = full.indexOf(STREAM_RESULT_SEPARATOR) === -1
                ? full
                : full.slice(0, full.indexOf(STREAM_RESULT_SEPARATOR));
              try { onDelta(visible, chunk); } catch { /* a render hiccup must not kill the stream */ }
            }
          }
        }
      } finally {
        clearTimeout(idleTimer);
      }

      // We ALWAYS request stream_result:true, so the server MUST append a
      // validation trailer (RS char + JSON). A MISSING trailer means the stream
      // ended before it could be validated — e.g. a mid-stream upstream error
      // that dropped the mandatory trailer, or an out-of-date server. Treat it
      // as a PROTOCOL FAILURE, never as a completed answer: an unscreened /
      // partial preview (which may already contain fabricated Scripture) must
      // not be kept as the result.
      // Locate the trailer at the LAST RS (the server writes exactly one, right
      // before the marker+JSON; content RS bytes were replaced with spaces
      // server-side). A missing separator → interrupted/unvalidated stream.
      const sepIdx = full.lastIndexOf(STREAM_RESULT_SEPARATOR);
      if (sepIdx === -1) {
        const error = new Error('The AI stream ended before it could be validated. Please retry.');
        error.status = 502;
        error.streamTextPreview = full.replace(/\n$/, '').slice(0, 500);
        error.streamIncomplete = true;
        throw error;
      }
      const content = full.slice(0, sepIdx);
      const afterSep = full.slice(sepIdx + 1);
      // Frame integrity: we must have received the out-of-band nonce header;
      // content must contain NO RS (a model-injected RS is stripped server-side,
      // so one here signals tampering); and the authentic trailer MUST begin with
      // the exact per-stream nonce. Any failure → forged/absent frame → fail
      // closed, never accept as success.
      if (!trailerNonce
          || content.indexOf(STREAM_RESULT_SEPARATOR) !== -1
          || !afterSep.startsWith(trailerNonce)) {
        const error = new Error('The AI stream validation frame was invalid. Please retry.');
        error.status = 502;
        error.streamTextPreview = content.replace(/\n$/, '').slice(0, 500);
        error.streamIncomplete = true;
        throw error;
      }
      const text = content.replace(/\n$/, '');
      const rawTrailer = afterSep.slice(trailerNonce.length);
      let result = null;
      try { result = JSON.parse(rawTrailer); } catch { /* malformed trailer */ }
      // POSITIVE + STRICT validation: resolve ONLY on an exact, consistent,
      // fully-valid success trailer (see isFullyValidSuccessTrailer) — the right
      // keys and nothing more, no duplicate keys (JSON.parse's last-wins can't
      // overwrite a failure with success), verdict fields strictly boolean and
      // present, and evidence CONSISTENT with the verdict (scripture.ok:true
      // requires fabricated:0). Anything else — missing/malformed/contradictory
      // trailer — is FAILURE. Absence of explicit, coherent success is never
      // success: a streamed preview can carry fabricated Scripture the server
      // only confirms clean in the trailer, so the UI must never mark it
      // validated without a clean one.
      const fullyValid = isFullyValidSuccessTrailer(result, rawTrailer);
      if (!fullyValid) {
        const scriptureFailed = !!(result && result.scripture && result.scripture.ok === false);
        const error = new Error(
          !result
            ? 'The AI stream result could not be validated. Please retry.'
            : result.truncated === true
              ? 'The AI response was too long and was cut off before it finished.'
              : scriptureFailed
                ? 'The AI draft contained Scripture references that could not be verified. Regenerating.'
                : 'The AI stream could not be confirmed as validated. Please retry.',
        );
        error.status = 502;
        error.streamTextPreview = text.slice(0, 500);
        error.truncated = !!(result && result.truncated);
        error.scriptureUnverified = scriptureFailed;
        throw error;
      }
      return text;
    },
    SendEmail:                  (p) => apiFetch('/api/ai/email',    { method: 'POST', body: JSON.stringify(p) }),
    GenerateImage:              (p) => apiFetch('/api/ai/image',    { method: 'POST', body: JSON.stringify(p) }),
  },
};

// ---------------------------------------------------------------------------
// Cloud functions (bible passage, Stripe, admin helpers, etc.)
// ---------------------------------------------------------------------------

// Cloud-function calls are POSTs, so by default they don't auto-retry. The
// Bible-passage helpers are pure read operations against bible-api.com and
// are safe to retry on transient failures, so we mark them explicitly.
const RETRYABLE_FUNCTIONS = new Set([
  'biblePassage',
  'listAvailableTranslations',
  'verifyVerseWording',
  'getPassageMultiSource',
]);

const functions = {
  invoke: (name, params) =>
    apiFetch(`/api/functions/${name}`, {
      method: 'POST',
      retry: RETRYABLE_FUNCTIONS.has(name),
      body: JSON.stringify(params || {}),
    }),
  shareLinkPage: (resourceId, { offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ resourceId, offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/functions/share-links?${query}`);
  },
  shareLinks: async (resourceId) => {
    const links = [];
    let offset = 0;
    while (offset !== null) {
      const page = await functions.shareLinkPage(resourceId, { offset, limit: 100 });
      // Rolling compatibility with an older API that returned a bare array.
      if (Array.isArray(page)) return { links: [...links, ...page], next_offset: null };
      links.push(...(Array.isArray(page?.links) ? page.links : []));
      const next = Number.isSafeInteger(page?.next_offset) ? page.next_offset : null;
      if (next !== null && next <= offset) {
        throw new Error('Share-link pagination returned an invalid cursor.');
      }
      offset = next;
    }
    return { links, next_offset: null };
  },
  revokeShareableLink: (id) => apiFetch(`/api/functions/share-links/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Community / share routes — dedicated, public-where-public.
//
// SharedContent's "public" tab tried to use the generic entity API, which
// scopes to the calling user. That meant the community feed only ever
// showed the viewer's own content. These routes hit a server-side
// allow-public path that bypasses tenant scoping safely.
// ---------------------------------------------------------------------------
const community = {
  sharedContent: (type) => {
    const q = type && type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
    return apiFetch(`/api/community/shared-content${q}`);
  },
  // Public forum/community feeds — these read across ALL users (unlike the
  // tenant-scoped entity API), so members actually see each other's content.
  posts: () => apiFetch('/api/community/posts'),
  myForumContent: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/posts/mine?${query}`);
  },
  myRatings: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/ratings/mine?${query}`);
  },
  deleteRating: (id) => apiFetch(`/api/community/ratings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  mySharedSeries: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/shared-series/mine?${query}`);
  },
  unshareSeries: (id) => apiFetch(`/api/community/shared-series/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  mySharedContent: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/shared-content/mine?${query}`);
  },
  withdrawSharedContent: (id) => apiFetch(`/api/community/shared-content/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  myPublicReadingPlans: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/reading-plans/mine?${query}`);
  },
  withdrawReadingPlan: (id) => apiFetch(`/api/community/reading-plans/${encodeURIComponent(id)}/publication`, { method: 'DELETE' }),
  myComments: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/comments/mine?${query}`);
  },
  createPost: (payload) => apiFetch('/api/community/posts', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  deletePost: (postId) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }),
  reportPost: (postId, payload = {}) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/report`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  sermons: (sort = 'popular') => apiFetch(`/api/community/sermons?sort=${encodeURIComponent(sort)}`),
  mySharedSermonPage: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/sermons/mine?${query}`);
  },
  // Existing analytics/library callers expect an array. Traverse every
  // lifecycle page here while exposing mySharedSermonPage to management UIs.
  mySharedSermons: async () => {
    const sermons = [];
    const seenOffsets = new Set();
    let offset = 0;
    for (;;) {
      if (seenOffsets.has(offset)) throw new Error('The server returned a non-advancing shared-sermon page');
      seenOffsets.add(offset);
      const query = new URLSearchParams({ offset: String(offset), limit: '100' });
      const page = await apiFetch(`/api/community/sermons/mine?${query}`);
      // Rolling-deploy compatibility with the former unpaginated response.
      if (Array.isArray(page)) return page;
      sermons.push(...(page?.sermons || []));
      if (page?.next_offset === null || page?.next_offset === undefined) return sermons;
      const nextOffset = Number(page.next_offset);
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
        throw new Error('The server returned an invalid shared-sermon page');
      }
      offset = nextOffset;
    }
  },
  shareSermon: (payload) => apiFetch('/api/community/sermons/share', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  unshareSermon: (id) => apiFetch(`/api/community/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  recordSermonView: (id) => apiFetch(`/api/community/sermons/${encodeURIComponent(id)}/view`, { method: 'POST' }),
  recordSermonFork: (id, createdSermonId) => apiFetch(`/api/community/sermons/${encodeURIComponent(id)}/fork`, {
    method: 'POST',
    body: JSON.stringify({ created_sermon_id: createdSermonId }),
  }),
  sermonRatings: (id) => apiFetch(`/api/community/sermons/${encodeURIComponent(id)}/ratings`),
  rateSermon: (id, payload) => apiFetch(`/api/community/sermons/${encodeURIComponent(id)}/rating`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  comments: (contentType, contentId) => {
    const query = new URLSearchParams({ content_type: contentType, content_id: contentId });
    return apiFetch(`/api/community/comments?${query}`);
  },
  createComment: (payload) => apiFetch('/api/community/comments', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  likeComment: (id) => apiFetch(`/api/community/comments/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  unlikeComment: (id) => apiFetch(`/api/community/comments/${encodeURIComponent(id)}/like`, { method: 'DELETE' }),
  pinComment: (id) => apiFetch(`/api/community/comments/${encodeURIComponent(id)}/pin`, { method: 'PATCH' }),
  deleteComment: (id) => apiFetch(`/api/community/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  likePost: (postId) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' }),
  unlikePost: (postId) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, { method: 'DELETE' }),
  post: (postId) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}`),
  postReplies: (postId) => apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/replies`),
  replyToPost: (postId, payload) =>
    apiFetch(`/api/community/posts/${encodeURIComponent(postId)}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  deletePostReply: (postId, replyId) => apiFetch(
    `/api/community/posts/${encodeURIComponent(postId)}/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' },
  ),
  reportPostReply: (postId, replyId, payload = {}) => apiFetch(
    `/api/community/posts/${encodeURIComponent(postId)}/replies/${encodeURIComponent(replyId)}/report`,
    { method: 'POST', body: JSON.stringify(payload) },
  ),
  studyGroups: () => apiFetch('/api/community/study-groups'),
  myStudyGroups: ({ offset = 0, limit = 100 } = {}) => {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    return apiFetch(`/api/community/study-groups/mine?${query}`);
  },
  createStudyGroup: (payload) => apiFetch('/api/community/study-groups', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  studyGroup: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}`),
  joinStudyGroup: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/join`, { method: 'POST' }),
  addStudyGroupMember: (id, userId) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  }),
  leaveStudyGroup: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/membership`, { method: 'DELETE' }),
  promoteStudyGroupMember: (groupId, memberId) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}/promote`,
    { method: 'PATCH' },
  ),
  removeStudyGroupMember: (groupId, memberId) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  ),
  groupMessages: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/messages`),
  sendGroupMessage: (id, payload) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  deleteGroupMessage: (groupId, messageId) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  ),
  groupMeetings: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/meetings`),
  createGroupMeeting: (id, payload) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/meetings`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  updateGroupMeeting: (groupId, meetingId, payload) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/meetings/${encodeURIComponent(meetingId)}`,
    { method: 'PATCH', body: JSON.stringify(payload || {}) },
  ),
  deleteGroupMeeting: (groupId, meetingId) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/meetings/${encodeURIComponent(meetingId)}`,
    { method: 'DELETE' },
  ),
  rsvpGroupMeeting: (groupId, meetingId, status) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(groupId)}/meetings/${encodeURIComponent(meetingId)}/rsvp`,
    { method: 'POST', body: JSON.stringify({ status }) },
  ),
  groupProgress: (id) => apiFetch(`/api/community/study-groups/${encodeURIComponent(id)}/progress`),
  assignGroupProgressPlan: (id, planId) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(id)}/progress`,
    { method: 'PUT', body: JSON.stringify({ plan_id: planId }) },
  ),
  completeGroupProgressDay: (id, day) => apiFetch(
    `/api/community/study-groups/${encodeURIComponent(id)}/progress/days/${encodeURIComponent(day)}/complete`,
    { method: 'POST' },
  ),
  readingPlans: (sort = 'newest') => apiFetch(`/api/community/reading-plans?sort=${encodeURIComponent(sort)}`),
  recordPlanFork: (id, createdPlanId) => apiFetch(`/api/community/reading-plans/${encodeURIComponent(id)}/fork`, {
    method: 'POST',
    body: JSON.stringify({ created_plan_id: createdPlanId }),
  }),
  planRatings: (id) => apiFetch(`/api/community/reading-plans/${encodeURIComponent(id)}/ratings`),
  ratePlan: (id, payload) => apiFetch(`/api/community/reading-plans/${encodeURIComponent(id)}/rating`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }),
  members: ({ q = '', limit = 24, offset = 0 } = {}) => {
    const query = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
    return apiFetch(`/api/community/members?${query}`);
  },
  member: (id) => apiFetch(`/api/community/members/${encodeURIComponent(id)}`),
  followMember: (id) => apiFetch(`/api/community/members/${encodeURIComponent(id)}/follow`, { method: 'POST' }),
  unfollowMember: (id) => apiFetch(`/api/community/members/${encodeURIComponent(id)}/follow`, { method: 'DELETE' }),
  share: (slug) => apiFetch(`/api/community/share/${encodeURIComponent(slug)}`),
  like: (id) => apiFetch(`/api/community/shared-content/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  save: (id) => apiFetch(`/api/community/shared-content/${encodeURIComponent(id)}/save`, { method: 'POST' }),
  report: (id, payload = {}) =>
    apiFetch(`/api/community/shared-content/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

const admin = {
  aiAuditSummary: (days = 7) => apiFetch(`/api/ai/audit/summary?days=${encodeURIComponent(days)}`),
  moderationQueue: () => apiFetch('/api/community/moderation/queue'),
  moderateCommunityContent: (type, id, payload = {}) =>
    apiFetch(`/api/community/moderation/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

// ---------------------------------------------------------------------------
// Media transcription jobs.
//
// Uploads stream the raw file body (not JSON) so a long recording never has to
// be base64-inflated in memory. The declared Content-Type is what the server
// uses to decide how to decode it, and X-File-Name carries the original name.
// ---------------------------------------------------------------------------

const media = {
  jobs: (limit = 100, offset = 0) => apiFetch(`/api/media/jobs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
  job: (id) => apiFetch(`/api/media/jobs/${encodeURIComponent(String(id))}`),
  upload: (file) => apiFetch('/api/media/jobs', {
    method: 'POST',
    body: file,
    timeoutMs: 180_000,
    headers: {
      'Content-Type': file.type || ({
        txt: 'text/plain',
        md: 'text/markdown',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        mp4: 'video/mp4',
        wav: 'audio/wav',
        webm: 'audio/webm',
      })[String(file.name || '').split('.').pop().toLowerCase()] || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name || 'upload'),
    },
  }),
  deleteJob: (id) => apiFetch(`/api/media/jobs/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export const api = { auth, entities: entitiesProxy, integrations, functions, community, admin, media };

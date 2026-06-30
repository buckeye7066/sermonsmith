/**
 * SermonSmith API client.
 * Provides auth, entity CRUD, AI integrations, and cloud function calls
 * against the self-hosted Express/Prisma backend (Railway).
 *
 * Authentication uses httpOnly cookies set by the server — no tokens
 * are stored in localStorage or sessionStorage (OWASP best practice).
 */

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
  if (!resolved) resolved = 'http://localhost:3001';

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
function isAuthHandshakePath(path) {
  return path.startsWith('/api/auth/');
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
  const { retry, timeoutMs, ...fetchOptions } = options;

  const headers = {
    'Content-Type': 'application/json',
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

  const apiBase = await getApiBaseUrl();

  let res;
  try {
    res = await fetch(`${apiBase}${path}`, {
      ...fetchOptions,
      headers,
      signal,
      credentials: 'include', // send/receive httpOnly auth cookies
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
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(body.message || `API error ${res.status}`);
    error.status = res.status;
    error.data = body;

    // Surface a real, mid-session 401 to the app-level handler so the UI can
    // tell the user their session expired and route them to login — instead
    // of each page swallowing it into a vague "couldn't do X" message. We skip
    // the auth-handshake endpoints (their 401s are expected and handled by the
    // caller). The handler itself decides whether we were actually logged in.
    if (res.status === 401 && !isAuthHandshakePath(path)) {
      try { _onUnauthorized?.(path); } catch { /* a broken handler must never mask the API error */ }
    }

    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
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
  me:       ()            => apiFetch('/api/auth/me'),
  updateMe: (data)        => apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  exportData: ()          => apiFetch('/api/auth/export'),
  deleteAccount: ()       => apiFetch('/api/auth/me', { method: 'DELETE' }),
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

const integrations = {
  Core: {
    InvokeLLM:                  (p) => apiFetch('/api/ai/invoke',   { method: 'POST', body: JSON.stringify(p) }),
    SendEmail:                  (p) => apiFetch('/api/ai/email',    { method: 'POST', body: JSON.stringify(p) }),
    SendSMS:                    (p) => apiFetch('/api/ai/sms',      { method: 'POST', body: JSON.stringify(p) }),
    UploadFile:                 (p) => apiFetch('/api/ai/upload',   { method: 'POST', body: JSON.stringify(p) }),
    GenerateImage:              (p) => apiFetch('/api/ai/image',    { method: 'POST', body: JSON.stringify(p) }),
    ExtractDataFromUploadedFile:(p) => apiFetch('/api/ai/extract',  { method: 'POST', body: JSON.stringify(p) }),
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
  'getPassageMultiSource',
]);

const functions = {
  invoke: (name, params) =>
    apiFetch(`/api/functions/${name}`, {
      method: 'POST',
      retry: RETRYABLE_FUNCTIONS.has(name),
      body: JSON.stringify(params || {}),
    }),
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
// Public exports
// ---------------------------------------------------------------------------

export const api = { auth, entities: entitiesProxy, integrations, functions, community, admin };

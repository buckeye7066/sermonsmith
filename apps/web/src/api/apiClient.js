/**
 * SermonSmith API client.
 * Provides auth, entity CRUD, AI integrations, and cloud function calls
 * against the self-hosted Express/Prisma backend (Railway).
 *
 * Authentication uses httpOnly cookies set by the server — no tokens
 * are stored in localStorage or sessionStorage (OWASP best practice).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function apiFetch(path, options = {}, _retryCount = 0) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Only create an internal AbortController when the caller hasn't supplied their own signal.
  // This avoids allocating a wasted controller (and its timeout) for every caller-cancelled request.
  const ownController = options.signal ? null : new AbortController();
  const timeout = ownController
    ? setTimeout(() => ownController.abort(), REQUEST_TIMEOUT_MS)
    : null;
  const signal = ownController ? ownController.signal : options.signal;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal,
      credentials: 'include', // send/receive httpOnly auth cookies
    });
  } catch (err) {
    if (timeout) clearTimeout(timeout);
    // Retry on network errors / timeouts (not on user-abort)
    if (_retryCount < MAX_RETRIES && err.name !== 'AbortError') {
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
    // Retry on 5xx server errors
    if (res.status >= 500 && _retryCount < MAX_RETRIES) {
      const jitter = Math.random() * RETRY_DELAY_MS;
      const backoff = Math.min(RETRY_DELAY_MS * Math.pow(2, _retryCount), 10_000);
      await new Promise(r => setTimeout(r, backoff + jitter));
      return apiFetch(path, options, _retryCount + 1);
    }
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(body.message || `API error ${res.status}`);
    error.status = res.status;
    error.data = body;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Entity CRUD (generic document store)
// ---------------------------------------------------------------------------

function createEntityMethods(entityName) {
  const base = `/api/entities/${entityName}`;
  return {
    create:     (data)       => apiFetch(base, { method: 'POST', body: JSON.stringify(data) }),
    list:       ()           => apiFetch(base),
    get:        (id)         => apiFetch(`${base}/${id}`),
    update:     (id, data)   => apiFetch(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete:     (id)         => apiFetch(`${base}/${id}`, { method: 'DELETE' }),
    filter:     (query)      => apiFetch(`${base}/filter`, { method: 'POST', body: JSON.stringify(query) }),
    bulkCreate: (items)      => apiFetch(`${base}/bulk`, { method: 'POST', body: JSON.stringify({ items }) }),
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

const functions = {
  invoke: (name, params) =>
    apiFetch(`/api/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    }),
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export const api = { auth, entities: entitiesProxy, integrations, functions };

/**
 * SermonSmith API client.
 * Provides auth, entity CRUD, AI integrations, and cloud function calls
 * against the self-hosted Express/Prisma backend (Railway).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'ss_token';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function getToken() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('access_token');
  if (urlToken) {
    localStorage.setItem(TOKEN_KEY, urlToken);
    params.delete('access_token');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', clean);
    return urlToken;
  }

  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function apiFetch(path, options = {}, _retryCount = 0) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    // Retry on network errors / timeouts (not on user-abort)
    if (_retryCount < MAX_RETRIES && err.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (_retryCount + 1)));
      return apiFetch(path, options, _retryCount + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // Retry on 5xx server errors
    if (res.status >= 500 && _retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (_retryCount + 1)));
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

  login: async (email, password) => {
    const result = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token) setToken(result.token);
    return result;
  },

  register: async (email, password, name) => {
    const result = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (result.token) setToken(result.token);
    return result;
  },

  redirectToLogin: (returnUrl) => {
    const target = returnUrl
      ? `/Login?return=${encodeURIComponent(returnUrl)}`
      : '/Login';
    window.location.href = target;
  },

  logout: (returnUrl) => {
    setToken(null);
    if (returnUrl) window.location.href = returnUrl;
  },

  setToken,
  getToken,
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

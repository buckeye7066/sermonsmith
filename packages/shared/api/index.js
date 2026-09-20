const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeApiBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Readiness API base URL must use HTTPS outside localhost');
  }
  return url;
}

/**
 * Node-compatible client for the public operational API surface.
 *
 * Monitoring code receives this client (or a test double) instead of owning a
 * second raw-fetch path. Retry/polling policy remains with the monitor; this
 * client centralizes URL construction, timeout, headers, HTTP errors, and JSON
 * validation for the readiness request itself.
 */
export function createReadinessClient(options = {}) {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof fetchImpl !== 'function') throw new Error('Readiness API client requires a fetch implementation');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Readiness API timeout must be positive');

  return Object.freeze({
    async getReadiness() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(new URL('/readyz', baseUrl).toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`readiness returned HTTP ${response.status}`);
        }
        const body = await response.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('readiness returned an invalid JSON object');
        }
        return body;
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}

export const READINESS_CLIENT_CONSTANTS = Object.freeze({ DEFAULT_TIMEOUT_MS });


export const AI_RESPONSE_HEADERS = Object.freeze(['X-AI-Billing-Mode', 'X-AI-Provider', 'X-AI-Model']);
export function readAiResponseMetadata(headers) {
  const billing = headers?.get?.('X-AI-Billing-Mode');
  const provider = headers?.get?.('X-AI-Provider');
  const model = headers?.get?.('X-AI-Model');
  if (billing !== 'subscription' || provider !== 'subscription:codex' || typeof model !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(model)) return null;
  return { billing_mode: billing, provider, model };
}

// Leave room for the seven-character Bearer prefix in the server header limit.
export const OWNER_WORKER_TOKEN_LIMITS = Object.freeze({ min: 32, max: 1017, headerMax: 1024 });

/** Dedicated worker authentication through the shared API transport, never the public client session. */
export function createOwnerWorkerClient({ baseUrl, token, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      typeof token !== 'string' || token.length < OWNER_WORKER_TOKEN_LIMITS.min || token.length > OWNER_WORKER_TOKEN_LIMITS.max || typeof fetchImpl !== 'function' ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new Error('invalid_configuration');
  const encoder = new TextEncoder();
  return Object.freeze({
    async post(route, body, signal) {
      if (!['poll', 'result'].includes(route) || !body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_operation_or_request');
      const wire = JSON.stringify(body);
      if (encoder.encode(wire).byteLength > 2097152) throw new Error('invalid_operation_or_request');
      signal?.throwIfAborted();
      const combined = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
      const response = await fetchImpl(new URL('/api/owner-ai/worker/' + route, origin).href, {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: combined,
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: wire,
      });
      if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error('unavailable'), { status: response.status }); }
      // A permitted 128 KiB prompt can expand sixfold when JSON escapes control characters.
      const limit = 1048576; const reader = response.body?.getReader();
      if (!reader) throw new Error('unavailable');
      const decoder = new TextDecoder(); let bytes = 0; let raw = '';
      try {
        while (true) {
          combined.throwIfAborted();
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > limit) { await reader.cancel(); throw new Error('unavailable: response exceeds byte limit'); }
          raw += decoder.decode(part.value, { stream: true });
        }
        raw += decoder.decode();
      } finally { reader.releaseLock(); }
      let value; try { value = JSON.parse(raw); } catch { throw new Error('unavailable'); }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('unavailable');
      return value;
    },
  });
}

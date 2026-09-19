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

/** Dedicated worker requests share one bounded, non-retrying HTTP boundary. */
export function createOwnerWorkerClient({baseUrl, token, fetchImpl = globalThis.fetch} = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Owner worker requires an HTTPS origin');
  }
  if (typeof token !== 'string' || token.length < 32 || typeof fetchImpl !== 'function') {
    throw new Error('Owner worker configuration is incomplete');
  }
  const limit = 1024 * 1024; // Includes JSON escaping of the 128 KiB prompt contract.
  return Object.freeze({
    async post(operation, body, signal) {
      if (!['poll', 'result'].includes(operation)) throw new Error('Unknown owner worker operation');
      const input = JSON.stringify(body);
      if (Buffer.byteLength(input) > limit) throw new Error('Owner worker request exceeds the byte limit');
      const response = await fetchImpl(new URL('/api/owner-ai/worker/' + operation, base).toString(), {
        method: 'POST', redirect: 'error', credentials: 'omit',
        signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]),
        headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json'}, body: input,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw Object.assign(new Error('Owner worker HTTP request failed'), {status: response.status});
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Owner worker returned no response body');
      const chunks = []; let size = 0;
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw new Error('Owner worker response exceeds the byte limit'); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Owner worker returned an invalid JSON object');
      return result;
    },
  });
}

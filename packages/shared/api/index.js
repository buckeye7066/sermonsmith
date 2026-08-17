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

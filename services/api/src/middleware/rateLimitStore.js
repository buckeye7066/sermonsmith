/**
 * Shared rate-limit store factory.
 *
 * If `REDIS_URL` is configured AND the optional `redis` + `rate-limit-redis`
 * packages are installed, this returns a Redis-backed store so multiple
 * API instances share counters (required for horizontal scaling).
 *
 * Otherwise it returns `undefined` and `express-rate-limit` falls back to
 * its built-in in-memory store. That fallback is fine for single-process
 * dev and CI but MUST NOT be used in production behind a load balancer.
 *
 * To avoid forcing a hard dependency on Redis, the imports are dynamic and
 * the function tolerates missing packages with a single warning.
 */

let _client = null;
let _warned = false;

async function getRedisClient() {
  if (_client) return _client;
  if (!process.env.REDIS_URL) {
    console.warn('[rateLimit] REDIS_URL is not set — falling back to in-memory store.');
    return null;
  }

  try {
    const { createClient } = await import('redis');
    _client = createClient({ url: process.env.REDIS_URL });
    _client.on('error', (err) => {
      console.error('[rateLimit] Redis error:', err.message);
    });
    await _client.connect();
    return _client;
  } catch (err) {
    if (!_warned) {
      console.warn(
        '[rateLimit] REDIS_URL is set but `redis` package is unavailable — ' +
        'falling back to in-memory rate limiting (NOT safe for multi-instance deployments). ' +
        `Install with: npm i redis rate-limit-redis. Reason: ${err.message}`
      );
      _warned = true;
    }
    return null;
  }
}

/**
 * Returns a `store` option for express-rate-limit, or `undefined` to
 * accept the default in-memory store.
 *
 * Each named limiter passes its own `prefix` so the counters don't
 * collide in shared Redis (e.g. "ai:", "login:", "register:").
 *
 * Awaiting this is safe — initialization happens once and is cached.
 */
export async function makeRateLimitStore(prefix) {
  const client = await getRedisClient();
  if (!client) {
    console.error('[rateLimit] Failed to create Redis client — falling back to in-memory store.');
    return { store: undefined };
  }

  try {
    const { default: RedisStore } = await import('rate-limit-redis');
    return new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    if (!_warned) {
      console.warn(
        '[rateLimit] `rate-limit-redis` package not installed — ' +
        'falling back to in-memory store. Reason: ' + err.message
      );
      _warned = true;
    }
    console.error('[rateLimit] Failed to create Redis store — falling back to in-memory store.');
    return { store: undefined };
  }
}

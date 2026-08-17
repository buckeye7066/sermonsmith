// Test-only env vars set before any module imports run. The cookie/JWT
// values here are deliberately long enough to satisfy loadEnv()'s
// production thresholds in case a test sets NODE_ENV=production.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-that-is-at-least-32-chars-long';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'ci-test-cookie-secret-at-least-32-chars-long';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.RELEASE_SHA = process.env.RELEASE_SHA || '0123456789abcdef0123456789abcdef01234567';
process.env.DISABLE_AI = process.env.DISABLE_AI || '1';
process.env.DISABLE_BILLING = process.env.DISABLE_BILLING || '1';
process.env.DISABLE_PASSWORD_RESET = process.env.DISABLE_PASSWORD_RESET || '1';

// Force the AI model allowlist back to its hard-coded defaults during tests.
// A developer machine may have OPENAI_MODEL / AI_FREE_MODELS / AI_PREMIUM_MODELS
// exported globally for local OpenAI experiments; those leaks would otherwise
// flip the model-allowlist tests into 403 rejections (e.g. an OPENAI_MODEL of
// "gpt-4o" is not in the FREE allowlist, so a free-user invoke would 403
// instead of returning the expected 503 / 200 path).
delete process.env.OPENAI_MODEL;
delete process.env.AI_FREE_MODELS;
delete process.env.AI_PREMIUM_MODELS;

// Test-only env vars set before any module imports run. The cookie/JWT
// values here are deliberately long enough to satisfy loadEnv()'s
// production thresholds in case a test sets NODE_ENV=production.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-that-is-at-least-32-chars-long';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'ci-test-cookie-secret-at-least-32-chars-long';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.DISABLE_AI = process.env.DISABLE_AI || '1';
process.env.DISABLE_BILLING = process.env.DISABLE_BILLING || '1';
process.env.DISABLE_PASSWORD_RESET = process.env.DISABLE_PASSWORD_RESET || '1';

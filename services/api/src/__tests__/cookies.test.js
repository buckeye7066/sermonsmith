/**
 * cookieOptions() production behaviour.
 *
 * The production deployment puts the SermonSmith web app on Vercel and the
 * API on Railway — different eTLD+1 — so the auth cookie MUST be set with
 * SameSite=None + Secure or the browser will silently drop it on every
 * cross-site fetch and authenticated requests will fail.
 *
 * This file is isolated from ai.test.js (which mocks the entire auth module)
 * so it can import the real implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SAVED = {
  NODE_ENV: process.env.NODE_ENV,
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  JWT_SECRET: process.env.JWT_SECRET,
};

beforeEach(() => {
  vi.resetModules();
  delete process.env.COOKIE_SAMESITE;
  delete process.env.COOKIE_DOMAIN;
  process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
});

afterEach(() => {
  process.env.NODE_ENV = SAVED.NODE_ENV;
  if (SAVED.COOKIE_SAMESITE === undefined) delete process.env.COOKIE_SAMESITE;
  else process.env.COOKIE_SAMESITE = SAVED.COOKIE_SAMESITE;
  if (SAVED.COOKIE_DOMAIN === undefined) delete process.env.COOKIE_DOMAIN;
  else process.env.COOKIE_DOMAIN = SAVED.COOKIE_DOMAIN;
});

describe('cookieOptions in production', () => {
  it('defaults to sameSite=none + secure=true so Vercel→Railway cross-domain auth works', async () => {
    process.env.NODE_ENV = 'production';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('none');
    expect(opts.path).toBe('/');
  });

  it('is a session cookie (no maxAge/expires) so a browser session must re-login', async () => {
    process.env.NODE_ENV = 'production';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.maxAge).toBeUndefined();
    expect(opts.expires).toBeUndefined();
  });

  it('honours COOKIE_SAMESITE=lax for same-domain deploys', async () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SAMESITE = 'lax';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(true);
  });

  it('attaches domain when COOKIE_DOMAIN is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_DOMAIN = '.example.com';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.domain).toBe('.example.com');
  });

  it('does NOT attach domain when COOKIE_DOMAIN is unset', async () => {
    process.env.NODE_ENV = 'production';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.domain).toBeUndefined();
  });

  it('rejects invalid COOKIE_SAMESITE values and falls back to lax', async () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SAMESITE = 'banana';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.sameSite).toBe('lax');
  });
});

describe('cookieOptions in dev', () => {
  it('defaults to sameSite=lax + secure=false', async () => {
    process.env.NODE_ENV = 'development';
    const { cookieOptions } = await import('../middleware/auth.js');
    const opts = cookieOptions();
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(false);
  });
});

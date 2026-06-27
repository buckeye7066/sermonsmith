import { describe, it, expect } from 'vitest';
import { loadEnv, ENV_CONSTANTS } from '../config/env.js';

describe('loadEnv', () => {
  function strong() {
    return 'a'.repeat(ENV_CONSTANTS.MIN_SECRET_LENGTH + 4);
  }

  it('throws in production when DATABASE_URL is missing', () => {
    expect(() =>
      loadEnv({
        source: { NODE_ENV: 'production', JWT_SECRET: strong(), COOKIE_SECRET: strong(), CORS_ORIGIN: 'https://app', RESEND_API_KEY: 'x', OPENAI_API_KEY: 'y', STRIPE_SECRET_KEY: 'sk_live_123456789abcdef', STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef', STRIPE_PRICE_ID: 'price_123456789abcdef' },
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('throws in production when COOKIE_SECRET is missing', () => {
    expect(() =>
      loadEnv({
        source: { NODE_ENV: 'production', JWT_SECRET: strong(), DATABASE_URL: 'postgres://x', CORS_ORIGIN: 'https://app', RESEND_API_KEY: 'x', OPENAI_API_KEY: 'y', STRIPE_SECRET_KEY: 'sk_live_123456789abcdef', STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef', STRIPE_PRICE_ID: 'price_123456789abcdef' },
      }),
    ).toThrow(/COOKIE_SECRET/);
  });

  it('throws in production when JWT_SECRET is too short', () => {
    expect(() =>
      loadEnv({
        source: { NODE_ENV: 'production', JWT_SECRET: 'short', COOKIE_SECRET: strong(), DATABASE_URL: 'postgres://x', CORS_ORIGIN: 'https://app', OPENAI_API_KEY: 'a', STRIPE_SECRET_KEY: 'sk_live_123456789abcdef', STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef', STRIPE_PRICE_ID: 'price_123456789abcdef', RESEND_API_KEY: 'd' },
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('throws in production when COOKIE_SECRET is too short', () => {
    expect(() =>
      loadEnv({
        source: { NODE_ENV: 'production', JWT_SECRET: strong(), COOKIE_SECRET: 'short', DATABASE_URL: 'postgres://x', CORS_ORIGIN: 'https://app', OPENAI_API_KEY: 'a', STRIPE_SECRET_KEY: 'sk_live_123456789abcdef', STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef', STRIPE_PRICE_ID: 'price_123456789abcdef', RESEND_API_KEY: 'd' },
      }),
    ).toThrow(/COOKIE_SECRET/);
  });

  it('throws in production when billing is enabled but STRIPE_PRICE_ID is missing', () => {
    expect(() =>
      loadEnv({
        source: {
          NODE_ENV: 'production',
          JWT_SECRET: strong(),
          COOKIE_SECRET: strong(),
          DATABASE_URL: 'postgres://x',
          CORS_ORIGIN: 'https://app',
          OPENAI_API_KEY: 'a',
          STRIPE_SECRET_KEY: 'sk_live_123456789abcdef',
          STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef',
          RESEND_API_KEY: 'd',
        },
      }),
    ).toThrow(/STRIPE_PRICE_ID/);
  });

  it('throws in production when Stripe uses test-mode credentials', () => {
    expect(() =>
      loadEnv({
        source: {
          NODE_ENV: 'production',
          JWT_SECRET: strong(),
          COOKIE_SECRET: strong(),
          DATABASE_URL: 'postgres://x',
          CORS_ORIGIN: 'https://app',
          OPENAI_API_KEY: 'a',
          STRIPE_SECRET_KEY: 'sk_test_123456789abcdef',
          STRIPE_WEBHOOK_SECRET: 'whsec_123456789abcdef',
          STRIPE_PRICE_ID: 'price_123456789abcdef',
          RESEND_API_KEY: 'd',
        },
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('honours feature flags to skip optional secrets', () => {
    const env = loadEnv({
      source: {
        NODE_ENV: 'production',
        JWT_SECRET: strong(),
        COOKIE_SECRET: strong(),
        DATABASE_URL: 'postgres://x',
        CORS_ORIGIN: 'https://app',
        DISABLE_AI: '1',
        DISABLE_BILLING: '1',
        DISABLE_PASSWORD_RESET: '1',
      },
    });
    expect(env.aiEnabled).toBe(false);
    expect(env.billingEnabled).toBe(false);
    expect(env.passwordResetEnabled).toBe(false);
  });

  it('parses CORS_ORIGIN as a list', () => {
    const env = loadEnv({ source: { NODE_ENV: 'development', CORS_ORIGIN: 'https://a, https://b' } });
    expect(env.corsAllowList()).toEqual(['https://a', 'https://b']);
  });

  it('warns but does not throw in dev when secrets are missing', () => {
    const warnings = [];
    const env = loadEnv({ source: { NODE_ENV: 'development' }, warn: (m) => warnings.push(m) });
    expect(env.NODE_ENV).toBe('development');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

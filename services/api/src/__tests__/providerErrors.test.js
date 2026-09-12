import { describe, it, expect } from 'vitest';
import {
  clientSafeProviderError,
  isProviderApiError,
  isProviderQuotaExhausted,
  providerRetryDelayMs,
} from '../lib/providerErrors.js';

// Shape of an openai@4 APIError: the constructor always assigns these fields.
function providerError(status, message, { code = null } = {}) {
  return Object.assign(new Error(`${status} ${message}`), {
    status,
    headers: { 'x-request-id': 'req_test' },
    request_id: 'req_test',
    error: code ? { code, message } : { message },
    code,
  });
}

// The exact production failure seen on 2026-09-11.
const noCredits = () => providerError(
  429,
  'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
  { code: 'insufficient_quota' },
);

describe('provider error mapping', () => {
  it('recognises SDK errors but not errors the API raises itself', () => {
    expect(isProviderApiError(noCredits())).toBe(true);
    expect(isProviderApiError(Object.assign(new Error('OpenAI API key not configured'), { status: 503 }))).toBe(false);
    expect(isProviderApiError(Object.assign(new Error('timed out'), { status: 504 }))).toBe(false);
    expect(isProviderApiError(null)).toBe(false);
  });

  it('maps exhausted credits to a 503 that never repeats the provider billing text', () => {
    const safe = clientSafeProviderError(noCredits());
    expect(safe).toEqual({ status: 503, code: 'ai_unavailable', message: expect.stringMatching(/temporarily unavailable/i) });
    expect(JSON.stringify(safe)).not.toMatch(/credits|openai|billing|platform\./i);
  });

  it('detects quota exhaustion from the message when the code is absent', () => {
    expect(isProviderQuotaExhausted(providerError(429, 'You exceeded your current quota, please check your plan'))).toBe(true);
    expect(isProviderQuotaExhausted(providerError(429, 'Rate limit reached for gpt-4o-mini in organization org-abc'))).toBe(false);
  });

  it('keeps an ordinary provider rate limit off 429 and hides the organization id', () => {
    const safe = clientSafeProviderError(providerError(429, 'Rate limit reached for gpt-4o-mini in organization org-abc'));
    expect(safe.status).toBe(503);
    expect(safe.code).toBe('ai_busy');
    expect(safe.message).not.toMatch(/org-/);
  });

  it('treats a rejected key as an outage and hides the key fragment', () => {
    const safe = clientSafeProviderError(providerError(401, 'Incorrect API key provided: sk-proj-****abcd'));
    expect(safe).toMatchObject({ status: 503, code: 'ai_unavailable' });
    expect(safe.message).not.toMatch(/sk-/);
  });

  it('maps other provider failures to a generic 502', () => {
    expect(clientSafeProviderError(providerError(400, "Invalid parameter: 'messages'"))).toMatchObject({ status: 502, code: 'ai_upstream_error' });
    expect(clientSafeProviderError(providerError(500, 'The server had an error'))).toMatchObject({ status: 502 });
  });

  it('leaves non-provider errors to the existing handler', () => {
    expect(clientSafeProviderError(Object.assign(new Error('Daily AI limit reached'), { status: 429 }))).toBeNull();
  });
});

describe('providerRetryDelayMs', () => {
  const limited = (headers) => ({ status: 429, headers });

  it('prefers retry-after-ms over retry-after', () => {
    expect(providerRetryDelayMs(limited({ 'retry-after-ms': '750', 'retry-after': '9' }))).toBe(750);
  });

  it('reads retry-after as seconds', () => {
    expect(providerRetryDelayMs(limited({ 'retry-after': '1.5' }))).toBe(1500);
  });

  it('reads retry-after as an HTTP date', () => {
    const now = Date.parse('2026-09-11T12:00:00Z');
    expect(providerRetryDelayMs(limited({ 'retry-after': 'Fri, 11 Sep 2026 12:00:03 GMT' }), now)).toBe(3000);
  });

  it('reads a fetch Headers instance as well as a plain object', () => {
    expect(providerRetryDelayMs({ headers: new Headers({ 'retry-after': '2' }) })).toBe(2000);
  });

  it('ignores missing, non-positive, unparseable, and 60-second-or-longer hints', () => {
    expect(providerRetryDelayMs(new Error('no headers'))).toBeNull();
    expect(providerRetryDelayMs(limited({ 'retry-after': '0' }))).toBeNull();
    expect(providerRetryDelayMs(limited({ 'retry-after': '60' }))).toBeNull();
    expect(providerRetryDelayMs(limited({ 'retry-after': 'soon' }))).toBeNull();
  });
});

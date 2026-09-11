import { describe, it, expect } from 'vitest';
import {
  clientSafeProviderError,
  isProviderApiError,
  isProviderQuotaExhausted,
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

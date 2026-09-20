import { describe, it, expect, vi } from 'vitest';
import { callWithRetry } from '../routes/ai.js';

// Unit tests for the OpenAI transient-failure retry helper (see ai.js).
// baseMs is set to 1 so the exponential backoff doesn't slow the suite.
describe('callWithRetry', () => {
  it('retries 5xx and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 503 }))
      .mockResolvedValueOnce('ok');

    const result = await callWithRetry(fn, { baseMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries 429 rate-limit', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce('ok');

    await expect(callWithRetry(fn, { baseMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 429 that means the provider account has no credits', async () => {
    const noCredits = Object.assign(new Error('429 You have no credits remaining.'), {
      status: 429,
      headers: {},
      request_id: 'req_test',
      error: { code: 'insufficient_quota' },
      code: 'insufficient_quota',
    });
    const fn = vi.fn().mockRejectedValue(noCredits);
    await expect(callWithRetry(fn, { baseMs: 1 })).rejects.toBe(noCredits);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a connection failure, which the SDK no longer retries for wrapped calls', async () => {
    class APIConnectionError extends Error {}
    const fn = vi.fn()
      .mockRejectedValueOnce(new APIConnectionError('Connection error.'))
      .mockResolvedValueOnce('ok');

    await expect(callWithRetry(fn, { baseMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a status-less error that is not a connection failure', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('params.messages is not iterable'));
    await expect(callWithRetry(fn, { baseMs: 1 })).rejects.toThrow('not iterable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits as long as the provider Retry-After asks before retrying a rate limit', async () => {
    vi.useFakeTimers();
    try {
      const limited = Object.assign(new Error('429 Rate limit reached for gpt-4o-mini'), {
        status: 429,
        headers: { 'retry-after': '2' },
        request_id: 'req_test',
        error: { code: 'rate_limit_exceeded' },
        code: 'rate_limit_exceeded',
      });
      const fn = vi.fn().mockRejectedValueOnce(limited).mockResolvedValueOnce('ok');

      const result = callWithRetry(fn, { baseMs: 1 });
      await vi.advanceTimersByTimeAsync(1_900);
      expect(fn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      await expect(result).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start a retry whose wait would end past the caller deadline', async () => {
    const limited = Object.assign(new Error('429 Rate limit reached'), {
      status: 429,
      headers: { 'retry-after': '59' },
      request_id: 'req_test',
      error: { code: 'rate_limit_exceeded' },
      code: 'rate_limit_exceeded',
    });
    const fn = vi.fn().mockRejectedValue(limited);

    await expect(callWithRetry(fn, { baseMs: 1, deadline: Date.now() + 10_000 })).rejects.toBe(limited);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry deterministic 4xx (400)', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));
    await expect(callWithRetry(fn, { baseMs: 1 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry our own 504 timeout', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('timed out'), { status: 504 }));
    await expect(callWithRetry(fn, { baseMs: 1 })).rejects.toThrow('timed out');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget is exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('still down'), { status: 500 }));
    await expect(callWithRetry(fn, { baseMs: 1, retries: 2 })).rejects.toThrow('still down');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

import { EventEmitter } from 'node:events';
import { createOwnerSubscription } from '../lib/ownerSubscription.js';

it('does not replay a completed owner job rejected for malformed JSON', async () => {
  const env = { OWNER_AI_BRIDGE_ENABLED: 'true', OWNER_AI_USER_ID: 'owner-id',
    OWNER_AI_EMAIL: 'owner@example.test', OWNER_AI_BRIDGE_TOKEN: 'x'.repeat(32) };
  const bridge = createOwnerSubscription({ env });
  let attempted = 0;
  const response = new EventEmitter();
  await bridge.scope(response, async () => {
    bridge.identify({ id: 'owner-id', email: 'owner@example.test', role: 'admin' });
    bridge.poll({ providers: { codex: 'ready' } });
    const invoke = async () => {
      attempted++;
      const pending = bridge.openAIClient().chat.completions.create({
        messages: [{ role: 'user', content: 'Return fixture JSON' }],
        response_format: { type: 'json_object' }, max_tokens: 100 });
      const { job } = bridge.poll({ providers: { codex: 'ready' } });
      expect(job).toBeTruthy();
      bridge.result({ id: job.id, lease: job.lease, result: { ok: true, complete: true,
        raw: '{not json', provider: 'subscription:codex', billing_mode: 'subscription',
        model: 'fixture-model', model_source: 'app_server_configuration',
        usage: { input_tokens: 4, cached_input_tokens: 0, output_tokens: 4 } } });
      return pending;
    };
    await expect(callWithRetry(invoke, { baseMs: 1 })).rejects.toMatchObject({ code: 'OWNER_SUBSCRIPTION_UNAVAILABLE' });
    expect(attempted).toBe(1);
    expect(bridge.status().pending).toBe(0);
  });
});

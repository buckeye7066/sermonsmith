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

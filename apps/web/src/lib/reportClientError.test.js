// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const apiFetch = vi.fn(() => Promise.resolve());
vi.mock('@/api/apiClient', () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const {
  reportClientError,
  registerGlobalErrorReporting,
  classifyClientError,
  __test,
} = await import('./reportClientError.js');

const OUTLOOK_SCANNER_MESSAGE = 'Object Not Found Matching Id:4, MethodName:update, ParamCount:4';

function lastPayload() {
  const call = apiFetch.mock.calls.at(-1);
  return JSON.parse(call[1].body);
}

beforeEach(() => {
  apiFetch.mockClear();
  __test._resetDedupe();
});

describe('classifyClientError', () => {
  it('classifies the Outlook SafeLinks scanner signature', () => {
    expect(classifyClientError(OUTLOOK_SCANNER_MESSAGE)).toBe('external-scanner');
    expect(classifyClientError('Object Not Found Matching Id:2, MethodName:simulateEvent, ParamCount:1')).toBe('external-scanner');
  });

  it('does not classify ordinary errors', () => {
    expect(classifyClientError("Cannot read properties of undefined (reading 'id')")).toBeNull();
    expect(classifyClientError('Authentication failed')).toBeNull();
    expect(classifyClientError('')).toBeNull();
  });
});

describe('reportClientError', () => {
  it('tags scanner-injected errors with a classification but still reports them', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      reportClientError(new Error(OUTLOOK_SCANNER_MESSAGE));
      expect(apiFetch).toHaveBeenCalledTimes(1);
      expect(lastPayload().classification).toBe('external-scanner');
      // Diagnostic breadcrumb logged, no secrets in it.
      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0][0]).toContain('external-scanner');
    } finally {
      info.mockRestore();
    }
  });

  it('sends ordinary errors without a classification', () => {
    reportClientError(new TypeError('boom'));
    expect(lastPayload().classification).toBeUndefined();
    expect(lastPayload().name).toBe('TypeError');
  });

  it('marks reporter-synthesized stacks so they are not misattributed', () => {
    reportClientError(new Error('wrapped non-Error'), { syntheticStack: true });
    expect(lastPayload().syntheticStack).toBe(true);
  });

  it('dedupes identical messages within the window', () => {
    reportClientError(new Error('same thing'));
    reportClientError(new Error('same thing'));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('registerGlobalErrorReporting', () => {
  it('wraps a non-Error unhandledrejection as a synthetic-stack report with a useful message', () => {
    registerGlobalErrorReporting();

    const event = new Event('unhandledrejection');
    event.reason = { code: 'E_STRANGE', detail: 'no Error object here' };
    window.dispatchEvent(event);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const payload = lastPayload();
    expect(payload.syntheticStack).toBe(true);
    // Not the useless "[object Object]".
    expect(payload.message).toContain('E_STRANGE');
  });

  it('reports a real Error from an error event without the synthetic flag', () => {
    registerGlobalErrorReporting();

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('real crash'), message: 'real crash' }));

    const payload = lastPayload();
    expect(payload.message).toBe('real crash');
    expect(payload.syntheticStack).toBeUndefined();
  });
});

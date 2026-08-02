// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadWithReload, isChunkLoadError } from './lazyWithReload';

const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: https://x/assets/Reader-wB0R6gsY.js');

describe('isChunkLoadError', () => {
  it('matches the browser variants of a stale-chunk failure', () => {
    expect(isChunkLoadError(chunkError())).toBe(true); // Chromium
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true); // WebKit
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true); // Firefox
  });

  it('does not match unrelated errors', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError(new TypeError('x is not a function'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('loadWithReload', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('passes through a successful import and clears the reload guard', async () => {
    sessionStorage.setItem('ss:chunk-reload-at', String(Date.now()));
    const mod = { default: () => null };
    await expect(loadWithReload(() => Promise.resolve(mod))).resolves.toBe(mod);
    expect(sessionStorage.getItem('ss:chunk-reload-at')).toBeNull();
  });

  it('reloads exactly once on a stale-chunk failure and never resolves', async () => {
    const reload = vi.fn();
    const result = loadWithReload(() => Promise.reject(chunkError()), { reload });
    // The returned promise intentionally never settles (the page is reloading);
    // give the microtask queue a beat and assert reload fired.
    await Promise.race([result, new Promise((r) => setTimeout(r, 20))]);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(Number(sessionStorage.getItem('ss:chunk-reload-at'))).toBeGreaterThan(0);
  });

  it('does NOT reload again within the guard window - the error surfaces instead', async () => {
    sessionStorage.setItem('ss:chunk-reload-at', String(Date.now()));
    const reload = vi.fn();
    await expect(loadWithReload(() => Promise.reject(chunkError()), { reload })).rejects.toThrow(
      /dynamically imported module/
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('rethrows non-chunk errors without reloading', async () => {
    const reload = vi.fn();
    await expect(loadWithReload(() => Promise.reject(new Error('real bug')), { reload })).rejects.toThrow(
      'real bug'
    );
    expect(reload).not.toHaveBeenCalled();
  });
});

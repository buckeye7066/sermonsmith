/**
 * Report an uncaught client-side error to the backend, which analyzes it and
 * emails the owner (non-admin users only — the server enforces that).
 *
 * This is best-effort telemetry: every failure is swallowed so the reporter
 * can never itself surface an error to the user or recurse. A short
 * same-message dedupe window keeps a render loop from spamming the endpoint.
 */

import { apiFetch } from '@/api/apiClient';

const DEDUPE_MS = 60_000;
/** message -> last-sent epoch ms */
const _recent = new Map();

function shouldSend(message, now) {
  // Opportunistically prune so the map can't grow unbounded.
  for (const [key, ts] of _recent) {
    if (now - ts > DEDUPE_MS) _recent.delete(key);
  }
  const last = _recent.get(message);
  if (last && now - last < DEDUPE_MS) return false;
  _recent.set(message, now);
  return true;
}

/**
 * @param {unknown} error  - the thrown error (Error, string, or anything)
 * @param {{ componentStack?: string }} [info]
 */
export function reportClientError(error, info = {}) {
  try {
    const message = String(error?.message ?? error ?? 'Unknown client error').slice(0, 2000);
    if (!message) return;

    const now = Date.now();
    if (!shouldSend(message, now)) return;

    const payload = {
      message,
      name: error?.name || 'ClientError',
      stack: typeof error?.stack === 'string' ? error.stack.slice(0, 20_000) : undefined,
      componentStack: info?.componentStack ? String(info.componentStack).slice(0, 20_000) : undefined,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    // Fire-and-forget. Never let a telemetry failure bubble up.
    apiFetch('/api/report-client-error', {
      method: 'POST',
      body: JSON.stringify(payload),
      retry: false,
    }).catch(() => { /* swallow — telemetry must never throw */ });
  } catch {
    // Absolutely never throw from the error reporter.
  }
}

let _globalHandlersRegistered = false;

/**
 * Register window-level handlers for uncaught errors and unhandled promise
 * rejections. Idempotent — safe to call once at app bootstrap.
 */
export function registerGlobalErrorReporting() {
  if (_globalHandlersRegistered || typeof window === 'undefined') return;
  _globalHandlersRegistered = true;

  window.addEventListener('error', (event) => {
    const err = event?.error || new Error(event?.message || 'Uncaught error');
    reportClientError(err);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Unhandled promise rejection'));
    reportClientError(err);
  });
}

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

// External-scanner classification.
//
// Microsoft Outlook SafeLinks (and similar mail-security crawlers) pre-fetch
// links found in emails — including our password-reset links to
// /Login?reset_token=… — inside an instrumented WebView that proxies JS calls
// over an RPC bridge. When that bridge loses one of its own object handles it
// throws "Object Not Found Matching Id:<n>, MethodName:<m>, ParamCount:<n>"
// as an unhandled rejection inside our page. It is injected by the scanner,
// not thrown by app code: every DB id here is a UUID (numeric Id:4 cannot be
// ours) and nothing calls an update with 4 params. We still report it, tagged,
// so the server keeps a log trail — the server skips the owner email for it.
// Mirror of services/api/src/services/externalErrorClassifier.js.
const EXTERNAL_SCANNER_RE = /^Object Not Found Matching Id:\d+, MethodName:[\w$.]+, ParamCount:\d+/i;

/** @returns {'external-scanner' | null} */
export function classifyClientError(message) {
  return EXTERNAL_SCANNER_RE.test(String(message ?? '')) ? 'external-scanner' : null;
}

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
 * @param {{ componentStack?: string, syntheticStack?: boolean }} [info]
 *   `syntheticStack` marks errors the reporter itself constructed to wrap a
 *   non-Error value — their stack points at this module, not the throw site.
 */
export function reportClientError(error, info = {}) {
  try {
    const message = String(error?.message ?? error ?? 'Unknown client error').slice(0, 2000);
    if (!message) return;

    const now = Date.now();
    if (!shouldSend(message, now)) return;

    const classification = classifyClientError(message);
    if (classification) {
      // Diagnostic breadcrumb (no secrets): what we matched and what we did.
      // eslint-disable-next-line no-console
      const where = typeof window !== 'undefined' ? window.location.pathname : '?';
      console.info(`[reportClientError] classified "${message.slice(0, 80)}" as ${classification} on ${where} — reported for server-side logging only`);
    }

    const payload = {
      message,
      name: error?.name || 'ClientError',
      stack: typeof error?.stack === 'string' ? error.stack.slice(0, 20_000) : undefined,
      componentStack: info?.componentStack ? String(info.componentStack).slice(0, 20_000) : undefined,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      classification: classification || undefined,
      syntheticStack: info?.syntheticStack ? true : undefined,
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
    if (event?.error) {
      reportClientError(event.error);
    } else {
      // No Error object (e.g. cross-origin script) — we synthesize one, so
      // its stack points at this handler, not the real throw site.
      reportClientError(new Error(event?.message || 'Uncaught error'), { syntheticStack: true });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (reason instanceof Error) {
      reportClientError(reason);
    } else {
      reportClientError(new Error(stringifyRejectionReason(reason)), { syntheticStack: true });
    }
  });
}

// String(reason) on a plain object yields the useless "[object Object]" —
// prefer its JSON shape so the report says what actually rejected.
function stringifyRejectionReason(reason) {
  if (reason == null) return 'Unhandled promise rejection';
  if (typeof reason === 'object') {
    try {
      const json = JSON.stringify(reason);
      if (json && json !== '{}') return json.slice(0, 2000);
    } catch { /* circular — fall through to String() */ }
  }
  return String(reason);
}

// Exposed for tests.
export const __test = {
  _resetDedupe() {
    _recent.clear();
  },
};

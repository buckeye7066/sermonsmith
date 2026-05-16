/**
 * Structured error logger shared by client code.
 *
 * The Bible Reader / translation loaders used to call:
 *   console.error("Error loading verses:", error);
 * which — depending on minification, axios vs fetch errors, and how the
 * browser DevTools collapse Error objects — produced lines like
 *   "Error loading verses: tr"
 * with no status, no URL, no payload. That made it impossible to tell
 * whether a 401 / 404 / 5xx / network drop was at fault.
 *
 * `logError(label, err, extra?)` emits a single console.error() with an
 * always-populated, JSON-serialisable record so every failure surfaces
 * status, server message, request payload, and stack at once. Extra
 * context (e.g. translationId, bookCode, chapter) can be appended via the
 * `extra` argument.
 *
 * Returns a user-friendly message string callers can hand to a toast or
 * inline error state — never the raw `err`, which may be a string, an
 * Error, or an axios-style response object.
 */
export function logError(label, err, extra) {
  const info = {
    message: err?.message ?? (typeof err === 'string' ? err : undefined),
    name: err?.name,
    status: err?.response?.status ?? err?.status,
    data: err?.response?.data ?? err?.data,
    stack: err?.stack,
    ...(extra || {}),
  };

  console.error(label, info);

  // Prefer the server-supplied message over anything stringified from the
  // Error wrapper. Fall back to the label so the UI never shows "[object
  // Object]" or a 2-char minifier artefact.
  return (
    info.data?.message ||
    info.data?.error ||
    info.message ||
    label
  );
}

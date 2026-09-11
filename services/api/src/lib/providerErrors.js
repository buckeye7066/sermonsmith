// Client-safe mapping for AI provider (OpenAI SDK) errors.
//
// SDK errors carry the provider's own text: billing links, organization ids,
// masked key fragments ("You have no credits remaining. Add credits ... at
// https://platform.openai.com/settings/organization/billing"). The global error
// handler used to forward err.message for every non-500 status, so on
// 2026-09-11 end users were shown the operator's OpenAI billing notice as a 429.
// The owner still receives the raw error through reportErrorToOwner.

const QUOTA_MESSAGE = /insufficient_quota|exceeded your current quota|no credits remaining/i;

const own = (err, key) => Object.prototype.hasOwnProperty.call(err, key);

// openai@4 APIError assigns status, headers, request_id and error in its
// constructor. Errors this codebase raises itself only ever set `status`.
export function isProviderApiError(err) {
  return Boolean(err) && typeof err === 'object'
    && typeof err.status === 'number'
    && own(err, 'headers')
    && own(err, 'request_id');
}

export function isProviderQuotaExhausted(err) {
  if (!isProviderApiError(err) || err.status !== 429) return false;
  return err.code === 'insufficient_quota'
    || err.error?.code === 'insufficient_quota'
    || QUOTA_MESSAGE.test(String(err.message || ''));
}

const UNAVAILABLE = 'AI generation is temporarily unavailable. Please try again later.';

/**
 * @returns {null | { status: number, code: string, message: string }}
 *   null when the error did not come from the provider SDK.
 */
export function clientSafeProviderError(err) {
  if (!isProviderApiError(err)) return null;
  if (isProviderQuotaExhausted(err) || err.status === 401 || err.status === 403) {
    // Account-level problems (no credits, bad or revoked key) are outages, not
    // something the user caused or can fix by retrying.
    return { status: 503, code: 'ai_unavailable', message: UNAVAILABLE };
  }
  if (err.status === 429) {
    // Deliberately not 429: the client reserves that for the per-user daily
    // AI limit, which has different copy and different advice.
    return { status: 503, code: 'ai_busy', message: 'The AI service is busy right now. Please try again in a moment.' };
  }
  return { status: 502, code: 'ai_upstream_error', message: 'The AI service could not complete this request. Please try again.' };
}

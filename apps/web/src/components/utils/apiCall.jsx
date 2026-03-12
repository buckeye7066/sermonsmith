/**
 * UNIFIED API CALL HELPER
 *
 * api.functions.invoke returns parsed JSON directly.
 * Backend functions MAY use the { ok, error, data } envelope.
 * This helper unwraps the envelope when present.
 */

import { api } from '@/api/apiClient';

/**
 * Call a backend function and unwrap the envelope if present.
 * @param {string} functionName
 * @param {object} payload
 * @returns {Promise<any>}
 */
export async function apiCall(functionName, payload = {}) {
  const response = await api.functions.invoke(functionName, payload);

  if (!response || typeof response !== 'object') {
    return response;
  }

  if (response.selfTest) return response;

  if (response.ok === false) {
    throw new Error(response.error || 'Unknown error from server');
  }

  return response.data ?? response;
}

/**
 * Call a backend function that returns binary data (e.g. file export).
 * NOTE: Current backend export endpoints are stubs (client-side via jsPDF).
 * This placeholder uses the standard JSON endpoint and wraps the response.
 * @param {string} functionName
 * @param {object} payload
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function apiBinaryCall(functionName, payload = {}) {
  const response = await apiCall(functionName, payload);
  // Backend export routes currently return JSON messages.
  // Convert to a text blob so callers that expect a blob still work.
  const text = typeof response === 'string' ? response : JSON.stringify(response);
  const blob = new Blob([text], { type: 'application/octet-stream' });
  return { blob, filename: `${functionName}-export` };
}

export default apiCall;

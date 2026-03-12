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

export default apiCall;

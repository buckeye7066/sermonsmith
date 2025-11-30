/**
 * UNIFIED API CALL HELPER
 * 
 * All backend functions now return: { ok: boolean, error: string|null, data: any }
 * This helper unwraps the envelope and throws on errors.
 */

import { base44 } from '@/api/base44Client';

/**
 * Call a backend function and unwrap the unified envelope
 * @param {string} functionName - Name of the function to call
 * @param {object} payload - Payload to send
 * @returns {Promise<any>} - The data from the response
 * @throws {Error} - If ok is false or response is invalid
 */
export async function apiCall(functionName, payload = {}) {
  try {
    const response = await base44.functions.invoke(functionName, payload);
    
    // Handle non-object responses
    if (!response || typeof response.data !== 'object') {
      // Check for HTML response (error page)
      if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
        throw new Error('Server returned an error page. Please try again.');
      }
      return response.data;
    }
    
    const { ok, error, data, selfTest } = response.data;
    
    // Self-test responses are always valid
    if (selfTest) {
      return response.data;
    }
    
    // Check envelope
    if (ok === false) {
      throw new Error(error || 'Unknown error from server');
    }
    
    // Return the data payload
    return data ?? response.data;
    
  } catch (err) {
    // Re-throw with cleaner message
    if (err.message?.includes('<!doctype') || err.message?.includes('<html')) {
      throw new Error('Server temporarily unavailable. Please try again.');
    }
    throw err;
  }
}

/**
 * Call a backend function that returns binary data (PDF, PPTX)
 * @param {string} functionName - Name of the function to call
 * @param {object} payload - Payload to send
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function apiBinaryCall(functionName, payload = {}) {
  const response = await base44.functions.invoke(functionName, payload);
  
  // Check if it's an error response
  if (response.data && typeof response.data === 'object' && response.data.ok === false) {
    throw new Error(response.data.error || 'Export failed');
  }
  
  // Get filename from headers if available
  const contentDisposition = response.headers?.['content-disposition'] || '';
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : 'download';
  
  return {
    blob: new Blob([response.data]),
    filename
  };
}

export default apiCall;
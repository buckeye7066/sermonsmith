/**
 * Application parameters derived from URL query strings and localStorage.
 * Kept minimal after migration off external auth providers.
 */

const isNode = typeof window === 'undefined';

function getParamValue(paramName, { removeFromUrl = false } = {}) {
  if (isNode) return null;

  const urlParams = new URLSearchParams(window.location.search);
  const value = urlParams.get(paramName);

  if (value && removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  return value || null;
}

export const appParams = {
  token: getParamValue('access_token', { removeFromUrl: true }),
  returnUrl: getParamValue('return'),
};

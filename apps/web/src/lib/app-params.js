/**
 * Application parameters derived from URL query strings.
 * Auth tokens are managed via httpOnly cookies — no token parameters needed.
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
  returnUrl: getParamValue('return'),
};

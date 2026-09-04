// Electron configuration compatibility helpers.
// The historical default cannot be distinguished from an explicit local
// configuration after it has been persisted. Keep that value intact and ask
// the pastor to confirm it once instead of silently redirecting a working
// backend to a different port.
const LEGACY_LOCAL_API_URL = 'http://localhost:3001';
const DEFAULT_LOCAL_API_URL = 'http://localhost:3101';

function isBareLegacyLocalApiUrl(apiUrl) {
  if (typeof apiUrl !== 'string') return false;

  try {
    const url = new URL(apiUrl);
    return url.protocol === 'http:'
      && url.hostname === 'localhost'
      && url.port === '3001'
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function requiresLocalApiUrlReview(config) {
  return Boolean(
    config
    && typeof config === 'object'
    && config.localApiUrlReviewed !== true
    && isBareLegacyLocalApiUrl(config.apiUrl),
  );
}

module.exports = {
  DEFAULT_LOCAL_API_URL,
  LEGACY_LOCAL_API_URL,
  isBareLegacyLocalApiUrl,
  requiresLocalApiUrlReview,
};

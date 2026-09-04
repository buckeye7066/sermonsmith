// Electron configuration compatibility helpers.
// Keep the migration deliberately narrow: only the historical first-run
// default is rewritten, so users' explicit local ports, paths, and remote
// deployment URLs remain untouched.
const LEGACY_LOCAL_API_URL = 'http://localhost:3001';
const DEFAULT_LOCAL_API_URL = 'http://localhost:3101';

function migrateLegacyLocalApiUrl(config) {
  if (!config || typeof config !== 'object' || typeof config.apiUrl !== 'string') {
    return config;
  }

  try {
    const url = new URL(config.apiUrl);
    const isLegacyDefault = url.protocol === 'http:'
      && url.hostname === 'localhost'
      && url.port === '3001'
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && !url.username
      && !url.password;

    return isLegacyDefault
      ? { ...config, apiUrl: DEFAULT_LOCAL_API_URL }
      : config;
  } catch {
    return config;
  }
}

module.exports = {
  DEFAULT_LOCAL_API_URL,
  LEGACY_LOCAL_API_URL,
  migrateLegacyLocalApiUrl,
};

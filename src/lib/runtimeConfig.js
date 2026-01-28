function assertValidString(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[runtimeConfig] Missing or invalid ${name}.`);
  }
}

function assertValidBackendUrl(url) {
  assertValidString('backendUrl', url);
  // Keep validation intentionally minimal but explicit.
  if (!/^https?:\/\/.+/i.test(url)) {
    throw new Error(
      `[runtimeConfig] Invalid backendUrl "${url}". Expected an http(s) URL like "https://your-base44-backend".`
    );
  }
}

/**
 * Load Base44 runtime configuration.
 *
 * Electron builds must be configurable at runtime (renderer bundle is already built),
 * so in Electron we read config via the preload bridge.
 *
 * Web builds continue to use Vite import.meta.env.
 */
export async function getRuntimeConfig() {
  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;

  if (isElectron) {
    const cfg = await window.electron.getConfig();
    if (!cfg) {
      throw new Error(
        '[runtimeConfig] Missing Base44 configuration. Please complete the first-run wizard (appId + backendUrl).'
      );
    }
    assertValidString('appId', cfg.appId);
    assertValidBackendUrl(cfg.backendUrl);
    return { appId: cfg.appId, backendUrl: cfg.backendUrl };
  }

  const appId = import.meta.env.VITE_BASE44_APP_ID;
  const backendUrl = import.meta.env.VITE_BASE44_BACKEND_URL;

  assertValidString('VITE_BASE44_APP_ID', appId);
  assertValidBackendUrl(backendUrl);

  return { appId, backendUrl };
}


// Electron preload — CommonJS (see main.cjs for the .cjs rationale).
const { contextBridge, ipcRenderer } = require('electron');

// Same validation as main.cjs. Local HTTP is allowed for dev; everything
// else must be HTTPS — a hostile first-run prompt cannot point the
// desktop app at a plaintext attacker server on the same network.
function isValidConfig(config) {
  if (!config || typeof config !== 'object') return false;
  try {
    const url = new URL(config.apiUrl);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost);
  } catch {
    return false;
  }
}

contextBridge.exposeInMainWorld('electron', {
  saveConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: apiUrl must be HTTPS (or HTTP for localhost).');
    }
    return ipcRenderer.invoke('save-config', config);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: apiUrl must be HTTPS (or HTTP for localhost).');
    }
    return ipcRenderer.invoke('update-config', config);
  },
  // The renderer bundle is built with a baked-in import.meta.env.VITE_API_URL,
  // so we cannot rely on the env var to update at first-run. The web
  // apiClient resolves its base URL through this bridge instead — if a
  // config has been saved it always wins over the bundled default.
  getApiUrl: async () => {
    const config = await ipcRenderer.invoke('get-config');
    return config?.apiUrl || null;
  },
  savePdf: (payload) => ipcRenderer.invoke('save-pdf', payload),
  isElectron: true,
});


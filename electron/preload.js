const { contextBridge, ipcRenderer } = require('electron');

// Validate configuration object
function isValidConfig(config) {
  return (
    config &&
    typeof config === 'object' &&
    typeof config.appId === 'string' &&
    config.appId.length > 0 &&
    typeof config.backendUrl === 'string' &&
    config.backendUrl.length > 0 &&
    // Validate URL format
    /^https?:\/\/.+/.test(config.backendUrl)
  );
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Configuration management
  saveConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: appId and backendUrl (valid URL) are required');
    }
    return ipcRenderer.invoke('save-config', config);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: appId and backendUrl (valid URL) are required');
    }
    return ipcRenderer.invoke('update-config', config);
  },
  
  // Check if running in Electron
  isElectron: true
});

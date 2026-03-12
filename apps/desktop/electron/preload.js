const { contextBridge, ipcRenderer } = require('electron');

function isValidConfig(config) {
  return (
    config &&
    typeof config === 'object' &&
    typeof config.apiUrl === 'string' &&
    config.apiUrl.length > 0 &&
    /^https?:\/\/.+/.test(config.apiUrl)
  );
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Configuration management
  saveConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: apiUrl (valid URL) is required');
    }
    return ipcRenderer.invoke('save-config', config);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: async (config) => {
    if (!isValidConfig(config)) {
      throw new Error('Invalid configuration: apiUrl (valid URL) is required');
    }
    return ipcRenderer.invoke('update-config', config);
  },
  
  // Check if running in Electron
  isElectron: true
});

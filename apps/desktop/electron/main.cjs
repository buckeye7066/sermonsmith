// Electron main process — CommonJS.
//
// The desktop workspace declares `"type": "module"`, which makes Node /
// Electron treat every `.js` in the package as an ES module. `require()`
// is not defined in ESM scope, so the previous `main.js` / `preload.js`
// loaded as ESM and threw at startup. Renaming to `.cjs` opts those two
// files back into CommonJS while leaving the rest of the package free to
// stay ESM-first.
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { migrateLegacyLocalApiUrl } = require('./config.cjs');

const store = new Store();

let mainWindow;
let firstRunWindow;

function isFirstRun() {
  store.get('sermonsmithConfig'); // Ensure the store is initialized
  return !store.has('sermonsmithConfig');
}

function getStoredConfig() {
  const savedConfig = store.get('sermonsmithConfig');
  const migratedConfig = migrateLegacyLocalApiUrl(savedConfig);
  if (migratedConfig !== savedConfig) {
    store.set('sermonsmithConfig', migratedConfig);
  }
  return migratedConfig;
}

// Mirror of the renderer-side check so we never persist a config the
// renderer would refuse anyway. Local HTTP is allowed for dev; everything
// else MUST be HTTPS so a stolen first-run prompt cannot redirect users to
// a plaintext attacker URL on the same network.
function isValidConfig(config) {
  if (!config || typeof config !== 'object') return false;
  try {
    const url = new URL(config.apiUrl);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!/^https?:\/\/.+/i.test(config.apiUrl)) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost);
  } catch {
    return false;
  }
}

function createMainWindow() {
  const iconPath = path.join(app.getAppPath(), '..', 'web', 'src', 'assets', 'icons', 'icon.png');
  mainWindow = new BrowserWindow({
    width: store.get('windowWidth', 1200),
    height: store.get('windowHeight', 800),
    x: store.get('windowX'),
    y: store.get('windowY'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: iconPath,
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'web', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowWidth', bounds.width);
    store.set('windowHeight', bounds.height);
    store.set('windowX', bounds.x);
    store.set('windowY', bounds.y);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFirstRunWindow() {
  const iconPath = path.join(app.getAppPath(), '..', 'web', 'src', 'assets', 'icons', 'icon.png');
  firstRunWindow = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: iconPath,
  });

  firstRunWindow.loadFile(path.join(__dirname, 'first-run.html'));

  firstRunWindow.on('closed', () => {
    firstRunWindow = null;
    if (isFirstRun()) {
      app.quit();
    }
  });
}

ipcMain.handle('save-config', async (_event, config) => {
  try {
    if (!isValidConfig(config)) {
      return { success: false, error: 'Invalid configuration: apiUrl must be HTTPS (or HTTP for localhost).' };
    }
    store.set('sermonsmithConfig', config);
    // Setting process.env.VITE_API_URL here is intentionally a no-op for
    // the *built* renderer — Vite inlines import.meta.env.VITE_API_URL at
    // build time. The renderer reads the live value via the preload's
    // `getApiUrl()` bridge instead.
    process.env.VITE_API_URL = config.apiUrl;

    if (firstRunWindow) {
      firstRunWindow.close();
    }
    createMainWindow();
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-config', async () => {
  return getStoredConfig();
});

ipcMain.handle('update-config', async (_event, config) => {
  try {
    if (!isValidConfig(config)) {
      return { success: false, error: 'Invalid configuration: apiUrl must be HTTPS (or HTTP for localhost).' };
    }
    store.set('sermonsmithConfig', config);
    process.env.VITE_API_URL = config.apiUrl;
    return { success: true };
  } catch (error) {
    console.error('Error updating config:', error);
    return { success: false, error: error.message };
  }
});

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function trustedRenderer(event) {
  try {
    const sender = new URL(event.senderFrame.url);
    return sender.protocol === 'file:'
      || (sender.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(sender.hostname));
  } catch {
    return false;
  }
}

ipcMain.handle('save-pdf', async (event, payload) => {
  try {
    if (!trustedRenderer(event)) return { success: false, error: 'Untrusted renderer.' };
    const filename = typeof payload?.filename === 'string' ? payload.filename.trim() : '';
    const data = typeof payload?.data === 'string' ? payload.data : '';
    if (!filename || filename.length > 120 || path.basename(filename) !== filename
        || !/^[\\w .()-]+\\.pdf$/i.test(filename)) {
      return { success: false, error: 'Invalid PDF filename.' };
    }
    if (!data || data.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 4
        || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { success: false, error: 'Invalid PDF data.' };
    }
    const bytes = Buffer.from(data, 'base64');
    if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES
        || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return { success: false, error: 'Invalid PDF document.' };
    }

    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(ownerWindow, {
      title: 'Save Bible study PDF',
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    await fs.writeFile(result.filePath, bytes, { flag: 'w' });
    return { success: true, fileName: path.basename(result.filePath) };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return { success: false, error: 'The PDF could not be saved.' };
  }
});

app.whenReady().then(() => {
  if (!isFirstRun()) {
    const config = getStoredConfig();
    process.env.VITE_API_URL = config.apiUrl;
    createMainWindow();
  } else {
    createFirstRunWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!isFirstRun()) {
        createMainWindow();
      } else {
        createFirstRunWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});


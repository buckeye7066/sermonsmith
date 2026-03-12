const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let firstRunWindow;

function isFirstRun() {
  return !store.has('sermonsmithConfig');
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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath,
    show: false
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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath
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
    store.set('sermonsmithConfig', config);
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
  return store.get('sermonsmithConfig');
});

ipcMain.handle('update-config', async (_event, config) => {
  try {
    store.set('sermonsmithConfig', config);
    process.env.VITE_API_URL = config.apiUrl;
    return { success: true };
  } catch (error) {
    console.error('Error updating config:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  if (!isFirstRun()) {
    const config = store.get('sermonsmithConfig');
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

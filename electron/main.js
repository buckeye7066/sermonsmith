const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persistent configuration
const store = new Store();

let mainWindow;
let firstRunWindow;

// Check if this is the first run (no config stored)
function isFirstRun() {
  return !store.has('base44Config');
}

// Create the main application window
function createMainWindow() {
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
    icon: path.join(__dirname, '..', 'src', 'assets', 'icons', 'icon.png'),
    show: false // Don't show until ready
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window position and size on close
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

// Create first-run setup wizard window
function createFirstRunWindow() {
  firstRunWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icons', 'icon.png')
  });

  firstRunWindow.loadFile(path.join(__dirname, 'first-run.html'));

  firstRunWindow.on('closed', () => {
    firstRunWindow = null;
    // If setup was cancelled, quit the app
    if (isFirstRun()) {
      app.quit();
    }
  });
}

// Handle configuration save from first-run wizard
ipcMain.handle('save-config', async (event, config) => {
  try {
    store.set('base44Config', config);
    
    // Set environment variables for the app
    process.env.VITE_BASE44_APP_ID = config.appId;
    process.env.VITE_BASE44_BACKEND_URL = config.backendUrl;
    
    // Close first-run window and open main window
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

// Handle configuration retrieval
ipcMain.handle('get-config', async () => {
  return store.get('base44Config');
});

// Handle configuration update from settings
ipcMain.handle('update-config', async (event, config) => {
  try {
    store.set('base44Config', config);
    
    // Update environment variables
    process.env.VITE_BASE44_APP_ID = config.appId;
    process.env.VITE_BASE44_BACKEND_URL = config.backendUrl;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating config:', error);
    return { success: false, error: error.message };
  }
});

// App ready event
app.whenReady().then(() => {
  // Load config if it exists and set environment variables
  if (!isFirstRun()) {
    const config = store.get('base44Config');
    process.env.VITE_BASE44_APP_ID = config.appId;
    process.env.VITE_BASE44_BACKEND_URL = config.backendUrl;
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

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

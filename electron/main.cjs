// Flint — Electron Desktop Wrapper
// This file uses CommonJS (require) intentionally.
// The .cjs extension ensures Node treats it as CommonJS
// regardless of any "type":"module" in parent package.json files.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Resolve paths relative to THIS file's directory
const APP_DIR = __dirname;
const DIST_FILE = path.join(APP_DIR, 'dist', 'index.html');
const ICON_FILE = path.join(APP_DIR, 'icon.png');

function createWindow() {
  // Check dist exists before creating window
  if (!fs.existsSync(DIST_FILE)) {
    console.error('[Flint] ERROR: dist/index.html not found at ' + DIST_FILE);
    console.error('[Flint] The web app was not built correctly.');
    console.error('[Flint] Try running: bash install.sh');
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Flint',
    backgroundColor: '#0a0a0a',
    icon: fs.existsSync(ICON_FILE) ? ICON_FILE : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Load the built web app
  mainWindow.loadFile(DIST_FILE).then(() => {
    console.log('[Flint] Loaded successfully');
  }).catch(err => {
    console.error('[Flint] Failed to load:', err.message);
  });

  // Show window only when content is ready (no blank flash)
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      console.log('[Flint] Window displayed');
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    console.log('[Flint] App ready — desktop mode');
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) createWindow();
  });
}

// Graceful error handling
process.on('uncaughtException', (err) => {
  console.error('[Flint] Uncaught exception:', err.message);
});

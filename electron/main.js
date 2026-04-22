const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Flint',
    backgroundColor: '#0a0a0a',
    icon: path.join(__dirname, '..', 'public', 'flint-logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Remove default menu bar
    autoHideMenuBar: true,
  });

  // Load the built dist
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(distPath);

  // Remove menu
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let loadingWindow: BrowserWindow | null = null;

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 480,
    height: 480,
    frame: false,          
    transparent: true,    
    resizable: true,
    show: false,          
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  loadingWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));

  loadingWindow.once('ready-to-show', () => {
    if (loadingWindow) {
      loadingWindow.show();
    }
  });

  loadingWindow.on('closed', () => {
    loadingWindow = null;
  });
}

// IPC Handlers for Custom Window Controls
ipcMain.on('window-minimize', () => {
  if (loadingWindow) {
    loadingWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (loadingWindow) {
    if (loadingWindow.isMaximized()) {
      loadingWindow.unmaximize();
    } else {
      loadingWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (loadingWindow) {
    loadingWindow.close();
  }
});

app.whenReady().then(() => {
  createLoadingWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoadingWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


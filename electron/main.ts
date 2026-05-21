import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let loadingWindow: BrowserWindow | null = null;

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 480,
    height: 480,
    frame: false,          
    transparent: true,    
    resizable: false,
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

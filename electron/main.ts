import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

let loadingWindow: BrowserWindow | null = null;
let dbClient: MongoClient | null = null;

async function connectToDatabase(window: BrowserWindow) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in the environment configurations.");
  }

  try {
    window.webContents.send('db-status', {
      status: 'connecting',
      message: 'Securing database link...'
    });

    console.log("Connecting to MongoDB Atlas...");
    dbClient = new MongoClient(mongoUri);
    await dbClient.connect();

    await dbClient.db("admin").command({ ping: 1 });
    console.log("MongoDB connection verified successfully.");

    window.webContents.send('db-status', {
      status: 'success',
      message: 'Active database link established'
    });
  } catch (error: any) {
    console.error("Database connection error:", error);
    
    window.webContents.send('db-status', {
      status: 'error',
      message: error.message || 'Could not connect to Atlas DB cluster'
    });
  }
}

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
      
      // Delay database connection slightly to allow loading window transitions to render first
      setTimeout(() => {
        if (loadingWindow) {
          connectToDatabase(loadingWindow);
        }
      }, 1500);
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



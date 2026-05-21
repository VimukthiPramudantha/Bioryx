import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onDbStatus: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('db-status', callback);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Bioryx Preload script initialized.');
});


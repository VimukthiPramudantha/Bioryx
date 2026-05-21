import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close')
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Bioryx Preload script initialized.');
});


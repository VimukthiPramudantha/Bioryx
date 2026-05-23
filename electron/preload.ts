import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  onDbStatus: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('db-status', callback);
  },

  // ZKTeco testing
  testZkTecoConnection: (ip: string, port: number) =>
    ipcRenderer.invoke('zkteco-test-connection', ip, port),

  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),

  // Individual ZKTeco Connection Controls
  connectZkTeco: (ip: string, port: number) =>
    ipcRenderer.invoke('connect-zkteco', ip, port),
  disconnectZkTeco: () =>
    ipcRenderer.invoke('disconnect-zkteco'),

  // Individual MongoDB Connection Controls
  connectMongo: (mongoUri: string, mongoCollection: string) =>
    ipcRenderer.invoke('connect-mongodb', mongoUri, mongoCollection),
  disconnectMongo: () =>
    ipcRenderer.invoke('disconnect-mongodb'),

  // Real-Time punch callback subscription
  onRealTimePunch: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('realtime-punch', callback);
  },

  // State checks
  getAttendanceLogsArchive: () => ipcRenderer.invoke('get-attendance-logs-archive'),
  getConnectionState: () => ipcRenderer.invoke('get-connection-state'),
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Bioryx Preload script initialized with real-time support.');
});

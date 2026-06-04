import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import * as dns from 'dns';
import { zktecoService } from '../backend/device/zktecoService';
import { AttendanceDbService } from '../backend/db/attendanceDb';

app.disableHardwareAcceleration();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn("Could not set custom DNS servers:", e);
}

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let dbClient: MongoClient | null = null;
let isDbConnected = false;
let activeMongoUri = '';
let zktecoSyncInterval: NodeJS.Timeout | null = null;
let activeCollectionName = 'attendance_logs';

interface CachedPunch {
  userId: string;
  attTime: string;
  deviceIp: string;
  mongoSynced: boolean;
}

interface ArchivedAttLog {
  userId: string;
  timestamp: string; // ISO string
  deviceIp: string;
  type?: number;
  state?: number;
}

interface DeviceUser {
  userId: string;
  name: string;
  role?: number;
  cardno?: number;
}

function getUserArchiveFilePath(): string {
  return path.join(app.getPath('userData'), 'device_users_archive.json');
}

function readUserArchive(): DeviceUser[] {
  try {
    const filePath = getUserArchiveFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading device users archive:', err);
  }
  return [];
}

function writeUserArchive(users: DeviceUser[]) {
  try {
    fs.writeFileSync(getUserArchiveFilePath(), JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing device users archive:', err);
  }
}

async function fetchAndArchiveDeviceUsers(): Promise<void> {
  const result = await zktecoService.getUsers();
  if (!result.success || !result.data) {
    console.warn('Could not fetch users from device:', result.error);
    return;
  }

  const incoming: DeviceUser[] = result.data.map((u: any) => ({
    userId: String(u.userId ?? u.user_id ?? ''),
    name: String(u.name || ''),
    role: u.role,
    cardno: u.cardno,
  }));

  writeUserArchive(incoming);
  console.log(`Archived ${incoming.length} device users.`);
}

function getArchiveFilePath(): string {
  return path.join(app.getPath('userData'), 'device_logs_archive.json');
}

function readArchive(): ArchivedAttLog[] {
  try {
    const filePath = getArchiveFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading attendance archive:', err);
  }
  return [];
}

function writeArchive(logs: ArchivedAttLog[]) {
  try {
    fs.writeFileSync(getArchiveFilePath(), JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing attendance archive:', err);
  }
}

function pruneOlderThan7Days(logs: ArchivedAttLog[]): ArchivedAttLog[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
  return logs.filter(l => {
    try {
      return new Date(l.timestamp).getTime() >= cutoff;
    } catch (_) {
      return false;
    }
  });
}

function mergeArchive(existing: ArchivedAttLog[], incoming: ArchivedAttLog[]): ArchivedAttLog[] {
  const seen = new Set<string>(existing.map(l => `${l.userId}_${l.timestamp}`));
  const merged = [...existing];
  for (const log of incoming) {
    const key = `${log.userId}_${log.timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(log);
    }
  }
  return merged;
}

async function fetchAndArchiveDeviceLogs(deviceIp: string): Promise<void> {
  const result = await zktecoService.getAttendances();
  if (!result.success || !result.data) {
    console.warn('Could not fetch attendance logs from device:', result.error);
    return;
  }

  const incoming: ArchivedAttLog[] = result.data.map((rec: any) => ({
    userId: String(rec.user_id ?? rec.userId ?? ''),
    timestamp: rec.record_time
      ? new Date(rec.record_time).toISOString()
      : new Date().toISOString(),
    deviceIp,
    type:  rec.type,
    state: rec.state,
  }));

  const existing = readArchive();
  const merged   = mergeArchive(existing, incoming);
  const pruned   = pruneOlderThan7Days(merged);
  writeArchive(pruned);
  console.log(`Archived ${incoming.length} device logs locally. Total after merge+prune: ${pruned.length}.`);

  if (isDbConnected && dbClient) {
    try {
      const sorted = [...incoming].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      let synced = 0;
      for (const log of sorted) {
        const res = await AttendanceDbService.saveOrUpdatePunch(
          dbClient,
          activeCollectionName,
          log.userId,
          new Date(log.timestamp),
          app.getPath('userData')
        );
        if (res.success) synced++;
      }
      console.log(`Pushed ${synced}/${incoming.length} device logs into MongoDB daily attendance.`);
    } catch (err) {
      console.error('Failed to push device logs to MongoDB:', err);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('db-status', {
      synced: isDbConnected,
      count:  pruned.length,
      message: `Fetched ${incoming.length} attendance records from the ZKTeco reader.`
    });
  }
}

function getCacheFilePath(): string {
  return path.join(app.getPath('userData'), 'local_punch_cache.json');
}

function getCachedPunches(): CachedPunch[] {
  const filePath = getCacheFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading offline punch cache file:', err);
  }
  return [];
}

function saveCachedPunches(punches: CachedPunch[]) {
  const filePath = getCacheFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(punches, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing offline punch cache file:', err);
  }
}

function addPunchToCache(punch: CachedPunch) {
  const list = getCachedPunches();
  list.push(punch);
  saveCachedPunches(list);
  console.log(`Punch cached locally. Total offline punches: ${list.length}`);
}

async function connectToDatabase(mongoUri: string): Promise<{ success: boolean; responseTime?: number; error?: string }> {
  const start = Date.now();
  try {
    if (dbClient) {
      try { await dbClient.close(); } catch (_) { /* ignore */ }
      dbClient = null;
    }
    activeMongoUri = mongoUri;
    dbClient = new MongoClient(mongoUri);
    await dbClient.connect();
    await dbClient.db("admin").command({ ping: 1 });
    isDbConnected = true;
    
    syncOfflinePunches();

    return { success: true, responseTime: Date.now() - start };
  } catch (error: any) {
    isDbConnected = false;
    dbClient = null;
    return { success: false, error: error.message || 'MongoDB connection failed' };
  }
}

async function disconnectFromDatabase(): Promise<void> {
  if (dbClient) {
    try { await dbClient.close(); } catch (_) { }
    dbClient = null;
  }
  isDbConnected = false;
}

function startZktecoSyncInterval() {
  stopZktecoSyncInterval();
  zktecoSyncInterval = setInterval(async () => {
    if (zktecoService.deviceStatus === 'Connected') {
      console.log('Running scheduled 5-minute ZKTeco sync...');
      await syncDeviceData();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

function stopZktecoSyncInterval() {
  if (zktecoSyncInterval) {
    clearInterval(zktecoSyncInterval);
    zktecoSyncInterval = null;
  }
}

async function syncDeviceData(): Promise<void> {
  if (zktecoService.deviceStatus !== 'Connected' || !zktecoService.deviceIp) {
    console.warn('Cannot sync: ZKTeco device is not connected.');
    return;
  }
  const ip = zktecoService.deviceIp;
  try {
    console.log(`Starting sync for device at ${ip}...`);
    await fetchAndArchiveDeviceLogs(ip);
    await fetchAndArchiveDeviceUsers();
    if (isDbConnected && dbClient) {
      await syncOfflinePunches();
    }
  } catch (err) {
    console.error('Failed to sync device data:', err);
  }
}

async function syncOfflinePunches() {
  if (!isDbConnected || !dbClient) return;
  const list = getCachedPunches();
  if (list.length === 0) return;

  console.log(`Found ${list.length} offline punches. Synchronizing to Daily Attendance in MongoDB...`);
  try {
    // Sort punches chronologically to ensure IN/OUT are processed in order
    list.sort((a, b) => new Date(a.attTime).getTime() - new Date(b.attTime).getTime());

    let syncedCount = 0;
    for (const item of list) {
      const punchTime = new Date(item.attTime);
      const res = await AttendanceDbService.saveOrUpdatePunch(
        dbClient,
        activeCollectionName,
        item.userId,
        punchTime,
        app.getPath('userData')
      );
      if (res.success) {
        syncedCount++;
      }
    }

    console.log(`Successfully synced ${syncedCount} of ${list.length} offline punches to Daily Attendance in MongoDB.`);

    saveCachedPunches([]);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db-status', {
        synced: true,
        count: syncedCount,
        message: `Successfully synchronized ${syncedCount} offline buffered punch records.`
      });
    }
  } catch (err) {
    console.error('Error occurred while synchronizing offline punches:', err);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
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

  mainWindow.loadFile(path.join(__dirname, '../../renderer/dashboard/dashboard.html'));

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

zktecoService.onRealTimePunch = async (punch) => {
  console.log('Main process intercepted a real-time punch event:', punch);
  
  const punchData: CachedPunch = {
    userId: punch.userId,
    attTime: punch.attTime.toISOString(),
    deviceIp: zktecoService.deviceIp || '192.168.1.201',
    mongoSynced: false
  };

  // Write directly to database if active
  if (isDbConnected && dbClient) {
    try {
      const res = await AttendanceDbService.saveOrUpdatePunch(
        dbClient,
        activeCollectionName,
        punchData.userId,
        new Date(punchData.attTime),
        app.getPath('userData')
      );
      if (res.success) {
        punchData.mongoSynced = true;
        console.log(`Successfully synced real-time punch into daily attendance [Action: ${res.action}]`);
      } else {
        console.error('Failed to sync in real-time. Buffering locally:', res.error);
        addPunchToCache(punchData);
      }
    } catch (err) {
      console.error('Failed to sync in real-time. Buffering locally:', err);
      addPunchToCache(punchData);
    }
  } else {
    console.log('MongoDB is disconnected. Buffering punch locally.');
    addPunchToCache(punchData);
  }

  // Stream the event to renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('realtime-punch', punchData);
  }
};


zktecoService.onDisconnected = async () => {
  console.warn('ZKTeco device dropped connection. Handling disconnect...');

  stopZktecoSyncInterval();

  if (isDbConnected && dbClient) {
    console.log('Device disconnected. Flushing offline cache to MongoDB...');
    await syncOfflinePunches().catch(err =>
      console.error('Failed to flush cache after device disconnect:', err)
    );
  } else {
    console.warn('Device disconnected and MongoDB is offline. Cached punches remain local until reconnected.');
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('device-disconnected', {
      message: 'ZKTeco device connection was lost. Local records are saved and will sync when reconnected.'
    });
  }
};

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('connect-zkteco', async (_event, ip: string, port: number) => {
  const result = await zktecoService.connect(ip, port);
  if (result.success) {
    syncDeviceData().catch(err =>
      console.error('Initial background sync failed:', err)
    );
    startZktecoSyncInterval();
  }

  return { success: result.success, error: result.error, info: result.info };
});

ipcMain.handle('disconnect-zkteco', async () => {
  stopZktecoSyncInterval();

  if (isDbConnected && dbClient) {
    console.log('Manual disconnect: flushing offline cache to MongoDB...');
    await syncOfflinePunches().catch(err =>
      console.error('Failed to flush cache on manual disconnect:', err)
    );
  }

  await zktecoService.disconnect();
  return { success: true };
});

ipcMain.handle('zkteco-test-connection', async (_event, ip: string, port: number) => {
  const start = Date.now();
  const result = await zktecoService.testConnection(ip, port);
  return { ...result, responseTime: Date.now() - start };
});

ipcMain.handle('connect-mongodb', async (_event, mongoUri: string, mongoCollection: string) => {
  activeCollectionName = mongoCollection || 'attendance_logs';
  const result = await connectToDatabase(mongoUri);
  return result;
});

ipcMain.handle('disconnect-mongodb', async () => {
  await disconnectFromDatabase();
  return { success: true };
});

ipcMain.handle('get-connection-state', async () => {
  return {
    deviceStatus: zktecoService.deviceStatus,
    deviceIp: zktecoService.deviceIp,
    isDbConnected,
    activeCollectionName,
    lastSyncTime: zktecoService.lastSyncTime ? zktecoService.lastSyncTime.toISOString() : null
  };
});

ipcMain.handle('get-sync-status', async () => {
  return {
    deviceStatus: zktecoService.deviceStatus,
    lastSyncTime: zktecoService.lastSyncTime ? zktecoService.lastSyncTime.toISOString() : null
  };
});

ipcMain.handle('get-attendance-logs-archive', async () => {
  let baseLogs: ArchivedAttLog[] = [];

  if (isDbConnected && dbClient) {
    try {
      const db = dbClient.db("bioryx");
      const col = db.collection(activeCollectionName);
      const dailyDocs = await col.find({}).toArray();

      for (const doc of dailyDocs) {
        if (!Array.isArray(doc.records)) continue;
        for (const rec of doc.records) {
          if (rec.inTime) {
            baseLogs.push({
              userId: String(rec.userId),
              timestamp: new Date(rec.inTime).toISOString(),
              deviceIp: rec.deviceIp || zktecoService.deviceIp || '',
            });
          }
          if (rec.outTime) {
            baseLogs.push({
              userId: String(rec.userId),
              timestamp: new Date(rec.outTime).toISOString(),
              deviceIp: rec.deviceIp || zktecoService.deviceIp || '',
            });
          }
        }
      }

      console.log(`Fetched ${baseLogs.length} punch events from MongoDB for attendance table.`);
    } catch (err) {
      console.error('Failed to fetch attendance from MongoDB, falling back to local archive:', err);
      baseLogs = pruneOlderThan7Days(readArchive());
    }
  } else {
    console.log('MongoDB offline — using local attendance archive as fallback.');
    baseLogs = pruneOlderThan7Days(readArchive());
  }

  const offlinePunches = getCachedPunches();
  const offlineAsLogs: ArchivedAttLog[] = offlinePunches.map(p => ({
    userId: p.userId,
    timestamp: p.attTime,
    deviceIp: p.deviceIp
  }));

  return mergeArchive(baseLogs, offlineAsLogs);
});

ipcMain.handle('get-device-users', async () => {
  return readUserArchive();
});

ipcMain.handle('sync-device-database', async () => {
  console.log('Manual or network-state triggered sync request received.');
  
  if (!isDbConnected && activeMongoUri) {
    console.log('Database disconnected but URI is cached. Attempting automatic reconnection...');
    await connectToDatabase(activeMongoUri);
  }

  if (zktecoService.deviceStatus === 'Connected') {
    await syncDeviceData();
  } else {
    if (isDbConnected && dbClient) {
      await syncOfflinePunches();
    }
  }

  return {
    success: true,
    isDbConnected,
    deviceStatus: zktecoService.deviceStatus
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

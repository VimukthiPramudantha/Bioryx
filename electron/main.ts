import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import * as dns from 'dns';
import { zktecoService } from '../backend/device/zktecoService';

// Force reliable DNS servers (Google DNS) to ensure MongoDB SRV records resolve correctly
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn("Could not set custom DNS servers:", e);
}

dotenv.config();

let mainWindow: BrowserWindow | null = null;
let dbClient: MongoClient | null = null;
let isDbConnected = false;
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

// ── Device Users Archive Utilities ────────────────────────────────────────

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

// ── Attendance Archive Utilities (7-day local storage) ────────────────────

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
  // Use userId+timestamp as a composite key for deduplication
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

  console.log(`Archived ${incoming.length} device logs. Total after merge+prune: ${pruned.length}.`);

  // Notify frontend that fresh logs are available
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('db-status', {
      synced: false,
      count:  pruned.length,
      message: `Fetched ${incoming.length} attendance records from the ZKTeco reader.`
    });
  }
}

// ── Offline Buffering Utilities ───────────────────────────────────────────

function getCacheFilePath(): string {
  // Use user's safe appData directory for persistent cache storage
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

// ── Database connection & sync ─────────────────────────────────────────────

async function connectToDatabase(mongoUri: string): Promise<{ success: boolean; responseTime?: number; error?: string }> {
  const start = Date.now();
  try {
    if (dbClient) {
      try { await dbClient.close(); } catch (_) { /* ignore */ }
      dbClient = null;
    }
    dbClient = new MongoClient(mongoUri);
    await dbClient.connect();
    await dbClient.db("admin").command({ ping: 1 });
    isDbConnected = true;
    
    // Automatically trigger synchronization of cached offline logs
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
    try { await dbClient.close(); } catch (_) { /* ignore */ }
    dbClient = null;
  }
  isDbConnected = false;
}

async function syncOfflinePunches() {
  if (!isDbConnected || !dbClient) return;
  const list = getCachedPunches();
  if (list.length === 0) return;

  console.log(`Found ${list.length} offline punches. Synchronizing to MongoDB Atlas...`);
  try {
    const db = dbClient.db("bioryx");
    const col = db.collection(activeCollectionName);

    const documents = list.map(item => ({
      userId: item.userId,
      timestamp: new Date(item.attTime),
      deviceIp: item.deviceIp,
      syncedAt: new Date(),
      syncType: 'offline_buffered'
    }));

    await col.insertMany(documents);
    console.log(`Successfully synced ${documents.length} offline punches to MongoDB collection "${activeCollectionName}".`);

    // Reset local cache
    saveCachedPunches([]);

    // Notify UI that a sync completed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db-status', {
        synced: true,
        count: documents.length,
        message: `Successfully synchronized ${documents.length} offline buffered punch records.`
      });
    }
  } catch (err) {
    console.error('Error occurred while synchronizing offline punches:', err);
  }
}

// ── Window Creation ────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
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

// ── Bind Real-time callback to ZKTeco Service ──────────────────────────────

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
      const db = dbClient.db("bioryx");
      const col = db.collection(activeCollectionName);
      await col.insertOne({
        userId: punchData.userId,
        timestamp: new Date(punchData.attTime),
        deviceIp: punchData.deviceIp,
        syncedAt: new Date(),
        syncType: 'realtime'
      });
      punchData.mongoSynced = true;
      console.log(`Inserted punch into database in real-time [Collection: ${activeCollectionName}]`);
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

// ── Window Controls IPC ────────────────────────────────────────────────────

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

// ── ZKTeco Connection IPC Handlers ─────────────────────────────────────────

ipcMain.handle('connect-zkteco', async (_event, ip: string, port: number) => {
  const result = await zktecoService.connect(ip, port);

  // Automatically pull & archive all device logs and users upon successful connection
  if (result.success) {
    fetchAndArchiveDeviceLogs(ip).catch(err =>
      console.error('Background archive fetch failed:', err)
    );
    fetchAndArchiveDeviceUsers().catch(err =>
      console.error('Background users fetch failed:', err)
    );
  }

  return { success: result.success, error: result.error, info: result.info };
});

ipcMain.handle('disconnect-zkteco', async () => {
  await zktecoService.disconnect();
  return { success: true };
});

ipcMain.handle('zkteco-test-connection', async (_event, ip: string, port: number) => {
  const start = Date.now();
  const result = await zktecoService.testConnection(ip, port);
  return { ...result, responseTime: Date.now() - start };
});

// ── MongoDB Connection IPC Handlers ────────────────────────────────────────

ipcMain.handle('connect-mongodb', async (_event, mongoUri: string, mongoCollection: string) => {
  activeCollectionName = mongoCollection || 'attendance_logs';
  const result = await connectToDatabase(mongoUri);
  return result;
});

ipcMain.handle('disconnect-mongodb', async () => {
  await disconnectFromDatabase();
  return { success: true };
});

// ── Status Checks IPC Handlers ─────────────────────────────────────────────

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
  const logs = readArchive();
  const pruned = pruneOlderThan7Days(logs);
  // Also append any cached offline punches as attendance entries
  const offlinePunches = getCachedPunches();
  const offlineAsLogs: ArchivedAttLog[] = offlinePunches.map(p => ({
    userId: p.userId,
    timestamp: p.attTime,
    deviceIp: p.deviceIp
  }));
  const merged = mergeArchive(pruned, offlineAsLogs);
  return merged;
});

ipcMain.handle('get-device-users', async () => {
  return readUserArchive();
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

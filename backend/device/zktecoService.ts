const ZKTeco = require('zkteco-js');

export class ZKTecoService {
  private zk: any | null = null;
  public deviceStatus: 'Connected' | 'Disconnected' = 'Disconnected';
  public deviceIp: string = '';
  public lastSyncTime: Date | null = null;

  // Callback to emit punch events in real time to the main process
  public onRealTimePunch: ((punch: { userId: string; attTime: Date }) => void) | null = null;

  async connect(ip: string, port: number = 4370): Promise<{ success: boolean; info?: any; error?: string }> {
    await this.disconnect();

    try {
      console.log(`Connecting to ZKTeco device at ${ip}:${port}...`);
      this.zk = new ZKTeco(ip, port, 10000, 4000);
      await this.zk.createSocket();

      // Ensure the device is enabled
      try {
        await this.zk.enableDevice();
      } catch (e) {
        console.warn('Warning: Could not enable device explicitly:', e);
      }

      const info = await this.zk.getInfo();
      console.log('ZKTeco connected successfully. Info:', info);

      this.deviceStatus = 'Connected';
      this.deviceIp = ip;
      this.lastSyncTime = new Date();

      // Register real-time punch event listener
      try {
        await this.zk.getRealTimeLogs((log: any) => {
          if (this.onRealTimePunch && log) {
            this.onRealTimePunch({
              userId: log.userId,
              attTime: log.attTime instanceof Date ? log.attTime : new Date(log.attTime)
            });
          }
        });
        console.log('Registered real-time logs listener on ZKTeco reader.');
      } catch (logErr) {
        console.error('Failed to register real-time logs listener:', logErr);
      }

      return { success: true, info };
    } catch (error: any) {
      console.error(`ZKTeco connect failed at ${ip}:${port}`, error);
      this.deviceStatus = 'Disconnected';
      this.deviceIp = '';
      if (this.zk) {
        try { await this.zk.disconnect(); } catch (_) {}
        this.zk = null;
      }
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  async disconnect(): Promise<void> {
    if (this.zk) {
      try {
        // Disable real-time event notifications before disconnecting
        try {
          await this.zk.disableDevice();
        } catch (_) {}
        await this.zk.disconnect();
        console.log('ZKTeco device disconnected.');
      } catch (e) {
        console.warn('ZKTeco disconnect warning:', e);
      }
      this.zk = null;
    }
    this.deviceStatus = 'Disconnected';
    this.deviceIp = '';
  }

  async getAttendances(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!this.zk) {
      return { success: false, error: 'Device not connected' };
    }
    try {
      console.log('Fetching attendance records from ZKTeco...');
      const res = await this.zk.getAttendances();
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('Failed to get attendance records from device:', err);
      return { success: false, error: err.message || 'Failed to get records' };
    }
  }

  async testConnection(ip: string, port: number = 4370): Promise<{ success: boolean; info?: any; error?: string }> {
    let tempZk: any = null;
    try {
      console.log(`Testing ZKTeco connection at ${ip}:${port}...`);
      tempZk = new ZKTeco(ip, port, 10000, 4000);
      await tempZk.createSocket();

      const info = await tempZk.getInfo();
      await tempZk.disconnect();

      return { success: true, info };
    } catch (error: any) {
      console.error(`ZKTeco test failed at ${ip}:${port}`, error);
      if (tempZk) {
        try { await tempZk.disconnect(); } catch (_) { /* ignore */ }
      }
      return { success: false, error: error.message || 'Connection failed' };
    }
  }
}

export const zktecoService = new ZKTecoService();

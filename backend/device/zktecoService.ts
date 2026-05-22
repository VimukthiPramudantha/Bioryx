const ZKTeco = require('zkteco-js');

export class ZKTecoService {
  private zk: any | null = null;

  async testConnection(ip: string, port: number = 4370): Promise<any> {
    try {
      console.log(`Attempting to connect to ZKTeco device at ${ip}:${port}`);
      // Parameters: IP, Port, Timeout, Inport
      this.zk = new ZKTeco(ip, port, 10000, 4000); 
      
      await this.zk.createSocket();
      
      // Fetch device info to verify connection
      const info = await this.zk.getInfo();
      console.log("ZKTeco Device connected successfully. Info:", info);

      // Disconnect immediately since we just want to test
      await this.zk.disconnect();
      this.zk = null;

      return { success: true, info };
    } catch (error: any) {
      console.error(`Failed to connect to ZKTeco device at ${ip}:${port}`, error);
      
      if (this.zk) {
        try {
          await this.zk.disconnect();
        } catch (e) {
          // Ignore errors on disconnect
        }
        this.zk = null;
      }
      
      return { success: false, error: error.message || 'Connection failed' };
    }
  }
}

export const zktecoService = new ZKTecoService();

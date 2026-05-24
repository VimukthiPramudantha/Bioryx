interface DeviceManagerConfig {
  ip: string;
  port: number;
  mongoUri: string;
  mongoCollection: string;
}

interface ConnectionState {
  deviceConnected: boolean;
  mongoConnected: boolean;
  deviceIp: string;
  deviceResponseTime: number | null;
  mongoResponseTime: number | null;
}

type StateChangeCallback = (state: ConnectionState) => void;

const STORAGE_KEY = "bioryx_device_config_v2";

class BioryxDeviceManager {
  private container: HTMLElement;
  private onStateChange: StateChangeCallback;
  private state: ConnectionState = {
    deviceConnected: false,
    mongoConnected: false,
    deviceIp: "",
    deviceResponseTime: null,
    mongoResponseTime: null,
  };

  private refs: {
    ipInput: HTMLInputElement | null;
    portInput: HTMLInputElement | null;
    mongoUriInput: HTMLInputElement | null;
    mongoCollectionInput: HTMLInputElement | null;
    connectZkBtn: HTMLButtonElement | null;
    connectMongoBtn: HTMLButtonElement | null;
    testBtn: HTMLButtonElement | null;
    deviceStatusBadge: HTMLElement | null;
    mongoStatusBadge: HTMLElement | null;
    displayIp: HTMLElement | null;
    devicePing: HTMLElement | null;
    mongoPing: HTMLElement | null;
  } = {
    ipInput: null,
    portInput: null,
    mongoUriInput: null,
    mongoCollectionInput: null,
    connectZkBtn: null,
    connectMongoBtn: null,
    testBtn: null,
    deviceStatusBadge: null,
    mongoStatusBadge: null,
    displayIp: null,
    devicePing: null,
    mongoPing: null,
  };

  constructor(onStateChange: StateChangeCallback) {
    this.onStateChange = onStateChange;
    this.container = this.render();
    this.bindEvents();
    this.loadFromStorage();
    this.syncStateFromBackend();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(): HTMLElement {
    const root = document.createElement("div");
    root.className = "dm-root";
    root.innerHTML = `
      <div class="dm-grid">

        <!-- ── Left: Configuration Forms ── -->
        <div class="dm-col-left">
          
          <!-- ZKTeco Reader Card -->
          <div class="dm-card">
            <div class="dm-card-header">
              <div class="dm-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2"></rect>
                  <rect x="2" y="14" width="20" height="8" rx="2"></rect>
                  <line x1="6" y1="6" x2="6.01" y2="6"></line>
                  <line x1="6" y1="18" x2="6.01" y2="18"></line>
                </svg>
              </div>
              <div>
                <h3 class="dm-card-title">ZKTeco Reader Settings</h3>
                <p class="dm-card-desc">Biometric reader connection parameters</p>
              </div>
            </div>

            <div class="dm-section-label">ZKTeco Biometric Reader</div>

            <div class="dm-field-row">
              <div class="dm-field">
                <label class="dm-label" for="dm-ip">Device IP Address</label>
                <input id="dm-ip" type="text" class="dm-input" placeholder="e.g. 192.168.1.201" />
              </div>
              <div class="dm-field dm-field-sm">
                <label class="dm-label" for="dm-port">Port</label>
                <input id="dm-port" type="number" class="dm-input" placeholder="4370" />
              </div>
            </div>

            <div class="dm-actions">
              <button id="dm-test-btn" class="dm-btn dm-btn-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Test Reader
              </button>
              <button id="dm-connect-zk-btn" class="dm-btn dm-btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Connect Reader
              </button>
            </div>
          </div>

          <!-- MongoDB Card -->
          <div class="dm-card" style="margin-top: 24px;">
            <div class="dm-card-header">
              <div class="dm-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
                </svg>
              </div>
              <div>
                <h3 class="dm-card-title">MongoDB Connection</h3>
                <p class="dm-card-desc">MongoDB Atlas URI &amp; Sync Target Collection</p>
              </div>
            </div>

            <div class="dm-section-label">MongoDB Connection</div>

            <div class="dm-field">
              <label class="dm-label" for="dm-mongo">Connection URI</label>
              <input id="dm-mongo" type="password" class="dm-input" placeholder="mongodb+srv://user:pass@cluster.mongodb.net/DATABASE_NAME" />
            </div>

            <div class="dm-field">
              <label class="dm-label" for="dm-mongo-collection">Collection Name</label>
              <input id="dm-mongo-collection" type="text" class="dm-input" placeholder="attendance_logs" />
              <span class="dm-hint">Punches will sync dynamically to this collection.</span>
            </div>

            <div class="dm-actions">
              <button id="dm-connect-mongo-btn" class="dm-btn dm-btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Connect Database
              </button>
            </div>
          </div>

        </div>

        <!-- ── Right: Status Panel ── -->
        <div class="dm-status-col">

          <!-- Device Status Card -->
          <div class="dm-status-card">
            <div class="dm-status-card-header">
              <span class="dm-status-card-label">ZKTeco Reader</span>
              <span id="dm-device-badge" class="dm-badge dm-badge-offline">Disconnected</span>
            </div>
            <div class="dm-status-rows">
              <div class="dm-status-row">
                <span class="dm-status-row-label">Device IP</span>
                <span id="dm-display-ip" class="dm-status-row-value">--</span>
              </div>
              <div class="dm-status-row">
                <span class="dm-status-row-label">Connection</span>
                <span id="dm-device-status-text" class="dm-status-row-value">Disconnected</span>
              </div>
              <div class="dm-status-row">
                <span class="dm-status-row-label">Response Time</span>
                <span id="dm-device-ping" class="dm-status-row-value">-- ms</span>
              </div>
            </div>
          </div>

          <!-- MongoDB Status Card -->
          <div class="dm-status-card">
            <div class="dm-status-card-header">
              <span class="dm-status-card-label">MongoDB Atlas</span>
              <span id="dm-mongo-badge" class="dm-badge dm-badge-offline">Disconnected</span>
            </div>
            <div class="dm-status-rows">
              <div class="dm-status-row">
                <span class="dm-status-row-label">Connection</span>
                <span id="dm-mongo-status-text" class="dm-status-row-value">Disconnected</span>
              </div>
              <div class="dm-status-row">
                <span class="dm-status-row-label">Response Time</span>
                <span id="dm-mongo-ping" class="dm-status-row-value">-- ms</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
    return root;
  }

  private bindEvents(): void {
    this.refs.ipInput = this.container.querySelector("#dm-ip");
    this.refs.portInput = this.container.querySelector("#dm-port");
    this.refs.mongoUriInput = this.container.querySelector("#dm-mongo");
    this.refs.mongoCollectionInput = this.container.querySelector(
      "#dm-mongo-collection",
    );
    this.refs.connectZkBtn = this.container.querySelector("#dm-connect-zk-btn");
    this.refs.connectMongoBtn = this.container.querySelector(
      "#dm-connect-mongo-btn",
    );
    this.refs.testBtn = this.container.querySelector("#dm-test-btn");
    this.refs.deviceStatusBadge = this.container.querySelector(
      "#dm-device-badge",
    );
    this.refs.mongoStatusBadge = this.container.querySelector(
      "#dm-mongo-badge",
    );
    this.refs.displayIp = this.container.querySelector("#dm-display-ip");
    this.refs.devicePing = this.container.querySelector("#dm-device-ping");
    this.refs.mongoPing = this.container.querySelector("#dm-mongo-ping");

    [
      this.refs.ipInput,
      this.refs.portInput,
      this.refs.mongoUriInput,
      this.refs.mongoCollectionInput,
    ].forEach((el) => {
      if (el) el.addEventListener("input", () => this.saveToStorage());
    });

    this.refs.connectZkBtn?.addEventListener("click", () => {
      if (this.state.deviceConnected) {
        this.handleDisconnectZk();
      } else {
        this.handleConnectZk();
      }
    });

    this.refs.connectMongoBtn?.addEventListener("click", () => {
      if (this.state.mongoConnected) {
        this.handleDisconnectMongo();
      } else {
        this.handleConnectMongo();
      }
    });

    this.refs.testBtn?.addEventListener("click", () => this.handleTest());
  }


  private saveToStorage(): void {
    const config: DeviceManagerConfig = {
      ip: (this.refs.ipInput?.value || "").trim(),
      port: parseInt(this.refs.portInput?.value || "4370", 10),
      mongoUri: (this.refs.mongoUriInput?.value || "").trim(),
      mongoCollection:
        (this.refs.mongoCollectionInput?.value || "attendance_logs").trim(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        if (this.refs.mongoCollectionInput) {
          this.refs.mongoCollectionInput.value = "attendance_logs";
        }
        return;
      }
      const config: DeviceManagerConfig = JSON.parse(raw);
      if (this.refs.ipInput) this.refs.ipInput.value = config.ip || "";
      if (this.refs.portInput) {
        this.refs.portInput.value = String(config.port || 4370);
      }
      if (this.refs.mongoUriInput) {
        this.refs.mongoUriInput.value = config.mongoUri || "";
      }
      if (this.refs.mongoCollectionInput) {
        this.refs.mongoCollectionInput.value = config.mongoCollection ||
          "attendance_logs";
      }
    } catch (_) { /* skip */ }
  }


  private async syncStateFromBackend(): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api?.getConnectionState) return;
    try {
      const s = await api.getConnectionState();
      this.state.deviceConnected = s.deviceStatus === "Connected";
      this.state.mongoConnected = s.isDbConnected;
      this.state.deviceIp = s.deviceIp || "";
      this.updateStatusUI();
      this.updateConnectButtons();
    } catch (_) { /* ignore */ }
  }


  private async handleConnectZk(): Promise<void> {
    const ip = (this.refs.ipInput?.value || "").trim();
    const port = parseInt(this.refs.portInput?.value || "4370", 10);
    const toast = (window as any).gooeyToast;
    const api = (window as any).electronAPI;

    if (!ip) {
      toast?.error("Missing IP", {
        description: "Please enter a device IP address.",
      });
      return;
    }
    if (!api?.connectZkTeco) {
      toast?.error("Bridge Error", {
        description: "Electron connectZkTeco API not available.",
      });
      return;
    }

    if (this.refs.connectZkBtn) {
      this.refs.connectZkBtn.disabled = true;
      this.refs.connectZkBtn.textContent = "Connecting...";
    }
    toast?.info("Connecting Reader", {
      description: `Linking to ZKTeco device at ${ip}:${port}...`,
    });

    try {
      const start = Date.now();
      const result = await api.connectZkTeco(ip, isNaN(port) ? 4370 : port);

      this.state.deviceConnected = result.success;
      this.state.deviceIp = result.success ? ip : "";
      this.state.deviceResponseTime = result.success
        ? (Date.now() - start)
        : null;

      this.updateStatusUI();
      this.updateConnectButtons();
      this.onStateChange({ ...this.state });

      if (result.success) {
        toast?.success("Reader Connected", {
          description: `ZKTeco (${ip}) is online and streaming logs.`,
        });
      } else {
        toast?.error("Reader Connection Failed", {
          description: result.error ||
            "Could not connect to the ZKTeco reader.",
        });
      }
    } catch (err: any) {
      toast?.error("Connection Error", {
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      if (this.refs.connectZkBtn) {
        this.refs.connectZkBtn.disabled = false;
        this.updateConnectButtons();
      }
    }
  }


  private async handleDisconnectZk(): Promise<void> {
    const toast = (window as any).gooeyToast;
    const api = (window as any).electronAPI;
    if (!api?.disconnectZkTeco) return;

    if (this.refs.connectZkBtn) {
      this.refs.connectZkBtn.disabled = true;
      this.refs.connectZkBtn.textContent = "Disconnecting...";
    }

    try {
      await api.disconnectZkTeco();
      this.state.deviceConnected = false;
      this.state.deviceIp = "";
      this.state.deviceResponseTime = null;

      this.updateStatusUI();
      this.updateConnectButtons();
      this.onStateChange({ ...this.state });
      toast?.info("Reader Disconnected", {
        description: "ZKTeco reader connection has been closed.",
      });
    } catch (err: any) {
      toast?.error("Disconnect Error", {
        description: err.message || "Could not cleanly disconnect ZKTeco.",
      });
    } finally {
      if (this.refs.connectZkBtn) {
        this.refs.connectZkBtn.disabled = false;
        this.updateConnectButtons();
      }
    }
  }


  private async handleConnectMongo(): Promise<void> {
    const mongoUri = (this.refs.mongoUriInput?.value || "").trim();
    const mongoCollection =
      (this.refs.mongoCollectionInput?.value || "attendance_logs").trim();
    const toast = (window as any).gooeyToast;
    const api = (window as any).electronAPI;

    if (!mongoUri) {
      toast?.error("Missing URI", {
        description: "Please enter a MongoDB connection URI.",
      });
      return;
    }
    if (!api?.connectMongo) {
      toast?.error("Bridge Error", {
        description: "Electron connectMongo API not available.",
      });
      return;
    }

    if (this.refs.connectMongoBtn) {
      this.refs.connectMongoBtn.disabled = true;
      this.refs.connectMongoBtn.textContent = "Connecting...";
    }
    toast?.info("Connecting Database", {
      description: "Linking to MongoDB Atlas cluster...",
    });

    try {
      const result = await api.connectMongo(mongoUri, mongoCollection);

      this.state.mongoConnected = result.success;
      this.state.mongoResponseTime = result.success
        ? (result.responseTime ?? 10)
        : null;

      this.updateStatusUI();
      this.updateConnectButtons();
      this.onStateChange({ ...this.state });

      if (result.success) {
        toast?.success("Database Connected", {
          description:
            `Successfully authenticated. Active collection: "${mongoCollection}".`,
        });
      } else {
        toast?.error("Database Connection Failed", {
          description: result.error || "Could not connect to MongoDB Atlas.",
        });
      }
    } catch (err: any) {
      toast?.error("Connection Error", {
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      if (this.refs.connectMongoBtn) {
        this.refs.connectMongoBtn.disabled = false;
        this.updateConnectButtons();
      }
    }
  }


  private async handleDisconnectMongo(): Promise<void> {
    const toast = (window as any).gooeyToast;
    const api = (window as any).electronAPI;
    if (!api?.disconnectMongo) return;

    if (this.refs.connectMongoBtn) {
      this.refs.connectMongoBtn.disabled = true;
      this.refs.connectMongoBtn.textContent = "Disconnecting...";
    }

    try {
      await api.disconnectMongo();
      this.state.mongoConnected = false;
      this.state.mongoResponseTime = null;

      this.updateStatusUI();
      this.updateConnectButtons();
      this.onStateChange({ ...this.state });
      toast?.info("Database Disconnected", {
        description: "MongoDB connection has been closed.",
      });
    } catch (err: any) {
      toast?.error("Disconnect Error", {
        description: err.message || "Could not cleanly disconnect MongoDB.",
      });
    } finally {
      if (this.refs.connectMongoBtn) {
        this.refs.connectMongoBtn.disabled = false;
        this.updateConnectButtons();
      }
    }
  }


  private async handleTest(): Promise<void> {
    const ip = (this.refs.ipInput?.value || "").trim();
    const port = parseInt(this.refs.portInput?.value || "4370", 10);
    const toast = (window as any).gooeyToast;
    const api = (window as any).electronAPI;

    if (!ip) {
      toast?.error("Missing IP", {
        description: "Please enter a device IP address to test.",
      });
      return;
    }
    if (!api?.testZkTecoConnection) return;

    const testBtn = this.refs.testBtn;
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = "Testing...";
    }
    toast?.info("Testing Connection", {
      description: `Sending probe to ZKTeco reader at ${ip}:${port}...`,
    });

    try {
      const result = await api.testZkTecoConnection(
        ip,
        isNaN(port) ? 4370 : port,
      );
      if (result.success) {
        this.state.deviceResponseTime = result.responseTime ?? null;
        if (this.refs.devicePing) {
          this.refs.devicePing.textContent = result.responseTime != null
            ? `${result.responseTime} ms`
            : "-- ms";
        }
        toast?.success("Reader Reachable", {
          description: `ZKTeco reader responded successfully in ${
            result.responseTime ?? "--"
          } ms.`,
        });
      } else {
        toast?.error("Reader Unreachable", {
          description: result.error || "No response from device.",
        });
      }
    } catch (err: any) {
      toast?.error("Test Failed", {
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Test Reader`;
      }
    }
  }


  private updateStatusUI(): void {
    const {
      deviceConnected,
      mongoConnected,
      deviceIp,
      deviceResponseTime,
      mongoResponseTime,
    } = this.state;
    const devBadge = this.refs.deviceStatusBadge;
    const mongoBadge = this.refs.mongoStatusBadge;

    if (devBadge) {
      devBadge.textContent = deviceConnected ? "Connected" : "Disconnected";
      devBadge.className = `dm-badge ${
        deviceConnected ? "dm-badge-online" : "dm-badge-offline"
      }`;
    }
    if (mongoBadge) {
      mongoBadge.textContent = mongoConnected ? "Connected" : "Disconnected";
      mongoBadge.className = `dm-badge ${
        mongoConnected ? "dm-badge-online" : "dm-badge-offline"
      }`;
    }

    const devStatusText = this.container.querySelector(
      "#dm-device-status-text",
    );
    const mongoStatusText = this.container.querySelector(
      "#dm-mongo-status-text",
    );
    if (devStatusText) {
      devStatusText.textContent = deviceConnected
        ? "Active"
        : "Disconnected";
    }
    if (mongoStatusText) {
      mongoStatusText.textContent = mongoConnected
        ? "Active"
        : "Disconnected";
    }

    if (this.refs.displayIp) this.refs.displayIp.textContent = deviceIp || "--";
    if (this.refs.devicePing) {
      this.refs.devicePing.textContent = deviceResponseTime != null
        ? `${deviceResponseTime} ms`
        : "-- ms";
    }
    if (this.refs.mongoPing) {
      this.refs.mongoPing.textContent = mongoResponseTime != null
        ? `${mongoResponseTime} ms`
        : "-- ms";
    }
  }

  private updateConnectButtons(): void {
    const zkBtn = this.refs.connectZkBtn;
    if (zkBtn) {
      const isConnected = this.state.deviceConnected;
      zkBtn.className = `dm-btn ${
        isConnected ? "dm-btn-danger" : "dm-btn-primary"
      }`;
      zkBtn.innerHTML = isConnected
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> Disconnect`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> Connect Reader`;
    }

    const mongoBtn = this.refs.connectMongoBtn;
    if (mongoBtn) {
      const isConnected = this.state.mongoConnected;
      mongoBtn.className = `dm-btn ${
        isConnected ? "dm-btn-danger" : "dm-btn-primary"
      }`;
      mongoBtn.innerHTML = isConnected
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> Disconnect`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> Connect Database`;
    }
  }
}

(window as any).BioryxDeviceManager = BioryxDeviceManager;

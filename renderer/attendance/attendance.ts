interface ArchivedPunch {
  userId: string;
  timestamp: string;
  deviceIp: string;
  mongoSynced?: boolean;
}

interface DeviceUser {
  userId: string;
  name: string;
  role?: number;
  cardno?: number;
}

class BioryxAttendance {
  private container: HTMLElement;
  private allLogs: ArchivedPunch[] = [];
  private livePunches: ArchivedPunch[] = [];
  private deviceUsers: DeviceUser[] = [];
  
  private refs: {
    dateFilter: HTMLInputElement | null;
    empFilter: HTMLInputElement | null;
    tableBody: HTMLElement | null;
    refreshBtn: HTMLButtonElement | null;
    syncBtn: HTMLButtonElement | null;
  } = {
    dateFilter: null,
    empFilter: null,
    tableBody: null,
    refreshBtn: null,
    syncBtn: null,
  };

  constructor() {
    this.container = this.render();
    this.bindEvents();
    this.loadLogs();
    this.setupLivePunchListener();
    this.setupNetworkStateListener();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'dm-root';

    const today = new Date().toISOString().split('T')[0];

    root.innerHTML = `
      <div class="dm-card" style="margin-bottom: 24px;">
        <div class="dm-card-header">
          <div class="dm-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div>
            <h3 class="dm-card-title">Attendance Filters</h3>
            <p class="dm-card-desc">Filter attendance records by date and employee</p>
          </div>
        </div>

        <div class="dm-field-row" style="margin-top: 16px;">
          <div class="dm-field">
            <label class="dm-label" for="att-date">Select Date</label>
            <input id="att-date" type="date" class="dm-input" value="${today}" />
          </div>
          <div class="dm-field">
            <label class="dm-label" for="att-emp">Employee ID or Name</label>
            <input id="att-emp" type="text" class="dm-input" placeholder="Search Employee..." />
          </div>
        </div>

        <div class="dm-actions" style="margin-top: 16px; justify-content: flex-end; gap: 8px;">
          <button id="att-refresh-btn" class="dm-btn dm-btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh Records
          </button>
          <button id="att-sync-btn" class="dm-btn dm-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
            Sync Now
          </button>
        </div>
      </div>

      <!-- Attendance Table Container -->
      <div class="table-container">
        <div class="table-header-row">
          <div class="table-title-group">
            <h3 id="att-table-title">Daily Attendance Logs</h3>
            <p id="att-table-subtitle">Attendance records for date: ${today}</p>
          </div>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>In</th>
              <th>Out</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="att-table-body">
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
                Loading attendance records...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return root;
  }

  private bindEvents(): void {
    this.refs.dateFilter = this.container.querySelector('#att-date');
    this.refs.empFilter  = this.container.querySelector('#att-emp');
    this.refs.tableBody  = this.container.querySelector('#att-table-body');
    this.refs.refreshBtn = this.container.querySelector('#att-refresh-btn');
    this.refs.syncBtn    = this.container.querySelector('#att-sync-btn');

    this.refs.dateFilter?.addEventListener('change', () => this.processAndRenderLogs());
    this.refs.empFilter?.addEventListener('input', () => this.processAndRenderLogs());

    this.refs.refreshBtn?.addEventListener('click', async () => {
      const toast = (window as any).gooeyToast;
      toast?.info('Refreshing', { description: 'Fetching historical device logs...' });
      await this.loadLogs();
    });

    this.refs.syncBtn?.addEventListener('click', async () => {
      await this.triggerDeviceDbSync(true);
    });
  }

  
  private async loadLogs(): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api?.getAttendanceLogsArchive) return;
    try {
      this.allLogs = await api.getAttendanceLogsArchive();
      if (api.getDeviceUsers) {
        this.deviceUsers = await api.getDeviceUsers();
      }
      this.processAndRenderLogs();
    } catch (err: any) {
      console.error('Failed to load attendance logs archive:', err);
      const toast = (window as any).gooeyToast;
      toast?.error('Load Failed', { description: 'Could not retrieve attendance logs archive.' });
    }
  }


  private setupLivePunchListener(): void {
    const api = (window as any).electronAPI;
    if (!api?.onRealTimePunch) return;

    api.onRealTimePunch((_event: any, punch: any) => {
      const livePunch: ArchivedPunch = {
        userId: punch.userId,
        timestamp: punch.attTime,
        deviceIp: punch.deviceIp,
        mongoSynced: punch.mongoSynced
      };
      
      this.livePunches.push(livePunch);

      this.processAndRenderLogs();
    });
  }

  private processAndRenderLogs(): void {
    if (!this.refs.tableBody) return;

    const dateVal = this.refs.dateFilter?.value;
    const empVal  = (this.refs.empFilter?.value || '').trim().toLowerCase();

    const subtitle = this.container.querySelector('#att-table-subtitle');
    if (subtitle && dateVal) {
      subtitle.textContent = `Attendance records for date: ${dateVal}`;
    }

    if (!dateVal) {
      this.refs.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
            Please select a date to view attendance logs.
          </td>
        </tr>
      `;
      return;
    }

    const punchMap = new Map<string, ArchivedPunch>();
    
    this.allLogs.forEach(p => {
      punchMap.set(`${p.userId}_${p.timestamp}`, p);
    });
    this.livePunches.forEach(p => {
      punchMap.set(`${p.userId}_${p.timestamp}`, p);
    });

    const combinedPunches = Array.from(punchMap.values());

    const dailyPunches = combinedPunches.filter(p => {
      const punchDate = p.timestamp.split('T')[0];
      return punchDate === dateVal;
    });

    const employeeGroups = new Map<string, Date[]>();
    dailyPunches.forEach(p => {
      const timestamp = new Date(p.timestamp);
      if (!employeeGroups.has(p.userId)) {
        employeeGroups.set(p.userId, []);
      }
      employeeGroups.get(p.userId)!.push(timestamp);
    });

    const rowsData: Array<{
      userId: string;
      userName: string;
      inTime: string;
      outTime: string;
      hours: string;
      statusBadge: string;
      hoursNum: number;
    }> = [];

    employeeGroups.forEach((punches, userId) => {
      punches.sort((a, b) => a.getTime() - b.getTime());

      const userObj = this.deviceUsers.find(u => u.userId === userId);
      const empName = userObj ? userObj.name : `User #${userId}`;
      const searchMatch = !empVal || 
                          userId.toLowerCase().includes(empVal) || 
                          empName.toLowerCase().includes(empVal);

      if (!searchMatch) return;

      const firstPunch = punches[0];
      const lastPunch  = punches.length > 1 ? punches[punches.length - 1] : null;

      const formatTime = (d: Date) => {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      };

      const inTimeStr  = formatTime(firstPunch);
      const outTimeStr = lastPunch ? formatTime(lastPunch) : '--';
      
      let hoursStr = '--';
      let statusBadge = '<span class="badge badge-danger">Missing Out</span>';
      let workingHoursNum = 0;

      if (lastPunch) {
        const diffMs = lastPunch.getTime() - firstPunch.getTime();
        workingHoursNum = diffMs / (1000 * 60 * 60); 
        
        const totalMinutes = Math.round(diffMs / (1000 * 60));
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        hoursStr = `${hrs}h ${mins}m`;

        if (workingHoursNum >= 8) {
          statusBadge = '<span class="badge badge-success">On Time</span>';
        } else {
          statusBadge = '<span class="badge badge-warning">Short Hours</span>';
        }
      }

      rowsData.push({
        userId,
        userName: empName,
        inTime: inTimeStr,
        outTime: outTimeStr,
        hours: hoursStr,
        statusBadge,
        hoursNum: workingHoursNum
      });
    });

    this.refs.tableBody.innerHTML = '';

    if (rowsData.length === 0) {
      this.refs.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
            No attendance records found for the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    rowsData.sort((a, b) => parseInt(a.userId, 10) - parseInt(b.userId, 10));

    rowsData.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: var(--text-primary);">${row.userName}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">ID: ${row.userId}</span>
          </div>
        </td>
        <td><span style="color: var(--primary); font-weight:500;">${row.inTime}</span></td>
        <td><span style="color: ${row.outTime === '--' ? 'var(--text-secondary)' : 'var(--success)'}; font-weight:500;">${row.outTime}</span></td>
        <td><strong>${row.hours}</strong></td>
        <td>${row.statusBadge}</td>
      `;
      this.refs.tableBody!.appendChild(tr);
    });
  }

  private async triggerDeviceDbSync(isManual: boolean): Promise<void> {
    const api = (window as any).electronAPI;
    const toast = (window as any).gooeyToast;
    
    if (!api?.syncDeviceDatabase) {
      if (isManual) {
        toast?.error('Sync Failed', { description: 'Sync API is not available.' });
      }
      return;
    }

    try {
      if (isManual) {
        toast?.info('Synchronizing', { description: 'Syncing device and database...' });
      } else {
        toast?.info('Auto Syncing', { description: 'Internet connection is back. Syncing offline logs...' });
      }

      const res = await api.syncDeviceDatabase();
      if (res.success) {
        if (isManual) {
          toast?.success('Sync Complete', {
            description: `Successfully synchronized. Device: ${res.deviceStatus}, DB: ${res.isDbConnected ? 'Connected' : 'Disconnected'}`
          });
        } else {
          toast?.success('Auto Sync Complete', { description: 'Offline logs successfully flushed to database.' });
        }
        await this.loadLogs();
      } else {
        if (isManual) {
          toast?.error('Sync Failed', { description: res.error || 'Unknown sync error.' });
        }
      }
    } catch (err: any) {
      console.error('Device DB Sync error:', err);
      if (isManual) {
        toast?.error('Sync Error', { description: err.message || 'Failed to complete synchronization.' });
      }
    }
  }

  private setupNetworkStateListener(): void {
    window.addEventListener('online', async () => {
      console.log('App went online. Flashing offline punches to MongoDB...');
      await this.triggerDeviceDbSync(false);
    });
  }
}

(window as any).BioryxAttendance = BioryxAttendance;

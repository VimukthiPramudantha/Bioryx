/* Dashboard Process Script — mounts sidebar, header, and delegates tab views */

const livePunches: Array<{ userId: string; timestamp: Date; deviceIp: string; mongoSynced: boolean }> = [];
const liveActivity: Array<{ deviceName: string; ipAddress: string; action: string; status: string; timestamp: Date }> = [];

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: { [key: string]: string } = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') el.className = value;
    else if (key === 'innerHTML') el.innerHTML = value;
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  }
  return el;
}

function createMetricCard(title: string, value: string, color: string, iconHtml: string): HTMLElement {
  return createElement('div', { className: 'metric-card' },
    createElement('div', { className: `metric-icon ${color}-icon`, innerHTML: iconHtml }),
    createElement('div', { className: 'metric-info' },
      createElement('h3', {}, title),
      createElement('p', { className: 'metric-value' }, value)
    )
  );
}

function createTableRow(...cells: string[]): HTMLElement {
  const row = document.createElement('tr');
  cells.forEach(cell => {
    const td = document.createElement('td');
    td.innerHTML = cell;
    row.appendChild(td);
  });
  return row;
}

document.addEventListener('DOMContentLoaded', async () => {
  // ── Clean slate ──────────────────────────────────────────────────────────
  const toaster = document.querySelector('GooeyToaster');
  document.body.innerHTML = '';
  if (toaster) document.body.appendChild(toaster);

  // ── Title bar ────────────────────────────────────────────────────────────
  const titleBar = createElement('div', { className: 'title-bar' },
    createElement('div', { className: 'title-bar-title' }, 'Bioryx — Attendance Synchronizer'),
    createElement('div', { className: 'window-controls' },
      createElement('button', { className: 'control-btn minimize', id: 'btn-minimize', title: 'Minimize',
        innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' }),
      createElement('button', { className: 'control-btn maximize', id: 'btn-maximize', title: 'Maximize',
        innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>' }),
      createElement('button', { className: 'control-btn close', id: 'btn-close', title: 'Close',
        innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' })
    )
  );

  // ── Header status elements ────────────────────────────────────────────────
  const statusDot   = createElement('span', { className: 'status-dot', id: 'device-status-dot' });
  const statusText  = createElement('span', { id: 'device-status-text' }, 'Device: --');
  const syncTimeText = createElement('span', { id: 'last-sync-time' }, 'Last Sync: --');
  const btnManualSync = createElement('button', { className: 'glass-btn btn-small', id: 'btn-manual-sync' }, 'Manual Sync');

  const statusBar = createElement('div', { className: 'status-bar' },
    createElement('div', { className: 'status-indicator' }, statusDot, statusText),
    createElement('div', { className: 'sync-info' }, syncTimeText),
    btnManualSync
  );

  // ── Layout scaffold ───────────────────────────────────────────────────────
  const appLayout    = createElement('div', { className: 'app-layout' });
  const mainContent  = createElement('div', { className: 'main-content' });
  const contentHeader = createElement('header', { className: 'content-header' });
  const contentTitle  = createElement('h2', { className: 'content-header-title' }, 'Dashboard');
  const contentBody   = createElement('div', { className: 'content-body' });

  contentHeader.appendChild(contentTitle);
  contentHeader.appendChild(statusBar);
  mainContent.appendChild(contentHeader);
  mainContent.appendChild(contentBody);

  // ── Instantiate Sidebar ───────────────────────────────────────────────────
  if ((window as any).BioryxSidebar) {
    const sidebar = new (window as any).BioryxSidebar((tabId: string, tabLabel: string) => {
      switchTab(tabId, tabLabel);
    });
    appLayout.appendChild(sidebar.getElement());
  }

  appLayout.appendChild(mainContent);
  document.body.appendChild(titleBar);
  document.body.appendChild(appLayout);

  // ── Instantiate Device Manager (hidden, manages its own state) ────────────
  let deviceManagerEl: HTMLElement | null = null;
  if ((window as any).BioryxDeviceManager) {
    const dm = new (window as any).BioryxDeviceManager((state: any) => {
      // Propagate connection state to the header status indicator
      if (state.deviceConnected) {
        statusDot.className   = 'status-dot connected';
        statusText.textContent = `Device: ${state.deviceIp || 'Connected'}`;
      } else {
        statusDot.className   = 'status-dot disconnected';
        statusText.textContent = 'Device: Disconnected';
      }
    });
    deviceManagerEl = dm.getElement();
  }

  // ── Window controls ───────────────────────────────────────────────────────
  titleBar.querySelector('#btn-minimize')?.addEventListener('click', () =>
    (window as any).electronAPI?.minimize());
  titleBar.querySelector('#btn-maximize')?.addEventListener('click', () =>
    (window as any).electronAPI?.maximize());
  titleBar.querySelector('#btn-close')?.addEventListener('click', () =>
    (window as any).electronAPI?.close());

  // ── Persistent header status sync ────────────────────────────────────────
  const refreshStatus = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getConnectionState) return;
    try {
      const s = await api.getConnectionState();
      if (s.deviceStatus === 'Connected') {
        statusDot.className    = 'status-dot connected';
        statusText.textContent  = `Device: ${s.deviceIp || 'Connected'}`;
      } else {
        statusDot.className    = 'status-dot disconnected';
        statusText.textContent  = 'Device: Disconnected';
      }
      if (s.lastSyncTime) {
        const d = new Date(s.lastSyncTime);
        syncTimeText.textContent = `Last Sync: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        syncTimeText.textContent = 'Last Sync: Never';
      }
    } catch (_) { /* silently ignore */ }
  };

  await refreshStatus();

  btnManualSync.addEventListener('click', async () => {
    const toast = (window as any).gooeyToast;
    toast?.info('Refreshing Status', { description: 'Checking device and database connection...' });
    btnManualSync.setAttribute('disabled', 'true');
    btnManualSync.textContent = 'Refreshing...';
    await refreshStatus();
    btnManualSync.removeAttribute('disabled');
    btnManualSync.textContent = 'Manual Sync';
  });

  // ── Tab view router ───────────────────────────────────────────────────────
  function switchTab(tabId: string, tabLabel: string) {
    contentTitle.textContent = tabLabel;
    contentBody.innerHTML    = '';

    switch (tabId) {
      case 'dashboard':  renderDashboard();  break;
      case 'employees':  renderEmployees();  break;
      case 'attendance': renderAttendance(); break;
      case 'sync':       renderSync();       break;
      case 'device':     renderDeviceManager(); break;
      case 'settings':   renderSettings();   break;
    }
  }

  // ── 1. Dashboard ──────────────────────────────────────────────────────────
  function renderDashboard() {
    // Dynamic calculation of total attendance based on real-time punches
    const baseAttendance = 145;
    const totalTodayAttendance = baseAttendance + livePunches.length;

    const grid = createElement('div', { className: 'metrics-grid' },
      createMetricCard('Total Employees',    '150', 'blue',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'),
      createMetricCard("Today's Attendance", String(totalTodayAttendance), 'green',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'),
      createMetricCard('Late Arrivals',      '12',  'yellow',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'),
      createMetricCard('Missed Punches',     '3',   'red',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>')
    );

    const tableWrap = createElement('div', { className: 'table-container', style: 'margin-top:28px;' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Recent Device Activity'),
          createElement('p', {}, 'Latest synchronization and ping logs from biometric readers')
        )
      ),
      (() => {
        const t = createElement('table', { className: 'data-table' });
        t.appendChild(createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Device Name'),
            createElement('th', {}, 'IP Address'),
            createElement('th', {}, 'Action'),
            createElement('th', {}, 'Status'),
            createElement('th', {}, 'Timestamp')
          )
        ));
        const tb = document.createElement('tbody');
        tb.id = 'dashboard-activity-tbody';

        // Prepend real-time live activities
        liveActivity.forEach(act => {
          tb.appendChild(createTableRow(
            act.deviceName,
            act.ipAddress,
            act.action,
            act.status,
            act.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          ));
        });

        // Add static placeholders
        tb.appendChild(createTableRow('ZKTeco Main Reader',      '192.168.1.201', 'Log Fetch', '<span class="badge badge-success">Success</span>', 'Just Now'));
        tb.appendChild(createTableRow('ZKTeco Secondary Reader', '192.168.1.202', 'Log Fetch', '<span class="badge badge-success">Success</span>', '10 mins ago'));
        tb.appendChild(createTableRow('Canteen Terminal',        '192.168.1.203', 'Ping',      '<span class="badge badge-danger">Offline</span>',  '1 hour ago'));
        t.appendChild(tb);
        return t;
      })()
    );

    contentBody.appendChild(grid);
    contentBody.appendChild(tableWrap);
  }

  // ── 2. Employees ──────────────────────────────────────────────────────────
  function renderEmployees() {
    const wrap = createElement('div', { className: 'table-container' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Active Employees'),
          createElement('p', {}, 'Manage employee profiles, access groups, and fingerprint templates')
        ),
        createElement('button', { className: 'btn-primary' }, '+ Add Employee')
      ),
      (() => {
        const t = createElement('table', { className: 'data-table' });
        t.appendChild(createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Employee ID'), createElement('th', {}, 'Name'),
            createElement('th', {}, 'Department'),  createElement('th', {}, 'Card Number'),
            createElement('th', {}, 'Enrolled')
          )
        ));
        const tb = document.createElement('tbody');
        tb.appendChild(createTableRow('EMP001', 'John Doe',       'Engineering',     '1092834', '2024-01-15'));
        tb.appendChild(createTableRow('EMP002', 'Jane Smith',     'Human Resources', '1092835', '2024-02-10'));
        tb.appendChild(createTableRow('EMP003', 'Alice Johnson',  'Finance',         '1092836', '2024-03-01'));
        tb.appendChild(createTableRow('EMP004', 'Bob Brown',      'Operations',      '1092837', '2024-03-12'));
        t.appendChild(tb);
        return t;
      })()
    );
    contentBody.appendChild(wrap);
  }

  // ── 3. Attendance ─────────────────────────────────────────────────────────
  function renderAttendance() {
    const wrap = createElement('div', { className: 'table-container' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Daily Attendance Logs'),
          createElement('p', {}, 'Real-time record of check-in and check-out logs')
        )
      ),
      (() => {
        const t = createElement('table', { className: 'data-table' });
        t.appendChild(createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Employee'),     createElement('th', {}, 'Date'),
            createElement('th', {}, 'Clock In'),     createElement('th', {}, 'Clock Out'),
            createElement('th', {}, 'Status')
          )
        ));
        const tb = document.createElement('tbody');
        tb.id = 'attendance-logs-tbody';

        // Prepend real-time live punches
        livePunches.forEach(p => {
          tb.appendChild(createTableRow(
            `User #${p.userId}`,
            p.timestamp.toLocaleDateString(),
            p.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            p.mongoSynced ? '<span class="badge badge-success">Synced</span>' : '<span class="badge badge-warning">Local Cache</span>',
            '<span class="badge badge-success">On Time</span>'
          ));
        });

        // Add static placeholders
        tb.appendChild(createTableRow('John Doe (EMP001)',    'May 23, 2026', '08:55 AM', '05:05 PM', '<span class="badge badge-success">On Time</span>'));
        tb.appendChild(createTableRow('Jane Smith (EMP002)',  'May 23, 2026', '09:12 AM', '05:00 PM', '<span class="badge badge-warning">Late</span>'));
        tb.appendChild(createTableRow('Alice Johnson (EMP003)','May 23, 2026','08:50 AM', '05:15 PM', '<span class="badge badge-success">On Time</span>'));
        tb.appendChild(createTableRow('Bob Brown (EMP004)',   'May 23, 2026', '--',        '--',       '<span class="badge badge-danger">Absent</span>'));
        t.appendChild(tb);
        return t;
      })()
    );
    contentBody.appendChild(wrap);
  }

  // ── 4. Sync Manager ───────────────────────────────────────────────────────
  function renderSync() {
    const grid = createElement('div', { className: 'config-grid' },
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Synchronization Status'),
        createElement('p', { className: 'card-desc' }, 'Configure background synchronization intervals'),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Sync Frequency'),
          (() => {
            const s = createElement('select', { className: 'form-input' });
            ['Every 5 Minutes','Every 15 Minutes','Every 1 Hour'].forEach(o => s.appendChild(createElement('option', {}, o)));
            return s;
          })()
        ),
        createElement('button', { className: 'btn-primary', style: 'margin-top:16px;' }, 'Force Sync Now')
      ),
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Sync Service Logs'),
        createElement('p', { className: 'card-desc' }, 'History of background synchronization events'),
        (() => {
          const t = createElement('table', { className: 'data-table' });
          t.appendChild(createElement('thead', {},
            createElement('tr', {},
              createElement('th', {}, 'Event'), createElement('th', {}, 'Records'), createElement('th', {}, 'Status')
            )
          ));
          const tb = document.createElement('tbody');
          tb.appendChild(createTableRow('Fetched Attendance', '45 logs',    '<span class="badge badge-success">Success</span>'));
          tb.appendChild(createTableRow('Updated Employees',  '3 profiles', '<span class="badge badge-success">Success</span>'));
          tb.appendChild(createTableRow('Connection Ping',    'Online',     '<span class="badge badge-success">Success</span>'));
          t.appendChild(tb);
          return t;
        })()
      )
    );
    contentBody.appendChild(grid);
  }

  // ── 5. Device Manager — delegates to BioryxDeviceManager component ────────
  function renderDeviceManager() {
    if (deviceManagerEl) {
      contentBody.appendChild(deviceManagerEl);
    } else {
      contentBody.appendChild(
        createElement('div', { className: 'config-card' },
          createElement('p', {}, 'Device Manager component failed to load.')
        )
      );
    }
  }

  // ── 6. Settings ───────────────────────────────────────────────────────────
  function renderSettings() {
    const grid = createElement('div', { className: 'config-grid' },
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'System Options'),
        createElement('p', { className: 'card-desc' }, 'Update operational parameters and backup protocols'),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Local Cache Directory'),
          createElement('input', { type: 'text', className: 'form-input', value: 'C:\\Bioryx\\cache' })
        ),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Auto-Backup Frequency'),
          (() => {
            const s = createElement('select', { className: 'form-input' });
            ['Daily','Weekly','Never'].forEach(o => s.appendChild(createElement('option', {}, o)));
            return s;
          })()
        ),
        createElement('div', { className: 'form-actions' },
          createElement('button', { className: 'btn-primary' }, 'Save Changes')
        )
      )
    );
    contentBody.appendChild(grid);
  }

  // ── 7. Setup Live Listeners ───────────────────────────────────────────────
  const api = (window as any).electronAPI;
  const toast = (window as any).gooeyToast;

  if (api?.onRealTimePunch) {
    api.onRealTimePunch((_event: any, data: { userId: string; attTime: string; deviceIp: string; mongoSynced: boolean }) => {
      console.log('Frontend received real-time punch notification:', data);
      
      const punchTime = new Date(data.attTime);
      const newPunch = {
        userId: data.userId,
        timestamp: punchTime,
        deviceIp: data.deviceIp,
        mongoSynced: data.mongoSynced
      };

      // Add to global state arrays (at the top, so they are drawn first when tab switches)
      livePunches.unshift(newPunch);
      
      const newAct = {
        deviceName: 'ZKTeco Reader',
        ipAddress: data.deviceIp,
        action: 'Attendance Punch',
        status: data.mongoSynced
          ? '<span class="badge badge-success">Synced</span>'
          : '<span class="badge badge-warning">Local Cache</span>',
        timestamp: punchTime
      };
      liveActivity.unshift(newAct);

      // Display beautiful toast
      toast?.success('Real-time Punch', {
        description: `User #${data.userId} punched in at ${punchTime.toLocaleTimeString()}! Status: ${data.mongoSynced ? 'Synced to Atlas' : 'Offline Cached'}`
      });

      // Dynamically update UI if currently viewing the dashboard tab
      const activityTbody = document.getElementById('dashboard-activity-tbody');
      if (activityTbody) {
        const newRow = createTableRow(
          newAct.deviceName,
          newAct.ipAddress,
          newAct.action,
          newAct.status,
          newAct.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        activityTbody.insertBefore(newRow, activityTbody.firstChild);

        // Update Today's Attendance Metric value card!
        const valueElements = document.querySelectorAll('.metric-value');
        if (valueElements && valueElements[1]) {
          const current = parseInt(valueElements[1].textContent || '145', 10);
          valueElements[1].textContent = String(current + 1);
        }
      }

      // Dynamically update UI if currently viewing the attendance tab
      const attendanceTbody = document.getElementById('attendance-logs-tbody');
      if (attendanceTbody) {
        const newRow = createTableRow(
          `User #${data.userId}`,
          punchTime.toLocaleDateString(),
          punchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          data.mongoSynced ? '<span class="badge badge-success">Synced</span>' : '<span class="badge badge-warning">Local Cache</span>',
          '<span class="badge badge-success">On Time</span>'
        );
        attendanceTbody.insertBefore(newRow, attendanceTbody.firstChild);
      }
    });
  }

  // Handle DB offline-buffered sync status callbacks
  if (api?.onDbStatus) {
    api.onDbStatus((_event: any, data: { synced: boolean; count: number; message: string }) => {
      console.log('Frontend received database status event:', data);
      if (data.synced) {
        toast?.success('Database Sync Complete', {
          description: data.message || `Successfully synchronized ${data.count} offline punch records to MongoDB Atlas.`
        });

        // Update sync status on the header sync indicator
        refreshStatus();

        // Update all badge statuses in the active live arrays to 'Synced'
        livePunches.forEach(p => p.mongoSynced = true);
        liveActivity.forEach(a => {
          if (a.action === 'Attendance Punch') {
            a.status = '<span class="badge badge-success">Synced</span>';
          }
        });

        // If the current tab has tables, refresh them to show green 'Synced' badges
        const currentTab = document.querySelector('.sidebar-menu-item.active')?.getAttribute('data-tab');
        if (currentTab === 'dashboard') {
          renderDashboard();
        } else if (currentTab === 'attendance') {
          renderAttendance();
        }
      }
    });
  }

  // Boot — render initial dashboard view
  renderDashboard();
});

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
  const toaster = document.querySelector('GooeyToaster');
  document.body.innerHTML = '';
  if (toaster) document.body.appendChild(toaster);

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

  const statusDot   = createElement('span', { className: 'status-dot', id: 'device-status-dot' });
  const statusText  = createElement('span', { id: 'device-status-text' }, 'Device: --');
  const syncTimeText = createElement('span', { id: 'last-sync-time' }, 'Last Sync: --');
  const btnManualSync = createElement('button', { className: 'glass-btn btn-small', id: 'btn-manual-sync' }, 'Manual Sync');

  const statusBar = createElement('div', { className: 'status-bar' },
    createElement('div', { className: 'status-indicator' }, statusDot, statusText),
    createElement('div', { className: 'sync-info' }, syncTimeText),
    btnManualSync
  );

  const appLayout    = createElement('div', { className: 'app-layout' });
  const mainContent  = createElement('div', { className: 'main-content' });
  const contentHeader = createElement('header', { className: 'content-header' });
  const contentTitle  = createElement('h2', { className: 'content-header-title' }, 'Dashboard');
  const contentBody   = createElement('div', { className: 'content-body' });

  contentHeader.appendChild(contentTitle);
  contentHeader.appendChild(statusBar);
  mainContent.appendChild(contentHeader);
  mainContent.appendChild(contentBody);

  if ((window as any).BioryxSidebar) {
    const sidebar = new (window as any).BioryxSidebar((tabId: string, tabLabel: string) => {
      switchTab(tabId, tabLabel);
    });
    appLayout.appendChild(sidebar.getElement());
  }

  appLayout.appendChild(mainContent);
  document.body.appendChild(titleBar);
  document.body.appendChild(appLayout);

  let deviceManagerEl: HTMLElement | null = null;
  if ((window as any).BioryxDeviceManager) {
    const dm = new (window as any).BioryxDeviceManager((state: any) => {
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

  let attendanceEl: HTMLElement | null = null;
  if ((window as any).BioryxAttendance) {
    const att = new (window as any).BioryxAttendance();
    attendanceEl = att.getElement();
  }

  let employeeManagmentEl: HTMLElement | null = null;
  if ((window as any).BioryxEmployeeManagment) {
    const emp = new (window as any).BioryxEmployeeManagment();
    employeeManagmentEl = emp.getElement();
  }

  titleBar.querySelector('#btn-minimize')?.addEventListener('click', () =>
    (window as any).electronAPI?.minimize());
  titleBar.querySelector('#btn-maximize')?.addEventListener('click', () =>
    (window as any).electronAPI?.maximize());
  titleBar.querySelector('#btn-close')?.addEventListener('click', () =>
    (window as any).electronAPI?.close());

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
    } catch (_) {}
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

  function renderDashboard() {
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

        liveActivity.forEach(act => {
          tb.appendChild(createTableRow(
            act.deviceName,
            act.ipAddress,
            act.action,
            act.status,
            act.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          ));
        });

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

  function renderEmployees() {
    if (employeeManagmentEl) {
      contentBody.appendChild(employeeManagmentEl);
    } else {
      contentBody.appendChild(
        createElement('div', { className: 'config-card' },
          createElement('p', {}, 'Employee Management component failed to load.')
        )
      );
    }
  }

  function renderAttendance() {
    if (attendanceEl) {
      contentBody.appendChild(attendanceEl);
    } else {
      contentBody.appendChild(
        createElement('div', { className: 'config-card' },
          createElement('p', {}, 'Attendance component failed to load.')
        )
      );
    }
  }

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

      toast?.success('Real-time Punch', {
        description: `User #${data.userId} punched in at ${punchTime.toLocaleTimeString()}! Status: ${data.mongoSynced ? 'Synced to Atlas' : 'Offline Cached'}`
      });

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

        const valueElements = document.querySelectorAll('.metric-value');
        if (valueElements && valueElements[1]) {
          const current = parseInt(valueElements[1].textContent || '145', 10);
          valueElements[1].textContent = String(current + 1);
        }
      }

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

  if (api?.onDbStatus) {
    api.onDbStatus((_event: any, data: { synced: boolean; count: number; message: string }) => {
      console.log('Frontend received database status event:', data);
      if (data.synced) {
        toast?.success('Database Sync Complete', {
          description: data.message || `Successfully synchronized ${data.count} offline punch records to MongoDB Atlas.`
        });

        refreshStatus();

        livePunches.forEach(p => p.mongoSynced = true);
        liveActivity.forEach(a => {
          if (a.action === 'Attendance Punch') {
            a.status = '<span class="badge badge-success">Synced</span>';
          }
        });

        const currentTab = document.querySelector('.sidebar-menu-item.active')?.getAttribute('data-tab');
        if (currentTab === 'dashboard') {
          renderDashboard();
        } else if (currentTab === 'attendance') {
          renderAttendance();
        }
      }
    });
  }

  renderDashboard();
});

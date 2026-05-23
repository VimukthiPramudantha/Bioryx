/* Dashboard and Navigation Process Script in TypeScript */

// Helper to create HTML elements with attribute configurations
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: { [key: string]: string } = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'innerHTML') {
      el.innerHTML = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

// Helper to create metric cards on the Dashboard
function createMetricCard(title: string, value: string, color: string, iconHtml: string): HTMLElement {
  return createElement('div', { className: 'metric-card' },
    createElement('div', { className: `metric-icon ${color}-icon`, innerHTML: iconHtml }),
    createElement('div', { className: 'metric-info' },
      createElement('h3', {}, title),
      createElement('p', { className: 'metric-value' }, value)
    )
  );
}

// Helper to construct custom table rows
function createTableRow(...cells: (string | HTMLElement)[]): HTMLElement {
  const row = document.createElement('tr');
  cells.forEach(cell => {
    const td = document.createElement('td');
    if (cell instanceof HTMLElement) {
      td.appendChild(cell);
    } else {
      td.innerHTML = cell;
    }
    row.appendChild(td);
  });
  return row;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Clear any existing content in the HTML body
  const toaster = document.querySelector('GooeyToaster');
  document.body.innerHTML = '';
  if (toaster) {
    document.body.appendChild(toaster);
  }

  // --- Title Bar Component ---
  const titleBar = createElement('div', { className: 'title-bar' },
    createElement('div', { className: 'title-bar-title' }, 'Bioryx - Attendance Synchronizer'),
    createElement('div', { className: 'window-controls' },
      createElement('button', { className: 'control-btn minimize', id: 'btn-minimize', title: 'Minimize', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' }),
      createElement('button', { className: 'control-btn maximize', id: 'btn-maximize', title: 'Maximize', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>' }),
      createElement('button', { className: 'control-btn close', id: 'btn-close', title: 'Close', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' })
    )
  );

  // --- Persistent Header Elements ---
  const statusDot = createElement('span', { className: 'status-dot', id: 'device-status-dot' });
  const statusText = createElement('span', { id: 'device-status-text' }, 'Device Status: Checking...');
  const syncTimeText = createElement('span', { id: 'last-sync-time' }, 'Last Sync: --');
  const btnManualSync = createElement('button', { className: 'glass-btn btn-small', id: 'btn-manual-sync' }, 'Manual Sync');

  // --- Core Layout Setup ---
  const appLayout = createElement('div', { className: 'app-layout' });
  const mainContent = createElement('div', { className: 'main-content' });
  const contentHeader = createElement('header', { className: 'content-header' });
  const contentHeaderTitle = createElement('h2', { className: 'content-header-title' }, 'Dashboard');
  const contentBody = createElement('div', { className: 'content-body' });

  // Assemble Persistent Header Sync Section
  const statusBar = createElement('div', { className: 'status-bar' },
    createElement('div', { className: 'status-indicator' }, statusDot, statusText),
    createElement('div', { className: 'sync-info' }, syncTimeText),
    btnManualSync
  );

  contentHeader.appendChild(contentHeaderTitle);
  contentHeader.appendChild(statusBar);

  // Assemble Main Content Pane
  mainContent.appendChild(contentHeader);
  mainContent.appendChild(contentBody);

  // Instantiate Sidebar Component
  if ((window as any).BioryxSidebar) {
    const sidebarComponent = new (window as any).BioryxSidebar((tabId: string, tabLabel: string) => {
      switchTab(tabId, tabLabel);
    });
    appLayout.appendChild(sidebarComponent.getElement());
  } else {
    console.error("BioryxSidebar component was not found in the global scope.");
  }

  appLayout.appendChild(mainContent);

  // Append Top Title Bar & Main Layout wrapper to document
  document.body.appendChild(titleBar);
  document.body.appendChild(appLayout);

  // --- Window Control Listeners ---
  const btnMinimize = titleBar.querySelector('#btn-minimize');
  const btnMaximize = titleBar.querySelector('#btn-maximize');
  const btnClose = titleBar.querySelector('#btn-close');

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      if ((window as any).electronAPI) (window as any).electronAPI.minimize();
    });
  }
  if (btnMaximize) {
    btnMaximize.addEventListener('click', () => {
      if ((window as any).electronAPI) (window as any).electronAPI.maximize();
    });
  }
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if ((window as any).electronAPI) (window as any).electronAPI.close();
    });
  }

  // --- ZKTeco Synchronizer Status Updates ---
  const updateStatus = async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.getSyncStatus) {
      try {
        const status = await (window as any).electronAPI.getSyncStatus();
        
        if (status.deviceStatus === 'Connected') {
          statusDot.className = 'status-dot connected';
          statusText.textContent = 'Device Status: Connected';
        } else {
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Device Status: Disconnected';
        }

        if (status.lastSyncTime) {
          const date = new Date(status.lastSyncTime);
          syncTimeText.textContent = `Last Sync: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          syncTimeText.textContent = `Last Sync: Never`;
        }
      } catch (err) {
        console.error('Failed to get sync status', err);
      }
    }
  };

  // Run initial status check
  await updateStatus();

  // Bind click trigger for manual sync button
  btnManualSync.addEventListener('click', async () => {
    const toast = (window as any).gooeyToast;
    if (toast) {
      toast.info('Synchronizing Logs', {
        description: 'Checking connection and downloading latest reader sync logs...'
      });
    }
    btnManualSync.setAttribute('disabled', 'true');
    btnManualSync.textContent = 'Syncing...';
    try {
      await updateStatus();
      if (toast) {
        toast.success('Sync Completed', {
          description: 'Attendance records and device logs synced successfully.'
        });
      }
    } catch (e: any) {
      if (toast) {
        toast.error('Sync Failed', {
          description: e.message || 'Error occurred during connection.'
        });
      }
    } finally {
      btnManualSync.removeAttribute('disabled');
      btnManualSync.textContent = 'Manual Sync';
    }
  });

  // --- Dynamic Content View Switchener ---
  function switchTab(tabId: string, tabLabel: string) {
    contentHeaderTitle.textContent = tabLabel;
    contentBody.innerHTML = '';

    switch (tabId) {
      case 'dashboard':
        renderDashboardView();
        break;
      case 'employees':
        renderEmployeesView();
        break;
      case 'attendance':
        renderAttendanceView();
        break;
      case 'sync':
        renderSyncManagerView();
        break;
      case 'device':
        renderDeviceManagerView();
        break;
      case 'settings':
        renderSettingsView();
        break;
      default:
        contentBody.appendChild(createElement('div', {}, 'Module view not found.'));
    }
  }

  // 1. Render Dashboard Module
  function renderDashboardView() {
    const grid = createElement('div', { className: 'metrics-grid' },
      createMetricCard('Total Employees', '150', 'blue', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'),
      createMetricCard("Today's Attendance", '145', 'green', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'),
      createMetricCard('Late Arrivals Today', '12', 'yellow', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'),
      createMetricCard('Missed Punches', '3', 'red', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>')
    );

    const tableContainer = createElement('div', { className: 'table-container' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Recent Device Connections'),
          createElement('p', {}, 'Latest synchronization and ping logs from biometric readers')
        )
      ),
      createElement('table', { className: 'data-table' },
        createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Device Name'),
            createElement('th', {}, 'IP Address'),
            createElement('th', {}, 'Action'),
            createElement('th', {}, 'Status'),
            createElement('th', {}, 'Timestamp')
          )
        ),
        createElement('tbody', {},
          createTableRow('ZKTeco Main Reader', '192.168.1.201', 'Log Fetch', '<span class="badge badge-success">Success</span>', 'Just Now'),
          createTableRow('ZKTeco Secondary Reader', '192.168.1.202', 'Log Fetch', '<span class="badge badge-success">Success</span>', '10 mins ago'),
          createTableRow('Canteen Terminal', '192.168.1.203', 'Ping Connection', '<span class="badge badge-danger">Offline</span>', '1 hour ago')
        )
      )
    );

    contentBody.appendChild(grid);
    contentBody.appendChild(tableContainer);
  }

  // 2. Render Employee Management Module
  function renderEmployeesView() {
    const tableContainer = createElement('div', { className: 'table-container' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Active Employees'),
          createElement('p', {}, 'Manage employee profiles, access groups, and fingerprint templates')
        ),
        createElement('button', { className: 'btn-primary' }, '+ Add Employee')
      ),
      createElement('table', { className: 'data-table' },
        createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Employee ID'),
            createElement('th', {}, 'Name'),
            createElement('th', {}, 'Department'),
            createElement('th', {}, 'Card Number'),
            createElement('th', {}, 'Enrollment Date')
          )
        ),
        createElement('tbody', {},
          createTableRow('EMP001', 'John Doe', 'Engineering', '1092834', '2024-01-15'),
          createTableRow('EMP002', 'Jane Smith', 'Human Resources', '1092835', '2024-02-10'),
          createTableRow('EMP003', 'Alice Johnson', 'Finance', '1092836', '2024-03-01'),
          createTableRow('EMP004', 'Bob Brown', 'Operations', '1092837', '2024-03-12')
        )
      )
    );

    contentBody.appendChild(tableContainer);
  }

  // 3. Render Attendance Module
  function renderAttendanceView() {
    const tableContainer = createElement('div', { className: 'table-container' },
      createElement('div', { className: 'table-header-row' },
        createElement('div', { className: 'table-title-group' },
          createElement('h3', {}, 'Daily Attendance Logs'),
          createElement('p', {}, 'Real-time record of check-in and check-out logs')
        )
      ),
      createElement('table', { className: 'data-table' },
        createElement('thead', {},
          createElement('tr', {},
            createElement('th', {}, 'Employee'),
            createElement('th', {}, 'Date'),
            createElement('th', {}, 'Clock In'),
            createElement('th', {}, 'Clock Out'),
            createElement('th', {}, 'Status')
          )
        ),
        createElement('tbody', {},
          createTableRow('John Doe (EMP001)', 'May 23, 2026', '08:55 AM', '05:05 PM', '<span class="badge badge-success">On Time</span>'),
          createTableRow('Jane Smith (EMP002)', 'May 23, 2026', '09:12 AM', '05:00 PM', '<span class="badge badge-warning">Late</span>'),
          createTableRow('Alice Johnson (EMP003)', 'May 23, 2026', '08:50 AM', '05:15 PM', '<span class="badge badge-success">On Time</span>'),
          createTableRow('Bob Brown (EMP004)', 'May 23, 2026', '--', '--', '<span class="badge badge-danger">Absent</span>')
        )
      )
    );

    contentBody.appendChild(tableContainer);
  }

  // 4. Render Sync Manager Module
  function renderSyncManagerView() {
    const configGrid = createElement('div', { className: 'config-grid' },
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Synchronization Status'),
        createElement('p', { className: 'card-desc' }, 'View and configure background synchronization intervals'),
        createElement('div', { className: 'sync-status-panel' },
          createElement('div', { className: 'sync-status-card' },
            createElement('div', { className: 'sync-status-details' },
              createElement('div', { className: 'sync-status-badge' }, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'),
              createElement('div', { className: 'sync-status-info' },
                createElement('h4', {}, 'Auto-Sync Service'),
                createElement('span', { className: 'badge badge-success' }, 'Running')
              )
            )
          ),
          createElement('div', { className: 'form-group' },
            createElement('label', {}, 'Sync Frequency'),
            createElement('select', { className: 'form-input' }, 
              createElement('option', {}, 'Every 5 Minutes'),
              createElement('option', {}, 'Every 15 Minutes'),
              createElement('option', {}, 'Every 1 Hour')
            )
          ),
          createElement('button', { className: 'btn-primary' }, 'Force Sync Database Now')
        )
      ),
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Sync Service Logs'),
        createElement('p', { className: 'card-desc' }, 'History of background synchronization events'),
        createElement('table', { className: 'data-table' },
          createElement('thead', {},
            createElement('tr', {},
              createElement('th', {}, 'Event'),
              createElement('th', {}, 'Records Affected'),
              createElement('th', {}, 'Status')
            )
          ),
          createElement('tbody', {},
            createTableRow('Fetched Attendance', '45 logs', '<span class="badge badge-success">Success</span>'),
            createTableRow('Updated Employees', '3 profiles', '<span class="badge badge-success">Success</span>'),
            createTableRow('Connection Ping', 'Online', '<span class="badge badge-success">Success</span>')
          )
        )
      )
    );

    contentBody.appendChild(configGrid);
  }

  // 5. Render Device Manager Module
  function renderDeviceManagerView() {
    const configGrid = createElement('div', { className: 'config-grid' },
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Device IP Configuration'),
        createElement('p', { className: 'card-desc' }, 'Configure connection details for the primary ZKTeco hardware reader'),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'IP Address'),
          createElement('input', { type: 'text', className: 'form-input', id: 'dev-ip-input', value: '192.168.1.201' })
        ),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Port'),
          createElement('input', { type: 'number', className: 'form-input', id: 'dev-port-input', value: '4370' })
        ),
        createElement('div', { className: 'form-actions' },
          createElement('button', { className: 'btn-secondary', id: 'btn-test-zk-dash' }, 'Test Connection'),
          createElement('button', { className: 'btn-primary' }, 'Save Configuration')
        )
      ),
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Registered Terminals'),
        createElement('p', { className: 'card-desc' }, 'All readers currently connected to the synchronization network'),
        createElement('table', { className: 'data-table' },
          createElement('thead', {},
            createElement('tr', {},
              createElement('th', {}, 'Reader Name'),
              createElement('th', {}, 'IP Address'),
              createElement('th', {}, 'Status')
            )
          ),
          createElement('tbody', {},
            createTableRow('Main Entrance Reader', '192.168.1.201', '<span class="badge badge-success">Online</span>'),
            createTableRow('Warehouse Terminal', '192.168.1.202', '<span class="badge badge-success">Online</span>')
          )
        )
      )
    );

    contentBody.appendChild(configGrid);

    // Bind testing function dynamically
    setTimeout(() => {
      const btnTest = document.getElementById('btn-test-zk-dash');
      const ipInput = document.getElementById('dev-ip-input') as HTMLInputElement;
      const portInput = document.getElementById('dev-port-input') as HTMLInputElement;

      if (btnTest && ipInput && portInput) {
        btnTest.addEventListener('click', async () => {
          const ip = ipInput.value.trim();
          const port = parseInt(portInput.value.trim() || '4370');
          const toast = (window as any).gooeyToast;

          if (!ip) {
            if (toast) toast.error('Invalid IP', { description: 'Please enter a valid IP address.' });
            return;
          }

          if (toast) toast.info('Connecting to Device', { description: `Attempting to connect to ${ip}:${port}...` });
          btnTest.setAttribute('disabled', 'true');
          btnTest.textContent = 'Testing...';

          try {
            if ((window as any).electronAPI && (window as any).electronAPI.testZkTecoConnection) {
              const result = await (window as any).electronAPI.testZkTecoConnection(ip, port);
              if (result.success) {
                if (toast) toast.success('Device Connected', { description: `Successfully pinged ZKTeco device at ${ip}:${port}.` });
              } else {
                if (toast) toast.error('Connection Failed', { description: result.error });
              }
            }
          } catch (err: any) {
            if (toast) toast.error('Error', { description: err.message || 'Connection error occurred.' });
          } finally {
            btnTest.removeAttribute('disabled');
            btnTest.textContent = 'Test Connection';
          }
        });
      }
    }, 50);
  }

  // 6. Render Settings Module
  function renderSettingsView() {
    const configGrid = createElement('div', { className: 'config-grid' },
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'System Options'),
        createElement('p', { className: 'card-desc' }, 'Update operational parameters and backup protocols'),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Local Cache Directory'),
          createElement('input', { type: 'text', className: 'form-input', value: 'C:\\Users\\User\\.gemini\\antigravity\\logs' })
        ),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Auto-Backup Frequency'),
          createElement('select', { className: 'form-input' }, 
            createElement('option', {}, 'Daily'),
            createElement('option', {}, 'Weekly'),
            createElement('option', {}, 'Never')
          )
        ),
        createElement('div', { className: 'form-actions' },
          createElement('button', { className: 'btn-primary' }, 'Save Changes')
        )
      ),
      createElement('div', { className: 'config-card' },
        createElement('h3', {}, 'Database Connection'),
        createElement('p', { className: 'card-desc' }, 'Manage remote MongoDB Atlas credentials'),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Database Name'),
          createElement('input', { type: 'text', className: 'form-input', value: 'admin' })
        ),
        createElement('div', { className: 'form-group' },
          createElement('label', {}, 'Connection URI'),
          createElement('input', { type: 'password', className: 'form-input', value: 'mongodb+srv://******:******@cluster.mongodb.net/' })
        ),
        createElement('div', { className: 'form-actions' },
          createElement('button', { className: 'btn-primary' }, 'Save URI')
        )
      )
    );

    contentBody.appendChild(configGrid);
  }

  // Render initial dashboard view
  renderDashboardView();
});

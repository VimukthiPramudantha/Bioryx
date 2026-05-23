// Helper to create elements
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

document.addEventListener('DOMContentLoaded', async () => {
  // Clear any existing content except scripts and toaster
  const toaster = document.querySelector('GooeyToaster');
  document.body.innerHTML = '';
  if (toaster) document.body.appendChild(toaster);

  // --- Title Bar ---
  const titleBar = createElement('div', { className: 'title-bar' },
    createElement('div', { className: 'title-bar-title' }, 'Bioryx - Dashboard'),
    createElement('div', { className: 'window-controls' },
      createElement('button', { className: 'control-btn minimize', id: 'btn-minimize', title: 'Minimize', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' }),
      createElement('button', { className: 'control-btn maximize', id: 'btn-maximize', title: 'Maximize', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>' }),
      createElement('button', { className: 'control-btn close', id: 'btn-close', title: 'Close', innerHTML: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' })
    )
  );

  // --- Dashboard Container ---
  const statusDot = createElement('span', { className: 'status-dot', id: 'device-status-dot' });
  const statusText = createElement('span', { id: 'device-status-text' }, 'Device Status: Checking...');
  const syncTimeText = createElement('span', { id: 'last-sync-time' }, 'Last Sync: --');
  const btnManualSync = createElement('button', { className: 'glass-btn btn-small', id: 'btn-manual-sync' }, 'Manual Sync');

  const dashboardContainer = createElement('div', { className: 'dashboard-container' },
    createElement('div', { className: 'glow-bg blob-1' }),
    createElement('div', { className: 'glow-bg blob-2' }),
    createElement('header', { className: 'dashboard-header' },
      createElement('div', { className: 'header-content' },
        createElement('h1', { className: 'app-title' }, 'Dashboard'),
        createElement('div', { className: 'status-bar' },
          createElement('div', { className: 'status-indicator' }, statusDot, statusText),
          createElement('div', { className: 'sync-info' }, syncTimeText),
          btnManualSync
        )
      )
    ),
    createElement('div', { className: 'metrics-grid' },
      createElement('div', { className: 'metric-card' },
        createElement('div', { className: 'metric-icon blue-icon', innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' }),
        createElement('div', { className: 'metric-info' },
          createElement('h3', {}, 'Total Employees'),
          createElement('p', { className: 'metric-value' }, '150')
        )
      ),
      createElement('div', { className: 'metric-card' },
        createElement('div', { className: 'metric-icon green-icon', innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' }),
        createElement('div', { className: 'metric-info' },
          createElement('h3', {}, "Today's Attendance"),
          createElement('p', { className: 'metric-value' }, '145')
        )
      ),
      createElement('div', { className: 'metric-card' },
        createElement('div', { className: 'metric-icon yellow-icon', innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' }),
        createElement('div', { className: 'metric-info' },
          createElement('h3', {}, 'Late Arrivals Today'),
          createElement('p', { className: 'metric-value' }, '12')
        )
      ),
      createElement('div', { className: 'metric-card' },
        createElement('div', { className: 'metric-icon red-icon', innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' }),
        createElement('div', { className: 'metric-info' },
          createElement('h3', {}, 'Missed Punches'),
          createElement('p', { className: 'metric-value' }, '3')
        )
      )
    )
  );

  document.body.appendChild(titleBar);
  document.body.appendChild(dashboardContainer);

  // --- Logic & Event Listeners ---
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

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

  const updateStatus = async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.getSyncStatus) {
      try {
        const status = await (window as any).electronAPI.getSyncStatus();
        
        if (status.deviceStatus === 'Connected') {
          statusDot.classList.add('connected');
          statusDot.classList.remove('disconnected');
          statusText.textContent = 'Device Status: Connected';
        } else {
          statusDot.classList.add('disconnected');
          statusDot.classList.remove('connected');
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

  await updateStatus();

  btnManualSync.addEventListener('click', () => {
    const toast = (window as any).gooeyToast;
    if (toast) {
      toast.info('Feature Coming Soon', {
        description: 'A popup screen to enter IP configuration will appear here.'
      });
    }
  });
});


document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('device-status-dot');
  const statusText = document.getElementById('device-status-text');
  const syncTimeText = document.getElementById('last-sync-time');
  const btnManualSync = document.getElementById('btn-manual-sync');

  // Window controls
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

  // Fetch initial status from backend
  const updateStatus = async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.getSyncStatus) {
      try {
        const status = await (window as any).electronAPI.getSyncStatus();
        
        if (status.deviceStatus === 'Connected') {
          statusDot?.classList.add('connected');
          statusDot?.classList.remove('disconnected');
          if (statusText) statusText.textContent = 'Device Status: Connected';
        } else {
          statusDot?.classList.add('disconnected');
          statusDot?.classList.remove('connected');
          if (statusText) statusText.textContent = 'Device Status: Disconnected';
        }

        if (syncTimeText) {
          if (status.lastSyncTime) {
            const date = new Date(status.lastSyncTime);
            syncTimeText.textContent = `Last Sync: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            syncTimeText.textContent = `Last Sync: Never`;
          }
        }
      } catch (err) {
        console.error('Failed to get sync status', err);
      }
    }
  };

  await updateStatus();

  if (btnManualSync) {
    btnManualSync.addEventListener('click', () => {
      const toast = (window as any).gooeyToast;
      if (toast) {
        toast.info('Feature Coming Soon', {
          description: 'A popup screen to enter IP configuration will appear here.'
        });
      }
    });
  }
});

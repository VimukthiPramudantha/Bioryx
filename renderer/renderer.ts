/* Renderer Process script in TypeScript */

document.addEventListener('DOMContentLoaded', () => {
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.minimize();
      }
    });
  }

  if (btnMaximize) {
    btnMaximize.addEventListener('click', () => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.maximize();
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.close();
      }
    });
  }

  const statusText = document.getElementById('status-text');
  if (!statusText) return;

  // Listen to actual MongoDB status updates from the main process
  const electronAPI = (window as any).electronAPI;
  if (electronAPI && electronAPI.onDbStatus) {
    electronAPI.onDbStatus((_event: any, data: any) => {
      // Update status message in the loading splash screen card
      if (statusText) {
        statusText.textContent = data.message;
      }

      // Trigger high-fidelity custom gooey-toasts matching React goey-toast API signature
      const toast = (window as any).gooeyToast;
      if (toast) {
        if (data.status === 'success') {
          toast.success('Database Connected', {
            description: 'Your MongoDB Atlas connection has been established successfully.'
          });
        } else if (data.status === 'error') {
          toast.error('Database Connection Failed', {
            description: `Could not connect to Atlas cluster: ${data.message}`
          });
        } else if (data.status === 'connecting') {
          toast.info('Database Syncing', {
            description: data.message || 'Attempting to secure a link to your MongoDB Atlas cluster...'
          });
        }
      }
    });
  }
});

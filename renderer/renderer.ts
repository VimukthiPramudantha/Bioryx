/* Renderer Process script in TypeScript */

document.addEventListener('DOMContentLoaded', () => {
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.minimize();
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

  const steps = [
    { text: 'Loading local configurations...', delay: 800 },
    { 
      text: 'Searching for biometric devices...', 
      delay: 2200, 
      toast: { type: 'info', msg: 'Scanning local network for ZKTeco terminal...' } 
    },
    { 
      text: 'ZKTeco terminal connected (IP: 192.168.1.150)...', 
      delay: 4000, 
      toast: { type: 'success', msg: 'Biometric device found & online' } 
    },
    { 
      text: 'Establishing secure link to MongoDB Atlas...', 
      delay: 5800 
    },
    { 
      text: 'Atlas DB cluster connection established.', 
      delay: 7200, 
      toast: { type: 'success', msg: 'MongoDB Atlas Sync engine activated' } 
    },
    { 
      text: 'Synchronizing local database with Atlas cluster...', 
      delay: 9000,
      toast: { type: 'info', msg: 'Pulling 14 pending attendance logs...' }
    },
    { 
      text: 'All biometric systems nominal.', 
      delay: 11000, 
      toast: { type: 'success', msg: 'Sync system active. Dashboard ready.' } 
    }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      statusText.textContent = step.text;
      
      const toastManager = (window as any).gooeyToast;
      if (toastManager && step.toast) {
        const { type, msg } = step.toast;
        if (type === 'success') {
          toastManager.success(msg);
        } else if (type === 'error') {
          toastManager.error(msg);
        } else if (type === 'warning') {
          toastManager.warning(msg);
        } else {
          toastManager.info(msg);
        }
      }
    }, step.delay);
  });
});

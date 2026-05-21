/* Custom Gooey Toast Manager in Vanilla TypeScript */

interface ToastOptions {
  duration?: number;
  closeable?: boolean;
}

class GooeyToastManager {
  private container: HTMLDivElement | null = null;

  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private init() {
    this.injectSVGFilter();
    this.createContainer();
  }

  private injectSVGFilter() {
    if (document.getElementById('gooey-filter-svg')) return;

    const svgHtml = `
      <svg id="gooey-filter-svg" style="visibility: hidden; position: absolute; width: 0; height: 0;" xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
          <filter id="gooey-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="gooey" />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>
    `;
    const wrapper = document.createElement('div');
    wrapper.style.display = 'none';
    wrapper.innerHTML = svgHtml.trim();
    document.body.appendChild(wrapper.firstChild!);
  }

  private createContainer() {
    this.container = document.querySelector('.gooey-toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'gooey-toast-container';
      document.body.appendChild(this.container);
    }
  }

  public show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', options: ToastOptions = {}) {
    if (!this.container) {
      this.createContainer();
    }

    const { duration = 4000, closeable = true } = options;

    const toast = document.createElement('div');
    toast.className = `gooey-toast ${type}`;

    let icon = '•';
    if (type === 'success') {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else if (type === 'warning') {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'info') {
      icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">${message}</div>
    `;

    if (closeable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      closeBtn.onclick = () => this.dismiss(toast);
      toast.appendChild(closeBtn);
    }

    this.container!.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  }

  public success(message: string, options?: ToastOptions) {
    return this.show(message, 'success', options);
  }

  public error(message: string, options?: ToastOptions) {
    return this.show(message, 'error', options);
  }

  public warning(message: string, options?: ToastOptions) {
    return this.show(message, 'warning', options);
  }

  public info(message: string, options?: ToastOptions) {
    return this.show(message, 'info', options);
  }

  private dismiss(toast: HTMLDivElement) {
    if (toast.classList.contains('dismissing') || !toast.parentNode) return;
    toast.classList.add('dismissing');
    
    toast.addEventListener('animationend', (e) => {
      if (e.animationName === 'gooey-slide-out') {
        toast.remove();
      }
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 700);
  }
}

const gooeyToast = new GooeyToastManager();
(window as any).gooeyToast = gooeyToast;

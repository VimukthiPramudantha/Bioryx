/* Custom Sidebar Component for Bioryx */

class BioryxSidebar {
  private container: HTMLElement;
  private onTabChange: (tabId: string, tabLabel: string) => void;

  constructor(onTabChange: (tabId: string, tabLabel: string) => void) {
    this.onTabChange = onTabChange;
    this.container = this.render();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(): HTMLElement {
    const sidebarEl = document.createElement('div');
    sidebarEl.className = 'sidebar';

    // Sidebar Branding / Logo Header
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    header.innerHTML = `
      <svg class="sidebar-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a10 10 0 0 0-10 10c0 1.25.2 2.45.6 3.6"></path>
        <path d="M12 2a10 10 0 0 1 10 10c0 1.25-.2 2.45-.6 3.6"></path>
        <path d="M12 10a2 2 0 0 0-2 2c0 2 1.5 2 1.5 4v1.5"></path>
        <path d="M12 14c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1s1 .4 1 1v2c0 .6-.4 1-1 1z"></path>
      </svg>
      <span class="sidebar-title">BIORYX</span>
    `;
    sidebarEl.appendChild(header);

    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';

    const navItems = [
      { label: 'Dashboard', id: 'dashboard', icon: this.getIcon('dashboard') },
      { label: 'Employee Management', id: 'employees', icon: this.getIcon('employees') },
      { label: 'Attendance', id: 'attendance', icon: this.getIcon('attendance') },
      { label: 'Sync Manager', id: 'sync', icon: this.getIcon('sync') },
      { label: 'Device Manager', id: 'device', icon: this.getIcon('device') },
      { label: 'Settings Module', id: 'settings', icon: this.getIcon('settings') },
    ];

    navItems.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = `nav-item${index === 0 ? ' active' : ''}`;
      itemEl.setAttribute('data-tab', item.id);
      itemEl.innerHTML = `
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      `;

      itemEl.addEventListener('click', () => {
        const activeItem = nav.querySelector('.nav-item.active');
        if (activeItem) {
          activeItem.classList.remove('active');
        }
        itemEl.classList.add('active');
        this.onTabChange(item.id, item.label);
      });

      nav.appendChild(itemEl);
    });

    sidebarEl.appendChild(nav);
    return sidebarEl;
  }

  private getIcon(id: string): string {
    switch (id) {
      case 'dashboard':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`;
      case 'employees':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
      case 'attendance':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      case 'sync':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
      case 'device':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`;
      case 'settings':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
      default:
        return '';
    }
  }
}

(window as any).BioryxSidebar = BioryxSidebar;

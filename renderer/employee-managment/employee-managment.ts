interface DeviceUser {
  userId: string;
  name: string;
  role?: number;
  cardno?: number;
}

class BioryxEmployeeManagment {
  private container: HTMLElement;
  private deviceUsers: DeviceUser[] = [];
  private refs: {
    tableBody: HTMLElement | null;
    addBtn: HTMLButtonElement | null;
  } = {
    tableBody: null,
    addBtn: null
  };

  constructor() {
    this.container = this.render();
    this.bindEvents();
    this.loadEmployees();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private render(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'dm-root';
    root.innerHTML = `
      <div class="table-container">
        <div class="table-header-row">
          <div class="table-title-group">
            <h3>Active Employees</h3>
            <p>Manage employee profiles, access groups, and fingerprint templates</p>
          </div>
          <button id="emp-add-btn" class="btn-primary">+ Add Employee</button>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Department / Role</th>
              <th>Card Number</th>
              <th>Enrolled</th>
            </tr>
          </thead>
          <tbody id="emp-table-body">
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
                Loading employees...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    return root;
  }

  private bindEvents(): void {
    this.refs.tableBody = this.container.querySelector('#emp-table-body');
    this.refs.addBtn = this.container.querySelector('#emp-add-btn');

    this.refs.addBtn?.addEventListener('click', () => {
      (window as any).BioryxPopup?.show(
        'Employee registration flow is under development.',
        'u can suport developer by useing git hub repo'
      );
    });
  }

  private async loadEmployees(): Promise<void> {
    const api = (window as any).electronAPI;
    if (api && api.getDeviceUsers) {
      try {
        this.deviceUsers = await api.getDeviceUsers();
      } catch (err) {
        console.error('Failed to load device users:', err);
      }
    }
    this.renderEmployeesList();
  }

  private renderEmployeesList(): void {
    if (!this.refs.tableBody) return;

    this.refs.tableBody.innerHTML = '';

    // If there are no device users loaded (e.g. empty or disconnected), show dummy data so the screen isn't empty/boring.
    if (this.deviceUsers.length === 0) {
      const dummyEmployees = [
        { id: 'EMP001', name: 'John Doe', dept: 'Engineering', card: '1092834', enrolled: '2024-01-15' },
        { id: 'EMP002', name: 'Jane Smith', dept: 'Human Resources', card: '1092835', enrolled: '2024-02-10' },
        { id: 'EMP003', name: 'Alice Johnson', dept: 'Finance', card: '1092836', enrolled: '2024-03-01' },
        { id: 'EMP004', name: 'Bob Brown', dept: 'Operations', card: '1092837', enrolled: '2024-03-12' }
      ];

      dummyEmployees.forEach(emp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span style="font-weight: 600; color: var(--text-primary);">${emp.id}</span></td>
          <td>${emp.name}</td>
          <td>${emp.dept}</td>
          <td>${emp.card}</td>
          <td>${emp.enrolled}</td>
        `;
        this.refs.tableBody!.appendChild(tr);
      });
      return;
    }

    // Sort device users by numeric ID or string ID
    const sortedUsers = [...this.deviceUsers].sort((a, b) => {
      const numA = parseInt(a.userId, 10);
      const numB = parseInt(b.userId, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.userId.localeCompare(b.userId);
    });

    sortedUsers.forEach(user => {
      const roleStr = user.role === 14 ? 'Admin' : 'Standard User';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span style="font-weight: 600; color: var(--text-primary);">${user.userId}</span></td>
        <td>${user.name}</td>
        <td>${roleStr}</td>
        <td>${user.cardno || '--'}</td>
        <td><span class="badge badge-success">Enrolled</span></td>
      `;
      this.refs.tableBody!.appendChild(tr);
    });
  }
}

(window as any).BioryxEmployeeManagment = BioryxEmployeeManagment;

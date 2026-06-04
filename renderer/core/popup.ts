class BioryxPopup {
  private static styleId = 'bioryx-popup-styles';

  public static show(title: string, message: string): void {
    if (document.getElementById('bioryx-popup-overlay')) return;

    this.injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'bioryx-popup-overlay';
    overlay.innerHTML = `
      <div class="bioryx-popup">
        <div class="bioryx-popup-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3>${title}</h3>
        <p>${message}</p>
        <button class="bioryx-popup-btn" id="bioryx-popup-close-btn">Close</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#bioryx-popup-close-btn');
    const dismiss = () => {
      overlay.style.animation = 'bioryx-popup-fade-in 0.2s reverse forwards';
      const modal = overlay.querySelector('.bioryx-popup') as HTMLElement | null;
      if (modal) {
        modal.style.animation = 'bioryx-popup-pop-in 0.2s reverse ease forwards';
      }
      setTimeout(() => {
        overlay.remove();
      }, 200);
    };

    closeBtn?.addEventListener('click', dismiss);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        dismiss();
      }
    });
  }

  private static injectStyles(): void {
    if (document.getElementById(this.styleId)) return;

    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      #bioryx-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: bioryx-popup-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .bioryx-popup {
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 24px;
        padding: 32px;
        width: 90%;
        max-width: 440px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        text-align: center;
        transform: scale(0.9) translateY(10px);
        animation: bioryx-popup-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .bioryx-popup-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(35, 169, 242, 0.08);
        color: #23a9f2;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }
      .bioryx-popup-icon svg {
        width: 32px;
        height: 32px;
      }
      .bioryx-popup h3 {
        font-family: 'Poppins', sans-serif;
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 10px;
        line-height: 1.4;
      }
      .bioryx-popup p {
        font-family: 'Poppins', sans-serif;
        font-size: 13.5px;
        line-height: 1.5;
        color: #64748b;
        margin: 0 0 24px;
      }
      .bioryx-popup-btn {
        background: linear-gradient(135deg, #23a9f2, #0284c7);
        color: #ffffff;
        border: none;
        border-radius: 12px;
        padding: 12px 32px;
        font-size: 14px;
        font-weight: 600;
        font-family: 'Poppins', sans-serif;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(35, 169, 242, 0.25);
      }
      .bioryx-popup-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(35, 169, 242, 0.35);
      }
      .bioryx-popup-btn:active {
        transform: translateY(0);
      }
      @keyframes bioryx-popup-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes bioryx-popup-pop-in {
        to {
          transform: scale(1) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

(window as any).BioryxPopup = BioryxPopup;

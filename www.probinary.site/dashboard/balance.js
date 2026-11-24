// ProBinary — Strict Demo and Real Balance Separation Engine
(function () {
  const modeStorageKey = 'probinary_account_mode';
  // Default mode: Real account unless user explicitly toggled to Demo
  let isDemo = localStorage.getItem(modeStorageKey) === 'demo';

  // In-memory database-authoritative balances
  window.databaseRealBalance = parseFloat(localStorage.getItem('probinary_real_balance') || '0.00');
  window.databaseDemoBalance = parseFloat(localStorage.getItem('probinary_demo_balance') || '10000.00');

  const balanceElements = [
    'headerBalanceText',
    'sidebarBalanceAmount',
    'panelBalTiny',
    'pBal',
    'balance',
    'mobHeaderBalance',
    'mobileScannerBalance',
    'mobilePositionsBalance',
    'mainAvailableBal',
    'profileBalanceDisplay'
  ].map(id => document.getElementById(id)).filter(Boolean);

  function formatMoney(amount) {
    const num = Number(amount);
    return Number.isFinite(num) ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  }

  function updateAccountBadges(demo) {
    const modeLabel = demo ? 'DEMO ACCOUNT' : 'REAL ACCOUNT';
    const shortLabel = demo ? 'Demo' : 'Real';

    const realDemoLabel = document.getElementById('realDemoLabel');
    if (realDemoLabel) realDemoLabel.textContent = shortLabel;

    const badgeModeText = document.getElementById('badgeModeText');
    if (badgeModeText) badgeModeText.textContent = modeLabel;

    const accountTypePill = document.getElementById('accountTypePill');
    if (accountTypePill) {
      accountTypePill.textContent = modeLabel;
      accountTypePill.style.background = demo ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      accountTypePill.style.color = demo ? '#e0ccff' : '#10b981';
      accountTypePill.style.borderColor = demo ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.4)';
    }

    const tabDemo = document.getElementById('tabDemo');
    const tabLive = document.getElementById('tabLive');
    if (tabDemo && tabLive) {
      if (demo) {
        tabDemo.classList.add('active');
        tabLive.classList.remove('active');
      } else {
        tabLive.classList.add('active');
        tabDemo.classList.remove('active');
      }
    }

    const realDemoToggle = document.getElementById('realDemoToggle');
    if (realDemoToggle) {
      realDemoToggle.checked = !demo;
    }
  }

  function renderSelectedBalance() {
    updateAccountBadges(isDemo);

    if (isDemo) {
      // Strictly DEMO account balance
      const bal = Number.isFinite(window.databaseDemoBalance) ? window.databaseDemoBalance : 10000.00;
      localStorage.setItem('probinary_demo_balance', bal.toFixed(2));
      localStorage.setItem('probinary_balance', bal.toFixed(2));
      balanceElements.forEach(el => { el.textContent = `$${formatMoney(bal)}`; });
    } else {
      // Strictly REAL account balance (NEVER fallback to demo or default 1000/10000)
      const bal = Number.isFinite(window.databaseRealBalance) ? window.databaseRealBalance : 0.00;
      localStorage.setItem('probinary_real_balance', bal.toFixed(2));
      localStorage.setItem('probinary_balance', bal.toFixed(2));
      balanceElements.forEach(el => { el.textContent = `$${formatMoney(bal)}`; });
    }
  }

  // Account Switcher API
  window.setMode = async function(demo) {
    isDemo = Boolean(demo);
    localStorage.setItem(modeStorageKey, isDemo ? 'demo' : 'real');
    if (typeof window.onAccountModeChanged === 'function') {
      window.onAccountModeChanged(isDemo);
    }
    renderSelectedBalance();
    await window.refreshAccountBalance();
  };

  window.setDatabaseBalance = function(balance) {
    const val = Number(balance);
    if (Number.isFinite(val)) {
      window.databaseRealBalance = val;
      localStorage.setItem('probinary_real_balance', val.toFixed(2));
      if (!isDemo) renderSelectedBalance();
      window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: { realBalance: val, demoBalance: window.databaseDemoBalance } }));
    }
  };

  window.setDatabaseDemoBalance = function(balance) {
    const val = Number(balance);
    if (Number.isFinite(val)) {
      window.databaseDemoBalance = val;
      localStorage.setItem('probinary_demo_balance', val.toFixed(2));
      if (isDemo) renderSelectedBalance();
      window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: { realBalance: window.databaseRealBalance, demoBalance: val } }));
    }
  };

  window.refreshAccountBalance = async function() {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      const response = await fetch('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        return false;
      }
      if (!response.ok) throw new Error('Balance lookup failed');

      const data = await response.json();
      if (!data.success) throw new Error('Invalid balance response');

      // Update REAL balance
      if (Number.isFinite(Number(data.realBalance))) {
        window.databaseRealBalance = Number(data.realBalance);
        localStorage.setItem('probinary_real_balance', window.databaseRealBalance.toFixed(2));
      } else if (Number.isFinite(Number(data.balance)) && !isDemo) {
        window.databaseRealBalance = Number(data.balance);
        localStorage.setItem('probinary_real_balance', window.databaseRealBalance.toFixed(2));
      }

      // Update DEMO balance
      if (Number.isFinite(Number(data.demoBalance))) {
        window.databaseDemoBalance = Number(data.demoBalance);
        localStorage.setItem('probinary_demo_balance', window.databaseDemoBalance.toFixed(2));
      }

      renderSelectedBalance();
      window.dispatchEvent(new CustomEvent('balanceUpdated', {
        detail: { realBalance: window.databaseRealBalance, demoBalance: window.databaseDemoBalance }
      }));
      return true;
    } catch {
      renderSelectedBalance();
      return false;
    }
  };

  // Live SSE Real-Time Balance Stream
  let sseSource = null;
  function connectBalanceStream() {
    const token = localStorage.getItem('auth_token');
    if (!token || typeof EventSource === 'undefined') return;
    if (sseSource) {
      try { sseSource.close(); } catch {}
    }
    try {
      sseSource = new EventSource(`/api/wallet/stream?token=${encodeURIComponent(token)}`);
      sseSource.onmessage = function (event) {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'balance') {
            if (Number.isFinite(Number(payload.realBalance))) {
              window.databaseRealBalance = Number(payload.realBalance);
              localStorage.setItem('probinary_real_balance', window.databaseRealBalance.toFixed(2));
            }
            if (Number.isFinite(Number(payload.demoBalance))) {
              window.databaseDemoBalance = Number(payload.demoBalance);
              localStorage.setItem('probinary_demo_balance', window.databaseDemoBalance.toFixed(2));
            }
            renderSelectedBalance();
            window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: payload }));
          }
        } catch {}
      };
      sseSource.onerror = function () {
        try { sseSource.close(); } catch {}
        sseSource = null;
        setTimeout(connectBalanceStream, 8000);
      };
    } catch {}
  }

  window.addEventListener('storage', event => {
    if (event.key === modeStorageKey) {
      isDemo = event.newValue === 'demo';
      renderSelectedBalance();
    } else if (event.key === 'probinary_real_balance') {
      const val = Number(event.newValue);
      if (Number.isFinite(val)) window.databaseRealBalance = val;
      if (!isDemo) renderSelectedBalance();
    } else if (event.key === 'probinary_demo_balance') {
      const val = Number(event.newValue);
      if (Number.isFinite(val)) window.databaseDemoBalance = val;
      if (isDemo) renderSelectedBalance();
    }
  });

  // Initial render & sync
  renderSelectedBalance();
  window.refreshAccountBalance();
  connectBalanceStream();
  window.setInterval(window.refreshAccountBalance, 12000);
  window.addEventListener('focus', () => {
    window.refreshAccountBalance();
    if (!sseSource) connectBalanceStream();
  });
})();

(function () {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('probinary_user') || '{}');
  } catch {}

  const modeStorageKey = 'probinary_account_mode';
  // Default to real if user has balance or chosen, else support demo
  let isDemo = localStorage.getItem(modeStorageKey) === 'demo';

  const balanceElements = [
    'headerBalanceText',
    'sidebarBalanceAmount',
    'panelBalTiny',
    'pBal',
    'mainAvailableBal',
    'profileBalanceDisplay'
  ].map(id => document.getElementById(id)).filter(Boolean);

  function showBalance(value) {
    const num = Number(value);
    const formatted = Number.isFinite(num) ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    balanceElements.forEach(element => { element.textContent = `$${formatted}`; });
  }

  function getDemoBalance() {
    const storedBalance = localStorage.getItem('probinary_demo_balance');
    if (storedBalance === null) {
      localStorage.setItem('probinary_demo_balance', '10000.00');
      return 10000;
    }
    const balance = Number(storedBalance);
    return Number.isFinite(balance) ? balance : 10000;
  }

  function renderSelectedBalance() {
    if (isDemo) {
      const balance = getDemoBalance();
      localStorage.setItem('probinary_balance', balance.toFixed(2));
      showBalance(balance);
      return;
    }
    if (Number.isFinite(window.databaseWalletBalance)) {
      const balance = window.databaseWalletBalance;
      localStorage.setItem('probinary_balance', balance.toFixed(2));
      showBalance(balance);
    } else {
      const stored = parseFloat(localStorage.getItem('probinary_real_balance') || '0');
      showBalance(stored);
    }
  }

  balanceElements.forEach(element => { element.textContent = 'Loading...'; });

  if (typeof window.setMode === 'function') {
    const setPageMode = window.setMode;
    window.setMode = demo => {
      isDemo = Boolean(demo);
      localStorage.setItem(modeStorageKey, isDemo ? 'demo' : 'real');
      setPageMode(isDemo);
      renderSelectedBalance();
    };
    window.setMode(isDemo);
  } else {
    localStorage.setItem(modeStorageKey, isDemo ? 'demo' : 'real');
    renderSelectedBalance();
  }

  window.setDemoBalance = balance => {
    const amount = Number(balance);
    if (!Number.isFinite(amount) || amount < 0) return false;
    localStorage.setItem('probinary_demo_balance', amount.toFixed(2));
    if (isDemo) {
      localStorage.setItem('probinary_balance', amount.toFixed(2));
      showBalance(amount);
    }
    if (typeof window.setDatabaseDemoBalance === 'function') window.setDatabaseDemoBalance(amount);
    return true;
  };

  window.refreshAccountBalance = async function() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return false;
    }

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
      const balance = Number(data.balance);
      if (!data.success || !Number.isFinite(balance)) throw new Error('Invalid balance response');

      localStorage.setItem('probinary_real_balance', balance.toFixed(2));
      window.databaseWalletBalance = balance;
      if (typeof window.setDatabaseBalance === 'function') window.setDatabaseBalance(balance);
      renderSelectedBalance();
      return true;
    } catch {
      if (isDemo) renderSelectedBalance();
      return false;
    }
  };

  window.addEventListener('storage', event => {
    if (event.key === modeStorageKey) {
      isDemo = event.newValue === 'demo';
      window.setMode?.(isDemo);
      renderSelectedBalance();
    } else if (event.key === 'probinary_real_balance' && !isDemo) {
      const balance = Number(event.newValue);
      if (Number.isFinite(balance)) {
        window.databaseWalletBalance = balance;
        if (typeof window.setDatabaseBalance === 'function') window.setDatabaseBalance(balance);
      }
      renderSelectedBalance();
    } else if (event.key === 'probinary_demo_balance' && isDemo) {
      const balance = Number(event.newValue);
      if (Number.isFinite(balance) && typeof window.setDatabaseDemoBalance === 'function') {
        window.setDatabaseDemoBalance(balance);
      }
      renderSelectedBalance();
    }
  });

  window.refreshAccountBalance();
  window.setInterval(window.refreshAccountBalance, 15000);
  window.addEventListener('focus', window.refreshAccountBalance);
})();

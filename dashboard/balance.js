(function () {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('probinary_user') || '{}');
  } catch {}

  const isSimulation = Boolean(user.simulation || user.is80WinRate || (user.email && user.email.toLowerCase().includes('simulation')));
  const modeStorageKey = 'probinary_account_mode';
  let isDemo = isSimulation && localStorage.getItem(modeStorageKey) !== 'real';
  const balanceElements = [
    'headerBalanceText',
    'sidebarBalanceAmount',
    'panelBalTiny',
    'pBal',
    'mainAvailableBal',
    'profileBalanceDisplay'
  ].map(id => document.getElementById(id)).filter(Boolean);

  function showBalance(value) {
    const formatted = Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    }
  }

  balanceElements.forEach(element => { element.textContent = 'Loading...'; });

  if (!isSimulation) {
    localStorage.setItem(modeStorageKey, 'real');
    document.getElementById('tabDemo')?.remove();
    const demoToggle = document.getElementById('realDemoToggle');
    if (demoToggle) (demoToggle.closest('label') || demoToggle).remove();
    const liveTradingUnavailable = 'Live order execution is not configured for this deployment.';
    ['btnActionRise', 'btnActionFall', 'btnDeployBot'].forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = true;
        button.title = liveTradingUnavailable;
      }
    });
    const tradeStatus = document.getElementById('tradeStatusPrompt');
    if (tradeStatus) tradeStatus.textContent = liveTradingUnavailable;
  }

  if (typeof window.setMode === 'function') {
    const setPageMode = window.setMode;
    window.setMode = demo => {
      isDemo = isSimulation && Boolean(demo);
      localStorage.setItem(modeStorageKey, isDemo ? 'demo' : 'real');
      setPageMode(isDemo);
      renderSelectedBalance();
    };
    window.setMode(isDemo);
  } else {
    localStorage.setItem(modeStorageKey, isDemo ? 'demo' : 'real');
    renderSelectedBalance();
  }

  const withdrawalInputs = {
    executeMpesaWithdrawal: 'mpesaWithUsd',
    executeCryptoWithdrawal: 'cryptoWithUsd',
    executeBankWithdrawal: 'bankWithUsd'
  };
  for (const [name, inputId] of Object.entries(withdrawalInputs)) {
    if (typeof window[name] !== 'function') continue;
    window[name] = () => {
      if (!isDemo) {
        window.alert('Real withdrawals are not configured for this deployment.');
        return;
      }
      const amount = Number(document.getElementById(inputId)?.value);
      const balance = getDemoBalance();
      if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
        window.alert('Enter a valid amount within the demo balance.');
        return;
      }
      window.setDemoBalance(balance - amount);
      window.alert(`Demo balance reduced by $${amount.toFixed(2)}. No payout was made.`);
    };
  }

  window.setDemoBalance = balance => {
    const amount = Number(balance);
    if (!isSimulation || !isDemo || !Number.isFinite(amount) || amount < 0) return false;
    localStorage.setItem('probinary_demo_balance', amount.toFixed(2));
    localStorage.setItem('probinary_balance', amount.toFixed(2));
    if (typeof window.setDatabaseDemoBalance === 'function') window.setDatabaseDemoBalance(amount);
    renderSelectedBalance();
    return true;
  };

  window.refreshAccountBalance = async function() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.replace('/auth/login.html');
      return false;
    }

    try {
      const response = await fetch('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.replace('/auth/login.html');
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
      else balanceElements.forEach(element => { element.textContent = 'Unavailable'; });
      return false;
    }
  };

  window.addEventListener('storage', event => {
    if (event.key === modeStorageKey) {
      window.setMode?.(event.newValue === 'demo');
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
  window.setInterval(window.refreshAccountBalance, 30000);
  window.addEventListener('focus', window.refreshAccountBalance);
})();
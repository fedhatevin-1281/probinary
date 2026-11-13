(function () {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('probinary_user') || '{}');
  } catch {}

  const isSimulation = Boolean(user.simulation || user.is80WinRate || (user.email && user.email.toLowerCase().includes('simulation')));
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

  balanceElements.forEach(element => { element.textContent = 'Loading...'; });

  if (!isSimulation) {
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
    ['executeMpesaWithdrawal', 'executeCryptoWithdrawal', 'executeBankWithdrawal'].forEach(name => {
      if (typeof window[name] === 'function') {
        window[name] = () => window.alert('Withdrawal processing is not configured for this deployment.');
      }
    });
    if (typeof window.setMode === 'function') {
      const setMode = window.setMode;
      setMode(false);
      window.setMode = demo => { if (!demo) setMode(false); };
    }
  }

  async function refreshBalance() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      window.location.replace('/auth/login.html');
      return;
    }

    try {
      const response = await fetch('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.replace('/auth/login.html');
        return;
      }
      if (!response.ok) throw new Error('Balance lookup failed');
      const data = await response.json();
      const balance = Number(data.balance);
      if (!data.success || !Number.isFinite(balance)) throw new Error('Invalid balance response');

      localStorage.setItem('probinary_balance', balance.toFixed(2));
      localStorage.setItem('probinary_real_balance', balance.toFixed(2));
      window.databaseWalletBalance = balance;
      if (typeof window.setDatabaseBalance === 'function') window.setDatabaseBalance(balance);
      showBalance(balance);
    } catch {
      balanceElements.forEach(element => { element.textContent = 'Unavailable'; });
    }
  }

  refreshBalance();
  window.setInterval(refreshBalance, 30000);
})();
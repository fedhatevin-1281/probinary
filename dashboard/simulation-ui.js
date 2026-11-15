(function () {
  const allowed = new Set(['martinluther200024@gmail.com', 'dfirekenyanao@gmail.com']);
  const user = JSON.parse(localStorage.getItem('probinary_user') || '{}');
  const email = String(user.email || '').trim().toLowerCase();
  if (!allowed.has(email)) {
    window.location.href = '/auth/login.html?redirect=%2Fdashboard%2Fsimulation.html&reason=simulation_required';
    return;
  }

  const token = localStorage.getItem('auth_token');
  let mode = localStorage.getItem('probinary_simulation_mode') || 'real';
  let realBalance = 0;
  let demoBalance = 0;
  let pending = false;
  const $ = id => document.getElementById(id);
  const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setStatus = text => { if ($('tradeStatusPrompt')) $('tradeStatusPrompt').textContent = text; };
  if ($('headerSimBadge')) $('headerSimBadge').style.display = 'inline-flex';

  function render() {
    const balance = mode === 'demo' ? demoBalance : realBalance;
    ['headerBalanceText', 'panelBalTiny', 'sidebarBalanceAmount', 'pBal'].forEach(id => { if ($(id)) $(id).textContent = money(balance); });
    if ($('realDemoLabel')) $('realDemoLabel').textContent = mode === 'demo' ? 'Demo' : 'Real';
    if ($('badgeModeText')) $('badgeModeText').textContent = mode === 'demo' ? 'Demo Mode' : 'Real Mode';
    if ($('realDemoToggle')) $('realDemoToggle').checked = mode !== 'demo';
    if ($('tabLive')) $('tabLive').classList.toggle('active', mode !== 'demo');
    if ($('tabDemo')) $('tabDemo').classList.toggle('active', mode === 'demo');
    document.querySelectorAll('.balance-switch-option').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
  }

  async function refreshBalances() {
    const response = await fetch('/api/simulation/balance', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load simulation balances.');
    realBalance = Number(data.realBalance || 0);
    demoBalance = Number(data.demoBalance || 0);
    render();
  }

  window.setMode = function (demo) {
    mode = demo ? 'demo' : 'real';
    localStorage.setItem('probinary_simulation_mode', mode);
    render();
    setStatus(`Switched to ${mode.toUpperCase()} simulation wallet.`);
  };
  window.selectBalanceMode = function (demo, event) {
    event?.stopPropagation();
    window.setMode(demo);
    $('balanceSwitchMenu')?.classList.remove('open');
  };
  window.toggleBalanceMenu = function (event) {
    event?.stopPropagation();
    $('balanceSwitchMenu')?.classList.toggle('open');
  };

  $('realDemoToggle')?.addEventListener('change', event => window.setMode(!event.target.checked));
  $('tabLive')?.addEventListener('click', () => window.setMode(false));
  $('tabDemo')?.addEventListener('click', () => window.setMode(true));

  async function placeSimulationTrade(direction) {
    if (pending) return;
    const stake = Number($('inputStakeVal')?.value || 0);
    const balance = mode === 'demo' ? demoBalance : realBalance;
    if (!Number.isFinite(stake) || stake <= 0 || stake > balance) {
      setStatus(`Insufficient ${mode} simulation balance.`);
      return;
    }
    pending = true;
    setStatus(`SIMULATION ${mode.toUpperCase()} ORDER OPEN: ${direction.toUpperCase()} (3s)`);
    setTimeout(async () => {
      try {
        const response = await fetch('/api/simulation/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode, direction, stake })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Simulation trade failed.');
        realBalance = Number(data.realBalance || 0);
        demoBalance = Number(data.demoBalance || 0);
        const result = data.trade.outcome === 'win' ? 'WIN' : 'LOSS';
        setStatus(`${result} · ${result === 'WIN' ? money(data.trade.payout) + ' returned (' + money(data.trade.profit) + ' profit)' : 'stake lost'} · balance ${money(mode === 'demo' ? demoBalance : realBalance)}`);
        render();
      } catch (error) {
        setStatus(error.message);
      } finally {
        pending = false;
      }
    }, 3000);
  }

  document.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => placeSimulationTrade(button.dataset.direction));
  });
  refreshBalances().catch(error => setStatus(error.message));
})();

(function () {
  const allowed = new Set(['martinluther200024@gmail.com', 'gideonkipngetich606@gmail.com', 'khojainternational@gmail.com', 'dfirekenyanao@gmail.com', 'simulation@probinary.com']);
  const user = JSON.parse(localStorage.getItem('probinary_user') || '{}');
  const email = String(user.email || '').trim().toLowerCase();
  const isSimulationAccount = user.simulation === true || user.is80WinRate === true || allowed.has(email);
  if (!isSimulationAccount) {
    window.location.href = '/auth/login.html?redirect=%2Fdashboard%2Fsimulation.html&reason=simulation_required';
    return;
  }

  const token = localStorage.getItem('auth_token');
  const modeStorageKeys = ['probinary_account_mode', 'probinary_simulation_mode'];
  let mode = localStorage.getItem(modeStorageKeys[0]) || localStorage.getItem(modeStorageKeys[1]) || 'real';
  mode = mode === 'demo' ? 'demo' : 'real';
  modeStorageKeys.forEach(key => localStorage.setItem(key, mode));
  let realBalance = 0;
  let demoBalance = 0;
  let pending = false;
  let tradeType = 'Rise/Fall';
  const actionsByType = {
    'Rise/Fall': [{ label: 'Rise ▲', direction: 'Rise' }, { label: 'Fall ▼', direction: 'Fall' }],
    'Even/Odd': [{ label: 'Even', direction: 'Even' }, { label: 'Odd', direction: 'Odd' }],
    Matches: [{ label: 'Matches', direction: 'Matches' }, { label: 'Differs', direction: 'Differs' }],
    'Over/Under': [{ label: 'Over', direction: 'Over' }, { label: 'Under', direction: 'Under' }],
    'Higher/Lower': [{ label: 'Higher ▲', direction: 'Higher' }, { label: 'Lower ▼', direction: 'Lower' }],
    Touch: [{ label: 'Touch', direction: 'Touch' }, { label: 'No Touch', direction: 'No Touch' }]
  };
  const $ = id => document.getElementById(id);
  const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setStatus = text => { if ($('tradeStatusPrompt')) $('tradeStatusPrompt').textContent = text; };

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
    modeStorageKeys.forEach(key => localStorage.setItem(key, mode));
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

  window.addEventListener('storage', event => {
    if (!modeStorageKeys.includes(event.key)) return;
    mode = event.newValue === 'demo' ? 'demo' : 'real';
    modeStorageKeys.forEach(key => localStorage.setItem(key, mode));
    render();
  });

  function updateContractType(type) {
    if (!Object.prototype.hasOwnProperty.call(actionsByType, type)) return;
    tradeType = type;
    document.querySelectorAll('.type-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.type === tradeType);
    });
    const groupName = {
      Matches: 'digit',
      'Over/Under': 'digit',
      'Higher/Lower': 'offset',
      Touch: 'barrier'
    }[tradeType];
    const panel = $('simulationContractParameters');
    if (panel) {
      panel.hidden = !groupName;
      panel.querySelectorAll('[data-contract-group]').forEach(group => {
        group.hidden = group.dataset.contractGroup !== groupName;
      });
    }
    actionsByType[tradeType].forEach((action, index) => {
      const button = $(index === 0 ? 'btnActionRise' : 'btnActionFall');
      if (!button) return;
      button.dataset.direction = action.direction;
      button.setAttribute('aria-label', action.label);
      const label = button.querySelector('.contract-action-label');
      if (label) label.textContent = action.label;
    });
  }

  document.querySelectorAll('.type-btn').forEach(button => {
    button.addEventListener('click', () => updateContractType(button.dataset.type));
  });

  async function placeSimulationTrade(direction) {
    if (pending) return;
    const stake = Number($('inputStakeVal')?.value || 0);
    const balance = mode === 'demo' ? demoBalance : realBalance;
    if (!Number.isFinite(stake) || stake <= 0 || stake > balance) {
      setStatus(`Insufficient ${mode} simulation balance.`);
      return;
    }
    const contractParameters = {};
    if (tradeType === 'Matches' || tradeType === 'Over/Under') {
      const targetDigit = Number(document.querySelector('[data-contract-parameter="targetDigit"]')?.value);
      if (!Number.isInteger(targetDigit) || targetDigit < 0 || targetDigit > 9) {
        setStatus('Choose a prediction digit from 0 to 9.');
        return;
      }
      contractParameters.targetDigit = targetDigit;
    } else if (tradeType === 'Higher/Lower') {
      const barrierOffset = Number(document.querySelector('[data-contract-parameter="barrierOffset"]')?.value);
      if (!Number.isFinite(barrierOffset) || barrierOffset <= 0) {
        setStatus('Enter a positive barrier offset.');
        return;
      }
      contractParameters.barrierOffset = barrierOffset;
    } else if (tradeType === 'Touch') {
      const barrier = Number(document.querySelector('[data-contract-parameter="touchBarrier"]')?.value);
      if (!Number.isFinite(barrier) || barrier <= 0) {
        setStatus('Enter a valid barrier price.');
        return;
      }
      contractParameters.barrier = barrier;
    }
    pending = true;
    setStatus(`SIMULATION ${mode.toUpperCase()} ORDER OPEN: ${direction.toUpperCase()} (3s)`);
    setTimeout(async () => {
      try {
        const response = await fetch('/api/simulation/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode, direction, stake, tradeType, ...contractParameters })
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
  updateContractType(tradeType);
  refreshBalances().catch(error => setStatus(error.message));
})();

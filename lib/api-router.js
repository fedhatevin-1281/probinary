const crypto = require('crypto');
const db = require('./db');
const { handleAuth, handleWalletBalance, verifyToken, sendJson, readJson } = require('./auth');
const { handleMakamescoPay } = require('./makamescopay');
const { handleNowPayments } = require('./nowpayments');
const { handleAdminApi, handleFinanceMonitorApi } = require('./admin');
const SIMULATION_ACCESS_EMAILS = new Set([
  'martinluther200024@gmail.com',
  'dfirekenyanao@gmail.com'
]);

function hasSimulationAccess(email) {
  return SIMULATION_ACCESS_EMAILS.has(String(email || '').trim().toLowerCase());
}

function getRequestUser(req) {
  const authHeader = (req.headers && (req.headers['authorization'] || req.headers['Authorization'])) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return verifyToken(token);
}

function resolvePathname(req) {
  let pathname = '';
  try {
    const parsed = new URL(req.url, 'http://localhost');
    pathname = parsed.pathname;
  } catch {
    pathname = (req.url || '').split('?')[0];
  }

  // Handle Vercel serverless query path rewriting
  if ((!pathname || pathname === '/' || !pathname.startsWith('/api')) && req.query && req.query.path) {
    const parts = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    pathname = `/api/${parts}`;
  } else if ((!pathname || pathname === '/' || !pathname.startsWith('/api')) && req.headers && req.headers['x-matched-path']) {
    pathname = req.headers['x-matched-path'].split('?')[0];
  }

  // Strip trailing slashes
  return pathname.replace(/\/+$/, '') || '/api';
}

async function handleApi(req, res) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const pathname = resolvePathname(req);

  // 2. M-Pesa routes
  if (pathname.startsWith('/api/mpesa')) {
    return handleMakamescoPay(req, res);
  }

  // 3. Crypto & NOWPayments routes
  if (
    pathname.startsWith('/api/crypto') ||
    pathname.startsWith('/api/payments/nowpayments')
  ) {
    return handleNowPayments(req, res);
  }

  // 4. Authentication routes
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
    return handleAuth(req, res);
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const [wallet, demoWallet] = await Promise.all([
        db.getWallet(user.id).catch(() => ({ current_balance: 0 })),
        db.getDemoWallet(user.id).catch(() => ({ current_balance: 10000 }))
      ]);
      const realBal = Number(wallet.current_balance || 0);
      const demoBal = Number(demoWallet.current_balance ?? 10000);
      user.balance = realBal;
      user.realBalance = realBal;
      user.demoBalance = demoBal;
      return sendJson(res, 200, { success: true, user });
    } catch {
      return sendJson(res, 200, { success: true, user });
    }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    return sendJson(res, 200, { success: true, message: 'Logged out successfully.' });
  }

  // 5. Wallet & Balance routes
  if (pathname === '/api/wallet/stream') {
    let user = getRequestUser(req);
    if (!user) {
      try {
        const parsed = new URL(req.url, 'http://localhost');
        const queryToken = parsed.searchParams.get('token');
        if (queryToken) user = verifyToken(queryToken);
      } catch {}
    }
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

    Promise.all([
      db.getWallet(user.id).catch(() => ({ current_balance: 0 })),
      db.getDemoWallet(user.id).catch(() => ({ current_balance: 10000 }))
    ]).then(([w, dw]) => {
      res.write(`data: ${JSON.stringify({
        type: 'balance',
        realBalance: Number(w.current_balance || 0),
        demoBalance: Number(dw.current_balance ?? 10000)
      })}\n\n`);
    }).catch(() => {});

    const onBalanceUpdate = (event) => {
      if (String(event.userId) === String(user.id)) {
        res.write(`data: ${JSON.stringify({
          type: 'balance',
          realBalance: event.realBalance,
          demoBalance: event.demoBalance,
          updateType: event.type
        })}\n\n`);
      }
    };
    db.balanceEvents.on('update', onBalanceUpdate);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      db.balanceEvents.off('update', onBalanceUpdate);
    });
    return;
  }

  if (pathname === '/api/wallet/balance') {
    return handleWalletBalance(req, res);
  }

  if ((pathname === '/api/wallet/demo/reset' || pathname === '/api/wallet/reset-demo') && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const newBal = await db.resetDemoWallet(user.id);
      return sendJson(res, 200, { success: true, balance: newBal, demoBalance: newBal, message: 'Demo account balance reset to $10,000.00.' });
    } catch {
      return sendJson(res, 500, { error: 'Failed to reset demo balance.' });
    }
  }

  if (pathname === '/api/wallet/transactions' || pathname === '/api/wallet/me/transactions') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const txs = await db.getUserTransactions(user.id);
      return sendJson(res, 200, { success: true, transactions: txs });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Failed to load transaction history.' });
    }
  }

  if (pathname === '/api/wallet/withdraw' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const amount = parseFloat(body.amount) || 0;
    const isDemo = Boolean(body.isDemo);

    if (amount <= 0) {
      return sendJson(res, 400, { error: 'Withdrawal amount must be greater than zero.' });
    }

    if (isDemo) {
      return sendJson(res, 400, { error: 'Virtual demo funds cannot be withdrawn.' });
    }

    try {
      const method = body.method || body.paymentMethod || 'mpesa';
      const dest = body.destination || body.destinationDetails || body.phone || body.address || 'User Account';
      const result = await db.requestWithdrawal({
        userId: user.id,
        amount,
        paymentMethod: method,
        destinationDetails: dest
      });

      return sendJson(res, 200, {
        success: true,
        reference: result.reference,
        balance: result.new_balance,
        message: `Withdrawal request for $${amount.toFixed(2)} submitted successfully. Status: Pending Administrator Approval.`
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Withdrawal request failed.' });
    }
  }

  if (pathname === '/api/wallet/deposit' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const amount = parseFloat(body.amount) || 0;
    const isDemo = Boolean(body.isDemo);

    if (amount <= 0) return sendJson(res, 400, { error: 'Invalid deposit amount.' });

    if (isDemo) {
      const newBal = (body.currentDemoBalance || 10000) + amount;
      return sendJson(res, 200, { success: true, balance: newBal, message: `Demo balance updated by $${amount.toFixed(2)}.` });
    }

    return sendJson(res, 400, { error: 'Live deposits must use the verified M-Pesa or Crypto payment flow.' });
  }

  // 6. Market Quotes
  if (pathname === '/api/market/quotes' && req.method === 'GET') {
    const quotes = {
      'EUR/USD': { price: 1.08420, change: 0.18, high: 1.0865, low: 1.0820, precision: 5 },
      'GBP/USD': { price: 1.29150, change: -0.24, high: 1.2950, low: 1.2890, precision: 5 },
      'USD/JPY': { price: 154.200, change: 0.35, high: 154.60, low: 153.80, precision: 3 },
      'BTC/USD': { price: 91420.50, change: 2.45, high: 92100.0, low: 89800.0, precision: 2 },
      'ETH/USD': { price: 3140.80, change: 1.62, high: 3180.0, low: 3090.0, precision: 2 },
      'XAU/USD': { price: 2684.30, change: 0.54, high: 2695.0, low: 2670.0, precision: 2 },
      'USD/KES': { price: 129.50, change: -0.05, high: 130.00, low: 129.20, precision: 2 },
      'OIL/USD': { price: 74.85, change: -0.80, high: 75.90, low: 74.20, precision: 2 }
    };
    return sendJson(res, 200, { success: true, quotes });
  }

  // 7. Trading API
  if (pathname === '/api/trading/active' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const activeTrades = await db.getActiveTrades(user.id);
      return sendJson(res, 200, { success: true, trades: activeTrades });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Failed to fetch active trades.' });
    }
  }

  if (pathname === '/api/trading/order' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const stake = parseFloat(body.stake) || 0;
    // Respect the account mode selected by the user. Simulation accounts can
    // switch between their persisted demo and real wallets normally.
    const isDemo = Boolean(body.isDemo);

    if (stake <= 0) return sendJson(res, 400, { error: 'Stake must be greater than zero.' });

    try {
      const duration = parseInt(body.duration, 10) || 5;
      const entryPrice = parseFloat(body.entryPrice) || db.getMarketPrice(body.asset || 'EUR/USD');
      const entryDigit = parseInt(String(entryPrice).replace('.', '').slice(-1), 10) || 0;
      const tradeId = body.id || `PB-${crypto.randomUUID()}`;

      const result = await db.executeTrade({
        userId: user.id,
        tradeId,
        symbol: body.asset || 'EUR/USD',
        contractType: body.tradeType || 'Rise/Fall',
        direction: body.direction || body.dir || 'rise',
        stake,
        entryPrice,
        entryDigit,
        duration,
        payoutMultiplier: body.payoutRate ? 1 + Number(body.payoutRate) : 1.87,
        isDemo
      });

      const trade = {
        id: result.tradeId,
        userId: user.id,
        asset: body.asset || 'EUR/USD',
        tradeType: body.tradeType || 'Rise/Fall',
        direction: body.direction || body.dir || 'rise',
        stake,
        entryPrice,
        duration,
        isDemo,
        status: 'open',
        createdAt: new Date().toISOString()
      };

      return sendJson(res, 200, { success: true, trade, balance: result.new_balance });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Failed to place trade.' });
    }
  }

  if (pathname === '/api/trading/settle' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const tradeId = body.tradeId || body.orderId;
    if (!tradeId) return sendJson(res, 400, { error: 'Trade ID is required.' });

    const isDemo = Boolean(body.isDemo);
    let exitPrice = parseFloat(body.exitPrice);

    let tradeRecord = null;
    try {
      const trades = await db.supabaseFetch(`binary_trade_records?id=eq.${encodeURIComponent(tradeId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
      tradeRecord = Array.isArray(trades) ? trades[0] : null;
    } catch {}

    if (tradeRecord && tradeRecord.status !== 'open') {
      return sendJson(res, 200, {
        success: true,
        alreadySettled: true,
        trade: {
          id: tradeId,
          status: tradeRecord.status,
          outcome: tradeRecord.outcome || tradeRecord.status,
          exitPrice: Number(tradeRecord.exit_price),
          payout: Number(tradeRecord.payout || 0),
          profit: Number(tradeRecord.profit || 0),
          settledAt: tradeRecord.settled_at
        }
      });
    }

    const asset = tradeRecord?.market_name || tradeRecord?.symbol || body.asset || 'EUR/USD';
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      exitPrice = db.getMarketPrice(asset);
    }
    const exitDigit = parseInt(String(exitPrice).replace('.', '').slice(-1), 10) || 0;

    const simulationTrade = Boolean(tradeRecord ? tradeRecord.is_demo : isDemo) &&
      (user.simulation === true || user.is80WinRate === true ||
        SIMULATION_ACCESS_EMAILS.has(String(user.email || '').trim().toLowerCase()));
    let evaluation = db.calculateTradeOutcome({
      symbol: asset,
      contractType: tradeRecord?.contract_type || body.tradeType || 'Rise/Fall',
      direction: tradeRecord?.direction || body.direction || 'rise',
      entryPrice: Number(tradeRecord?.entry_price ?? body.entryPrice ?? exitPrice),
      exitPrice,
      barrier: tradeRecord?.barrier,
      isDemo: Boolean(tradeRecord ? tradeRecord.is_demo : isDemo),
      userEmail: user.email,
      stake: Number(tradeRecord?.stake ?? body.stake ?? 10),
      payoutMultiplier: Number(tradeRecord?.payout_multiplier ?? 1.87),
      isSimulationDemo: simulationTrade
    });

    // The simulation UI chooses the outcome locally, but the server must
    // calculate the money values from the stored trade. This keeps the UI and
    // persisted balance consistent while preventing client-supplied payout
    // amounts from being trusted.
    const requestedOutcome = String(body.outcome || '').toLowerCase();
    if (simulationTrade && (requestedOutcome === 'win' || requestedOutcome === 'loss')) {
      const storedStake = Number(tradeRecord?.stake ?? body.stake ?? 10);
      const storedMultiplier = Number(tradeRecord?.payout_multiplier ?? 1.87);
      const isWin = requestedOutcome === 'win';
      const simulationPayout = isWin ? Number((storedStake * storedMultiplier).toFixed(2)) : 0;
      evaluation = {
        outcome: isWin ? 'win' : 'loss',
        payout: simulationPayout,
        profit: isWin ? Number((simulationPayout - storedStake).toFixed(2)) : Number((-storedStake).toFixed(2))
      };
    }

    const outcome = evaluation.outcome;
    const payout = evaluation.payout;
    const profit = evaluation.profit;

    try {
      const settled = await db.settleTrade({
        userId: user.id,
        tradeId,
        exitPrice,
        exitDigit,
        outcome,
        payout,
        profit,
        isDemo: Boolean(tradeRecord ? tradeRecord.is_demo : isDemo)
      });

      return sendJson(res, 200, {
        success: true,
        trade: {
          id: tradeId,
          status: outcome,
          outcome,
          exitPrice,
          payout: settled.payout,
          profit: settled.profit,
          settledAt: new Date().toISOString()
        },
        balance: settled.new_balance
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Failed to settle trade.' });
    }
  }

  if (pathname === '/api/trading/history' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const trades = await db.getUserTrades(user.id);
      return sendJson(res, 200, { success: true, trades });
    } catch {
      return sendJson(res, 200, { success: true, trades: [] });
    }
  }

  // 8. KYC Endpoints
  if (pathname === '/api/kyc/submit' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    try {
      const submission = await db.submitKycSubmission({
        userId: user.id,
        fullName: body.fullName || user.name,
        dob: body.dob || null,
        docNumber: body.docNumber || 'ID-' + Math.floor(100000 + Math.random() * 900000),
        documentType: body.docType || body.documentType || 'national_id',
        frontUrl: body.frontUrl || 'https://probinary.app/docs/front.png',
        backUrl: body.backUrl || null,
        selfieUrl: body.selfieUrl || null
      });

      return sendJson(res, 200, {
        success: true,
        submission,
        status: 'pending',
        message: 'KYC documents submitted successfully. Status: Pending Administrator Verification.'
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Failed to submit KYC documents.' });
    }
  }

  if (pathname === '/api/kyc/status' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    try {
      const kyc = await db.getUserKycStatus(user.id);
      return sendJson(res, 200, {
        success: true,
        status: kyc.status || 'pending',
        rejectionReason: kyc.rejection_reason || null,
        submittedAt: kyc.created_at || null,
        reviewedAt: kyc.reviewed_at || null
      });
    } catch {
      return sendJson(res, 500, { error: 'Failed to check KYC status.' });
    }
  }

  if (pathname === '/api/kyc/fastforward' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      await db.reviewKycSubmission({
        submissionId: 'user_' + user.id,
        action: 'approve',
        adminId: 'system_fastforward'
      });
    } catch {}
    return sendJson(res, 200, {
      success: true,
      message: '12-Hour clearance complete! Account verified for Tier 2 limits ($50,000/day).'
    });
  }

  // 9. Admin Portal API Router
  if (pathname.startsWith('/api/finance-monitor')) {
    const monitorPath = pathname.replace(/^\/api\/finance-monitor\/?/, '');
    return handleFinanceMonitorApi(req, res, monitorPath);
  }

  if (pathname.startsWith('/api/admin')) {
    const adminPath = pathname.replace(/^\/api\/admin\/?/, '');
    return handleAdminApi(req, res, adminPath);
  }

  // 10. Fallback / Health Check
  if (pathname === '/api' || pathname === '/api/') {
    return sendJson(res, 200, {
      service: 'probinary-api',
      version: '1.0.0',
      status: 'healthy',
      time: new Date().toISOString()
    });
  }

  return sendJson(res, 404, { error: `API route not found: ${pathname}` });
}

module.exports = {
  handleApi,
  getRequestUser
};


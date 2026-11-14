const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./lib/db');
const { handleAuth, handleWalletBalance, verifyToken, sendJson, readJson } = require('./lib/auth');
const { handleMakamescoPay } = require('./lib/makamescopay');
const { handleNowPayments } = require('./lib/nowpayments');
const { handleAdminApi } = require('./lib/admin');

// 1. Auto-load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SITE_DIR = path.join(ROOT, 'www.probinary.site');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function getRequestUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return verifyToken(token);
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  let [rawPath] = req.url.split('?');
  let reqUrl = rawPath.split('#')[0];

  // Enable CORS for API routes
  if (reqUrl.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }
  }

  // --- M-PESA & CRYPTO PAYMENT ROUTES ---
  if (reqUrl.startsWith('/api/mpesa/')) {
    return handleMakamescoPay(req, res);
  }

  if ([
    '/api/crypto/create-payment',
    '/api/crypto/status',
    '/api/crypto/verify-payment',
    '/api/crypto/webhook',
    '/api/payments/nowpayments/webhook'
  ].includes(reqUrl)) {
    return handleNowPayments(req, res);
  }

  // --- AUTHENTICATION ---
  if (reqUrl === '/api/auth/login' || reqUrl === '/api/auth/register') {
    return handleAuth(req, res);
  }

  if (reqUrl === '/api/auth/me' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const wallet = await db.getWallet(user.id);
      user.balance = wallet.current_balance;
      return sendJson(res, 200, { success: true, user });
    } catch {
      return sendJson(res, 200, { success: true, user });
    }
  }

  if (reqUrl === '/api/auth/logout' && req.method === 'POST') {
    return sendJson(res, 200, { success: true, message: 'Logged out successfully.' });
  }

  // --- WALLET & BALANCE ---
  if (reqUrl === '/api/wallet/balance') {
    return handleWalletBalance(req, res);
  }

  if (reqUrl === '/api/wallet/transactions' || reqUrl === '/api/wallet/me/transactions') {
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

  if (reqUrl === '/api/wallet/withdraw' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch (e) {
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
      const method = body.method || 'mpesa';
      const dest = body.destination || body.phone || body.address || 'User Account';
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

  if (reqUrl === '/api/wallet/deposit' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch (e) {
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

  // --- TRADING API ---
  if (reqUrl === '/api/market/quotes' && req.method === 'GET') {
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

  if (reqUrl === '/api/trading/order' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const stake = parseFloat(body.stake) || 0;
    const isDemo = Boolean(body.isDemo);

    if (stake <= 0) return sendJson(res, 400, { error: 'Stake must be greater than zero.' });

    try {
      const duration = parseInt(body.duration, 10) || 5;
      const entryPrice = parseFloat(body.entryPrice) || 1.0842;
      const entryDigit = parseInt(String(entryPrice).replace('.', '').slice(-1), 10) || 0;
      const tradeId = body.id || `PB-${crypto.randomUUID()}`;

      const result = await db.executeTrade({
        userId: user.id,
        tradeId,
        symbol: body.asset || 'EUR/USD',
        contractType: body.tradeType || 'Rise/Fall',
        direction: body.direction || 'rise',
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
        direction: body.direction || 'rise',
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

  if (reqUrl === '/api/trading/settle' && req.method === 'POST') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const tradeId = body.tradeId;
    if (!tradeId) return sendJson(res, 400, { error: 'Trade ID is required.' });

    const exitPrice = parseFloat(body.exitPrice) || 1.0845;
    const exitDigit = parseInt(String(exitPrice).replace('.', '').slice(-1), 10) || 0;
    let outcome = body.outcome || 'loss'; // 'win' or 'loss'
    let payout = parseFloat(body.payout) || 0;
    const isDemo = Boolean(body.isDemo);

    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isSimulationAccount && Math.random() < 0.80) {
      outcome = 'win';
      if (payout <= 0) {
        const stake = parseFloat(body.stake) || 10;
        payout = parseFloat((stake * 1.87).toFixed(2));
      }
    }

    const stake = parseFloat(body.stake) || 10;
    const profit = outcome === 'win' ? (payout - stake) : -stake;

    try {
      const settled = await db.settleTrade({
        userId: user.id,
        tradeId,
        exitPrice,
        exitDigit,
        outcome,
        payout: outcome === 'win' ? payout : 0,
        profit,
        isDemo
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

  if (reqUrl === '/api/trading/history' && req.method === 'GET') {
    const user = getRequestUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
    try {
      const trades = await db.getUserTrades(user.id);
      return sendJson(res, 200, { success: true, trades });
    } catch {
      return sendJson(res, 200, { success: true, trades: [] });
    }
  }

  // --- KYC ENDPOINTS ---
  if (reqUrl === '/api/kyc/submit' && req.method === 'POST') {
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
        documentType: body.docType || 'national_id',
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

  if (reqUrl === '/api/kyc/status' && req.method === 'GET') {
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
    } catch (err) {
      return sendJson(res, 500, { error: 'Failed to check KYC status.' });
    }
  }

  // --- ADMIN PORTAL API ROUTER ---
  if (reqUrl.startsWith('/api/admin/')) {
    const adminPath = reqUrl.replace(/^\/api\/admin\/?/, '');
    return handleAdminApi(req, res, adminPath);
  }

  // --- STATIC ROUTING & REWRITES ---
  let filePath = null;

  if (reqUrl === '/' || reqUrl === '' || reqUrl === '/index.html') {
    filePath = path.join(ROOT, 'index.html');
  } else if (reqUrl === '/auth/login' || reqUrl === '/auth/login/' || reqUrl === '/auth/login.html' || reqUrl === '/login' || reqUrl === '/login.html') {
    filePath = path.join(ROOT, 'auth', 'login.html');
  } else if (reqUrl === '/auth/register' || reqUrl === '/auth/register/' || reqUrl === '/auth/register.html' || reqUrl === '/register' || reqUrl === '/register.html') {
    filePath = path.join(ROOT, 'auth', 'register.html');
  } else if (reqUrl === '/dashboard' || reqUrl === '/dashboard/' || reqUrl === '/dashboard/trade' || reqUrl === '/dashboard/trade/' || reqUrl === '/dashboard/trade.html' || reqUrl === '/trade' || reqUrl === '/trade.html') {
    filePath = path.join(ROOT, 'dashboard', 'trade.html');
  } else if (reqUrl === '/dashboard/bot' || reqUrl === '/dashboard/bot/' || reqUrl === '/dashboard/bot.html' || reqUrl === '/bot' || reqUrl === '/bot.html') {
    filePath = path.join(ROOT, 'dashboard', 'bot.html');
  } else if (reqUrl === '/dashboard/deposit' || reqUrl === '/dashboard/deposit/' || reqUrl === '/dashboard/deposit.html' || reqUrl === '/deposit' || reqUrl === '/deposit.html') {
    filePath = path.join(ROOT, 'dashboard', 'deposit.html');
  } else if (reqUrl === '/dashboard/withdraw' || reqUrl === '/dashboard/withdraw/' || reqUrl === '/dashboard/withdraw.html' || reqUrl === '/withdraw' || reqUrl === '/withdraw.html') {
    filePath = path.join(ROOT, 'dashboard', 'withdraw.html');
  } else if (reqUrl === '/dashboard/history' || reqUrl === '/dashboard/history/' || reqUrl === '/dashboard/history.html' || reqUrl === '/history' || reqUrl === '/history.html' || reqUrl === '/dashboard/portfolio' || reqUrl === '/portfolio') {
    filePath = path.join(ROOT, 'dashboard', 'history.html');
  } else if (reqUrl === '/dashboard/profile' || reqUrl === '/dashboard/profile/' || reqUrl === '/dashboard/profile.html' || reqUrl === '/profile' || reqUrl === '/profile.html' || reqUrl === '/kyc') {
    filePath = path.join(ROOT, 'dashboard', 'profile.html');
  } else if (reqUrl === '/dashboard/admin' || reqUrl === '/dashboard/admin/' || reqUrl === '/dashboard/admin.html' || reqUrl === '/admin' || reqUrl === '/admin.html') {
    filePath = path.join(ROOT, 'dashboard', 'admin.html');
  } else {
    let cleanRel = decodeURIComponent(reqUrl).replace(/^[\/\\]+/, '');
    let safeRel = path.normalize(cleanRel).replace(/^(\.\.[\/\\])+/, '');

    // Check root path
    let candidate = path.join(ROOT, safeRel);
    if (fs.existsSync(candidate)) {
      if (fs.statSync(candidate).isDirectory()) {
        const idx = path.join(candidate, 'index.html');
        if (fs.existsSync(idx)) filePath = idx;
      } else {
        filePath = candidate;
      }
    }

    if (!filePath && fs.existsSync(candidate + '.html')) {
      filePath = candidate + '.html';
    }

    // Check SITE_DIR
    if (!filePath) {
      let siteCandidate = path.join(SITE_DIR, safeRel);
      if (fs.existsSync(siteCandidate)) {
        if (fs.statSync(siteCandidate).isDirectory()) {
          const idx = path.join(siteCandidate, 'index.html');
          if (fs.existsSync(idx)) filePath = idx;
        } else {
          filePath = siteCandidate;
        }
      } else if (fs.existsSync(siteCandidate + '.html')) {
        filePath = siteCandidate + '.html';
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>404 — ProBinary</title><style>body{background:#090514;color:#f5f0ff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;text-align:center;}h1{font-size:36px;margin-bottom:8px;background:linear-gradient(135deg,#e0ccff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}p{color:#9d8ec2;margin-bottom:24px;}a{background:linear-gradient(135deg,#e0ccff,#a855f7);color:#090514;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;}</style></head><body><h1>404 · Page Not Found</h1><p>The page you are looking for does not exist.</p><a href="/dashboard/trade.html">Open Trading Desk →</a></body></html>`);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ProBinary Trading Desk Server Online (Supabase Backend)`);
  console.log(`  Website:      http://localhost:${PORT}`);
  console.log(`  Sign In:      http://localhost:${PORT}/auth/login`);
  console.log(`  Register:     http://localhost:${PORT}/auth/register`);
  console.log(`  Trading Desk: http://localhost:${PORT}/dashboard/trade`);
  console.log(`  Admin Portal: http://localhost:${PORT}/dashboard/admin`);
  console.log(`  Supabase URL: ${db.getConfig().url}`);
  console.log(`======================================================\n`);
});

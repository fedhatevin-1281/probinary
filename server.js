const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handleAuth, handleWalletBalance } = require('./lib/auth');
const { handleMakamescoPay } = require('./lib/makamescopay');
const { handleNowPayments } = require('./lib/nowpayments');

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
const JWT_SECRET = process.env.JWT_SECRET || '';
const KYC_FILE = path.join(ROOT, '.kyc.json');

// 2. Supabase Integration Layer (Strict Schema Compliance)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mrctjiyzhozpeyzkduzt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function supabaseFetch(endpoint, options = {}) {
  const pathPart = endpoint.startsWith('/') ? endpoint : `/rest/v1/${endpoint}`;
  const url = new URL(pathPart, SUPABASE_URL);
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };
  if (options.body !== undefined) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  return fetch(url.toString(), fetchOptions);
}

// User & Wallet Helpers (Direct Supabase)
async function sbGetUserByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  try {
    const res = await supabaseFetch(`/rest/v1/users?email=eq.${encodeURIComponent(clean)}&select=id,email,username,password_hash,account_status,created_at,wallets(current_balance,total_deposits,total_withdrawals),user_roles(role_id,roles(name))`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (err) {
    console.error('sbGetUserByEmail error:', err.message);
  }
  return null;
}

async function sbGetUserById(id) {
  if (!id) return null;
  try {
    const res = await supabaseFetch(`/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=id,email,username,password_hash,account_status,created_at,wallets(current_balance,total_deposits,total_withdrawals),user_roles(role_id,roles(name))`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (err) {
    console.error('sbGetUserById error:', err.message);
  }
  return null;
}

async function sbGetAllUsers() {
  try {
    const res = await supabaseFetch(`/rest/v1/users?select=id,email,username,account_status,created_at,wallets(current_balance,total_deposits,total_withdrawals),user_roles(role_id,roles(name))&order=id.asc`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
  } catch (err) {
    console.error('sbGetAllUsers error:', err.message);
  }
  return [];
}

async function sbGetUserBalance(userId) {
  if (!userId) throw new Error('A user ID is required to load a wallet balance');
  try {
    const res = await supabaseFetch(`/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&select=current_balance`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].current_balance !== undefined) {
      const balance = Number(data[0].current_balance);
      if (Number.isFinite(balance)) return balance;
    }
  } catch (err) {
    console.error('sbGetUserBalance error:', err.message);
  }
  throw new Error('Wallet balance is unavailable');
}

async function sbUpdateUserBalance(userId, newBalance, reason = 'Balance adjustment') {
  const balanceNum = Number(Number(newBalance).toFixed(2));
  if (!userId || !Number.isFinite(balanceNum)) throw new Error('A valid user and balance are required');
  try {
    const response = await supabaseFetch(`/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: {
        current_balance: balanceNum,
        updated_at: new Date().toISOString()
      }
    });
    const updatedWallets = await response.json();
    if (!response.ok || !Array.isArray(updatedWallets) || !updatedWallets[0]) {
      throw new Error('Wallet balance update was not confirmed');
    }
    const updatedBalance = Number(updatedWallets[0].current_balance);
    if (!Number.isFinite(updatedBalance)) throw new Error('Supabase returned an invalid wallet balance');

    // Record adjustment entry in transaction_history strictly adhering to schema constraints:
    // transaction_type = 'adjustment', status = 'completed'
    try {
      await supabaseFetch(`/rest/v1/transaction_history`, {
        method: 'POST',
        body: {
          user_id: parseInt(userId, 10),
          transaction_type: 'adjustment',
          amount: balanceNum,
          currency: 'USD',
          status: 'completed',
          payment_reference: 'ADJ-' + Date.now().toString(36).toUpperCase(),
          description: reason
        }
      });
    } catch (e) {
      console.error('Transaction history log error:', e.message);
    }

    return updatedBalance;
  } catch (err) {
    console.error('sbUpdateUserBalance error:', err.message);
    throw err;
  }
}

async function sbAdjustUserBalance(userId, delta, reason = 'Trade settlement / adjustment') {
  const current = await sbGetUserBalance(userId);
  const newBal = Math.max(0, parseFloat((current + delta).toFixed(2)));
  return await sbUpdateUserBalance(userId, newBal, reason);
}

// Completed Deposits from Supabase (manual_wallet_deposits, mpesa_deposits, transaction_history)
async function sbGetCompletedDeposits() {
  try {
    const [resManual, resMpesa, resTx, resUsers] = await Promise.all([
      supabaseFetch(`/rest/v1/manual_wallet_deposits?select=*&order=created_at.desc&limit=50`),
      supabaseFetch(`/rest/v1/mpesa_deposits?status=eq.completed&order=created_at.desc&limit=50`),
      supabaseFetch(`/rest/v1/transaction_history?transaction_type=in.(deposit,mpesa_deposit)&status=eq.completed&order=created_at.desc&limit=50`),
      supabaseFetch(`/rest/v1/users?select=id,email,username`)
    ]);

    const manualData = await resManual.json();
    const mpesaData = await resMpesa.json();
    const txData = await resTx.json();
    const usersData = await resUsers.json();

    const usersMap = {};
    if (Array.isArray(usersData)) {
      usersData.forEach(u => { usersMap[u.id] = u; });
    }

    const deposits = [];
    const seenRefs = new Set();

    if (Array.isArray(manualData)) {
      manualData.forEach(m => {
        const u = usersMap[m.user_id] || {};
        const ref = m.reference || ('DP-' + m.id);
        seenRefs.add(ref);
        deposits.push({
          id: ref,
          userId: m.user_id,
          userEmail: u.email || `Trader #${m.user_id}`,
          userName: u.username || 'Trader',
          amount: parseFloat(m.amount) || 0,
          stake: parseFloat(m.amount) || 0,
          method: m.note || 'Safaricom M-Pesa Instant',
          asset: 'M-Pesa / Safaricom',
          destination: 'Trading Account (USD)',
          createdAt: m.created_at,
          status: 'completed',
          outcome: 'completed'
        });
      });
    }

    if (Array.isArray(mpesaData)) {
      mpesaData.forEach(mp => {
        const u = usersMap[mp.user_id] || {};
        const ref = mp.payment_reference || ('MP-' + mp.id);
        if (!seenRefs.has(ref)) {
          seenRefs.add(ref);
          deposits.push({
            id: ref,
            userId: mp.user_id,
            userEmail: u.email || `Trader #${mp.user_id}`,
            userName: u.username || 'Trader',
            amount: parseFloat(mp.amount) || 0,
            stake: parseFloat(mp.amount) || 0,
            method: `M-Pesa (${mp.phone_number})`,
            asset: 'M-Pesa Safaricom',
            destination: 'Trading Account (KES/USD)',
            createdAt: mp.created_at,
            status: 'completed',
            outcome: 'completed'
          });
        }
      });
    }

    if (Array.isArray(txData)) {
      txData.forEach(t => {
        const u = usersMap[t.user_id] || {};
        const ref = t.payment_reference || ('TX-' + t.id);
        if (!seenRefs.has(ref)) {
          seenRefs.add(ref);
          deposits.push({
            id: ref,
            userId: t.user_id,
            userEmail: u.email || `Trader #${t.user_id}`,
            userName: u.username || 'Trader',
            amount: parseFloat(t.amount) || 0,
            stake: parseFloat(t.amount) || 0,
            method: t.description || 'USDT Crypto Gateway',
            asset: 'Crypto (TRC20)',
            destination: 'Trading Account (USD)',
            createdAt: t.created_at,
            status: t.status || 'completed',
            outcome: 'completed'
          });
        }
      });
    }

    return deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('sbGetCompletedDeposits error:', err.message);
    return [];
  }
}

// Withdrawals from Supabase transaction_history (transaction_type = 'withdrawal')
async function sbGetWithdrawals() {
  try {
    const [resWd, resUsers] = await Promise.all([
      supabaseFetch(`/rest/v1/transaction_history?transaction_type=eq.withdrawal&order=created_at.desc`),
      supabaseFetch(`/rest/v1/users?select=id,email,username`)
    ]);

    const wdData = await resWd.json();
    const usersData = await resUsers.json();
    const usersMap = {};
    if (Array.isArray(usersData)) {
      usersData.forEach(u => { usersMap[u.id] = u; });
    }

    if (Array.isArray(wdData)) {
      return wdData.map(w => {
        const u = usersMap[w.user_id] || {};
        const isFailed = w.status === 'failed';
        const isCompleted = w.status === 'completed';
        const outcome = isCompleted ? 'approved' : (isFailed ? 'rejected' : 'pending');

        return {
          id: w.payment_reference || ('WD-' + w.id),
          txId: w.id,
          userId: w.user_id,
          userEmail: u.email || `Trader #${w.user_id}`,
          userName: u.username || 'Trader',
          amount: parseFloat(w.amount) || 0,
          stake: parseFloat(w.amount) || 0,
          method: w.metadata_json?.method || (w.description?.toLowerCase().includes('crypto') ? 'crypto' : 'mpesa'),
          asset: w.metadata_json?.asset || (w.description?.toLowerCase().includes('crypto') ? 'USDT (TRC20)' : 'M-Pesa Safaricom'),
          destination: w.metadata_json?.destination || w.description || 'User Account',
          createdAt: w.created_at,
          status: w.status,
          outcome: outcome
        };
      });
    }
  } catch (err) {
    console.error('sbGetWithdrawals error:', err.message);
  }
  return [];
}

// 3. KYC Automated Clearance Engine (12-Hour)
function loadKyc() {
  if (!fs.existsSync(KYC_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(KYC_FILE, 'utf-8'));
    let changed = false;
    const now = Date.now();
    for (const id in data) {
      const entry = data[id];
      if (entry && entry.status === 'review') {
        const submitted = new Date(entry.submittedAt || now).getTime();
        const autoApproveTime = entry.autoApproveAt ? new Date(entry.autoApproveAt).getTime() : (submitted + 12 * 3600 * 1000);
        if (now >= autoApproveTime) {
          entry.status = 'verified';
          entry.verifiedAt = new Date().toISOString();
          entry.autoApproved = true;
          changed = true;
        }
      }
    }
    if (changed) {
      try { fs.writeFileSync(KYC_FILE, JSON.stringify(data, null, 2), 'utf-8'); } catch {}
    }
    return data;
  } catch {
    return {};
  }
}

function saveKyc(data) {
  try { fs.writeFileSync(KYC_FILE, JSON.stringify(data, null, 2), 'utf-8'); } catch (err) { console.error('Save KYC error:', err); }
}

function verifyJWT(token) {
  if (!JWT_SECRET) return null;
  try {
    const [header, body, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

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

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

// 5. HTTP Server
const server = http.createServer(async (req, res) => {
  let [rawPath] = req.url.split('?');
  let reqUrl = rawPath.split('#')[0];

  // Enable CORS for API routes
  if (reqUrl.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }
  }

  if (reqUrl === '/api/mpesa/config' || reqUrl === '/api/mpesa/create' || reqUrl === '/api/mpesa/status') {
    return handleMakamescoPay(req, res);
  }
  if (reqUrl === '/api/auth/login' || reqUrl === '/api/auth/register') {
    return handleAuth(req, res);
  }
  if (reqUrl === '/api/wallet/balance') {
    return handleWalletBalance(req, res);
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

  // Helper to extract authenticated user from Authorization header
  function getRequestUser() {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    return verifyJWT(token);
  }

  if (reqUrl === '/api/auth/me' && req.method === 'GET') {
    const user = getRequestUser();
    if (user) {
      const liveBal = await sbGetUserBalance(user.id);
      user.balance = liveBal;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, user }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  }

  if (reqUrl === '/api/auth/logout' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
  }

  // --- TRADING API (binary_trade_records SCHEMA) ---
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, quotes }));
  }

  if (reqUrl === '/api/trading/order' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const stake = parseFloat(body.stake) || 0;
    const isDemo = Boolean(body.isDemo);
    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isDemo && !isSimulationAccount) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Demo mode is unavailable for this account.' }));
    }
    if (!isSimulationAccount) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Live order execution is not configured.' }));
    }

    if (stake <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Stake must be greater than zero' }));
    }

    let currentBalance = isDemo ? (body.demoBalance || 10000) : await sbGetUserBalance(user.id);

    if (!isDemo && currentBalance < stake) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Insufficient balance ($${currentBalance.toFixed(2)}). Please deposit funds or switch to Demo.` }));
    }

    // Deduct stake from Supabase wallet
    let newBalance = isDemo ? (currentBalance - stake) : await sbAdjustUserBalance(user.id, -stake, `Trade opened: ${body.asset || 'EUR/USD'}`);

    const tradeId = 'PB-' + Math.floor(100000 + Math.random() * 900000);
    const duration = parseInt(body.duration) || 5;
    const entryPrice = parseFloat(body.entryPrice) || 1.0842;
    const entryDigit = parseInt(String(entryPrice).replace('.', '').slice(-1)) || 0;

    const trade = {
      id: tradeId,
      userId: user.id,
      userEmail: user.email,
      asset: body.asset || 'EUR/USD',
      tradeType: body.tradeType || 'Rise/Fall',
      direction: body.direction || 'rise',
      targetDigit: body.targetDigit !== undefined ? parseInt(body.targetDigit) : null,
      threshold: body.threshold !== undefined ? parseInt(body.threshold) : null,
      barrier: body.barrier !== undefined ? parseFloat(body.barrier) : null,
      stake: stake,
      payoutRate: body.payoutRate || 0.87,
      potentialPayout: body.potentialPayout || parseFloat((stake * 1.87).toFixed(2)),
      entryPrice: entryPrice,
      duration: duration,
      isDemo: isDemo,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Insert into Supabase binary_trade_records (strictly matching check constraints)
    if (!isDemo) {
      try {
        await supabaseFetch('/rest/v1/binary_trade_records', {
          method: 'POST',
          body: {
            user_id: String(user.id),
            trade_id: tradeId,
            is_demo: false,
            symbol: body.asset || 'EUR/USD',
            market_name: body.asset || 'EUR/USD',
            contract_type: body.tradeType || 'Rise/Fall',
            direction: body.direction || 'rise',
            stake: stake,
            entry_price: entryPrice,
            entry_digit: entryDigit,
            created_at: new Date().toISOString(),
            expiry_at: new Date(Date.now() + duration * 1000).toISOString(),
            expiry_seconds: duration,
            payout_multiplier: 1.87,
            status: 'open',
            result: null
          }
        });
      } catch (e) {
        console.error('Insert binary_trade_records error:', e.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, trade, balance: newBalance }));
  }

  if (reqUrl === '/api/trading/settle' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const tradeId = body.tradeId;
    const exitPrice = parseFloat(body.exitPrice) || 1.0845;
    const exitDigit = parseInt(String(exitPrice).replace('.', '').slice(-1)) || 0;
    let outcome = body.outcome; // 'win' or 'loss'
    let payout = parseFloat(body.payout) || 0;
    const isDemo = Boolean(body.isDemo);
    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isDemo && !isSimulationAccount) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Demo mode is unavailable for this account.' }));
    }
    if (!isSimulationAccount) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Live order settlement is not configured.' }));
    }

    // 80% Win Rate Simulation Engine Check
    if (isSimulationAccount) {
      if (Math.random() < 0.80) {
        outcome = 'win';
        if (payout <= 0) {
          const stake = parseFloat(body.stake) || 10;
          payout = parseFloat((stake * 1.87).toFixed(2));
        }
      }
    }

    const stake = parseFloat(body.stake) || 10;
    const profit = outcome === 'win' ? (payout - stake) : -stake;

    let newBalance;
    if (!isDemo) {
      if (outcome === 'win') {
        newBalance = await sbAdjustUserBalance(user.id, payout, `Trade WON: ${tradeId} (+${profit.toFixed(2)})`);
      } else {
        newBalance = await sbGetUserBalance(user.id);
      }

      // Update Supabase binary_trade_records (status: 'won'|'lost', result: 'won'|'lost')
      try {
        await supabaseFetch(`/rest/v1/binary_trade_records?trade_id=eq.${tradeId}`, {
          method: 'PATCH',
          body: {
            status: outcome === 'win' ? 'won' : 'lost',
            result: outcome === 'win' ? 'won' : 'lost',
            exit_price: exitPrice,
            exit_digit: exitDigit,
            payout: outcome === 'win' ? payout : 0,
            profit: profit,
            settled_at: new Date().toISOString()
          }
        });

        // Insert into transaction_history (transaction_type = 'trade', status = 'completed')
        await supabaseFetch(`/rest/v1/transaction_history`, {
          method: 'POST',
          body: {
            user_id: parseInt(user.id) || 59,
            transaction_type: 'trade',
            amount: Math.abs(profit),
            currency: 'USD',
            status: 'completed',
            payment_reference: tradeId,
            description: `Trade ${outcome.toUpperCase()}: ${tradeId} (${profit >= 0 ? '+' : ''}${profit.toFixed(2)})`
          }
        });
      } catch (err) {
        console.error('Settle trade error in Supabase:', err.message);
      }
    } else {
      newBalance = body.demoBalance !== undefined ? body.demoBalance : 10000;
    }

    const trade = {
      id: tradeId,
      status: 'settled',
      exitPrice: exitPrice,
      outcome: outcome,
      payout: outcome === 'win' ? payout : 0,
      profit: profit,
      settledAt: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, trade, balance: newBalance }));
  }

  if (reqUrl === '/api/trading/cashout' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const tradeId = body.tradeId;
    const currentPrice = parseFloat(body.currentPrice) || 1.0;
    const stake = parseFloat(body.stake) || 10;
    const cashoutAmount = parseFloat((stake * 0.75).toFixed(2));
    const isDemo = Boolean(body.isDemo);
    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isDemo && !isSimulationAccount) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Demo mode is unavailable for this account.' }));
    }
    if (!isSimulationAccount) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Live order cashout is not configured.' }));
    }

    let newBalance;
    if (!isDemo) {
      newBalance = await sbAdjustUserBalance(user.id, cashoutAmount, `Trade cashout: ${tradeId}`);
      try {
        await supabaseFetch(`/rest/v1/binary_trade_records?trade_id=eq.${tradeId}`, {
          method: 'PATCH',
          body: {
            status: 'break_even',
            result: 'break_even',
            exit_price: currentPrice,
            payout: cashoutAmount,
            profit: cashoutAmount - stake,
            settled_at: new Date().toISOString(),
            closure_reason: 'manual_cashout'
          }
        });
      } catch {}
    } else {
      newBalance = (body.demoBalance || 10000) + cashoutAmount;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      trade: { id: tradeId, status: 'settled', outcome: 'cashout', payout: cashoutAmount, profit: cashoutAmount - stake },
      balance: newBalance
    }));
  }

  if (reqUrl === '/api/trading/history' && req.method === 'GET') {
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    try {
      const resTrades = await supabaseFetch(`/rest/v1/binary_trade_records?user_id=eq.${user.id}&order=created_at.desc&limit=50`);
      const trades = await resTrades.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, trades: Array.isArray(trades) ? trades : [] }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, trades: [] }));
    }
  }

  // --- WALLET DEPOSIT & WITHDRAWAL ---
  if (reqUrl === '/api/wallet/deposit' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const amount = parseFloat(body.amount) || 0;
    const isDemo = Boolean(body.isDemo);
    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isDemo && !isSimulationAccount) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Demo mode is unavailable for this account.' }));
    }

    if (amount <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid deposit amount' }));
    }

    if (!isDemo) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Live deposits must use the verified MakamescoPay payment flow' }));
    }
    const newBalance = (body.currentDemoBalance || 0) + amount;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      balance: newBalance,
      message: `Deposit of $${amount.toFixed(2)} completed successfully.`
    }));
  }

  if (reqUrl === '/api/wallet/withdraw' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser();
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    const amount = parseFloat(body.amount) || 0;
    const isDemo = Boolean(body.isDemo);
    const isSimulationAccount = user.is80WinRate || user.simulation || user.email === 'simulation@probinary.com';
    if (isDemo && !isSimulationAccount) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Demo mode is unavailable for this account.' }));
    }

    if (amount <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid withdrawal amount' }));
    }

    if (!isDemo) {
      const current = await sbGetUserBalance(user.id);
      if (current < amount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Insufficient funds ($${current.toFixed(2)}).` }));
      }

      // Reserve the balance in Supabase
      const newBalance = await sbAdjustUserBalance(user.id, -amount, `Withdrawal reserved: ${body.method || 'mpesa'}`);
      const tradeId = 'WD-' + Math.floor(100000 + Math.random() * 900000);
      const methodLabel = body.method === 'crypto' ? `USDT (${(body.network || 'TRC20').toUpperCase()})` : (body.method === 'bank' ? 'Wire Transfer' : 'M-Pesa Instant');
      const destLabel = body.destination || body.phone || body.address || 'User Account';

      // Insert pending withdrawal in transaction_history strictly adhering to schema constraints:
      // transaction_type = 'withdrawal', status = 'pending'
      try {
        await supabaseFetch('/rest/v1/transaction_history', {
          method: 'POST',
          body: {
            user_id: parseInt(user.id) || 59,
            transaction_type: 'withdrawal',
            amount: amount,
            currency: 'USD',
            status: 'pending',
            payment_reference: tradeId,
            description: `Withdrawal via ${methodLabel}: ${destLabel}`,
            metadata_json: { method: body.method, destination: destLabel, tradeId }
          }
        });
      } catch (err) {
        console.error('Insert withdrawal error in Supabase:', err.message);
      }

      const wdTrade = {
        id: tradeId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        type: 'withdrawal',
        asset: methodLabel,
        tradeType: 'Payout',
        direction: 'out',
        stake: amount,
        payout: 0,
        profit: -amount,
        outcome: 'pending',
        status: 'pending',
        method: body.method || 'mpesa',
        destination: destLabel,
        createdAt: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        trade: wdTrade,
        balance: newBalance,
        message: `Withdrawal of $${amount.toFixed(2)} submitted. Status: Pending Administrator Approval.`
      }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Cannot withdraw virtual demo funds' }));
    }
  }

  // --- ADMIN PORTAL API ENDPOINTS ---
  if (reqUrl === '/api/admin/overview' && req.method === 'GET') {
    try {
      const [users, deposits, withdrawals] = await Promise.all([
        sbGetAllUsers(),
        sbGetCompletedDeposits(),
        sbGetWithdrawals()
      ]);

      const totalDepositsAmount = deposits.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
      const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
      const totalPendingWdAmount = pendingWithdrawals.reduce((acc, w) => acc + (parseFloat(w.amount) || 0), 0);

      const approvedWithdrawals = withdrawals.filter(w => w.status === 'completed' || w.outcome === 'approved');
      const totalApprovedWdAmount = approvedWithdrawals.reduce((acc, w) => acc + (parseFloat(w.amount) || 0), 0);

      const kycStore = loadKyc();
      const kycInReview = Object.values(kycStore).filter(k => k.status === 'review');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        stats: {
          totalUsers: users.length,
          totalDepositsAmount: parseFloat(totalDepositsAmount.toFixed(2)),
          totalDepositsCount: deposits.length,
          pendingWithdrawalsAmount: parseFloat(totalPendingWdAmount.toFixed(2)),
          pendingWithdrawalsCount: pendingWithdrawals.length,
          approvedWithdrawalsAmount: parseFloat(totalApprovedWdAmount.toFixed(2)),
          approvedWithdrawalsCount: approvedWithdrawals.length,
          kycReviewCount: kycInReview.length
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to load admin overview from Supabase' }));
    }
  }

  if (reqUrl === '/api/admin/users' && req.method === 'GET') {
    try {
      const users = await sbGetAllUsers();
      const kycStore = loadKyc();

      const safeUsers = users.map(u => {
        const roleName = u.user_roles?.[0]?.roles?.name || '';
        const isAdmin = roleName === 'super_admin' || roleName === 'admin' || u.email === 'admin@probinary.com' || u.email === 'superadmin@probinary.com';
        const isSimulation = u.email === 'simulation@probinary.com' || (u.username && u.username.includes('simulation'));
        const bal = parseFloat(u.wallets?.current_balance ?? (isAdmin ? 25000.00 : (isSimulation ? 10000.00 : 0)));

        return {
          id: u.id,
          name: u.username || (isAdmin ? 'System Administrator' : (isSimulation ? 'Simulation Trader' : u.email.split('@')[0])),
          email: u.email,
          role: isAdmin ? 'admin' : 'trader',
          balance: bal,
          simulation: isSimulation,
          is80WinRate: isSimulation,
          winRate: isSimulation ? 80 : null,
          kycStatus: (kycStore[u.id] && kycStore[u.id].status) || (isSimulation || isAdmin ? 'verified' : 'pending'),
          createdAt: u.created_at
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, users: safeUsers }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to load users from Supabase' }));
    }
  }

  // --- ADMIN BALANCE MODIFICATION ENDPOINT FOR SIMULATION ACCOUNT ---
  if ((reqUrl === '/api/admin/simulation/balance' || reqUrl === '/api/admin/users/update-balance') && req.method === 'POST') {
    const body = await readBody(req);
    const targetEmail = (body.email || 'simulation@probinary.com').trim().toLowerCase();
    let targetUserId = body.userId;

    if (!targetUserId) {
      const targetUser = await sbGetUserByEmail(targetEmail);
      targetUserId = targetUser ? targetUser.id : 59;
    }

    let newBalance;
    if (body.balance !== undefined) {
      newBalance = parseFloat(body.balance);
    } else if (body.delta !== undefined) {
      const current = await sbGetUserBalance(targetUserId);
      newBalance = Math.max(0, current + parseFloat(body.delta));
    } else if (body.amount !== undefined) {
      newBalance = parseFloat(body.amount);
    } else {
      newBalance = 10000.00;
    }

    if (isNaN(newBalance) || newBalance < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid balance amount specified' }));
    }

    // Updates Supabase wallets table directly and writes an 'adjustment' record in transaction_history
    const updated = await sbUpdateUserBalance(targetUserId, newBalance, body.reason || `Admin override balance adjustment`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      userId: targetUserId,
      email: targetEmail,
      balance: updated,
      formattedBalance: '$' + updated.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      message: `Balance for ${targetEmail} updated to $${updated.toLocaleString('en-US', { minimumFractionDigits: 2 })} in Supabase.`
    }));
  }

  if (reqUrl === '/api/admin/deposits' && req.method === 'GET') {
    const deposits = await sbGetCompletedDeposits();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, deposits }));
  }

  if (reqUrl === '/api/admin/withdrawals' && req.method === 'GET') {
    const withdrawals = await sbGetWithdrawals();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, withdrawals }));
  }

  if (reqUrl === '/api/admin/withdrawals/approve' && req.method === 'POST') {
    const body = await readBody(req);
    const tradeId = body.tradeId;

    try {
      // In transaction_history, status must be 'completed'
      await supabaseFetch(`/rest/v1/transaction_history?payment_reference=eq.${tradeId}`, {
        method: 'PATCH',
        body: { status: 'completed', updated_at: new Date().toISOString() }
      });
      await supabaseFetch(`/rest/v1/transaction_history?id=eq.${tradeId}`, {
        method: 'PATCH',
        body: { status: 'completed', updated_at: new Date().toISOString() }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        trade: { id: tradeId, status: 'completed', outcome: 'approved' },
        message: `Withdrawal ${tradeId} has been APPROVED and marked disbursed in Supabase.`
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to approve withdrawal in Supabase' }));
    }
  }

  if (reqUrl === '/api/admin/withdrawals/reject' && req.method === 'POST') {
    const body = await readBody(req);
    const tradeId = body.tradeId;
    const reason = body.reason || 'Compliance verification requirement';

    try {
      const resWd = await supabaseFetch(`/rest/v1/transaction_history?payment_reference=eq.${tradeId}`);
      const wdData = await resWd.json();
      const wd = Array.isArray(wdData) && wdData.length > 0 ? wdData[0] : null;

      let refundAmount = 100;
      let targetUserId = 59;
      if (wd) {
        refundAmount = parseFloat(wd.amount) || 0;
        targetUserId = wd.user_id;
      }

      // In transaction_history schema: status = 'failed'
      await supabaseFetch(`/rest/v1/transaction_history?payment_reference=eq.${tradeId}`, {
        method: 'PATCH',
        body: {
          status: 'failed',
          updated_at: new Date().toISOString(),
          metadata_json: { rejectReason: reason, refunded: true, rejectedAt: new Date().toISOString() }
        }
      });

      // Refund the held stake back to trader's Supabase balance
      const updatedBalance = await sbAdjustUserBalance(targetUserId, refundAmount, `Refund for rejected withdrawal: ${tradeId}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        trade: { id: tradeId, status: 'rejected', rejectReason: reason },
        refundedBalance: updatedBalance,
        message: `Withdrawal ${tradeId} was rejected and $${refundAmount.toFixed(2)} was refunded to user's wallet in Supabase.`
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to reject withdrawal in Supabase' }));
    }
  }

  // --- KYC VERIFICATION ENDPOINTS (12-Hour Automated Clearance Engine) ---
  if (reqUrl === '/api/kyc/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser() || { id: 59, email: 'simulation@probinary.com', name: 'Simulation Trader' };
    const kycStore = loadKyc();
    const now = Date.now();
    const autoApproveAt = new Date(now + 12 * 3600 * 1000).toISOString();

    kycStore[user.id] = {
      userId: user.id,
      userEmail: user.email,
      fullName: body.fullName || user.name || 'Simulation Trader',
      dob: body.dob || '1995-07-19',
      docType: body.docType || 'National ID',
      docNumber: body.docNumber || 'ID-SIM-889102',
      status: 'review',
      submittedAt: new Date(now).toISOString(),
      autoApproveAt: autoApproveAt
    };
    saveKyc(kycStore);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      status: 'review',
      autoApproveAt: autoApproveAt,
      message: 'KYC documents received. Automated compliance review active — approval automatically clears in 12 hours.'
    }));
  }

  if (reqUrl === '/api/kyc/status' && req.method === 'GET') {
    const user = getRequestUser() || { id: 59 };
    const kycStore = loadKyc();
    const entry = kycStore[user.id];
    const status = entry ? entry.status : 'verified';
    const now = Date.now();
    let remainingSeconds = 0;
    if (entry && entry.status === 'review') {
      const autoApproveTime = entry.autoApproveAt ? new Date(entry.autoApproveAt).getTime() : (new Date(entry.submittedAt || now).getTime() + 12 * 3600 * 1000);
      remainingSeconds = Math.max(0, Math.floor((autoApproveTime - now) / 1000));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      status,
      submittedAt: entry ? entry.submittedAt : null,
      autoApproveAt: entry ? entry.autoApproveAt : null,
      remainingSeconds,
      remainingHoursFormatted: `${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m`
    }));
  }

  if (reqUrl === '/api/kyc/approve-demo' && req.method === 'POST') {
    const user = getRequestUser() || { id: 59 };
    const kycStore = loadKyc();
    kycStore[user.id] = {
      ...(kycStore[user.id] || {}),
      userId: user.id,
      status: 'verified',
      verifiedAt: new Date().toISOString()
    };
    saveKyc(kycStore);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, status: 'verified', message: 'Identity verified successfully!' }));
  }

  if ((reqUrl === '/api/kyc/fastforward' || reqUrl === '/api/admin/kyc/fastforward') && req.method === 'POST') {
    const body = await readBody(req);
    const user = getRequestUser() || { id: 59 };
    const kycStore = loadKyc();
    const targetId = body.userId || user.id || 59;
    if (kycStore[targetId]) {
      // Simulate 12.5 hours passing
      kycStore[targetId].submittedAt = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
      kycStore[targetId].autoApproveAt = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
      saveKyc(kycStore);
      const updated = loadKyc();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        status: updated[targetId]?.status || 'verified',
        message: 'Fast-forward complete: 12-hour review period elapsed. KYC status automatically verified!'
      }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, status: 'verified', message: 'Fast-forward complete.' }));
  }

  if (reqUrl === '/api/admin/kyc/queue' && req.method === 'GET') {
    const kycStore = loadKyc();
    const now = Date.now();
    const queue = [];
    for (const userId in kycStore) {
      const k = kycStore[userId];
      const submitted = new Date(k.submittedAt || now).getTime();
      const autoApproveTime = k.autoApproveAt ? new Date(k.autoApproveAt).getTime() : (submitted + 12 * 3600 * 1000);
      const remainingSeconds = Math.max(0, Math.floor((autoApproveTime - now) / 1000));
      queue.push({
        ...k,
        remainingSeconds,
        remainingHoursFormatted: `${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m`
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, queue }));
  }

  if (reqUrl === '/api/admin/kyc/approve' && req.method === 'POST') {
    const body = await readBody(req);
    const userId = body.userId || 59;
    const kycStore = loadKyc();
    if (kycStore[userId]) {
      kycStore[userId].status = 'verified';
      kycStore[userId].verifiedAt = new Date().toISOString();
      kycStore[userId].adminOverride = true;
      saveKyc(kycStore);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: `KYC for ${userId} manually verified by Administrator.` }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'KYC record not found' }));
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
    
    // Check root path first
    let candidate = path.join(ROOT, safeRel);
    if (fs.existsSync(candidate)) {
      if (fs.statSync(candidate).isDirectory()) {
        const idx = path.join(candidate, 'index.html');
        if (fs.existsSync(idx)) filePath = idx;
      } else {
        filePath = candidate;
      }
    }
    
    // Check with .html extension
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
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`======================================================\n`);
});

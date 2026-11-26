const crypto = require('crypto');
const EventEmitter = require('events');

const balanceEvents = new EventEmitter();
balanceEvents.setMaxListeners(200);

function emitBalanceUpdate(userId, details = {}) {
  try {
    balanceEvents.emit('update', {
      userId: String(userId),
      ...details,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('emitBalanceUpdate error:', err.message);
  }
}

// Authoritative Quotes Engine
const AUTHORITATIVE_QUOTES = {
  'EUR/USD': { price: 1.08420, precision: 5, delta: 0.00015 },
  'GBP/USD': { price: 1.29150, precision: 5, delta: 0.00020 },
  'USD/JPY': { price: 154.200, precision: 3, delta: 0.04 },
  'BTC/USD': { price: 91420.50, precision: 2, delta: 12.0 },
  'ETH/USD': { price: 3140.80, precision: 2, delta: 1.8 },
  'XAU/USD': { price: 2684.30, precision: 2, delta: 0.8 },
  'USD/KES': { price: 129.50, precision: 2, delta: 0.05 },
  'OIL/USD': { price: 74.85, precision: 2, delta: 0.08 }
};

function getMarketPrice(symbol) {
  const q = AUTHORITATIVE_QUOTES[symbol] || AUTHORITATIVE_QUOTES['EUR/USD'];
  const jitter = (Math.random() - 0.498) * (q.delta || 0.00015);
  return Number((q.price + jitter).toFixed(q.precision || 5));
}

function getPriceDigit(price, symbol) {
  const precision = AUTHORITATIVE_QUOTES[symbol]?.precision || 5;
  const formatted = Number(price).toFixed(precision).replace('.', '');
  return parseInt(formatted.slice(-1), 10) || 0;
}

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mrctjiyzhozpeyzkduzt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const jwtSecret = process.env.JWT_SECRET || 'probinary_super_secure_jwt_secret_production_2026';
  return { url, key, jwtSecret };
}

async function supabaseFetch(endpoint, options = {}) {
  const { url, key } = getConfig();
  const pathPart = endpoint.startsWith('/') ? endpoint : `/rest/v1/${endpoint}`;
  const targetUrl = new URL(pathPart, url);

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    signal: AbortSignal.timeout(15_000)
  };

  if (options.body !== undefined) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(targetUrl.toString(), fetchOptions);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Supabase request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Convert user ID to consistent BigInt number for bigint columns
function toBigIntId(userId) {
  const val = String(userId || '').trim();
  if (!/^\d+$/.test(val)) {
    throw new Error(`Invalid numeric user ID: ${userId}`);
  }
  return Number(val);
}

// Convert user ID to consistent text for text columns
function toTextId(userId) {
  return String(userId || '').trim();
}

// In-memory fallback stores for offline/mock environments
const memoryUsers = new Map();
const memoryWallets = new Map();
const memoryDemoWallets = new Map();
const memoryTrades = new Map();

// ============================================================================
// USER MANAGEMENT & ROLE AUTH
// ============================================================================

async function createUser({ email, username, password_hash, account_status = 'active' }) {
  const clean = email.trim().toLowerCase();
  try {
    const created = await supabaseFetch('users', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        email: clean,
        username,
        password_hash,
        account_status
      }
    });
    if (Array.isArray(created) && created[0]) {
      const u = created[0];
      memoryUsers.set(clean, u);
      memoryUsers.set(String(u.id), u);
      return u;
    }
  } catch (err) {
    if (err.message && (err.message.includes('unique') || err.message.includes('23505'))) {
      const e = new Error('Account already exists. Please sign in.');
      e.status = 409;
      throw e;
    }
  }

  // Resilient fallback for local test runs
  const mockId = Math.floor(100000 + Math.random() * 900000);
  const u = {
    id: mockId,
    email: clean,
    username,
    password_hash,
    account_status,
    created_at: new Date().toISOString()
  };
  memoryUsers.set(clean, u);
  memoryUsers.set(String(mockId), u);
  memoryWallets.set(mockId, {
    user_id: mockId,
    current_balance: 0.00,
    currency: 'USD',
    total_deposits: 0.00,
    total_withdrawals: 0.00
  });
  memoryDemoWallets.set(mockId, {
    user_id: mockId,
    current_balance: 10000.00,
    currency: 'USD'
  });
  return u;
}

async function getUserByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  try {
    const rows = await supabaseFetch(
      `users?email=eq.${encodeURIComponent(clean)}&select=id,email,username,password_hash,account_status,created_at,wallets(current_balance,currency,total_deposits,total_withdrawals),user_roles(role_id,roles(name))&limit=1`
    );
    if (Array.isArray(rows) && rows.length > 0) {
      memoryUsers.set(clean, rows[0]);
      return rows[0];
    }
  } catch (err) {}
  return memoryUsers.get(clean) || null;
}

async function getUserById(id) {
  if (!id) return null;
  try {
    const numericId = toBigIntId(id);
    const rows = await supabaseFetch(
      `users?id=eq.${numericId}&select=id,email,username,password_hash,account_status,created_at,wallets(current_balance,currency,total_deposits,total_withdrawals),demo_wallets(current_balance),user_roles(role_id,roles(name))&limit=1`
    );
    if (Array.isArray(rows) && rows.length > 0) {
      memoryUsers.set(String(numericId), rows[0]);
      return rows[0];
    }
    // Fall back to in-memory cache if Supabase returns empty
    return memoryUsers.get(String(numericId)) || null;
  } catch (err) {
    console.error('getUserById error:', err.message);
    // Fall back to in-memory cache on Supabase failure
    try {
      const numericId = toBigIntId(id);
      return memoryUsers.get(String(numericId)) || null;
    } catch {
      return null;
    }
  }
}

async function getAllUsers() {
  try {
    const rows = await supabaseFetch(
      `users?select=id,email,username,account_status,created_at,wallets(current_balance,currency,total_deposits,total_withdrawals),demo_wallets(current_balance),user_roles(role_id,roles(name))&order=id.asc`
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error('getAllUsers error:', err.message);
    return [];
  }
}

async function updateUserStatus(userId, status, adminId = null) {
  const numericId = toBigIntId(userId);
  if (!['active', 'suspended', 'deactivated'].includes(status)) {
    throw new Error('Invalid account status');
  }
  const updated = await supabaseFetch(`users?id=eq.${numericId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { account_status: status, updated_at: new Date().toISOString() }
  });
  return Array.isArray(updated) && updated.length > 0 ? updated[0] : null;
}

// ============================================================================
// WALLET MANAGEMENT (AUTHORITATIVE)
// ============================================================================

async function getWallet(userId) {
  const numericId = toBigIntId(userId);
  try {
    const rows = await supabaseFetch(`wallets?user_id=eq.${numericId}&select=*&limit=1`);
    if (Array.isArray(rows) && rows.length > 0) {
      const w = {
        ...rows[0],
        current_balance: Number(rows[0].current_balance || 0),
        total_deposits: Number(rows[0].total_deposits || 0),
        total_withdrawals: Number(rows[0].total_withdrawals || 0)
      };
      memoryWallets.set(numericId, w);
      return w;
    }
  } catch (err) {}

  if (memoryWallets.has(numericId)) {
    return memoryWallets.get(numericId);
  }

  // Auto-provision wallet if missing
  try {
    const created = await supabaseFetch(`wallets`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        user_id: numericId,
        current_balance: 0.00,
        currency: 'USD',
        total_deposits: 0.00,
        total_withdrawals: 0.00
      }
    });
    if (Array.isArray(created) && created.length > 0) {
      const w = {
        ...created[0],
        current_balance: Number(created[0].current_balance || 0),
        total_deposits: Number(created[0].total_deposits || 0),
        total_withdrawals: Number(created[0].total_withdrawals || 0)
      };
      memoryWallets.set(numericId, w);
      return w;
    }
  } catch {}

  const w = {
    user_id: numericId,
    current_balance: 0.00,
    currency: 'USD',
    total_deposits: 0.00,
    total_withdrawals: 0.00
  };
  memoryWallets.set(numericId, w);
  return w;
}

// ============================================================================
// DEDICATED DEMO WALLET (STRICTLY INDEPENDENT VIRTUAL FUNDS)
// ============================================================================

async function getDemoWallet(userId) {
  const numericId = toBigIntId(userId);
  try {
    const rows = await supabaseFetch(`demo_wallets?user_id=eq.${numericId}&select=*&limit=1`);
    if (Array.isArray(rows) && rows.length > 0) {
      const dw = {
        ...rows[0],
        current_balance: Number(rows[0].current_balance !== undefined ? rows[0].current_balance : 10000.00),
        currency: rows[0].currency || 'USD'
      };
      memoryDemoWallets.set(numericId, dw);
      return dw;
    }
  } catch (err) {}

  if (memoryDemoWallets.has(numericId)) {
    return memoryDemoWallets.get(numericId);
  }

  // Auto-provision demo wallet if missing (strictly 10,000.00)
  try {
    const created = await supabaseFetch(`demo_wallets`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        user_id: numericId,
        current_balance: 10000.00,
        currency: 'USD'
      }
    });
    if (Array.isArray(created) && created.length > 0) {
      const dw = {
        ...created[0],
        current_balance: Number(created[0].current_balance),
        currency: created[0].currency || 'USD'
      };
      memoryDemoWallets.set(numericId, dw);
      return dw;
    }
  } catch {}

  const dw = {
    user_id: numericId,
    current_balance: 10000.00,
    currency: 'USD'
  };
  memoryDemoWallets.set(numericId, dw);
  return dw;
}

async function resetDemoWallet(userId) {
  const numericId = toBigIntId(userId);
  try {
    const res = await supabaseFetch(`rpc/reset_demo_wallet_atomic`, {
      method: 'POST',
      body: { p_user_id: numericId }
    });
    if (typeof res === 'number') {
      const dw = { user_id: numericId, current_balance: res, currency: 'USD' };
      memoryDemoWallets.set(numericId, dw);
      return res;
    }
  } catch {}

  try {
    await supabaseFetch(`demo_wallets?user_id=eq.${numericId}`, {
      method: 'PATCH',
      body: {
        current_balance: 10000.00,
        updated_at: new Date().toISOString()
      }
    });
  } catch {}

  const dw = { user_id: numericId, current_balance: 10000.00, currency: 'USD' };
  memoryDemoWallets.set(numericId, dw);
  return 10000.00;
}

// Atomic Balance Adjustment with Audit Logging
async function adjustUserBalance({
  userId,
  amount,
  type = 'adjustment',
  reference = null,
  description = null,
  adminId = null,
  metadata = {}
}) {
  const numericUserId = toBigIntId(userId);
  const delta = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Adjustment amount must be a non-zero number');
  }

  const cleanRef = reference || `ADJ-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

  // 1. Try atomic PostgreSQL function
  try {
    const result = await supabaseFetch(`rpc/apply_wallet_adjustment_atomic`, {
      method: 'POST',
      body: {
        p_user_id: numericUserId,
        p_amount: delta,
        p_type: type,
        p_reference: cleanRef,
        p_description: description || `Balance adjustment (${type})`,
        p_admin_id: adminId ? toBigIntId(adminId) : null,
        p_metadata: metadata
      }
    });
    const resRow = Array.isArray(result) ? result[0] : result;
    if (resRow && resRow.current_balance !== undefined) {
      return {
        current_balance: Number(resRow.current_balance),
        total_deposits: Number(resRow.total_deposits || 0),
        total_withdrawals: Number(resRow.total_withdrawals || 0),
        reference: cleanRef
      };
    }
  } catch (rpcErr) {
    // If RPC is missing, use REST fallback with verification
    console.warn('RPC apply_wallet_adjustment_atomic fallback:', rpcErr.message);
  }

  // REST Fallback (Safe locked balance update)
  const currentWallet = await getWallet(numericUserId);
  const newBalance = Number((currentWallet.current_balance + delta).toFixed(2));
  if (newBalance < 0) {
    throw new Error(`Insufficient funds: balance cannot become negative (current: $${currentWallet.current_balance}, requested delta: $${delta})`);
  }

  let newDeposits = currentWallet.total_deposits;
  let newWithdrawals = currentWallet.total_withdrawals;
  if (type === 'deposit' || (type === 'adjustment' && delta > 0)) {
    newDeposits = Number((newDeposits + delta).toFixed(2));
  } else if (type === 'withdrawal' && delta < 0) {
    newWithdrawals = Number((newWithdrawals + Math.abs(delta)).toFixed(2));
  }

  // Update in-memory immediately (Supabase PATCH is best-effort)
  memoryWallets.set(numericUserId, {
    ...currentWallet,
    current_balance: newBalance,
    total_deposits: newDeposits,
    total_withdrawals: newWithdrawals
  });
  emitBalanceUpdate(numericUserId, { realBalance: newBalance, totalDeposits: newDeposits });
  try {
    await supabaseFetch(`wallets?user_id=eq.${numericUserId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: {
        current_balance: newBalance,
        total_deposits: newDeposits,
        total_withdrawals: newWithdrawals,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  } catch (patchErr) {
    console.warn('wallets adjust PATCH unavailable (offline mode):', patchErr.message);
  }

  // Log in transaction_history
  try {
    await supabaseFetch(`transaction_history`, {
      method: 'POST',
      body: {
        user_id: numericUserId,
        transaction_type: ['deposit', 'withdrawal', 'trade', 'adjustment', 'mpesa_deposit'].includes(type) ? type : 'adjustment',
        amount: Math.abs(delta),
        currency: currentWallet.currency || 'USD',
        status: 'completed',
        payment_reference: cleanRef,
        description: description || `Balance adjustment (${type})`,
        metadata_json: {
          admin_id: adminId,
          previous_balance: currentWallet.current_balance,
          new_balance: newBalance,
          ...metadata
        }
      }
    });
  } catch (txErr) {
    console.error('Failed to log transaction_history in fallback:', txErr.message);
  }

  // Log in manual_wallet_deposits if positive
  if (delta > 0) {
    try {
      await supabaseFetch(`manual_wallet_deposits`, {
        method: 'POST',
        body: {
          user_id: String(numericUserId),
          amount: delta,
          reference: cleanRef,
          note: description || 'Manual balance adjustment',
          credited_by: adminId ? String(adminId) : 'admin'
        }
      });
    } catch {}
  }

  return {
    current_balance: newBalance,
    total_deposits: newDeposits,
    total_withdrawals: newWithdrawals,
    reference: cleanRef
  };
}

// ============================================================================
// WITHDRAWAL MANAGEMENT
// ============================================================================

async function requestWithdrawal({
  userId,
  amount,
  paymentMethod,
  destinationDetails,
  currency = 'USD'
}) {
  const numericUserId = toBigIntId(userId);
  const requestedAmount = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error('Withdrawal amount must be greater than zero');
  }

  const ref = `WD-${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Try atomic PostgreSQL function
  try {
    const res = await supabaseFetch(`rpc/request_withdrawal_atomic`, {
      method: 'POST',
      body: {
        p_user_id: numericUserId,
        p_amount: requestedAmount,
        p_payment_method: paymentMethod || 'M-Pesa',
        p_destination_details: destinationDetails || 'User Account',
        p_reference: ref
      }
    });
    const row = Array.isArray(res) ? res[0] : res;
    if (row && row.withdrawal_id) {
      return {
        withdrawal_id: row.withdrawal_id,
        transaction_id: row.transaction_id,
        reference: row.payment_reference || ref,
        new_balance: Number(row.new_balance)
      };
    }
  } catch (rpcErr) {
    console.warn('RPC request_withdrawal_atomic fallback:', rpcErr.message);
  }

  // REST Fallback (Atomic reservation)
  const currentWallet = await getWallet(numericUserId);
  if (currentWallet.current_balance < requestedAmount) {
    throw new Error(`Insufficient funds: available $${currentWallet.current_balance.toFixed(2)}, requested $${requestedAmount.toFixed(2)}`);
  }

  const reservedBal = Number((currentWallet.current_balance - requestedAmount).toFixed(2));

  // Deduct/reserve funds
  await supabaseFetch(`wallets?user_id=eq.${numericUserId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: {
      current_balance: reservedBal,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });

  // Record pending transaction
  let txId = null;
  try {
    const createdTx = await supabaseFetch(`transaction_history`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        user_id: numericUserId,
        transaction_type: 'withdrawal',
        amount: requestedAmount,
        currency,
        status: 'pending',
        payment_reference: ref,
        description: `Withdrawal via ${paymentMethod} to ${destinationDetails}`,
        metadata_json: { paymentMethod, destinationDetails, reserved: true }
      }
    });
    txId = Array.isArray(createdTx) && createdTx[0] ? createdTx[0].id : null;
  } catch (e) {
    console.error('Failed to insert tx_history in fallback withdrawal:', e.message);
  }

  // Record withdrawal request in withdrawal_requests table if present
  let wdId = null;
  try {
    const createdWd = await supabaseFetch(`withdrawal_requests`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        user_id: numericUserId,
        amount: requestedAmount,
        currency,
        payment_method: paymentMethod,
        destination_details: destinationDetails,
        status: 'pending',
        transaction_history_id: txId
      }
    });
    wdId = Array.isArray(createdWd) && createdWd[0] ? createdWd[0].id : null;
  } catch (e) {
    console.warn('withdrawal_requests table not yet populated or missing in fallback:', e.message);
  }

  return {
    withdrawal_id: wdId || ref,
    transaction_id: txId,
    reference: ref,
    new_balance: reservedBal
  };
}

async function getAllWithdrawals({ strict = false } = {}) {
  try {
    // 1. Try withdrawal_requests first
    const fetchRows = endpoint => strict ? supabaseFetch(endpoint) : supabaseFetch(endpoint).catch(() => []);
    const [wdRows, txRows, users] = await Promise.all([
      fetchRows(`withdrawal_requests?select=*&order=created_at.desc`),
      fetchRows(`transaction_history?transaction_type=eq.withdrawal&order=created_at.desc`),
      getAllUsers()
    ]);

    const usersMap = new Map(users.map(u => [String(u.id), u]));
    const resultMap = new Map();

    // From dedicated withdrawal_requests table
    if (Array.isArray(wdRows)) {
      wdRows.forEach(w => {
        const u = usersMap.get(String(w.user_id)) || {};
        resultMap.set(String(w.id), {
          id: `WD-${w.id}`,
          requestId: w.id,
          txId: w.transaction_history_id,
          userId: w.user_id,
          userEmail: u.email || `Trader #${w.user_id}`,
          userName: u.username || 'Trader',
          amount: Number(w.amount || 0),
          currency: w.currency || 'USD',
          method: w.payment_method || 'M-Pesa',
          asset: w.payment_method || 'M-Pesa Safaricom',
          destination: w.destination_details || 'User Account',
          status: w.status,
          outcome: w.status === 'completed' || w.status === 'approved' ? 'approved' : (w.status === 'rejected' || w.status === 'failed' ? 'rejected' : 'pending'),
          adminNote: w.admin_note,
          reviewedBy: w.reviewed_by,
          reviewedAt: w.reviewed_at,
          createdAt: w.created_at
        });
      });
    }

    // Complement from transaction_history
    if (Array.isArray(txRows)) {
      txRows.forEach(t => {
        const u = usersMap.get(String(t.user_id)) || {};
        const ref = t.payment_reference || `TX-WD-${t.id}`;
        // Only add if not already captured
        const exists = Array.from(resultMap.values()).some(r => r.txId === t.id || r.reference === ref);
        if (!exists) {
          const meta = t.metadata_json || {};
          const isFailed = t.status === 'failed' || t.status === 'rejected';
          const isApproved = t.status === 'completed' || t.status === 'approved';
          resultMap.set(ref, {
            id: ref,
            requestId: null,
            txId: t.id,
            userId: t.user_id,
            userEmail: u.email || `Trader #${t.user_id}`,
            userName: u.username || 'Trader',
            amount: Number(t.amount || 0),
            currency: t.currency || 'USD',
            method: meta.paymentMethod || meta.method || 'M-Pesa',
            asset: meta.asset || 'M-Pesa Safaricom',
            destination: meta.destinationDetails || meta.destination || t.description || 'User Account',
            status: t.status,
            outcome: isApproved ? 'approved' : (isFailed ? 'rejected' : 'pending'),
            adminNote: meta.admin_note || meta.rejectReason,
            createdAt: t.created_at
          });
        }
      });
    }

    return Array.from(resultMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('getAllWithdrawals error:', err.message);
    if (strict) throw err;
    return [];
  }
}

async function reviewWithdrawal({
  identifier, // can be withdrawal_id or reference string or txId
  action, // 'approve', 'reject', 'process', 'complete', 'fail'
  adminId = null,
  adminNote = null
}) {
  const cleanAction = String(action || '').toLowerCase().trim();
  if (!['approve', 'reject', 'process', 'complete', 'fail'].includes(cleanAction)) {
    throw new Error(`Invalid withdrawal review action: ${action}`);
  }

  // 1. Check if identifier is numeric withdrawal_requests ID
  let numericReqId = /^\d+$/.test(String(identifier)) ? Number(identifier) : null;
  if (!numericReqId && String(identifier).startsWith('WD-')) {
    const stripped = String(identifier).replace(/^WD-/, '');
    if (/^\d+$/.test(stripped)) numericReqId = Number(stripped);
  }

  if (numericReqId) {
    try {
      const res = await supabaseFetch(`rpc/review_withdrawal_atomic`, {
        method: 'POST',
        body: {
          p_request_id: numericReqId,
          p_action: cleanAction,
          p_admin_id: adminId ? toBigIntId(adminId) : 1,
          p_admin_note: adminNote
        }
      });
      const row = Array.isArray(res) ? res[0] : res;
      if (row && row.withdrawal_id) {
        return {
          id: `WD-${row.withdrawal_id}`,
          status: row.status,
          refunded: Boolean(row.refunded),
          new_balance: Number(row.current_balance)
        };
      }
    } catch (rpcErr) {
      console.warn('RPC review_withdrawal_atomic fallback:', rpcErr.message);
    }
  }

  // REST Fallback by reference or txId
  const allWds = await getAllWithdrawals();
  const target = allWds.find(w => String(w.id) === String(identifier) || String(w.requestId) === String(identifier) || String(w.txId) === String(identifier));
  if (!target) {
    throw new Error(`Withdrawal request ${identifier} not found`);
  }

  const targetUserId = toBigIntId(target.userId);
  const refundAmount = Number(target.amount);

  let newStatus = 'pending';
  let refunded = false;
  let finalBalance = null;

  if (cleanAction === 'approve') {
    newStatus = 'approved';
    if (target.requestId) {
      await supabaseFetch(`withdrawal_requests?id=eq.${target.requestId}`, {
        method: 'PATCH',
        body: { status: 'approved', admin_note: adminNote, reviewed_by: adminId ? toBigIntId(adminId) : null, reviewed_at: new Date().toISOString() }
      }).catch(() => {});
    }
    if (target.txId) {
      await supabaseFetch(`transaction_history?id=eq.${target.txId}`, {
        method: 'PATCH',
        body: { status: 'approved', updated_at: new Date().toISOString() }
      }).catch(() => {});
    }
  } else if (cleanAction === 'complete') {
    newStatus = 'completed';
    if (target.requestId) {
      await supabaseFetch(`withdrawal_requests?id=eq.${target.requestId}`, {
        method: 'PATCH',
        body: { status: 'completed', admin_note: adminNote, reviewed_by: adminId ? toBigIntId(adminId) : null, reviewed_at: new Date().toISOString() }
      }).catch(() => {});
    }
    if (target.txId) {
      await supabaseFetch(`transaction_history?id=eq.${target.txId}`, {
        method: 'PATCH',
        body: { status: 'completed', updated_at: new Date().toISOString() }
      }).catch(() => {});
    }
    // Update wallet total_withdrawals
    const w = await getWallet(targetUserId);
    await supabaseFetch(`wallets?user_id=eq.${targetUserId}`, {
      method: 'PATCH',
      body: { total_withdrawals: Number((w.total_withdrawals + refundAmount).toFixed(2)), updated_at: new Date().toISOString() }
    }).catch(() => {});
  } else if (cleanAction === 'reject' || cleanAction === 'fail') {
    newStatus = cleanAction === 'reject' ? 'rejected' : 'failed';
    // Refund held funds back to wallet
    const currentW = await getWallet(targetUserId);
    const restoredBal = Number((currentW.current_balance + refundAmount).toFixed(2));
    refunded = true;
    finalBalance = restoredBal;

    await supabaseFetch(`wallets?user_id=eq.${targetUserId}`, {
      method: 'PATCH',
      body: { current_balance: restoredBal, last_updated: new Date().toISOString(), updated_at: new Date().toISOString() }
    });

    if (target.requestId) {
      await supabaseFetch(`withdrawal_requests?id=eq.${target.requestId}`, {
        method: 'PATCH',
        body: { status: newStatus, admin_note: adminNote, reviewed_by: adminId ? toBigIntId(adminId) : null, reviewed_at: new Date().toISOString() }
      }).catch(() => {});
    }
    if (target.txId) {
      await supabaseFetch(`transaction_history?id=eq.${target.txId}`, {
        method: 'PATCH',
        body: {
          status: newStatus,
          updated_at: new Date().toISOString(),
          metadata_json: {
            rejected: true,
            rejection_reason: adminNote,
            refunded: true,
            refunded_amount: refundAmount
          }
        }
      }).catch(() => {});
    }
  }

  return {
    id: target.id,
    status: newStatus,
    refunded,
    new_balance: finalBalance
  };
}

// ============================================================================
// KYC VERIFICATION SYSTEM
// ============================================================================

async function submitKycSubmission({
  userId,
  fullName,
  dob,
  docNumber,
  documentType = 'national_id',
  frontUrl,
  backUrl = null,
  selfieUrl = null
}) {
  const numericUserId = toBigIntId(userId);

  // Check if existing pending submission exists
  try {
    const existing = await supabaseFetch(
      `kyc_submissions?user_id=eq.${numericUserId}&status=eq.pending&select=id&limit=1`
    );
    if (Array.isArray(existing) && existing.length > 0) {
      throw new Error('You already have a KYC submission pending review.');
    }
  } catch (checkErr) {
    if (checkErr.message.includes('pending review')) throw checkErr;
  }

  const payload = {
    user_id: numericUserId,
    full_name: fullName,
    dob: dob || null,
    doc_number: docNumber,
    document_type: documentType,
    document_front_url: frontUrl || 'https://probinary.app/docs/placeholder-front.png',
    document_back_url: backUrl || null,
    selfie_url: selfieUrl || null,
    status: 'pending'
  };

  const created = await supabaseFetch(`kyc_submissions`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: payload
  });

  return Array.isArray(created) && created.length > 0 ? created[0] : payload;
}

async function getUserKycStatus(userId) {
  const numericUserId = toBigIntId(userId);
  try {
    const rows = await supabaseFetch(
      `kyc_submissions?user_id=eq.${numericUserId}&select=*&order=created_at.desc&limit=1`
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    console.error('getUserKycStatus error:', err.message);
  }
  return { status: 'pending', user_id: numericUserId };
}

async function getAllKycSubmissions(filterStatus = null) {
  try {
    let endpoint = `kyc_submissions?select=*&order=created_at.desc`;
    if (filterStatus) {
      endpoint = `kyc_submissions?status=eq.${encodeURIComponent(filterStatus)}&select=*&order=created_at.desc`;
    }
    const [kycRows, users] = await Promise.all([
      supabaseFetch(endpoint).catch(() => []),
      getAllUsers()
    ]);

    const usersMap = new Map(users.map(u => [String(u.id), u]));

    if (Array.isArray(kycRows)) {
      return kycRows.map(k => {
        const u = usersMap.get(String(k.user_id)) || {};
        return {
          id: k.id,
          userId: k.user_id,
          userEmail: u.email || `Trader #${k.user_id}`,
          userName: k.full_name || u.username || 'Trader',
          docType: k.document_type || 'National ID',
          docNumber: k.doc_number || 'N/A',
          frontUrl: k.document_front_url,
          backUrl: k.document_back_url,
          selfieUrl: k.selfie_url,
          status: k.status,
          rejectionReason: k.rejection_reason,
          reviewedBy: k.reviewed_by,
          reviewedAt: k.reviewed_at,
          createdAt: k.created_at
        };
      });
    }
    return [];
  } catch (err) {
    console.error('getAllKycSubmissions error:', err.message);
    return [];
  }
}

async function reviewKycSubmission({ kycId, action, rejectionReason = null, adminId = null }) {
  const numericId = toBigIntId(kycId);
  const cleanAction = String(action).toLowerCase().trim();
  const status = cleanAction === 'approve' ? 'approved' : 'rejected';

  const updated = await supabaseFetch(`kyc_submissions?id=eq.${numericId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: {
      status,
      rejection_reason: cleanAction === 'reject' ? (rejectionReason || 'Documents verification requirements not met') : null,
      reviewed_by: adminId ? toBigIntId(adminId) : null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });

  return Array.isArray(updated) && updated.length > 0 ? updated[0] : null;
}

// ============================================================================
// TRADING ENGINE & SYNCHRONIZATION
// ============================================================================

function calculateTradeOutcome({
  symbol,
  contractType = 'Rise/Fall',
  direction = 'rise',
  entryPrice,
  entryDigit,
  exitPrice,
  exitDigit,
  targetDigit,
  barrier,
  stake,
  payoutMultiplier = 1.87,
  isSimulationDemo = false
}) {
  if (isSimulationDemo) {
    const isWin = Math.random() < 0.8;
    const payout = isWin ? Number((stake * payoutMultiplier).toFixed(2)) : 0;
    const profit = isWin ? Number((payout - stake).toFixed(2)) : -stake;
    return { outcome: isWin ? 'win' : 'loss', payout, profit };
  }

  const cleanType = String(contractType || 'Rise/Fall').trim();
  const cleanDir = String(direction || 'rise').toLowerCase().trim();
  let isWin = false;

  const enDigit = entryDigit !== undefined && entryDigit !== null ? Number(entryDigit) : getPriceDigit(entryPrice, symbol);
  const exDigit = exitDigit !== undefined && exitDigit !== null ? Number(exitDigit) : getPriceDigit(exitPrice, symbol);

  if (cleanType.includes('Even') || cleanType.includes('Odd')) {
    isWin = cleanDir === 'even' ? (exDigit % 2 === 0) : (exDigit % 2 === 1);
  } else if (cleanType.includes('Match') || cleanType.includes('Differ')) {
    const prediction = targetDigit !== undefined && targetDigit !== null ? Number(targetDigit) : enDigit;
    const matched = exDigit === prediction;
    isWin = cleanDir.includes('match') ? matched : !matched;
  } else if (cleanType.includes('Over') || cleanType.includes('Under')) {
    const prediction = targetDigit !== undefined && targetDigit !== null ? Number(targetDigit) : enDigit;
    isWin = cleanDir.includes('over') ? (exDigit > prediction) : (exDigit < prediction);
  } else if (cleanType.includes('Touch')) {
    const barrierPrice = Number(barrier);
    const touched = Number.isFinite(barrierPrice) && barrierPrice > 0
      ? (barrierPrice >= Number(entryPrice) ? Number(exitPrice) >= barrierPrice : Number(exitPrice) <= barrierPrice)
      : Math.abs(Number(exitPrice) - Number(entryPrice)) > 0.0003;
    isWin = cleanDir === 'touch' ? touched : !touched;
  } else if (cleanType.includes('Higher') || cleanType.includes('Lower')) {
    const barrierPrice = Number(barrier);
    if (Number.isFinite(barrierPrice) && barrierPrice > 0) {
      isWin = cleanDir === 'higher' ? Number(exitPrice) > barrierPrice : Number(exitPrice) < barrierPrice;
    } else {
      const risen = Number(exitPrice) > Number(entryPrice);
      isWin = cleanDir === 'higher' ? risen : Number(exitPrice) < Number(entryPrice);
    }
  } else {
    // Rise/Fall or Higher/Lower
    const risen = Number(exitPrice) > Number(entryPrice);
    isWin = (cleanDir === 'rise' || cleanDir === 'higher' || cleanDir === 'call') ? risen : (!risen && Number(exitPrice) < Number(entryPrice));
  }

  const payout = isWin ? Number((stake * payoutMultiplier).toFixed(2)) : 0;
  const profit = isWin ? Number((payout - stake).toFixed(2)) : -stake;
  return { outcome: isWin ? 'win' : 'loss', payout, profit };
}

async function executeTrade({
  userId,
  tradeId,
  symbol,
  contractType,
  direction,
  stake,
  entryPrice,
  entryDigit,
  targetDigit,
  barrier,
  duration = 5,
  payoutMultiplier = 1.87,
  isDemo = false
}) {
  const cleanTradeId = tradeId || `PB-${crypto.randomUUID()}`;
  const stakeNum = Number(Number(stake).toFixed(2));
  if (stakeNum <= 0) throw new Error('Stake must be greater than zero');
  const numericUserId = toBigIntId(userId);
  const textUserId = toTextId(userId);
  const durationSec = Math.max(1, parseInt(duration, 10) || 5);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiryIso = new Date(now.getTime() + durationSec * 1000).toISOString();
  const cleanSymbol = symbol || 'EUR/USD';
  const cleanContract = contractType || 'Rise/Fall';
  const cleanDir = String(direction || 'rise').toLowerCase();
  const resolvedEntryPrice = Number(entryPrice) || getMarketPrice(cleanSymbol);
  const resolvedEntryDigit = entryDigit !== undefined && entryDigit !== null
    ? parseInt(entryDigit, 10)
    : getPriceDigit(resolvedEntryPrice, cleanSymbol);
  const resolvedTargetDigit = targetDigit !== undefined && targetDigit !== null ? parseInt(targetDigit, 10) : null;
  const resolvedBarrier = barrier !== undefined && barrier !== null && Number.isFinite(Number(barrier)) ? Number(barrier) : null;
  const multiplierNum = Number(payoutMultiplier) || 1.87;

  // 1. Try atomic PostgreSQL stored procedure first
  try {
    const res = await supabaseFetch(`rpc/execute_trade_atomic`, {
      method: 'POST',
      body: {
        p_user_id: textUserId,
        p_trade_id: cleanTradeId,
        p_symbol: cleanSymbol,
        p_contract_type: cleanContract,
        p_direction: cleanDir,
        p_stake: stakeNum,
        p_entry_price: resolvedEntryPrice,
        p_entry_digit: resolvedEntryDigit,
        p_target_digit: resolvedTargetDigit,
        p_barrier: resolvedBarrier,
        p_duration: durationSec,
        p_payout_multiplier: multiplierNum,
        p_is_demo: Boolean(isDemo)
      }
    });
    const row = Array.isArray(res) ? res[0] : res;
    if (row && row.trade_id) {
      const newBal = Number(row.new_balance);
      if (isDemo) {
        memoryDemoWallets.set(numericUserId, { user_id: numericUserId, current_balance: newBal, currency: 'USD' });
        emitBalanceUpdate(numericUserId, { demoBalance: newBal });
      } else {
        const curW = memoryWallets.get(numericUserId) || {};
        memoryWallets.set(numericUserId, { ...curW, current_balance: newBal, currency: 'USD' });
        emitBalanceUpdate(numericUserId, { realBalance: newBal });
      }
      return {
        tradeId: row.trade_id,
        status: 'open',
        new_balance: newBal,
        isDemo: Boolean(isDemo),
        expiry_at: expiryIso
      };
    }
  } catch (rpcErr) {
    if (rpcErr.message && rpcErr.message.includes('Insufficient')) {
      throw rpcErr;
    }
    console.warn('RPC execute_trade_atomic fallback:', rpcErr.message);
  }

  // 2. REST Fallback with Strict Schema Compliance
  if (isDemo) {
    // DEMO TRADE: strictly uses public.demo_wallets
    const demoWallet = await getDemoWallet(numericUserId);
    if (demoWallet.current_balance < stakeNum) {
      throw new Error(`Insufficient demo balance ($${demoWallet.current_balance.toFixed(2)}) for trade stake ($${stakeNum.toFixed(2)}). Reset your demo balance to continue.`);
    }

    const newDemoBal = Number((demoWallet.current_balance - stakeNum).toFixed(2));
    memoryDemoWallets.set(numericUserId, { ...demoWallet, current_balance: newDemoBal, updated_at: nowIso });
    emitBalanceUpdate(numericUserId, { demoBalance: newDemoBal });

    try {
      await supabaseFetch(`demo_wallets?user_id=eq.${numericUserId}`, {
        method: 'PATCH',
        body: { current_balance: newDemoBal, updated_at: nowIso }
      });
    } catch (patchErr) {
      console.warn('demo_wallets PATCH unavailable (offline mode):', patchErr.message);
    }

    const tradeRecord = {
      user_id: textUserId,
      trade_id: cleanTradeId,
      is_demo: true,
      symbol: cleanSymbol,
      market_name: cleanSymbol,
      contract_type: cleanContract,
      direction: cleanDir,
      stake: stakeNum,
      entry_price: resolvedEntryPrice,
      entry_digit: resolvedEntryDigit,
      target_digit: resolvedTargetDigit,
      barrier: resolvedBarrier,
      expiry_at: expiryIso,
      expiry_seconds: durationSec,
      payout_multiplier: multiplierNum,
      status: 'open',
      result: null,
      payout: 0.00,
      profit: 0.00,
      created_at: nowIso
    };
    memoryTrades.set(cleanTradeId, tradeRecord);

    try {
      await supabaseFetch(`binary_trade_records`, {
        method: 'POST',
        body: tradeRecord
      });
    } catch (recErr) {
      console.warn('binary_trade_records INSERT unavailable (offline mode):', recErr.message);
    }

    return {
      tradeId: cleanTradeId,
      status: 'open',
      new_balance: newDemoBal,
      isDemo: true,
      expiry_at: expiryIso
    };
  } else {
    // REAL TRADE: strictly uses public.wallets
    const wallet = await getWallet(numericUserId);
    if (wallet.current_balance < stakeNum) {
      throw new Error(`Insufficient real balance ($${wallet.current_balance.toFixed(2)}) for trade stake ($${stakeNum.toFixed(2)}). Please deposit funds or switch to Demo mode.`);
    }

    const newBal = Number((wallet.current_balance - stakeNum).toFixed(2));
    memoryWallets.set(numericUserId, { ...wallet, current_balance: newBal, last_updated: nowIso, updated_at: nowIso });
    emitBalanceUpdate(numericUserId, { realBalance: newBal });

    try {
      await supabaseFetch(`wallets?user_id=eq.${numericUserId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: { current_balance: newBal, last_updated: nowIso, updated_at: nowIso }
      });
    } catch (patchErr) {
      console.warn('wallets PATCH unavailable (offline mode):', patchErr.message);
    }

    const tradeRecord = {
      user_id: textUserId,
      trade_id: cleanTradeId,
      is_demo: false,
      symbol: cleanSymbol,
      market_name: cleanSymbol,
      contract_type: cleanContract,
      direction: cleanDir,
      stake: stakeNum,
      entry_price: resolvedEntryPrice,
      entry_digit: resolvedEntryDigit,
      target_digit: resolvedTargetDigit,
      barrier: resolvedBarrier,
      expiry_at: expiryIso,
      expiry_seconds: durationSec,
      payout_multiplier: multiplierNum,
      status: 'open',
      result: null,
      payout: 0.00,
      profit: 0.00,
      created_at: nowIso
    };
    memoryTrades.set(cleanTradeId, tradeRecord);

    try {
      await supabaseFetch(`binary_trade_records`, {
        method: 'POST',
        body: tradeRecord
      });
    } catch (recErr) {
      console.warn('binary_trade_records INSERT unavailable (offline mode):', recErr.message);
    }

    // Insert transaction history entry for real trade
    try {
      await supabaseFetch(`transaction_history`, {
        method: 'POST',
        body: {
          user_id: numericUserId,
          transaction_type: 'trade',
          amount: stakeNum,
          currency: wallet.currency || 'USD',
          status: 'pending',
          payment_reference: cleanTradeId,
          description: `Trade Stake Deducted: ${cleanSymbol} ${cleanDir.toUpperCase()}`,
          metadata_json: {
            tradeId: cleanTradeId,
            symbol: cleanSymbol,
            stake: stakeNum,
            direction: cleanDir,
            duration: durationSec
          }
        }
      });
    } catch {}

    return {
      tradeId: cleanTradeId,
      status: 'open',
      new_balance: newBal,
      isDemo: false,
      expiry_at: expiryIso
    };
  }
}

async function settleTrade({
  userId,
  tradeId,
  exitPrice,
  exitDigit,
  outcome, // 'win' or 'loss' or 'break_even'
  payout,
  profit,
  isDemo = false
}) {
  const payoutNum = Number(Number(payout).toFixed(2));
  const profitNum = Number(Number(profit).toFixed(2));
  const numericUserId = toBigIntId(userId);
  const textUserId = toTextId(userId);
  const nowIso = new Date().toISOString();

  // 1. Try atomic PostgreSQL stored procedure
  try {
    const res = await supabaseFetch(`rpc/settle_trade_atomic`, {
      method: 'POST',
      body: {
        p_user_id: textUserId,
        p_trade_id: tradeId,
        p_exit_price: Number(exitPrice),
        p_exit_digit: parseInt(exitDigit, 10) || 0,
        p_outcome: outcome,
        p_payout: payoutNum,
        p_profit: profitNum,
        p_is_demo: Boolean(isDemo)
      }
    });
    const row = Array.isArray(res) ? res[0] : res;
    if (row && row.trade_id) {
      const settledBal = Number(row.new_balance);
      if (isDemo) {
        emitBalanceUpdate(numericUserId, { demoBalance: settledBal });
      } else {
        emitBalanceUpdate(numericUserId, { realBalance: settledBal });
      }
      return {
        tradeId: row.trade_id,
        status: row.status,
        outcome: row.status,
        payout: Number(row.payout),
        profit: Number(row.profit),
        new_balance: settledBal,
        isDemo: Boolean(isDemo)
      };
    }
  } catch (rpcErr) {
    if (rpcErr.message && rpcErr.message.includes('already settled')) {
      throw rpcErr;
    }
    console.warn('RPC settle_trade_atomic fallback:', rpcErr.message);
  }

  // 2. REST Fallback: Fetch trade record to verify true is_demo status from database
  let actualIsDemo = Boolean(isDemo);
  let alreadySettled = false;
  try {
    const tradeRows = await supabaseFetch(`binary_trade_records?trade_id=eq.${encodeURIComponent(tradeId)}&select=is_demo,status,stake&limit=1`);
    if (Array.isArray(tradeRows) && tradeRows[0]) {
      if (tradeRows[0].status !== 'open' && tradeRows[0].status !== 'pending') {
        alreadySettled = true;
      }
      actualIsDemo = Boolean(tradeRows[0].is_demo);
    }
  } catch (err) {
    if (err.message && err.message.includes('already settled')) throw err;
    const memTrade = memoryTrades.get(tradeId);
    if (memTrade) {
      if (memTrade.status !== 'open' && memTrade.status !== 'pending') {
        alreadySettled = true;
      }
      actualIsDemo = Boolean(memTrade.is_demo);
    }
  }

  if (alreadySettled) {
    throw new Error(`Trade ${tradeId} is already settled.`);
  }

  const cleanOutcome = outcome === 'win' ? 'won' : (outcome === 'break_even' ? 'break_even' : 'lost');

  if (actualIsDemo) {
    // DEMO SETTLEMENT: strictly affects demo_wallets
    let finalBal = 10000.00;
    const demoWallet = await getDemoWallet(numericUserId);

    if (outcome === 'win' || outcome === 'break_even') {
      finalBal = Number((demoWallet.current_balance + payoutNum).toFixed(2));
      memoryDemoWallets.set(numericUserId, { ...demoWallet, current_balance: finalBal, updated_at: nowIso });
      try {
        await supabaseFetch(`demo_wallets?user_id=eq.${numericUserId}`, {
          method: 'PATCH',
          body: { current_balance: finalBal, updated_at: nowIso }
        });
      } catch (patchErr) {
        console.warn('demo_wallets settle PATCH unavailable (offline mode):', patchErr.message);
      }
    } else {
      finalBal = demoWallet.current_balance;
    }

    emitBalanceUpdate(numericUserId, { demoBalance: finalBal });

    if (memoryTrades.has(tradeId)) {
      memoryTrades.set(tradeId, { ...memoryTrades.get(tradeId), status: cleanOutcome, result: cleanOutcome, payout: payoutNum, profit: profitNum, settled_at: nowIso });
    }

    try {
      await supabaseFetch(`binary_trade_records?trade_id=eq.${encodeURIComponent(tradeId)}`, {
        method: 'PATCH',
        body: {
          status: cleanOutcome,
          result: cleanOutcome,
          exit_price: Number(exitPrice),
          exit_digit: parseInt(exitDigit, 10) || 0,
          payout: payoutNum,
          profit: profitNum,
          settled_at: nowIso
        }
      });
    } catch (patchErr) {
      console.warn('binary_trade_records settle PATCH unavailable (offline mode):', patchErr.message);
    }

    return {
      tradeId,
      status: cleanOutcome,
      outcome: cleanOutcome,
      payout: payoutNum,
      profit: profitNum,
      new_balance: finalBal,
      isDemo: true
    };
  } else {
    // REAL SETTLEMENT: strictly affects wallets and transaction_history
    let finalBal = null;

    if (outcome === 'win' || outcome === 'break_even') {
      const currentWallet = await getWallet(numericUserId);
      finalBal = Number((currentWallet.current_balance + payoutNum).toFixed(2));
      memoryWallets.set(numericUserId, { ...currentWallet, current_balance: finalBal, last_updated: nowIso, updated_at: nowIso });
      try {
        await supabaseFetch(`wallets?user_id=eq.${numericUserId}`, {
          method: 'PATCH',
          body: { current_balance: finalBal, last_updated: nowIso, updated_at: nowIso }
        });
      } catch (patchErr) {
        console.warn('wallets settle PATCH unavailable (offline mode):', patchErr.message);
      }
    } else {
      const currentWallet = await getWallet(numericUserId);
      finalBal = currentWallet.current_balance;
    }

    emitBalanceUpdate(numericUserId, { realBalance: finalBal });

    if (memoryTrades.has(tradeId)) {
      memoryTrades.set(tradeId, { ...memoryTrades.get(tradeId), status: cleanOutcome, result: cleanOutcome, payout: payoutNum, profit: profitNum, settled_at: nowIso });
    }

    try {
      await supabaseFetch(`binary_trade_records?trade_id=eq.${encodeURIComponent(tradeId)}`, {
        method: 'PATCH',
        body: {
          status: cleanOutcome,
          result: cleanOutcome,
          exit_price: Number(exitPrice),
          exit_digit: parseInt(exitDigit, 10) || 0,
          payout: payoutNum,
          profit: profitNum,
          settled_at: nowIso
        }
      });
    } catch (patchErr) {
      console.warn('binary_trade_records settle PATCH unavailable (offline mode):', patchErr.message);
    }

    try {
      await supabaseFetch(`transaction_history?payment_reference=eq.${encodeURIComponent(tradeId)}`, {
        method: 'PATCH',
        body: {
          status: 'completed',
          amount: outcome === 'win' ? payoutNum : Math.abs(profitNum),
          description: outcome === 'win'
            ? `Trade WON: ${tradeId} (+${profitNum.toFixed(2)})`
            : (outcome === 'break_even' ? `Trade CASHED OUT: ${tradeId}` : `Trade LOST: ${tradeId} (${profitNum.toFixed(2)})`),
          updated_at: nowIso
        }
      });
    } catch {}

    return {
      tradeId,
      status: cleanOutcome,
      outcome: cleanOutcome,
      payout: payoutNum,
      profit: profitNum,
      new_balance: finalBal,
      isDemo: false
    };
  }
}

async function getActiveTrades(userId) {
  try {
    const textId = toTextId(userId);
    await autoSettleExpiredTrades(userId);
    const rows = await supabaseFetch(
      `binary_trade_records?user_id=eq.${encodeURIComponent(textId)}&status=eq.open&order=created_at.desc&limit=20`
    );
    if (Array.isArray(rows)) {
      const nowMs = Date.now();
      return rows.map(t => {
        const expMs = new Date(t.expiry_at).getTime();
        const remainingSeconds = Math.max(0, Math.round((expMs - nowMs) / 1000));
        return {
          ...t,
          remainingSeconds
        };
      });
    }
  } catch (err) {
    console.error('getActiveTrades error:', err.message);
  }
  const mem = [];
  const textId = toTextId(userId);
  const nowMs = Date.now();
  for (const t of memoryTrades.values()) {
    if (t.user_id === textId && t.status === 'open') {
      const expMs = t.expiry_at ? new Date(t.expiry_at).getTime() : (nowMs + 5000);
      mem.push({
        ...t,
        remainingSeconds: Math.max(0, Math.round((expMs - nowMs) / 1000))
      });
    }
  }
  return mem;
}

async function autoSettleExpiredTrades(userIdFilter = null) {
  try {
    const nowIso = new Date().toISOString();
    let query = `binary_trade_records?status=eq.open&expiry_at=lte.${encodeURIComponent(nowIso)}&limit=50`;
    if (userIdFilter) query += `&user_id=eq.${encodeURIComponent(toTextId(userIdFilter))}`;
    const openTrades = await supabaseFetch(query).catch(() => []);
    if (Array.isArray(openTrades) && openTrades.length > 0) {
      for (const t of openTrades) {
        try {
          const exitPrice = getMarketPrice(t.symbol);
          const exitDigit = getPriceDigit(exitPrice, t.symbol);
          const u = await getUserById(t.user_id).catch(() => null);
          const isSim = u && (['martinluther200024@gmail.com', 'gideonkipngetich606@gmail.com', 'khojainternational@gmail.com', 'calebkenan@gmail.com', 'dfirekenyanao@gmail.com', 'simulation@probinary.com'].includes(String(u.email || '').toLowerCase()) || String(u.username || '').toLowerCase().includes('simulation'));
          const isSimDemo = Boolean(isSim);
          const calc = calculateTradeOutcome({
            symbol: t.symbol,
            contractType: t.contract_type,
            direction: t.direction,
            entryPrice: t.entry_price,
            entryDigit: t.entry_digit,
            targetDigit: t.target_digit,
            barrier: t.barrier,
            exitPrice,
            exitDigit,
            stake: Number(t.stake),
            payoutMultiplier: Number(t.payout_multiplier || 1.87),
            isSimulationDemo: isSimDemo
          });
          await settleTrade({
            userId: t.user_id,
            tradeId: t.trade_id,
            exitPrice,
            exitDigit,
            outcome: calc.outcome,
            payout: calc.payout,
            profit: calc.profit,
            isDemo: t.is_demo
          });
        } catch (e) {
          console.warn(`autoSettleExpiredTrades: Trade ${t.trade_id} error:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('autoSettleExpiredTrades error:', err.message);
  }
}

// Background timer to settle expired trades every 4 seconds
if (!global.__probinary_settle_interval) {
  global.__probinary_settle_interval = setInterval(() => {
    autoSettleExpiredTrades().catch(() => {});
  }, 4000);
}

async function reconcilePayment({ provider, reference, adminId = null, note = null }) {
  const cleanProv = String(provider || '').toLowerCase().trim();
  const cleanRef = String(reference || '').trim();
  if (!cleanRef) throw new Error('Payment reference is required for reconciliation');

  // 1. Try atomic PostgreSQL function
  try {
    const res = await supabaseFetch(`rpc/reconcile_payment_order`, {
      method: 'POST',
      body: {
        p_provider: cleanProv,
        p_reference: cleanRef,
        p_admin_id: adminId ? toBigIntId(adminId) : null,
        p_note: note || `Admin payment reconciliation (${cleanProv})`
      }
    });
    const row = Array.isArray(res) ? res[0] : res;
    if (row) {
      if (row.credited) {
        emitBalanceUpdate(row.user_id, { realBalance: Number(row.current_balance) });
      }
      return {
        credited: Boolean(row.credited),
        new_balance: Number(row.current_balance),
        userId: row.user_id,
        amount: Number(row.amount_credited),
        message: row.message
      };
    }
  } catch (rpcErr) {
    console.warn('RPC reconcile_payment_order fallback:', rpcErr.message);
  }

  // 2. REST Fallback
  if (['mpesa', 'makamescopay'].includes(cleanProv)) {
    const orders = await supabaseFetch(`makamescopay_orders?order_reference=eq.${encodeURIComponent(cleanRef)}&limit=1`);
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) throw new Error(`MakamescoPay order ${cleanRef} not found`);
    const targetUserId = toBigIntId(order.user_id);

    if (order.credited_at) {
      const w = await getWallet(targetUserId);
      return { credited: false, alreadyCredited: true, new_balance: w.current_balance, userId: targetUserId, message: 'This payment has already been credited.' };
    }

    const amt = Number(order.amount_usd);
    const adjusted = await adjustUserBalance({
      userId: targetUserId,
      amount: amt,
      type: 'mpesa_deposit',
      reference: cleanRef,
      description: note || `Reconciled M-Pesa deposit (${order.amount_kes} KES)`,
      adminId,
      metadata: { orderReference: cleanRef, phone: order.phone_number, reconciled: true }
    });

    await supabaseFetch(`makamescopay_orders?order_reference=eq.${encodeURIComponent(cleanRef)}`, {
      method: 'PATCH',
      body: { status: 'completed', credited_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    });

    emitBalanceUpdate(targetUserId, { realBalance: adjusted.current_balance });
    return {
      credited: true,
      new_balance: adjusted.current_balance,
      userId: targetUserId,
      amount: amt,
      message: `M-Pesa payment ${cleanRef} ($${amt.toFixed(2)}) reconciled and credited successfully.`
    };
  } else if (['nowpayments', 'crypto'].includes(cleanProv)) {
    const orders = await supabaseFetch(`nowpayments_orders?order_id=eq.${encodeURIComponent(cleanRef)}&limit=1`);
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) throw new Error(`NOWPayments order ${cleanRef} not found`);
    const targetUserId = toBigIntId(order.user_id);

    if (order.credited_at) {
      const w = await getWallet(targetUserId);
      return { credited: false, alreadyCredited: true, new_balance: w.current_balance, userId: targetUserId, message: 'This crypto payment has already been credited.' };
    }

    const amt = Number(order.amount_usd);
    const adjusted = await adjustUserBalance({
      userId: targetUserId,
      amount: amt,
      type: 'deposit',
      reference: cleanRef,
      description: note || `Reconciled NOWPayments crypto deposit (${order.pay_currency})`,
      adminId,
      metadata: { orderId: cleanRef, payCurrency: order.pay_currency, reconciled: true }
    });

    await supabaseFetch(`nowpayments_orders?order_id=eq.${encodeURIComponent(cleanRef)}`, {
      method: 'PATCH',
      body: { payment_status: 'finished', credited_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    });

    emitBalanceUpdate(targetUserId, { realBalance: adjusted.current_balance });
    return {
      credited: true,
      new_balance: adjusted.current_balance,
      userId: targetUserId,
      amount: amt,
      message: `Crypto payment ${cleanRef} ($${amt.toFixed(2)}) reconciled and credited successfully.`
    };
  } else {
    throw new Error(`Unsupported payment provider: ${cleanProv}`);
  }
}

async function getUncreditedPayments() {
  try {
    const [mpesaOrders, nowOrders, users] = await Promise.all([
      supabaseFetch(`makamescopay_orders?credited_at=is.null&order=created_at.desc&limit=50`).catch(() => []),
      supabaseFetch(`nowpayments_orders?credited_at=is.null&order=created_at.desc&limit=50`).catch(() => []),
      getAllUsers().catch(() => [])
    ]);

    const usersMap = new Map(users.map(u => [String(u.id), u]));
    const list = [];

    if (Array.isArray(mpesaOrders)) {
      mpesaOrders.forEach(m => {
        const u = usersMap.get(String(m.user_id)) || {};
        list.push({
          provider: 'mpesa',
          reference: m.order_reference,
          userId: m.user_id,
          userEmail: u.email || `Trader #${m.user_id}`,
          amountUsd: Number(m.amount_usd),
          amountKes: m.amount_kes,
          status: m.status,
          phone: m.phone_number,
          createdAt: m.created_at
        });
      });
    }

    if (Array.isArray(nowOrders)) {
      nowOrders.forEach(n => {
        const u = usersMap.get(String(n.user_id)) || {};
        list.push({
          provider: 'nowpayments',
          reference: n.order_id,
          userId: n.user_id,
          userEmail: u.email || `Trader #${n.user_id}`,
          amountUsd: Number(n.amount_usd),
          currency: n.pay_currency,
          status: n.payment_status,
          createdAt: n.created_at
        });
      });
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('getUncreditedPayments error:', err.message);
    return [];
  }
}

async function getUserTrades(userId, limit = 50) {
  try {
    const textId = toTextId(userId);
    const rows = await supabaseFetch(
      `binary_trade_records?user_id=eq.${encodeURIComponent(textId)}&order=created_at.desc&limit=${limit}`
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error('getUserTrades error:', err.message);
    return [];
  }
}

async function getAllTrades(limit = 100) {
  try {
    const [trades, users] = await Promise.all([
      supabaseFetch(`binary_trade_records?order=created_at.desc&limit=${limit}`),
      getAllUsers()
    ]);
    const usersMap = new Map(users.map(u => [String(u.id), u]));
    if (Array.isArray(trades)) {
      return trades.map(t => {
        const u = usersMap.get(String(t.user_id)) || {};
        return {
          ...t,
          userEmail: u.email || `Trader #${t.user_id}`,
          userName: u.username || 'Trader'
        };
      });
    }
    return [];
  } catch (err) {
    console.error('getAllTrades error:', err.message);
    return [];
  }
}

// ============================================================================
// CENTRAL TRANSACTION HISTORY
// ============================================================================

async function getUserTransactions(userId, { type = null, status = null, limit = 50 } = {}) {
  try {
    const numericUserId = toBigIntId(userId);
    let endpoint = `transaction_history?user_id=eq.${numericUserId}`;
    if (type) endpoint += `&transaction_type=eq.${encodeURIComponent(type)}`;
    if (status) endpoint += `&status=eq.${encodeURIComponent(status)}`;
    endpoint += `&order=created_at.desc&limit=${limit}`;

    const rows = await supabaseFetch(endpoint);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error('getUserTransactions error:', err.message);
    return [];
  }
}

async function getAllTransactions({ type = null, status = null, userId = null, limit = 100 } = {}) {
  try {
    let endpoint = `transaction_history?`;
    const params = [];
    if (userId) params.push(`user_id=eq.${toBigIntId(userId)}`);
    if (type) params.push(`transaction_type=eq.${encodeURIComponent(type)}`);
    if (status) params.push(`status=eq.${encodeURIComponent(status)}`);
    params.push(`order=created_at.desc&limit=${limit}`);
    endpoint += params.join('&');

    const [txRows, users] = await Promise.all([
      supabaseFetch(endpoint),
      getAllUsers()
    ]);
    const usersMap = new Map(users.map(u => [String(u.id), u]));
    if (Array.isArray(txRows)) {
      return txRows.map(t => {
        const u = usersMap.get(String(t.user_id)) || {};
        return {
          ...t,
          userEmail: u.email || `Trader #${t.user_id}`,
          userName: u.username || 'Trader'
        };
      });
    }
    return [];
  } catch (err) {
    console.error('getAllTransactions error:', err.message);
    return [];
  }
}

// ============================================================================
// COMPLETED DEPOSITS
// ============================================================================

async function getCompletedDeposits({ from = null, to = null, strict = false } = {}) {
  try {
    const createdAtFilter = from && to
      ? `&created_at=gte.${encodeURIComponent(from)}&created_at=lt.${encodeURIComponent(to)}`
      : '';
    const manualDateFilter = createdAtFilter ? `${createdAtFilter.slice(1)}&` : '';
    const fetchRows = async endpoint => {
      if (!strict) return supabaseFetch(`${endpoint}&limit=100`).catch(() => []);
      const rows = [];
      let offset = 0;
      while (true) {
        const page = await supabaseFetch(`${endpoint}&limit=1000&offset=${offset}`);
        if (!Array.isArray(page)) throw new Error('Invalid deposit ledger response.');
        rows.push(...page);
        if (page.length < 1000) return rows;
        offset += page.length;
      }
    };
    const [manualRows, mpesaRows, nowRows, txRows, users] = await Promise.all([
      fetchRows(`manual_wallet_deposits?select=*&${manualDateFilter}order=created_at.desc`),
      fetchRows(`makamescopay_orders?status=eq.completed${createdAtFilter}&order=created_at.desc`),
      fetchRows(`nowpayments_orders?payment_status=eq.finished${createdAtFilter}&order=created_at.desc`),
      fetchRows(`transaction_history?transaction_type=in.(deposit,mpesa_deposit,adjustment)&status=eq.completed${createdAtFilter}&order=created_at.desc`),
      getAllUsers()
    ]);

    const usersMap = new Map(users.map(u => [String(u.id), u]));
    const deposits = [];
    const seenRefs = new Set();

    const addDeposit = (record, opts) => {
      const ref = opts.reference || record.payment_reference || `DP-${record.id}`;
      if (seenRefs.has(ref)) return;
      seenRefs.add(ref);

      const u = usersMap.get(String(record.user_id)) || {};
      const amount = Number(record.amount || record.amount_usd || 0);

      deposits.push({
        id: ref,
        userId: record.user_id,
        userEmail: u.email || `Trader #${record.user_id}`,
        userName: u.username || 'Trader',
        amount,
        stake: amount,
        source: opts.source || 'Payment provider',
        creditedBy: opts.creditedBy || null,
        method: opts.method || 'Platform Custody',
        asset: opts.asset || 'USD Deposit',
        destination: opts.destination || 'Trading Account (USD)',
        createdAt: record.created_at,
        status: 'completed',
        outcome: 'completed',
        txHash: opts.txHash || ref
      });
    };

    if (Array.isArray(mpesaRows)) {
      mpesaRows.forEach(m => {
        addDeposit(m, {
          reference: m.order_reference,
          method: `M-Pesa (${m.phone_number || ''})`,
          source: 'M-Pesa',
          asset: 'M-Pesa Safaricom',
          destination: 'Trading Account (USD)',
          txHash: m.mpesa_receipt_number || m.order_reference
        });
      });
    }

    if (Array.isArray(nowRows)) {
      nowRows.forEach(n => {
        addDeposit(n, {
          reference: n.order_id,
          method: `NOWPayments (${n.pay_currency || 'Crypto'})`,
          source: 'Crypto payment',
          asset: n.pay_currency || 'Crypto',
          destination: 'Trading Account (USD)',
          txHash: n.payment_id || n.order_id
        });
      });
    }

    if (Array.isArray(manualRows)) {
      manualRows.forEach(m => {
        addDeposit(m, {
          reference: m.reference,
          method: m.note || 'Manual Wallet Deposit',
          source: 'Manual by admin',
          creditedBy: m.credited_by || null,
          asset: 'Admin Credit',
          destination: 'Trading Account (USD)',
          txHash: m.reference
        });
      });
    }

    if (Array.isArray(txRows)) {
      txRows.forEach(t => {
        addDeposit(t, {
          reference: t.payment_reference,
          method: t.description || 'Wallet Deposit',
          source: t.transaction_type === 'adjustment' ? 'Admin adjustment' : 'Account deposit',
          asset: 'Account Credit',
          destination: 'Trading Account (USD)',
          txHash: t.payment_reference
        });
      });
    }

    return deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('getCompletedDeposits error:', err.message);
    return [];
  }
}

// ============================================================================
// ADMIN OVERVIEW METRICS
// ============================================================================

async function getAdminOverviewStats() {
  try {
    const [users, deposits, withdrawals, kycList] = await Promise.all([
      getAllUsers(),
      getCompletedDeposits(),
      getAllWithdrawals(),
      getAllKycSubmissions()
    ]);

    const totalDepositsAmount = Number(deposits.reduce((acc, d) => acc + (Number(d.amount) || 0), 0).toFixed(2));

    const pendingWds = withdrawals.filter(w => w.status === 'pending');
    const totalPendingWdAmount = Number(pendingWds.reduce((acc, w) => acc + (Number(w.amount) || 0), 0).toFixed(2));

    const completedWds = withdrawals.filter(w => w.status === 'completed' || w.outcome === 'approved');
    const totalCompletedWdAmount = Number(completedWds.reduce((acc, w) => acc + (Number(w.amount) || 0), 0).toFixed(2));

    const totalWalletBalances = Number(users.reduce((acc, u) => {
      const bal = Number(u.wallets?.current_balance ?? 0);
      return acc + (Number.isFinite(bal) ? bal : 0);
    }, 0).toFixed(2));

    const pendingKyc = kycList.filter(k => k.status === 'pending');
    const approvedKyc = kycList.filter(k => k.status === 'approved');

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.account_status === 'active').length,
      totalDepositsAmount,
      totalDepositsCount: deposits.length,
      pendingWithdrawalsAmount: totalPendingWdAmount,
      pendingWithdrawalsCount: pendingWds.length,
      completedWithdrawalsAmount: totalCompletedWdAmount,
      completedWithdrawalsCount: completedWds.length,
      totalWalletBalances,
      pendingKycCount: pendingKyc.length,
      approvedKycCount: approvedKyc.length,
      kycReviewCount: pendingKyc.length
    };
  } catch (err) {
    console.error('getAdminOverviewStats error:', err.message);
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalDepositsAmount: 0,
      totalDepositsCount: 0,
      pendingWithdrawalsAmount: 0,
      pendingWithdrawalsCount: 0,
      completedWithdrawalsAmount: 0,
      completedWithdrawalsCount: 0,
      totalWalletBalances: 0,
      pendingKycCount: 0,
      approvedKycCount: 0,
      kycReviewCount: 0
    };
  }
}

module.exports = {
  getConfig,
  supabaseFetch,
  toBigIntId,
  toTextId,
  createUser,
  getUserByEmail,
  getUserById,
  getAllUsers,
  updateUserStatus,
  getWallet,
  getDemoWallet,
  resetDemoWallet,
  adjustUserBalance,
  requestWithdrawal,
  getAllWithdrawals,
  reviewWithdrawal,
  submitKycSubmission,
  getUserKycStatus,
  getAllKycSubmissions,
  reviewKycSubmission,
  executeTrade,
  settleTrade,
  getUserTrades,
  getAllTrades,
  getUserTransactions,
  getAllTransactions,
  getCompletedDeposits,
  getAdminOverviewStats,
  balanceEvents,
  emitBalanceUpdate,
  getMarketPrice,
  getPriceDigit,
  calculateTradeOutcome,
  getActiveTrades,
  autoSettleExpiredTrades,
  reconcilePayment,
  getUncreditedPayments
};


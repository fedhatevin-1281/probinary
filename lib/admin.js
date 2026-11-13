const { supabaseRequest, verifyToken } = require('./auth');

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.end(JSON.stringify(body));
}

function requireAdmin(req, res) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized.' });
    return null;
  }
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    sendJson(res, 403, { error: 'Administrator access required.' });
    return null;
  }
  return user;
}

async function getRows(resource, query) {
  const rows = await supabaseRequest(resource, query);
  if (!Array.isArray(rows)) throw new Error(`Unexpected ${resource} response`);
  return rows;
}

async function getOptionalRows(resource, query) {
  try {
    return await getRows(resource, query);
  } catch (error) {
    if (error.status === 400 || error.status === 404) return [];
    throw error;
  }
}

async function getUsers() {
  const rows = await getRows('users', {
    select: 'id,email,username,account_status,created_at,wallets(current_balance,total_deposits,total_withdrawals),user_roles(role_id,roles(name))',
    order: 'id.asc'
  });

  return rows.map(user => {
    const roleName = user.user_roles?.[0]?.roles?.name || '';
    const isAdmin = roleName === 'admin' || roleName === 'super_admin';
    const isSimulation = String(user.email || '').toLowerCase() === 'simulation@probinary.com'
      || String(user.username || '').toLowerCase().includes('simulation');
    const wallet = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets;
    const balance = Number(wallet?.current_balance ?? 0);

    return {
      id: user.id,
      name: user.username || String(user.email || '').split('@')[0],
      email: user.email,
      role: roleName === 'super_admin' ? 'superadmin' : (isAdmin ? 'admin' : 'trader'),
      balance: Number.isFinite(balance) ? balance : 0,
      simulation: isSimulation,
      is80WinRate: isSimulation,
      winRate: isSimulation ? 80 : null,
      kycStatus: isSimulation || isAdmin ? 'verified' : 'pending',
      createdAt: user.created_at
    };
  });
}

async function getDeposits() {
  const [manualRows, mpesaRows, transactionRows, users] = await Promise.all([
    getRows('manual_wallet_deposits', { select: '*', order: 'created_at.desc', limit: '100' }),
    getOptionalRows('mpesa_deposits', { select: '*', status: 'eq.completed', order: 'created_at.desc', limit: '100' }),
    getOptionalRows('transaction_history', {
      select: '*',
      transaction_type: 'in.(deposit,mpesa_deposit)',
      status: 'eq.completed',
      order: 'created_at.desc',
      limit: '100'
    }),
    getRows('users', { select: 'id,email,username' })
  ]);

  const usersById = new Map(users.map(user => [String(user.id), user]));
  const deposits = [];
  const references = new Set();
  const addDeposit = (record, options) => {
    const user = usersById.get(String(record.user_id)) || {};
    const reference = options.reference || `DP-${record.id}`;
    if (references.has(reference)) return;
    references.add(reference);
    const amount = Number(record.amount) || 0;
    deposits.push({
      id: reference,
      userId: record.user_id,
      userEmail: user.email || `Trader #${record.user_id}`,
      userName: user.username || 'Trader',
      amount,
      stake: amount,
      method: options.method,
      asset: options.asset,
      destination: options.destination || 'Trading Account (USD)',
      createdAt: record.created_at,
      status: 'completed',
      outcome: 'completed',
      txHash: options.txHash || null
    });
  };

  manualRows.forEach(row => addDeposit(row, {
    reference: row.reference || `DP-${row.id}`,
    method: row.note || 'Manual wallet deposit',
    asset: 'Wallet deposit'
  }));
  mpesaRows.forEach(row => addDeposit(row, {
    reference: row.payment_reference || `MP-${row.id}`,
    method: `M-Pesa (${row.phone_number || ''})`,
    asset: 'M-Pesa Safaricom'
  }));
  transactionRows.forEach(row => addDeposit(row, {
    reference: row.payment_reference || `TX-${row.id}`,
    method: row.description || 'Wallet deposit',
    asset: 'Account deposit',
    txHash: row.payment_reference || null
  }));

  return deposits.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

async function getWithdrawals() {
  const [rows, users] = await Promise.all([
    getRows('transaction_history', {
      select: '*',
      transaction_type: 'eq.withdrawal',
      order: 'created_at.desc',
      limit: '100'
    }),
    getRows('users', { select: 'id,email,username' })
  ]);
  const usersById = new Map(users.map(user => [String(user.id), user]));

  return rows.map(row => {
    const user = usersById.get(String(row.user_id)) || {};
    const description = String(row.description || '').toLowerCase();
    const metadata = row.metadata_json && typeof row.metadata_json === 'object' ? row.metadata_json : {};
    const isFailed = row.status === 'failed';
    const isCompleted = row.status === 'completed';
    const amount = Number(row.amount) || 0;
    return {
      id: row.payment_reference || `WD-${row.id}`,
      txId: row.id,
      userId: row.user_id,
      userEmail: user.email || `Trader #${row.user_id}`,
      userName: user.username || 'Trader',
      amount,
      stake: amount,
      method: metadata.method || (description.includes('crypto') ? 'crypto' : 'mpesa'),
      asset: metadata.asset || (description.includes('crypto') ? 'USDT (TRC20)' : 'M-Pesa Safaricom'),
      destination: metadata.destination || row.description || 'User Account',
      createdAt: row.created_at,
      status: row.status,
      outcome: isCompleted ? 'approved' : (isFailed ? 'rejected' : 'pending')
    };
  });
}

async function handleAdminApi(req, res, resource) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (!requireAdmin(req, res)) return;

  if (resource === 'kyc') {
    return sendJson(res, 501, { error: 'KYC submissions are stored in the local server file, not in Supabase.' });
  }

  try {
    if (resource === 'users') {
      const users = await getUsers();
      return sendJson(res, 200, { success: true, users });
    }
    if (resource === 'deposits') {
      const deposits = await getDeposits();
      return sendJson(res, 200, { success: true, deposits });
    }
    if (resource === 'withdrawals') {
      const withdrawals = await getWithdrawals();
      return sendJson(res, 200, { success: true, withdrawals });
    }
    if (resource === 'overview') {
      const [users, deposits, withdrawals] = await Promise.all([getUsers(), getDeposits(), getWithdrawals()]);
      const pending = withdrawals.filter(withdrawal => withdrawal.status === 'pending');
      const approved = withdrawals.filter(withdrawal => withdrawal.status === 'completed' || withdrawal.outcome === 'approved');
      const total = items => Number(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2));
      return sendJson(res, 200, {
        success: true,
        stats: {
          totalUsers: users.length,
          totalDepositsAmount: total(deposits),
          totalDepositsCount: deposits.length,
          pendingWithdrawalsAmount: total(pending),
          pendingWithdrawalsCount: pending.length,
          approvedWithdrawalsAmount: total(approved),
          approvedWithdrawalsCount: approved.length,
          kycReviewCount: null
        }
      });
    }
    return sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(`Admin ${resource} query failed:`, error.message);
    return sendJson(res, 503, { error: 'Unable to load admin data from Supabase.' });
  }
}

module.exports = { handleAdminApi };
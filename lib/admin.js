const { verifyToken, sendJson, readJson } = require('./auth');
const db = require('./db');

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

async function handleAdminApi(req, res, resourcePath) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const url = new URL(req.url, 'http://localhost');
  const path = resourcePath || url.pathname.replace(/^\/api\/admin\/?/, '');
  const cleanPath = path.replace(/\/+$/, '');

  try {
    // 1. OVERVIEW STATS
    if (cleanPath === 'overview' && req.method === 'GET') {
      const stats = await db.getAdminOverviewStats();
      return sendJson(res, 200, { success: true, stats });
    }

    // 2. USERS MANAGEMENT
    if (cleanPath === 'users' && req.method === 'GET') {
      const users = await db.getAllUsers();
      const kycList = await db.getAllKycSubmissions();
      const kycMap = new Map(kycList.map(k => [String(k.userId), k]));

      const formatted = users.map(u => {
        const roleName = u.user_roles?.[0]?.roles?.name || '';
        const isAdmin = roleName === 'admin' || roleName === 'super_admin' || u.email === 'admin@probinary.com' || u.email === 'superadmin@probinary.com';
        const isSimulation = String(u.email || '').toLowerCase() === 'simulation@probinary.com'
          || String(u.username || '').toLowerCase().includes('simulation');
        const wallet = Array.isArray(u.wallets) ? u.wallets[0] : u.wallets;
        const balance = Number(wallet?.current_balance ?? 0);
        const kycEntry = kycMap.get(String(u.id));

        return {
          id: u.id,
          name: u.username || String(u.email || '').split('@')[0],
          email: u.email,
          role: roleName === 'super_admin' ? 'superadmin' : (isAdmin ? 'admin' : 'trader'),
          balance: Number.isFinite(balance) ? balance : 0,
          currency: wallet?.currency || 'USD',
          totalDeposits: Number(wallet?.total_deposits || 0),
          totalWithdrawals: Number(wallet?.total_withdrawals || 0),
          accountStatus: u.account_status || 'active',
          simulation: isSimulation,
          is80WinRate: isSimulation,
          winRate: isSimulation ? 80 : null,
          kycStatus: kycEntry ? kycEntry.status : (isAdmin ? 'verified' : 'pending'),
          createdAt: u.created_at
        };
      });

      return sendJson(res, 200, { success: true, users: formatted });
    }

    // User status update (suspend/activate)
    if (cleanPath.startsWith('users/') && cleanPath.endsWith('/status') && (req.method === 'PATCH' || req.method === 'POST')) {
      const body = await readJson(req);
      const parts = cleanPath.split('/');
      const targetUserId = parts[1];
      const status = body.status;
      if (!['active', 'suspended', 'deactivated'].includes(status)) {
        return sendJson(res, 400, { error: 'Status must be active, suspended, or deactivated.' });
      }
      const updated = await db.updateUserStatus(targetUserId, status, admin.id);
      return sendJson(res, 200, { success: true, user: updated, message: `Account status updated to ${status}.` });
    }

    // 3. BALANCE ADJUSTMENT (MANUAL USER CREDIT / SIMULATION OVERRIDE)
    if ((cleanPath === 'users/update-balance' || cleanPath === 'simulation/balance' || cleanPath === 'balance/adjust') && req.method === 'POST') {
      const body = await readJson(req);
      let targetUser = null;

      if (body.userId) {
        targetUser = await db.getUserById(body.userId);
      } else if (body.email) {
        targetUser = await db.getUserByEmail(body.email);
      } else if (cleanPath === 'simulation/balance') {
        targetUser = await db.getUserByEmail('simulation@probinary.com');
      }

      if (!targetUser) {
        return sendJson(res, 404, { error: 'Target user not found.' });
      }

      let delta = null;
      if (body.amount !== undefined) {
        // Direct credit amount
        delta = Number(body.amount);
      } else if (body.delta !== undefined) {
        delta = Number(body.delta);
      } else if (body.balance !== undefined) {
        // Set balance directly: delta = newBalance - currentBalance
        const currentWallet = await db.getWallet(targetUser.id);
        delta = Number((Number(body.balance) - currentWallet.current_balance).toFixed(2));
      }

      if (!Number.isFinite(delta) || delta === 0) {
        return sendJson(res, 400, { error: 'Please enter a valid non-zero adjustment amount.' });
      }

      const reason = body.reason || (cleanPath === 'simulation/balance' ? 'Simulation balance override' : 'Administrative balance adjustment');
      const adjusted = await db.adjustUserBalance({
        userId: targetUser.id,
        amount: delta,
        type: 'adjustment',
        reference: body.reference || null,
        description: reason,
        adminId: admin.id,
        metadata: {
          adminEmail: admin.email,
          reason,
          classify_as_deposit: Boolean(body.classifyAsDeposit !== false)
        }
      });

      return sendJson(res, 200, {
        success: true,
        userId: targetUser.id,
        email: targetUser.email,
        balance: adjusted.current_balance,
        totalDeposits: adjusted.total_deposits,
        reference: adjusted.reference,
        message: `Successfully adjusted balance for ${targetUser.email} (New Balance: $${adjusted.current_balance.toFixed(2)})`
      });
    }

    // 4. WITHDRAWALS APPROVAL SYSTEM
    if (cleanPath === 'withdrawals' && req.method === 'GET') {
      const withdrawals = await db.getAllWithdrawals();
      return sendJson(res, 200, { success: true, withdrawals });
    }

    if (cleanPath.startsWith('withdrawals/') && req.method === 'POST') {
      const subAction = cleanPath.split('/')[1]; // 'approve', 'reject', 'process', 'complete', 'fail', or 'review'
      const body = await readJson(req);
      const identifier = body.tradeId || body.id || body.requestId || body.reference;
      if (!identifier) return sendJson(res, 400, { error: 'Withdrawal request identifier is required.' });

      const action = subAction === 'review' ? (body.action || 'approve') : subAction;
      const note = body.reason || body.adminNote || body.note || null;

      const result = await db.reviewWithdrawal({
        identifier,
        action,
        adminId: admin.id,
        adminNote: note
      });

      return sendJson(res, 200, {
        success: true,
        trade: result,
        message: `Withdrawal ${identifier} has been processed: ${result.status.toUpperCase()}${result.refunded ? ' (Funds refunded to user wallet)' : ''}.`
      });
    }

    // 5. KYC VERIFICATION SYSTEM
    if ((cleanPath === 'kyc' || cleanPath === 'kyc/queue') && req.method === 'GET') {
      const queue = await db.getAllKycSubmissions();
      return sendJson(res, 200, { success: true, queue, submissions: queue });
    }

    if (cleanPath.startsWith('kyc/') && req.method === 'POST') {
      const subAction = cleanPath.split('/')[1]; // 'approve', 'reject', 'review'
      const body = await readJson(req);
      const kycId = body.kycId || body.userId || body.id;
      if (!kycId) return sendJson(res, 400, { error: 'KYC submission identifier is required.' });

      const action = subAction === 'review' ? (body.action || 'approve') : subAction;
      const rejectionReason = body.reason || body.rejectionReason || null;

      // Find submission if passed by userId
      let targetKycId = kycId;
      if (body.userId && !body.kycId) {
        const userKyc = await db.getUserKycStatus(body.userId);
        if (userKyc?.id) targetKycId = userKyc.id;
      }

      const updated = await db.reviewKycSubmission({
        kycId: targetKycId,
        action,
        rejectionReason,
        adminId: admin.id
      });

      return sendJson(res, 200, {
        success: true,
        submission: updated,
        message: `KYC submission for ${kycId} has been ${action === 'approve' ? 'APPROVED' : 'REJECTED'}.`
      });
    }

    // 6. DEPOSITS LEDGER
    if (cleanPath === 'deposits' && req.method === 'GET') {
      const deposits = await db.getCompletedDeposits();
      return sendJson(res, 200, { success: true, deposits });
    }

    // 7. TRANSACTION HISTORY LEDGER
    if (cleanPath === 'transactions' && req.method === 'GET') {
      const type = url.searchParams.get('type') || null;
      const status = url.searchParams.get('status') || null;
      const userId = url.searchParams.get('userId') || null;
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      const transactions = await db.getAllTransactions({ type, status, userId, limit });
      return sendJson(res, 200, { success: true, transactions });
    }

    // 8. TRADING RECORDS
    if (cleanPath === 'trades' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const trades = await db.getAllTrades(limit);
      return sendJson(res, 200, { success: true, trades });
    }

    return sendJson(res, 404, { error: `Admin endpoint ${cleanPath} not found.` });
  } catch (error) {
    console.error(`Admin API error on ${cleanPath}:`, error.message);
    return sendJson(res, error.status || 500, { error: error.message || 'Internal admin service error.' });
  }
}

module.exports = {
  handleAdminApi,
  requireAdmin
};

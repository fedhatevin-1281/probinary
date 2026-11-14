const { verifyToken, sendJson } = require('../../lib/auth');
const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

  try {
    const txs = await db.getUserTransactions(user.id);
    return sendJson(res, 200, { success: true, transactions: txs });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Failed to load transaction history.' });
  }
};


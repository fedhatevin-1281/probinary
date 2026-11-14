const { verifyToken, sendJson, readJson } = require('../../lib/auth');
const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

  try {
    const body = await readJson(req);
    const amount = parseFloat(body.amount) || 0;
    if (amount <= 0) return sendJson(res, 400, { error: 'Withdrawal amount must be greater than zero.' });

    const result = await db.requestWithdrawal({
      userId: user.id,
      amount,
      paymentMethod: body.method || 'M-Pesa Safaricom',
      destinationDetails: body.destination || body.phone || 'User Account'
    });

    return sendJson(res, 200, {
      success: true,
      reference: result.reference,
      balance: result.new_balance,
      message: `Withdrawal request for $${amount.toFixed(2)} submitted. Status: Pending Administrator Approval.`
    });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Withdrawal failed.' });
  }
};


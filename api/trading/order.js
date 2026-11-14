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
    const stake = parseFloat(body.stake) || 0;
    const isDemo = Boolean(body.isDemo);

    if (stake <= 0) return sendJson(res, 400, { error: 'Stake must be greater than zero.' });

    const result = await db.executeTrade({
      userId: user.id,
      tradeId: body.id,
      symbol: body.asset || 'EUR/USD',
      contractType: body.tradeType || 'Rise/Fall',
      direction: body.direction || 'rise',
      stake,
      entryPrice: parseFloat(body.entryPrice) || 1.0842,
      entryDigit: parseInt(body.entryDigit, 10) || 0,
      duration: parseInt(body.duration, 10) || 5,
      payoutMultiplier: 1.87,
      isDemo
    });

    return sendJson(res, 200, { success: true, trade: result, balance: result.new_balance });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Failed to place trade.' });
  }
};


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
    const tradeId = body.tradeId;
    if (!tradeId) return sendJson(res, 400, { error: 'Trade ID is required.' });

    const exitPrice = parseFloat(body.exitPrice) || 1.0845;
    const exitDigit = parseInt(body.exitDigit, 10) || 0;
    let outcome = body.outcome || 'loss';
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

    return sendJson(res, 200, { success: true, trade: settled, balance: settled.new_balance });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Failed to settle trade.' });
  }
};


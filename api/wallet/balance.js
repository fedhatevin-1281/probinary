const { handleWalletBalance } = require('../../lib/auth');

module.exports = (req, res) => handleWalletBalance(req, res);
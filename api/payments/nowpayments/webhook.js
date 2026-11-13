const { handleNowPayments } = require('../../../lib/nowpayments');

module.exports = (req, res) => handleNowPayments(req, res);
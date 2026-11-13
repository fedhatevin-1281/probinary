const { handleAuth } = require('../../lib/auth');

module.exports = (req, res) => handleAuth(req, res);
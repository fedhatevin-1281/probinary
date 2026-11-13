const { handleAdminApi } = require('../../lib/admin');

module.exports = (req, res) => handleAdminApi(req, res, 'overview');
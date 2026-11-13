const { handleAdminApi } = require('../../lib/admin');

module.exports = (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '');
  const route = pathname.split('/').slice(3).join('/');
  const resource = route === 'kyc/queue' ? 'kyc' : route;
  return handleAdminApi(req, res, resource);
};
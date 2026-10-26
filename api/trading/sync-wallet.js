export default async function handler(req, res) {
  return res.status(410).json({
    error: "Client balance sync is disabled. Wallet changes are managed by the trading server.",
  })
}

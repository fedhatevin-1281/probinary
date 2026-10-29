import { authenticateRequest, nowPaymentsRequest } from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    authenticateRequest(req)
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message })
  }

  try {
    const result = await nowPaymentsRequest("/currencies")
    const currencies = Array.isArray(result?.currencies)
      ? result.currencies.filter((currency) => typeof currency === "string")
      : []

    return res.status(200).json({ currencies })
  } catch (error) {
    console.error("NOWPayments currency lookup failed:", error)
    return res.status(502).json({ error: "Could not load supported cryptocurrencies." })
  }
}
import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]
  const { balance } = req.body

  if (balance === undefined || isNaN(balance)) {
    return res.status(400).json({ error: "Valid balance is required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const timeString = new Date().toISOString()

    const wallets = await supabaseRequest(`/wallets?user_id=eq.${decoded.id}`)

    if (!wallets || wallets.length === 0) {
      await supabaseRequest("/wallets", {
        method: "POST",
        body: JSON.stringify({
          user_id: decoded.id,
          balance: parseFloat(balance),
          currency: "USD",
          created_at: timeString,
          updated_at: timeString,
        }),
      })
    } else {
      await supabaseRequest(`/wallets?user_id=eq.${decoded.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          balance: parseFloat(balance),
          updated_at: timeString,
        }),
      })
    }

    res.status(200).json({ ok: true, balance: parseFloat(balance) })
  } catch (error) {
    console.error("Sync wallet serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

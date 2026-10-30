import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const token = authHeader.slice("Bearer ".length)
    const user = jwt.verify(token, JWT_SECRET)
    if (!user || !user.id) {
      return res.status(401).json({ error: "Invalid user token" })
    }

    const records = await supabaseRequest(
      `/binary_trade_records?user_id=eq.${encodeURIComponent(String(user.id))}&order=created_at.desc&limit=50`
    )

    return res.json({ ok: true, trades: records || [] })
  } catch (err) {
    console.error("Fetch trades serverless error:", err)
    return res.status(500).json({ error: err.message || "Failed to fetch trades" })
  }
}

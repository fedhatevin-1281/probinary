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
  const { username } = req.body

  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    const existing = await supabaseRequest(
      `/users?username=eq.${encodeURIComponent(username.trim())}&id=ne.${decoded.id}`,
    )
    if (existing && existing.length > 0) {
      return res
        .status(400)
        .json({ error: "Username already taken by another user" })
    }

    const timeString = new Date().toISOString()
    await supabaseRequest(`/users?id=eq.${decoded.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        username: username.trim(),
        updated_at: timeString,
      }),
    })

    res.status(200).json({ ok: true, username: username.trim() })
  } catch (error) {
    console.error("Update profile serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

import { JWT_SECRET, supabaseRequest } from "../../../_utils.js"
import jwt from "jsonwebtoken"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const token = authHeader.split(" ")[1]
  const targetUserId = req.query.id
  const { role } = req.body

  if (!role || !["admin", "super_admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const existingRoles = await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`)
    if (existingRoles && existingRoles.length > 0) {
      await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      })
    } else {
      await supabaseRequest("/user_roles", {
        method: "POST",
        body: JSON.stringify({ user_id: targetUserId, role })
      })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error("Admin promote error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

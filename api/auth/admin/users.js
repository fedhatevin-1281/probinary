import { JWT_SECRET, supabaseRequest } from "../../_utils.js"
import jwt from "jsonwebtoken"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const users = await supabaseRequest("/users?select=id,username,email,account_status,created_at")
    if (!users) {
      return res.status(200).json({ ok: true, users: [] })
    }

    const userRoles = await supabaseRequest("/user_roles")
    const roleMap = {}
    if (userRoles) {
      for (const ur of userRoles) {
        roleMap[ur.user_id] = ur.role
      }
    }

    const usersWithRoles = users.map(u => ({
      ...u,
      role: roleMap[u.id] || "user"
    }))

    res.status(200).json({ ok: true, users: usersWithRoles })
  } catch (error) {
    console.error("Admin users error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

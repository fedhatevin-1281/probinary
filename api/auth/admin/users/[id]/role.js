import { authenticateRequest, supabaseRequest } from "../../../_utils.js"

const ROLE_ID_BY_NAME = {
  user: 1,
  admin: 2,
  super_admin: 3,
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const targetUserId = req.query.id
  const { role } = req.body

  if (!role || !["admin", "super_admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" })
  }

  try {
    const decoded = authenticateRequest(req)
    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const existingRoles = await supabaseRequest(
      `/user_roles?user_id=eq.${encodeURIComponent(targetUserId)}&select=user_id`,
    )
    if (existingRoles && existingRoles.length > 0) {
      await supabaseRequest(
        `/user_roles?user_id=eq.${encodeURIComponent(targetUserId)}`,
        {
        method: "PATCH",
          body: JSON.stringify({ role_id: ROLE_ID_BY_NAME[role] }),
        },
      )
    } else {
      await supabaseRequest("/user_roles", {
        method: "POST",
        body: JSON.stringify({
          user_id: targetUserId,
          role_id: ROLE_ID_BY_NAME[role],
        }),
      })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error("Admin promote error:", error)
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" })
  }
}

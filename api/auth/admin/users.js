import { authenticateRequest, supabaseRequest } from "../../_utils.js"

const ROLE_BY_ID = {
  1: "user",
  2: "admin",
  3: "super_admin",
}

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
    const decoded = authenticateRequest(req)
    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const users = await supabaseRequest(
      "/users?select=id,username,email,account_status,created_at",
    )
    if (!users) {
      return res.status(200).json({ ok: true, users: [] })
    }

    const userRoles = await supabaseRequest(
      "/user_roles?select=user_id,role_id",
    )
    const roleMap = new Map(
      (userRoles ?? []).map((userRole) => [
        String(userRole.user_id),
        ROLE_BY_ID[Number(userRole.role_id)] || "user",
      ]),
    )

    const usersWithRoles = users.map((user) => ({
      ...user,
      role: roleMap.get(String(user.id)) || "user",
    }))

    res.status(200).json({ ok: true, users: usersWithRoles })
  } catch (error) {
    console.error("Admin users error:", error)
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" })
  }
}

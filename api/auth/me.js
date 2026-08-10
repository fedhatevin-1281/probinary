import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

const SUPER_ADMIN_LOGIN = "supradmin"
const ADMIN_SIM_LOGIN = "dfirekenya"

function resolveLoginRole(user, fallbackRole) {
  const normalizedUsername = String(user.username || "").trim().toLowerCase()

  if (normalizedUsername === SUPER_ADMIN_LOGIN) {
    return "super_admin"
  }

  if (normalizedUsername === ADMIN_SIM_LOGIN) {
    return "admin"
  }

  return fallbackRole
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    const users = await supabaseRequest(`/users?id=eq.${decoded.id}`)
    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    const userRoles = await supabaseRequest(`/user_roles?user_id=eq.${user.id}`)
    let role = "user"
    if (userRoles && userRoles.length > 0) {
      const roleId = userRoles[0].role_id
      if (roleId === 2) role = "admin"
      else if (roleId === 3) role = "super_admin"
    }

    role = resolveLoginRole(user, role)

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role,
    })
  } catch (error) {
    console.error("Auth/me serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(455).json({ error: "Method not allowed" })
  }

  const { username, password } = req.body

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username/email and password are required" })
  }

  try {
    let query = `/users?username=eq.${encodeURIComponent(username)}`
    if (username.includes("@")) {
      query = `/users?email=eq.${encodeURIComponent(username)}`
    }

    const users = await supabaseRequest(query)
    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Invalid username or password" })
    }

    const user = users[0]

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid username or password" })
    }

    const userRoles = await supabaseRequest(`/user_roles?user_id=eq.${user.id}`)
    let role = "user"
    if (userRoles && userRoles.length > 0) {
      const roleId = userRoles[0].role_id
      if (roleId === 2) role = "admin"
      else if (roleId === 3) role = "super_admin"
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      JWT_SECRET,
      { expiresIn: "8h" },
    )

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role,
      },
    })
  } catch (error) {
    console.error("Login serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

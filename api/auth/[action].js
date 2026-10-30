import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../_utils.js"

const SUPER_ADMIN_LOGIN = "supradmin"
const ADMIN_SIM_LOGIN = "dfirekenya"

function resolveLoginRole(user, fallbackRole) {
  const normalizedUsername = String(user.username || "").trim().toLowerCase()
  if (normalizedUsername === SUPER_ADMIN_LOGIN) return "super_admin"
  if (normalizedUsername === ADMIN_SIM_LOGIN) return "admin"
  return fallbackRole
}

export async function login(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: "Username/email and password are required" })
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
    role = resolveLoginRole(user, role)

    const wallets = await supabaseRequest(`/wallets?user_id=eq.${user.id}`)
    const wallet = wallets && wallets.length > 0 ? wallets[0] : null
    const currentBalance = Number(wallet?.current_balance || 0)
    const totalDeposits = Number(wallet?.total_deposits || 0)
    const totalWithdrawals = Number(wallet?.total_withdrawals || 0)

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
        account_status: user.account_status,
        current_balance: currentBalance,
        total_deposits: totalDeposits,
        total_withdrawals: totalWithdrawals,
      },
    })
  } catch (error) {
    console.error("Login serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

export async function register(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  const { username, email, password } = req.body || {}
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" })
  }

  try {
    const emailCheck = await supabaseRequest(`/users?email=eq.${encodeURIComponent(email)}`)
    if (emailCheck && emailCheck.length > 0) {
      return res.status(400).json({ error: "Email already registered" })
    }

    const usernameCheck = await supabaseRequest(`/users?username=eq.${encodeURIComponent(username)}`)
    if (usernameCheck && usernameCheck.length > 0) {
      return res.status(400).json({ error: "Username already taken" })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const timeString = new Date().toISOString()
    const insertHeaders = { Prefer: "return=representation" }

    const createdUsers = await supabaseRequest("/users", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        username,
        email,
        password_hash: passwordHash,
        account_status: "active",
        created_at: timeString,
        updated_at: timeString,
      }),
    })

    if (!createdUsers || createdUsers.length === 0) {
      throw new Error("User creation returned empty representation")
    }

    const newUser = createdUsers[0]
    await supabaseRequest("/user_roles", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        user_id: newUser.id,
        role_id: 1,
        created_at: timeString,
      }),
    })

    await supabaseRequest("/wallets", {
      method: "POST",
      headers: insertHeaders,
      body: JSON.stringify({
        user_id: newUser.id,
        current_balance: 10000.0,
        currency: "KES",
        created_at: timeString,
        updated_at: timeString,
      }),
    })

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: "user" },
      JWT_SECRET,
      { expiresIn: "8h" },
    )

    res.status(200).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: "user",
      },
    })
  } catch (error) {
    console.error("Registration serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

export async function me(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
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
    if (user.account_status !== "active") {
      return res.status(403).json({ error: "Account is inactive" })
    }

    const userRoles = await supabaseRequest(`/user_roles?user_id=eq.${user.id}`)
    let role = "user"
    if (userRoles && userRoles.length > 0) {
      const roleId = userRoles[0].role_id
      if (roleId === 2) role = "admin"
      else if (roleId === 3) role = "super_admin"
    }
    role = resolveLoginRole(user, role)

    const wallets = await supabaseRequest(`/wallets?user_id=eq.${user.id}`)
    const wallet = wallets && wallets.length > 0 ? wallets[0] : null
    const currentBalance = Number(wallet?.current_balance || 0)
    const totalDeposits = Number(wallet?.total_deposits || 0)
    const totalWithdrawals = Number(wallet?.total_withdrawals || 0)

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      account_status: user.account_status,
      current_balance: currentBalance,
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
    })
  } catch (error) {
    console.error("Auth/me serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export async function updateProfile(req, res) {
  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" })
  }
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]
  const { username } = req.body || {}
  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const existing = await supabaseRequest(
      `/users?username=eq.${encodeURIComponent(username.trim())}&id=ne.${decoded.id}`,
    )
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Username already taken by another user" })
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

export async function changePassword(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const users = await supabaseRequest(`/users?id=eq.${decoded.id}`)
    if (!users || users.length === 0) return res.status(404).json({ error: "User not found" })

    const user = users[0]
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isPasswordValid) return res.status(400).json({ error: "Invalid current password" })

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    const timeString = new Date().toISOString()

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: hashedNewPassword,
        updated_at: timeString,
      }),
    })

    res.status(200).json({ ok: true, message: "Password updated successfully" })
  } catch (error) {
    console.error("Change password serverless error:", error)
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export async function forgotPassword(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: "Email is required" })

  try {
    const users = await supabaseRequest(`/users?email=eq.${encodeURIComponent(email)}`)
    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Email address not found" })
    }

    const user = users[0]
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const tokenHash = await bcrypt.hash(otpCode, 10)
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString()
    const timeString = new Date().toISOString()

    await supabaseRequest("/password_reset_tokens", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: timeString,
      }),
    })

    res.status(200).json({
      ok: true,
      message: "If the email matches a registered account, a password reset OTP code has been generated.",
      otpCode,
    })
  } catch (error) {
    console.error("Forgot password serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

export async function resetPassword(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  const { email, otpCode, newPassword } = req.body || {}
  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ error: "Email, OTP code, and new password are required" })
  }

  try {
    const users = await supabaseRequest(`/users?email=eq.${encodeURIComponent(email)}`)
    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Invalid email or OTP code" })
    }

    const user = users[0]
    const tokens = await supabaseRequest(
      `/password_reset_tokens?user_id=eq.${user.id}&used_at=is.null`,
    )

    let validToken = null
    const now = new Date()
    for (const token of tokens || []) {
      const expiresAt = new Date(token.expires_at)
      if (expiresAt > now) {
        const matches = await bcrypt.compare(otpCode, token.token_hash)
        if (matches) {
          validToken = token
          break
        }
      }
    }

    if (!validToken) {
      return res.status(400).json({ error: "Invalid or expired OTP code" })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    const timeString = new Date().toISOString()

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: hashedNewPassword,
        updated_at: timeString,
      }),
    })

    await supabaseRequest(`/password_reset_tokens?id=eq.${validToken.id}`, {
      method: "PATCH",
      body: JSON.stringify({ used_at: timeString }),
    })

    res.status(200).json({ ok: true, message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password serverless error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}

const handlers = {
  login,
  register,
  me,
  "update-profile": updateProfile,
  "change-password": changePassword,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
}

export default function handler(req, res) {
  const action = req.query?.action || req.url?.split("?")[0].split("/").pop()
  const actionHandler = handlers[action]

  if (!actionHandler) {
    return res.status(404).json({ error: `Auth action '${action}' not found` })
  }

  return actionHandler(req, res)
}
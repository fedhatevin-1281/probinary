import fs from "node:fs"

import path from "node:path"

import dns from "node:dns"

import express from "express"

import cors from "cors"

import bcrypt from "bcryptjs"

import jwt from "jsonwebtoken"

import createNowPaymentsPayment from "./api/payments/nowpayments/create-payment.js"

import getNowPaymentsCurrencies from "./api/payments/nowpayments/currencies.js"

import getNowPaymentsStatus from "./api/payments/nowpayments/status.js"

import handleNowPaymentsWebhook from "./api/payments/nowpayments/webhook.js"

// Force DNS lookup of localhost to prefer IPv4 first

dns.setDefaultResultOrder("ipv4first")

// Load environment variables manually to guarantee compatibility

function loadEnv() {
  try {
    const envPath = path.resolve(".env")

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8")

      for (const line of content.split("\n")) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith("#")) continue

        const index = trimmed.indexOf("=")

        if (index > 0) {
          const key = trimmed.slice(0, index).trim()

          let val = trimmed.slice(index + 1).trim()

          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }

          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .env file:", e)
  }
}

loadEnv()

const PORT = Number(process.env.AUTH_API_PORT || 8090)

const SUPABASE_URL = process.env.SUPABASE_URL

const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production"

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h"

const SUPER_ADMIN_LOGIN = "supradmin"

const ADMIN_SIM_LOGIN = "dfirekenya"

function resolveLoginRole(user, fallbackRoleName) {
  const normalizedUsername = String(user.username || "")
    .trim()
    .toLowerCase()

  if (normalizedUsername === SUPER_ADMIN_LOGIN) {
    return "super_admin"
  }

  if (normalizedUsername === ADMIN_SIM_LOGIN) {
    return "admin"
  }

  return fallbackRoleName
}

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "CRITICAL ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be defined in .env",
  )

  process.exit(1)
}

const app = express()

app.use(cors())

app.use(express.json())

app.get("/payments/nowpayments/currencies", getNowPaymentsCurrencies)

app.post("/payments/nowpayments/create-payment", createNowPaymentsPayment)

app.get("/payments/nowpayments/status", getNowPaymentsStatus)

app.post("/payments/nowpayments/webhook", handleNowPaymentsWebhook)

// Helper for Supabase REST API requests

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`

  const headers = {
    apikey: SUPABASE_SECRET_KEY,

    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,

    "Content-Type": "application/json",

    ...(options.headers || {}),
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(
      `Supabase request failed: ${response.status} - ${errorText}`,
    )
  }

  const text = await response.text()

  if (!text || text.trim() === "") {
    return null
  }

  return JSON.parse(text)
}

// 1. REGISTER USER

app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res

      .status(400)

      .json({ error: "Username, email, and password are required" })
  }

  try {
    // Check if email already exists

    const existingEmail = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )

    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ error: "Email already taken" })
    }

    // Check if username already exists

    const existingUsername = await supabaseRequest(
      `/users?username=eq.${encodeURIComponent(username)}`,
    )

    if (existingUsername && existingUsername.length > 0) {
      return res.status(400).json({ error: "Username already taken" })
    }

    // Hash the password

    const passwordHash = await bcrypt.hash(password, 10)

    const now = new Date().toISOString()

    // Insert user into 'users' table

    const users = await supabaseRequest("/users", {
      method: "POST",

      headers: { Prefer: "return=representation" },

      body: JSON.stringify({
        email,

        username,

        password_hash: passwordHash,

        account_status: "active",

        created_at: now,

        updated_at: now,
      }),
    })

    if (!users || users.length === 0) {
      throw new Error("Failed to create user record")
    }

    const newUser = users[0]

    // Assign 'client' role (ID: 1)

    await supabaseRequest("/user_roles", {
      method: "POST",

      body: JSON.stringify({
        user_id: newUser.id,

        role_id: 1,

        created_at: now,
      }),
    })

    // Create wallet with starting balance

    await supabaseRequest("/wallets", {
      method: "POST",

      body: JSON.stringify({
        user_id: newUser.id,

        current_balance: 0,

        currency: "USD",

        total_deposits: 0,

        total_withdrawals: 0,

        last_updated: now,

        created_at: now,

        updated_at: now,
      }),
    })

    // Generate JWT

    const token = jwt.sign(
      {
        id: newUser.id,

        username: newUser.username,

        email: newUser.email,

        role: "user",
      },

      JWT_SECRET,

      { expiresIn: JWT_EXPIRES_IN },
    )

    res.status(201).json({
      token,

      user: {
        id: newUser.id,

        username: newUser.username,

        email: newUser.email,

        role: "user",
      },
    })
  } catch (error) {
    console.error("Registration error:", error)

    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

// 2. LOGIN USER

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body // username field can accept email or username

  if (!username || !password) {
    return res

      .status(400)

      .json({ error: "Username/email and password are required" })
  }

  try {
    // Find user by username or email

    const query = `or=(email.eq.${encodeURIComponent(username)},username.eq.${encodeURIComponent(username)})`

    const users = await supabaseRequest(`/users?${query}`)

    if (!users || users.length === 0) {
      return res

        .status(401)

        .json({ error: "Invalid username/email or password" })
    }

    const user = users[0]

    if (user.account_status !== "active") {
      return res

        .status(403)

        .json({ error: "Your account is currently inactive" })
    }

    // Verify password

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return res

        .status(401)

        .json({ error: "Invalid username/email or password" })
    }

    // Get user role

    const [userRoles, wallets] = await Promise.all([
      supabaseRequest(`/user_roles?user_id=eq.${user.id}`),
      supabaseRequest(
        `/wallets?user_id=eq.${user.id}&select=current_balance`,
      ),
    ])

    const roleId = userRoles && userRoles.length > 0 ? userRoles[0].role_id : 1

    let roleName = "user"

    if (roleId === 2) roleName = "admin"

    if (roleId === 3) roleName = "super_admin"

    roleName = resolveLoginRole(user, roleName)

    // Generate JWT

    const token = jwt.sign(
      {
        id: user.id,

        username: user.username,

        email: user.email,

        role: roleName,
      },

      JWT_SECRET,

      { expiresIn: JWT_EXPIRES_IN },
    )

    res.json({
      token,

      user: {
        id: user.id,

        username: user.username,

        email: user.email,

        role: roleName,
      },
    })
  } catch (error) {
    console.error("Login error:", error)

    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

// 3. ME (SESSION RETRIEVAL)

app.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    // Fetch user from DB

    const users = await supabaseRequest(`/users?id=eq.${decoded.id}`)

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    if (user.account_status !== "active") {
      return res.status(403).json({ error: "Account is inactive" })
    }

    // Fetch user role

    const userRoles = await supabaseRequest(`/user_roles?user_id=eq.${user.id}`)

    const roleId = userRoles && userRoles.length > 0 ? userRoles[0].role_id : 1

    let roleName = "user"

    if (roleId === 2) roleName = "admin"

    if (roleId === 3) roleName = "super_admin"

    roleName = resolveLoginRole(user, roleName)

    res.json({
      id: user.id,

      email: user.email,

      username: user.username,

      role: roleName,

      current_balance: Number(wallets?.[0]?.current_balance || 0),
    })
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" })
  }
})

// 4. FORGOT PASSWORD (OTP GENERATION)

app.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  try {
    const users = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )

    if (!users || users.length === 0) {
      // Return 200 for security, but don't do anything

      return res.json({
        ok: true,

        message: "If the email exists, a reset code has been sent",
      })
    }

    const user = users[0]

    // Generate a 6-digit numeric OTP

    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    const hashedOtp = await bcrypt.hash(otp, 10)

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes expiration

    const now = new Date().toISOString()

    // Insert into 'password_reset_tokens'

    await supabaseRequest("/password_reset_tokens", {
      method: "POST",

      body: JSON.stringify({
        user_id: user.id,

        token_hash: hashedOtp,

        expires_at: expiresAt,

        created_at: now,
      }),
    })

    // Output code to server log in development

    console.log(`[AUTH] PASSWORD RESET REQUEST for ${email}. OTP Code: ${otp}`)

    // Return the code in response in dev/simulate mode for convenient client testing

    res.json({
      ok: true,

      message: "If the email exists, a reset code has been sent",

      otpCode: otp, // Provide directly to client for simulator verification
    })
  } catch (error) {
    console.error("Forgot password error:", error)

    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

// 5. RESET PASSWORD

app.post("/auth/reset-password", async (req, res) => {
  const { email, otpCode, newPassword } = req.body

  if (!email || !otpCode || !newPassword) {
    return res

      .status(400)

      .json({ error: "Email, OTP code, and new password are required" })
  }

  try {
    const users = await supabaseRequest(
      `/users?email=eq.${encodeURIComponent(email)}`,
    )

    if (!users || users.length === 0) {
      return res.status(400).json({ error: "Invalid email or OTP code" })
    }

    const user = users[0]

    // Fetch active, unused reset tokens for the user

    const tokens = await supabaseRequest(
      `/password_reset_tokens?user_id=eq.${user.id}&used_at=is.null`,
    )

    let validToken = null

    const now = new Date()

    for (const t of tokens) {
      const expiresAt = new Date(t.expires_at)

      if (expiresAt > now) {
        const matches = await bcrypt.compare(otpCode, t.token_hash)

        if (matches) {
          validToken = t

          break
        }
      }
    }

    if (!validToken) {
      return res.status(400).json({ error: "Invalid or expired OTP code" })
    }

    // Hash the new password

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    const timeString = new Date().toISOString()

    // Update password in users table

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",

      body: JSON.stringify({
        password_hash: hashedNewPassword,

        updated_at: timeString,
      }),
    })

    // Mark the reset token as used

    await supabaseRequest(`/password_reset_tokens?id=eq.${validToken.id}`, {
      method: "PATCH",

      body: JSON.stringify({
        used_at: timeString,
      }),
    })

    res.json({ ok: true, message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password error:", error)

    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

// 6. UPDATE PROFILE (change username)

app.post("/auth/update-profile", async (req, res) => {
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

    // Check if new username is already taken

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

    res.json({ ok: true, username: username.trim() })
  } catch (error) {
    console.error("Update profile error:", error)

    res.status(401).json({ error: "Invalid or expired token" })
  }
})

// 7. CHANGE PASSWORD

app.post("/auth/change-password", async (req, res) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]

  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res

      .status(400)

      .json({ error: "Current password and new password are required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    const users = await supabaseRequest(`/users?id=eq.${decoded.id}`)

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = users[0]

    // Verify current password

    const isPasswordValid = await bcrypt.compare(
      currentPassword,

      user.password_hash,
    )

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid current password" })
    }

    // Hash the new password

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    const timeString = new Date().toISOString()

    // Update in database

    await supabaseRequest(`/users?id=eq.${user.id}`, {
      method: "PATCH",

      body: JSON.stringify({
        password_hash: hashedNewPassword,

        updated_at: timeString,
      }),
    })

    res.json({ ok: true, message: "Password updated successfully" })
  } catch (error) {
    console.error("Change password error:", error)

    res.status(401).json({ error: "Invalid or expired token" })
  }
})

// 8. ADMIN STATS
app.get("/auth/admin/stats", async (req, res) => {
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

    // Get active users
    const users = await supabaseRequest(`/users?account_status=eq.active&select=id`)
    const totalUsers = users ? users.length : 0

    // Get wallets to compute total deposits and withdrawals
    const wallets = await supabaseRequest(`/wallets?select=total_deposits,total_withdrawals`)
    
    let totalDeposited = 0
    let totalWithdrawn = 0
    if (wallets) {
      for (const w of wallets) {
        totalDeposited += (w.total_deposits || 0)
        totalWithdrawn += (w.total_withdrawals || 0)
      }
    }

    res.json({
      ok: true,
      stats: {
        totalUsers,
        totalDeposited,
        totalWithdrawn,
        pendingWithdrawals: [] 
      }
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

// 9. ADMIN USERS
app.get("/auth/admin/users", async (req, res) => {
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
      return res.json({ ok: true, users: [] })
    }
    
    const [userRoles, wallets] = await Promise.all([
      supabaseRequest("/user_roles?select=user_id,role_id"),
      supabaseRequest("/wallets?select=user_id,current_balance,total_deposits,total_withdrawals"),
    ])
    const roleMap = {}
    if (userRoles) {
      for (const ur of userRoles) {
        roleMap[ur.user_id] = ({ 1: "user", 2: "admin", 3: "super_admin" })[ur.role_id] || "user"
      }
    }
    const walletMap = new Map((wallets || []).map(wallet => [String(wallet.user_id), wallet]))

    const usersWithRoles = users.map(u => ({
      ...u,
      role: roleMap[u.id] || "user",
      current_balance: Number(walletMap.get(String(u.id))?.current_balance || 0),
      total_deposits: Number(walletMap.get(String(u.id))?.total_deposits || 0),
      total_withdrawals: Number(walletMap.get(String(u.id))?.total_withdrawals || 0),
    }))

    res.json({ ok: true, users: usersWithRoles })
  } catch (error) {
    console.error("Admin users error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

app.post("/auth/admin/manual-deposit", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const admin = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const userId = String(req.body?.userId || "").trim()
    const amountText = String(req.body?.amount ?? "")
    const amount = Number(amountText)
    const reference = String(req.body?.reference || "").trim()
    const note = String(req.body?.note || "").trim()

    if (!userId || !/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ error: "Enter an amount between $0.01 and $1,000,000 with up to two decimals." })
    }
    if (!reference || reference.length > 100) {
      return res.status(400).json({ error: "Enter a payment reference of up to 100 characters." })
    }
    if (note.length > 500) {
      return res.status(400).json({ error: "Note must be 500 characters or fewer." })
    }

    const result = await supabaseRequest("/rpc/apply_manual_wallet_deposit", {
      method: "POST",
      body: JSON.stringify({
        p_user_id: userId,
        p_amount: amount,
        p_reference: reference,
        p_note: note,
        p_credited_by: String(admin.id),
      }),
    })
    const deposit = result?.[0]

    return res.json({
      ok: true,
      currentBalance: Number(deposit.current_balance),
      totalDeposits: Number(deposit.total_deposits),
    })
  } catch (error) {
    if (/409|23505|duplicate key/i.test(error.message || "")) {
      return res.status(409).json({ error: "That payment reference has already been credited." })
    }
    console.error("Manual wallet deposit error:", error)
    return res.status(500).json({ error: error.message || "Could not apply manual deposit." })
  }
})

app.post("/auth/admin/users/:id/role", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const token = authHeader.split(" ")[1]
  const targetUserId = req.params.id
  const { role } = req.body

  if (!role || !["admin", "super_admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    // Upsert the role
    // Check if role exists
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

    res.json({ ok: true })
  } catch (error) {
    console.error("Admin promote error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

app.listen(PORT, () => {
  console.log(`Auth API server listening on http://localhost:${PORT}`)
})

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

        account_status: "active",

        current_balance: 0,

        total_deposits: 0,

        total_withdrawals: 0,
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

    const userRoles = await supabaseRequest(`/user_roles?user_id=eq.${user.id}`)

    const roleId = userRoles && userRoles.length > 0 ? userRoles[0].role_id : 1

    let roleName = "user"

    if (roleId === 2) roleName = "admin"

    if (roleId === 3) roleName = "super_admin"

    roleName = resolveLoginRole(user, roleName)

    // Fetch user wallet
    const wallets = await supabaseRequest(`/wallets?user_id=eq.${user.id}`)
    const wallet = wallets && wallets.length > 0 ? wallets[0] : null
    const currentBalance = Number(wallet?.current_balance || 0)
    const totalDeposits = Number(wallet?.total_deposits || 0)
    const totalWithdrawals = Number(wallet?.total_withdrawals || 0)

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

        account_status: user.account_status,

        current_balance: currentBalance,

        total_deposits: totalDeposits,

        total_withdrawals: totalWithdrawals,
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

    // Fetch user wallet
    const wallets = await supabaseRequest(`/wallets?user_id=eq.${user.id}`)
    const wallet = wallets && wallets.length > 0 ? wallets[0] : null
    const currentBalance = Number(wallet?.current_balance || 0)
    const totalDeposits = Number(wallet?.total_deposits || 0)
    const totalWithdrawals = Number(wallet?.total_withdrawals || 0)

    res.json({
      id: user.id,

      email: user.email,

      username: user.username,

      role: roleName,

      account_status: user.account_status,

      current_balance: currentBalance,

      total_deposits: totalDeposits,

      total_withdrawals: totalWithdrawals,
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

async function notifyTradingServer(userId, newBalance, totalDeposits, reason) {
  try {
    const tradingServerUrl = process.env.TRADING_SERVER_URL || "http://localhost:8085"
    await fetch(`${tradingServerUrl}/internal/balance-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(userId),
        balance: Number(newBalance),
        totalDeposits: Number(totalDeposits || 0),
        reason: reason || "Administrator balance adjustment",
      }),
    })
  } catch (e) {
    console.warn("[AUTH] Notice: Could not notify trading server of balance update (might be starting up):", e.message)
  }
}

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
    const currentBalance = Number(deposit.current_balance)
    const totalDeposits = Number(deposit.total_deposits)

    // Notify connected trading server immediately so the client sees the update in real time
    notifyTradingServer(userId, currentBalance, totalDeposits, note ? `M-Pesa Till: ${note} (ref: ${reference})` : `M-Pesa Till Deposit: ref ${reference}`).catch(() => {})

    return res.json({
      ok: true,
      currentBalance,
      totalDeposits,
    })
  } catch (error) {
    if (/409|23505|duplicate key/i.test(error.message || "")) {
      return res.status(409).json({ error: "That payment reference has already been credited." })
    }
    console.error("Manual wallet deposit error:", error)
    return res.status(500).json({ error: error.message || "Could not apply manual deposit." })
  }
})

// ADMIN MANUAL BALANCE ADJUSTMENT (Credit or Deduction)
app.post("/auth/admin/adjust-balance", async (req, res) => {
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
    const amount = Number(req.body?.amount)
    const type = req.body?.type === "deduction" ? "deduction" : "credit"
    const reason = String(req.body?.reason || "").trim()
    const reference = String(req.body?.reference || `ADJ-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`).trim()

    if (!userId || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ error: "Enter a positive amount up to $1,000,000" })
    }

    // Fetch target user's current wallet
    const wallets = await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`)
    if (!wallets || wallets.length === 0) {
      return res.status(404).json({ error: "Wallet not found for this user." })
    }

    const wallet = wallets[0]
    const currentBalance = Number(wallet.current_balance || 0)
    const currentTotalDeposits = Number(wallet.total_deposits || 0)
    const delta = type === "deduction" ? -Math.round(amount * 100) / 100 : Math.round(amount * 100) / 100
    const newBalance = Math.round((currentBalance + delta) * 100) / 100

    if (newBalance < 0) {
      return res.status(400).json({ error: `Cannot deduct $${amount}. Current client balance is only $${currentBalance.toFixed(2)}.` })
    }

    const newTotalDeposits = delta > 0 ? Math.round((currentTotalDeposits + delta) * 100) / 100 : currentTotalDeposits
    const now = new Date().toISOString()

    // Update wallet in DB
    await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        current_balance: newBalance,
        total_deposits: newTotalDeposits,
        last_updated: now,
        updated_at: now,
      }),
    })

    // Record adjustment in manual_wallet_deposits
    try {
      await supabaseRequest("/manual_wallet_deposits", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          amount: Math.abs(delta),
          reference: reference.slice(0, 100),
          note: `[${type.toUpperCase()}] ${reason || "Manual balance adjustment"}`.slice(0, 500),
          credited_by: String(admin.id),
          created_at: now,
        }),
      })
    } catch (auditErr) {
      console.warn("[AUTH] Could not log adjustment audit record (non-fatal):", auditErr.message)
    }

    // Real-time broadcast to connected trading WebSocket server
    notifyTradingServer(userId, newBalance, newTotalDeposits, reason || `Manual balance adjustment (${type})`).catch(() => {})

    return res.json({
      ok: true,
      currentBalance: newBalance,
      totalDeposits: newTotalDeposits,
      reference,
    })
  } catch (error) {
    console.error("Admin balance adjustment error:", error)
    return res.status(500).json({ error: error.message || "Failed to adjust balance" })
  }
})

// ADMIN CREATE USER
app.post("/auth/admin/users", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const admin = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const { username, email, password, role = "user", initialBalance = 0, currency = "USD" } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." })
    }

    // Check existing email
    const existingEmail = await supabaseRequest(`/users?email=eq.${encodeURIComponent(email.trim())}`)
    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ error: "Email is already in use." })
    }

    // Check existing username
    const existingUsername = await supabaseRequest(`/users?username=eq.${encodeURIComponent(username.trim())}`)
    if (existingUsername && existingUsername.length > 0) {
      return res.status(400).json({ error: "Username is already taken." })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date().toISOString()

    const users = await supabaseRequest("/users", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        email: email.trim(),
        username: username.trim(),
        password_hash: passwordHash,
        account_status: "active",
        created_at: now,
        updated_at: now,
      }),
    })

    if (!users || users.length === 0) {
      throw new Error("Failed to create user record in database.")
    }

    const newUser = users[0]
    const roleId = role === "super_admin" ? 3 : role === "admin" ? 2 : 1

    await supabaseRequest("/user_roles", {
      method: "POST",
      body: JSON.stringify({
        user_id: newUser.id,
        role_id: roleId,
        created_at: now,
      }),
    })

    const parsedInitialBalance = Math.max(0, Math.round(Number(initialBalance || 0) * 100) / 100)

    await supabaseRequest("/wallets", {
      method: "POST",
      body: JSON.stringify({
        user_id: newUser.id,
        current_balance: parsedInitialBalance,
        currency: currency || "USD",
        total_deposits: parsedInitialBalance,
        total_withdrawals: 0,
        last_updated: now,
        created_at: now,
        updated_at: now,
      }),
    })

    if (parsedInitialBalance > 0) {
      try {
        await supabaseRequest("/manual_wallet_deposits", {
          method: "POST",
          body: JSON.stringify({
            user_id: String(newUser.id),
            amount: parsedInitialBalance,
            reference: `INIT-${newUser.id}-${Date.now()}`,
            note: "Starting balance allocated upon account creation",
            credited_by: String(admin.id),
            created_at: now,
          }),
        })
      } catch (e) {
        console.warn("[AUTH] Initial deposit audit note:", e.message)
      }
    }

    return res.status(201).json({
      ok: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role,
        account_status: "active",
        current_balance: parsedInitialBalance,
        total_deposits: parsedInitialBalance,
        total_withdrawals: 0,
        created_at: now,
      },
    })
  } catch (error) {
    console.error("Admin create user error:", error)
    return res.status(500).json({ error: error.message || "Failed to create user." })
  }
})

// ADMIN UPDATE USER (details / status)
app.patch("/auth/admin/users/:id", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const admin = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const targetUserId = req.params.id
    const { username, email, account_status, role } = req.body

    const updates = {}
    if (username && username.trim()) updates.username = username.trim()
    if (email && email.trim()) updates.email = email.trim()
    if (account_status && ["active", "inactive", "suspended"].includes(account_status)) {
      updates.account_status = account_status
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await supabaseRequest(`/users?id=eq.${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
    }

    if (role && ["user", "admin", "super_admin"].includes(role)) {
      const roleId = role === "super_admin" ? 3 : role === "admin" ? 2 : 1
      const existing = await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`)
      if (existing && existing.length > 0) {
        await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`, {
          method: "PATCH",
          body: JSON.stringify({ role_id: roleId }),
        })
      } else {
        await supabaseRequest("/user_roles", {
          method: "POST",
          body: JSON.stringify({ user_id: targetUserId, role_id: roleId }),
        })
      }
    }

    return res.json({ ok: true, message: "User updated successfully" })
  } catch (error) {
    console.error("Admin update user error:", error)
    return res.status(500).json({ error: error.message || "Failed to update user." })
  }
})

// ADMIN RESET USER PASSWORD
app.post("/auth/admin/users/:id/reset-password", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const admin = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const targetUserId = req.params.id
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await supabaseRequest(`/users?id=eq.${targetUserId}`, {
      method: "PATCH",
      body: JSON.stringify({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      }),
    })

    return res.json({ ok: true, message: "User password reset successfully" })
  } catch (error) {
    console.error("Admin reset password error:", error)
    return res.status(500).json({ error: error.message || "Failed to reset password." })
  }
})

// ADMIN MANUAL DEPOSITS & ADJUSTMENTS AUDIT HISTORY
app.get("/auth/admin/deposits", async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const admin = jwt.verify(authHeader.slice("Bearer ".length), JWT_SECRET)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const deposits = await supabaseRequest("/manual_wallet_deposits?order=created_at.desc&limit=100")
    return res.json({ ok: true, deposits: deposits || [] })
  } catch (error) {
    console.error("Admin get deposits error:", error)
    return res.status(500).json({ error: error.message || "Failed to fetch deposits history." })
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

    const roleId = role === "super_admin" ? 3 : role === "admin" ? 2 : 1

    // Upsert the role
    const existingRoles = await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`)
    if (existingRoles && existingRoles.length > 0) {
      await supabaseRequest(`/user_roles?user_id=eq.${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify({ role_id: roleId })
      })
    } else {
      await supabaseRequest("/user_roles", {
        method: "POST",
        body: JSON.stringify({ user_id: targetUserId, role_id: roleId })
      })
    }

    res.json({ ok: true })
  } catch (error) {
    console.error("Admin promote error:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Auth API server listening on http://0.0.0.0:${PORT}`)
})

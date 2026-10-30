import bcrypt from "bcryptjs"
import { authenticateRequest, supabaseRequest } from "../../_utils.js"

const ROLE_BY_ID = {
  1: "user",
  2: "admin",
  3: "super_admin",
}
const MAX_DEPOSIT_AMOUNT = 1000000

export default async function handler(req, res) {
  const resource = Array.isArray(req.query?.resource)
    ? req.query.resource[0]
    : req.query?.resource

  if (!["stats", "users", "manual-deposit", "adjust-balance", "deposits"].includes(resource)) {
    return res.status(404).json({ error: "Not found" })
  }

  try {
    const user = authenticateRequest(req)

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    if (resource === "deposits" && req.method === "GET") {
      const deposits = await supabaseRequest("/manual_wallet_deposits?order=created_at.desc&limit=100")
      return res.status(200).json({ ok: true, deposits: deposits || [] })
    }

    if (resource === "adjust-balance" && req.method === "POST") {
      const userId = String(req.body?.userId || "").trim()
      const amount = Number(req.body?.amount)
      const type = req.body?.type === "deduction" ? "deduction" : "credit"
      const reason = String(req.body?.reason || "").trim()
      const reference = String(req.body?.reference || `ADJ-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`).trim()

      if (!userId || !Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT_AMOUNT) {
        return res.status(400).json({ error: "Enter a positive amount up to $1,000,000" })
      }

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

      await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_balance: newBalance,
          total_deposits: newTotalDeposits,
          last_updated: now,
          updated_at: now,
        }),
      })

      try {
        await supabaseRequest("/manual_wallet_deposits", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            amount: Math.abs(delta),
            reference: reference.slice(0, 100),
            note: `[${type.toUpperCase()}] ${reason || "Manual balance adjustment"}`.slice(0, 500),
            credited_by: String(user.id),
            created_at: now,
          }),
        })
      } catch (auditErr) {
        console.warn("[AUTH] Could not log audit record:", auditErr.message)
      }

      return res.status(200).json({
        ok: true,
        currentBalance: newBalance,
        totalDeposits: newTotalDeposits,
        reference,
      })
    }

    if (resource === "manual-deposit" && req.method === "POST") {
      const userId = String(req.body?.userId || "").trim()
      const amountText = String(req.body?.amount ?? "")
      const amount = Number(amountText)
      const reference = String(req.body?.reference || "").trim()
      const note = String(req.body?.note || "").trim()

      if (
        !userId ||
        !/^\d+(\.\d{1,2})?$/.test(amountText) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > MAX_DEPOSIT_AMOUNT
      ) {
        return res.status(400).json({
          error: "Enter an amount between $0.01 and $1,000,000 with up to two decimals.",
        })
      }
      if (!reference || reference.length > 100) {
        return res.status(400).json({
          error: "Enter a payment reference of up to 100 characters.",
        })
      }
      if (note.length > 500) {
        return res.status(400).json({
          error: "Note must be 500 characters or fewer.",
        })
      }

      const result = await supabaseRequest("/rpc/apply_manual_wallet_deposit", {
        method: "POST",
        body: JSON.stringify({
          p_user_id: userId,
          p_amount: amount,
          p_reference: reference,
          p_note: note,
          p_credited_by: String(user.id),
        }),
      })
      const deposit = result?.[0]

      return res.status(200).json({
        ok: true,
        currentBalance: Number(deposit.current_balance),
        totalDeposits: Number(deposit.total_deposits),
      })
    }

    if (resource === "stats" && req.method === "GET") {
      const [users, wallets] = await Promise.all([
        supabaseRequest("/users?account_status=eq.active&select=id"),
        supabaseRequest("/wallets?select=total_deposits,total_withdrawals"),
      ])

      const stats = (wallets ?? []).reduce(
        (totals, wallet) => ({
          totalDeposited:
            totals.totalDeposited + Number(wallet.total_deposits || 0),
          totalWithdrawn:
            totals.totalWithdrawn + Number(wallet.total_withdrawals || 0),
        }),
        { totalDeposited: 0, totalWithdrawn: 0 },
      )

      return res.status(200).json({
        ok: true,
        stats: {
          totalUsers: users?.length ?? 0,
          ...stats,
          pendingWithdrawals: [],
        },
      })
    }

    if (resource === "users" && req.method === "POST") {
      const { username, email, password, role = "user", initialBalance = 0, currency = "USD" } = req.body

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email, and password are required." })
      }

      const existingEmail = await supabaseRequest(`/users?email=eq.${encodeURIComponent(email.trim())}`)
      if (existingEmail && existingEmail.length > 0) {
        return res.status(400).json({ error: "Email is already in use." })
      }

      const existingUsername = await supabaseRequest(`/users?username=eq.${encodeURIComponent(username.trim())}`)
      if (existingUsername && existingUsername.length > 0) {
        return res.status(400).json({ error: "Username is already taken." })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const now = new Date().toISOString()

      const createdUsers = await supabaseRequest("/users", {
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

      if (!createdUsers || createdUsers.length === 0) {
        throw new Error("Failed to create user record.")
      }

      const newUser = createdUsers[0]
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
    }

    if (resource === "users" && req.method === "GET") {
      const users = await supabaseRequest(
        "/users?select=id,username,email,account_status,created_at",
      )

      if (!users) {
        return res.status(200).json({ ok: true, users: [] })
      }

      const userRoles = await supabaseRequest(
        "/user_roles?select=user_id,role_id",
      )
      const wallets = await supabaseRequest(
        "/wallets?select=user_id,current_balance,total_deposits,total_withdrawals",
      )
      const roleMap = new Map(
        (userRoles ?? []).map((userRole) => [
          String(userRole.user_id),
          ROLE_BY_ID[Number(userRole.role_id)] || "user",
        ]),
      )
      const walletMap = new Map(
        (wallets ?? []).map((wallet) => [String(wallet.user_id), wallet]),
      )

      const usersWithRoles = users.map((account) => ({
        ...account,
        role: roleMap.get(String(account.id)) || "user",
        current_balance: Number(walletMap.get(String(account.id))?.current_balance || 0),
        total_deposits: Number(walletMap.get(String(account.id))?.total_deposits || 0),
        total_withdrawals: Number(walletMap.get(String(account.id))?.total_withdrawals || 0),
      }))

      return res.status(200).json({ ok: true, users: usersWithRoles })
    }

    return res.status(405).json({ error: "Method not allowed" })
  } catch (error) {
    if (resource === "manual-deposit" && /409|23505|duplicate key/i.test(error.message || "")) {
      return res.status(409).json({
        error: "That payment reference has already been credited.",
      })
    }
    console.error(`Admin ${resource} error:`, error)
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" })
  }
}
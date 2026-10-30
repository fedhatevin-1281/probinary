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

  if (!["stats", "users", "manual-deposit"].includes(resource)) {
    return res.status(404).json({ error: "Not found" })
  }
  if (resource === "manual-deposit" ? req.method !== "POST" : req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const user = authenticateRequest(req)

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    if (resource === "manual-deposit") {
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

    if (resource === "stats") {
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
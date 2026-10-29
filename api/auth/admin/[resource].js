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

  const resource = Array.isArray(req.query?.resource)
    ? req.query.resource[0]
    : req.query?.resource

  if (resource !== "stats" && resource !== "users") {
    return res.status(404).json({ error: "Not found" })
  }

  try {
    const user = authenticateRequest(req)

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
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
    const roleMap = new Map(
      (userRoles ?? []).map((userRole) => [
        String(userRole.user_id),
        ROLE_BY_ID[Number(userRole.role_id)] || "user",
      ]),
    )

    const usersWithRoles = users.map((account) => ({
      ...account,
      role: roleMap.get(String(account.id)) || "user",
    }))

    return res.status(200).json({ ok: true, users: usersWithRoles })
  } catch (error) {
    console.error(`Admin ${resource} error:`, error)
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" })
  }
}
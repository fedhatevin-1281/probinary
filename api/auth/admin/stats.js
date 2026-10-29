import { authenticateRequest, supabaseRequest } from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const user = authenticateRequest(req)

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const [users, wallets] = await Promise.all([
      supabaseRequest("/users?account_status=eq.active&select=id"),
      supabaseRequest("/wallets?select=total_deposits,total_withdrawals"),
    ])

    const stats = (wallets ?? []).reduce(
      (totals, wallet) => ({
        totalDeposited: totals.totalDeposited + Number(wallet.total_deposits || 0),
        totalWithdrawn: totals.totalWithdrawn + Number(wallet.total_withdrawals || 0),
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
  } catch (error) {
    console.error("Admin stats error:", error)
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" })
  }
}
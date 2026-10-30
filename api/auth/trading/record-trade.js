import jwt from "jsonwebtoken"
import { JWT_SECRET, supabaseRequest } from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    const token = authHeader.slice("Bearer ".length)
    const user = jwt.verify(token, JWT_SECRET)
    if (!user || !user.id) {
      return res.status(401).json({ error: "Invalid user token" })
    }

    const trade = req.body
    if (!trade || !trade.id) {
      return res.status(400).json({ error: "Trade payload is required" })
    }

    const tradeId = String(trade.id).trim()
    const isDemo = Boolean(trade.isDemo)
    const stake = Number(trade.stake || 0)
    const profit = Number(trade.profit || 0)
    const payout = Number(trade.payout || 0)
    const result = trade.result === "won" ? "won" : "lost"
    const now = new Date().toISOString()
    const userId = String(user.id)

    const existingTrades = await supabaseRequest(
      `/binary_trade_records?user_id=eq.${encodeURIComponent(userId)}&trade_id=eq.${encodeURIComponent(tradeId)}`
    )

    const existingRecord = existingTrades && existingTrades.length > 0 ? existingTrades[0] : null
    if (existingRecord && existingRecord.settled_at) {
      const wallets = await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`)
      const currentBalance = Number(wallets?.[0]?.current_balance || 0)
      return res.json({ ok: true, currentBalance, alreadyRecorded: true })
    }

    let updatedBalance = 0
    let totalDeposits = 0

    if (!isDemo) {
      const wallets = await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`)
      if (!wallets || wallets.length === 0) {
        return res.status(404).json({ error: "Wallet not found" })
      }

      const wallet = wallets[0]
      const currentBalance = Number(wallet.current_balance || 0)
      totalDeposits = Number(wallet.total_deposits || 0)

      let delta = 0
      if (existingRecord && existingRecord.status === "open") {
        delta = result === "won" ? payout : 0
      } else {
        delta = Math.round(profit * 100) / 100
      }

      let newBalance = Math.round((currentBalance + delta) * 100) / 100
      if (newBalance < 0) newBalance = 0

      if (delta !== 0) {
        await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            current_balance: newBalance,
            last_updated: now,
            updated_at: now,
          }),
        })
      }

      updatedBalance = newBalance

      try {
        await supabaseRequest("/transaction_history", {
          method: "POST",
          body: JSON.stringify({
            user_id: Number(user.id),
            transaction_type: "trade",
            amount: Math.abs(delta),
            currency: wallet.currency || "USD",
            status: "completed",
            payment_reference: tradeId.slice(0, 100),
            description: `Trade ${result.toUpperCase()}: ${trade.symbol || ""} (${delta >= 0 ? "+" : ""}${delta})`,
            metadata_json: {
              tradeId,
              symbol: trade.symbol,
              stake,
              payout,
              profit,
              result,
            },
            created_at: now,
            updated_at: now,
          }),
        })
      } catch (txErr) {
        console.warn("[AUTH] Notice: transaction_history logging skipped:", txErr.message)
      }
    } else {
      const wallets = await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}`)
      updatedBalance = Number(wallets?.[0]?.current_balance || 0)
      totalDeposits = Number(wallets?.[0]?.total_deposits || 0)
    }

    const tradeRecord = {
      user_id: userId,
      trade_id: tradeId,
      is_demo: isDemo,
      symbol: String(trade.symbol || "UNKNOWN"),
      market_name: String(trade.marketName || trade.symbol || "Market"),
      contract_type: String(trade.contractType || "rise-fall"),
      direction: String(trade.direction || "rise"),
      stake: Math.max(0, stake),
      entry_price: Number(trade.entryPrice || 0),
      entry_digit: Number(trade.entryDigit || 0),
      expiry_at: trade.expiryAt ? new Date(trade.expiryAt).toISOString() : now,
      expiry_seconds: Number(trade.expirySeconds || 30),
      payout_multiplier: Number(trade.payoutMultiplier || 1.8),
      status: result,
      result: result,
      exit_price: Number(trade.exitPrice || trade.entryPrice || 0),
      exit_digit: Number(trade.exitDigit ?? 0),
      payout: Math.max(0, payout),
      profit: profit,
      created_at: trade.createdAt ? new Date(trade.createdAt).toISOString() : now,
      settled_at: trade.settledAt ? new Date(trade.settledAt).toISOString() : now,
    }

    if (existingTrades && existingTrades.length > 0) {
      await supabaseRequest(
        `/binary_trade_records?user_id=eq.${encodeURIComponent(userId)}&trade_id=eq.${encodeURIComponent(tradeId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(tradeRecord),
        }
      )
    } else {
      await supabaseRequest("/binary_trade_records", {
        method: "POST",
        body: JSON.stringify(tradeRecord),
      })
    }

    return res.json({
      ok: true,
      currentBalance: updatedBalance,
      totalDeposits,
      trade: tradeRecord,
    })
  } catch (err) {
    console.error("Record trade serverless error:", err)
    return res.status(500).json({ error: err.message || "Failed to record trade" })
  }
}

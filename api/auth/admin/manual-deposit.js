import { authenticateRequest, supabaseRequest } from "../../_utils.js"

const MAX_DEPOSIT_AMOUNT = 1000000

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const admin = authenticateRequest(req)
    if (admin.role !== "admin" && admin.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" })
    }

    const userId = String(req.body?.userId || "").trim()
    const amount = Number(req.body?.amount)
    const reference = String(req.body?.reference || "").trim()
    const note = String(req.body?.note || "").trim()

    if (!userId || !/^\d+(\.\d{1,2})?$/.test(String(req.body?.amount ?? "")) ||
        !Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT_AMOUNT) {
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
    return res.status(200).json({
      ok: true,
      currentBalance: Number(deposit.current_balance),
      totalDeposits: Number(deposit.total_deposits),
    })
  } catch (error) {
    if (/409|23505|duplicate key/i.test(error.message || "")) {
      return res.status(409).json({ error: "That payment reference has already been credited." })
    }
    console.error("Manual wallet deposit error:", error)
    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Could not apply manual deposit." })
  }
}
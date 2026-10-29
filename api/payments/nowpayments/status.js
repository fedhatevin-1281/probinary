import { authenticateRequest, supabaseRequest } from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  let user

  try {
    user = authenticateRequest(req)
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message })
  }

  const orderId = String(req.query?.order_id || "")

  if (!orderId) return res.status(400).json({ error: "order_id is required" })

  try {
    const orders = await supabaseRequest(
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(String(user.id))}&select=order_id,amount_usd,payment_status,payment_id,pay_address,pay_amount,pay_currency,payin_extra_id,payin_extra_id_name,credited_at,created_at`,
    )

    if (!orders?.length) return res.status(404).json({ error: "Deposit not found" })

    const order = orders[0]
    const wallets = order.credited_at
      ? await supabaseRequest(
          `/wallets?user_id=eq.${encodeURIComponent(String(user.id))}&select=current_balance`,
        )
      : null

    return res.status(200).json({
      orderId: order.order_id,
      amountUsd: Number(order.amount_usd),
      status: order.credited_at ? "completed" : order.payment_status,
      paymentId: order.payment_id,
      payAddress: order.pay_address,
      payAmount: order.pay_amount === null ? null : Number(order.pay_amount),
      payCurrency: order.pay_currency,
      payinExtraId: order.payin_extra_id,
      payinExtraIdName: order.payin_extra_id_name,
      creditedAt: order.credited_at,
      createdAt: order.created_at,
      currentBalance: wallets?.length ? Number(wallets[0].current_balance) : null,
    })
  } catch (error) {
    console.error("NOWPayments status lookup failed:", error)
    return res.status(500).json({ error: "Could not check deposit status." })
  }
}
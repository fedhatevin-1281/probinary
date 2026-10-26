import {
  supabaseRequest,
  verifyNowPaymentsSignature,
} from "../../_utils.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const payload = req.body
  const signature = req.headers["x-nowpayments-sig"]

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "Invalid IPN payload" })
  }

  if (!verifyNowPaymentsSignature(payload, signature)) {
    return res.status(401).json({ error: "Invalid IPN signature" })
  }

  const orderId = String(payload.order_id || "")
  const paymentStatus = String(payload.payment_status || "").toLowerCase()

  if (!orderId || !paymentStatus) {
    return res.status(400).json({ error: "Missing order or payment status" })
  }

  try {
    const orders = await supabaseRequest(
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,amount_usd,invoice_id,credited_at`,
    )

    if (!orders?.length) return res.status(404).json({ error: "Order not found" })

    const order = orders[0]
    const expectedAmount = Number(order.amount_usd)
    const invoiceId = payload.invoice_id == null ? "" : String(payload.invoice_id)
    const amount = Number(payload.price_amount)
    const currency = String(payload.price_currency || "").toLowerCase()

    if (
      (invoiceId && order.invoice_id && invoiceId !== String(order.invoice_id)) ||
      currency !== "usd" ||
      !Number.isFinite(amount) ||
      amount !== expectedAmount
    ) {
      return res.status(400).json({ error: "IPN does not match the invoice" })
    }

    if (paymentStatus === "finished") {
      if (!payload.payment_id) {
        return res.status(400).json({ error: "Missing payment ID" })
      }

      await supabaseRequest("/rpc/complete_nowpayments_order", {
        method: "POST",
        body: JSON.stringify({
          p_order_id: orderId,
          p_payment_id: String(payload.payment_id),
          p_amount_usd: amount,
          p_price_currency: currency,
        }),
      })
    } else {
      await supabaseRequest(
        `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}&credited_at=is.null`,
        {
          method: "PATCH",
          body: JSON.stringify({
            payment_status: paymentStatus,
            payment_id: payload.payment_id ? String(payload.payment_id) : null,
            updated_at: new Date().toISOString(),
          }),
        },
      )
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error("NOWPayments IPN processing failed:", error)
    return res.status(500).json({ error: "Could not process IPN" })
  }
}
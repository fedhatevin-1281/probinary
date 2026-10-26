import { randomUUID } from "node:crypto"

import {
  authenticateRequest,
  getPublicAppUrl,
  nowPaymentsRequest,
  supabaseRequest,
} from "../../_utils.js"

const MIN_DEPOSIT_USD = 3
const MAX_DEPOSIT_USD = 50000

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  let user

  try {
    user = authenticateRequest(req)
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message })
  }

  const amountUsd = Math.round(Number(req.body?.amountUsd) * 100) / 100

  if (
    !Number.isFinite(amountUsd) ||
    amountUsd < MIN_DEPOSIT_USD ||
    amountUsd > MAX_DEPOSIT_USD
  ) {
    return res.status(400).json({
      error: `Deposit amount must be between $${MIN_DEPOSIT_USD} and $${MAX_DEPOSIT_USD}.`,
    })
  }

  let appUrl

  try {
    appUrl = getPublicAppUrl()

    if (!process.env.NOWPAYMENTS_API_KEY || !process.env.NOWPAYMENTS_IPN_SECRET) {
      throw new Error("NOWPayments is not configured")
    }
  } catch (error) {
    return res.status(503).json({ error: error.message })
  }

  const orderId = randomUUID()
  const userId = String(user.id)
  const timestamp = new Date().toISOString()

  try {
    await supabaseRequest("/nowpayments_orders", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId,
        amount_usd: amountUsd,
        payment_status: "creating",
        created_at: timestamp,
        updated_at: timestamp,
      }),
    })

    const successUrl = new URL(appUrl)
    successUrl.searchParams.set("nowpayments_order", orderId)

    const cancelUrl = new URL(appUrl)
    cancelUrl.searchParams.set("nowpayments_cancelled", orderId)

    const invoice = await nowPaymentsRequest("/invoice", {
      method: "POST",
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: "usd",
        order_id: orderId,
        order_description: `Pro Binary wallet deposit ${orderId}`,
        ipn_callback_url: `${appUrl}/api/payments/nowpayments/webhook`,
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
      }),
    })

    const invoiceUrl = new URL(invoice.invoice_url)

    if (invoiceUrl.protocol !== "https:") {
      throw new Error("NOWPayments returned an invalid invoice URL")
    }

    await supabaseRequest(
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          invoice_id: String(invoice.id),
          invoice_url: invoiceUrl.toString(),
          payment_status: "waiting",
          updated_at: new Date().toISOString(),
        }),
      },
    )

    return res.status(201).json({
      orderId,
      invoiceUrl: invoiceUrl.toString(),
    })
  } catch (error) {
    console.error("NOWPayments invoice creation failed:", error)

    await supabaseRequest(
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        }),
      },
    ).catch((updateError) => {
      console.error("Could not update failed NOWPayments order:", updateError)
    })

    return res.status(502).json({ error: "Could not create a crypto invoice." })
  }
}
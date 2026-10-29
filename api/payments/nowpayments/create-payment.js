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
  const payCurrency = String(req.body?.payCurrency || "").trim().toLowerCase()

  if (
    !Number.isFinite(amountUsd) ||
    amountUsd < MIN_DEPOSIT_USD ||
    amountUsd > MAX_DEPOSIT_USD
  ) {
    return res.status(400).json({
      error: `Deposit amount must be between $${MIN_DEPOSIT_USD} and $${MAX_DEPOSIT_USD}.`,
    })
  }

  if (!/^[a-z0-9]+$/.test(payCurrency)) {
    return res.status(400).json({ error: "Choose a supported cryptocurrency." })
  }

  if (!process.env.NOWPAYMENTS_API_KEY || !process.env.NOWPAYMENTS_IPN_SECRET) {
    return res.status(503).json({ error: "NOWPayments is not configured" })
  }

  let appUrl

  try {
    appUrl = getPublicAppUrl()
  } catch (error) {
    return res.status(503).json({ error: error.message })
  }

  const orderId = randomUUID()
  const userId = String(user.id)
  const timestamp = new Date().toISOString()

  try {
    const currencyResult = await nowPaymentsRequest("/currencies")
    const currencies = Array.isArray(currencyResult?.currencies)
      ? currencyResult.currencies.map((currency) => String(currency).toLowerCase())
      : []

    if (!currencies.includes(payCurrency)) {
      return res.status(400).json({ error: "That cryptocurrency is not currently supported." })
    }

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

    const payment = await nowPaymentsRequest("/payment", {
      method: "POST",
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: "usd",
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: `Pro Binary wallet deposit ${orderId}`,
        ipn_callback_url: `${appUrl}/api/payments/nowpayments/webhook`,
      }),
    })

    const paymentId = String(payment.payment_id || "")
    const payAddress = String(payment.pay_address || "")
    const payAmount = Number(payment.pay_amount)
    const returnedCurrency = String(payment.pay_currency || payCurrency).toLowerCase()
    const payinExtraId = payment.payin_extra_id
      ? String(payment.payin_extra_id)
      : null
    const payinExtraIdName = payment.payin_extra_id_name
      ? String(payment.payin_extra_id_name)
      : null

    if (!paymentId || !payAddress || !Number.isFinite(payAmount) || payAmount <= 0) {
      throw new Error("NOWPayments returned incomplete payment instructions")
    }

    await supabaseRequest(
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          payment_id: paymentId,
          pay_address: payAddress,
          pay_amount: payAmount,
          pay_currency: returnedCurrency,
          payin_extra_id: payinExtraId,
          payin_extra_id_name: payinExtraIdName,
          payment_status: payment.payment_status || "waiting",
          updated_at: new Date().toISOString(),
        }),
      },
    )

    return res.status(201).json({
      orderId,
      amountUsd,
      status: payment.payment_status || "waiting",
      paymentId,
      payAddress,
      payAmount,
      payCurrency: returnedCurrency,
      payinExtraId,
      payinExtraIdName,
      creditedAt: null,
      createdAt: timestamp,
      currentBalance: null,
    })
  } catch (error) {
    console.error("NOWPayments payment creation failed:", error)

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

    return res.status(502).json({ error: "Could not create a crypto payment." })
  }
}
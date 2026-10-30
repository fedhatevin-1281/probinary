import { randomUUID } from "node:crypto"
import {
  authenticateRequest,
  getPublicAppUrl,
  nowPaymentsRequest,
  supabaseRequest,
  verifyNowPaymentsSignature,
} from "../../_utils.js"

const MIN_DEPOSIT_USD = 3
const MAX_DEPOSIT_USD = 50000

export async function createPayment(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

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
    const supportedCurrencies = Array.isArray(currencyResult?.currencies)
      ? currencyResult.currencies
      : []

    if (!supportedCurrencies.includes(payCurrency)) {
      return res.status(400).json({
        error: `${payCurrency.toUpperCase()} is not available right now. Choose another cryptocurrency.`,
      })
    }

    const minAmountResult = await nowPaymentsRequest(
      `/min-amount?currency_from=${encodeURIComponent(payCurrency)}&fiat_equivalent=usd`,
    )
    const minRequiredFiat = Number(minAmountResult?.fiat_equivalent)

    if (Number.isFinite(minRequiredFiat) && amountUsd < minRequiredFiat) {
      return res.status(400).json({
        error: `Minimum deposit for ${payCurrency.toUpperCase()} is $${Math.ceil(minRequiredFiat)}.`,
      })
    }

    const orderDescription = `ProBinary deposit: $${amountUsd.toFixed(2)} USD via ${payCurrency.toUpperCase()} for user ${userId}`
    const callbackUrl = `${appUrl}/api/payments/nowpayments/webhook`
    const successUrl = `${appUrl}/?nowpayments_order=${encodeURIComponent(orderId)}`
    const cancelUrl = `${appUrl}/?nowpayments_cancelled=${encodeURIComponent(orderId)}`

    let payment
    try {
      payment = await nowPaymentsRequest("/payment", {
        method: "POST",
        body: JSON.stringify({
          price_amount: amountUsd,
          price_currency: "usd",
          pay_currency: payCurrency,
          ipn_callback_url: callbackUrl,
          order_id: orderId,
          order_description: orderDescription,
          is_fixed_rate: true,
          is_fee_paid_by_user: false,
        }),
      })
    } catch (paymentError) {
      const invoice = await nowPaymentsRequest("/invoice", {
        method: "POST",
        body: JSON.stringify({
          price_amount: amountUsd,
          price_currency: "usd",
          pay_currency: payCurrency,
          ipn_callback_url: callbackUrl,
          order_id: orderId,
          order_description: orderDescription,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })

      payment = {
        payment_id: null,
        invoice_id: invoice.id,
        invoice_url: invoice.invoice_url,
        payment_status: "waiting",
        pay_address: null,
        pay_amount: null,
        pay_currency: payCurrency,
        payin_extra_id: null,
        payin_extra_id_name: null,
      }
    }

    await supabaseRequest("/nowpayments_orders", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId,
        amount_usd: amountUsd,
        pay_currency: payCurrency,
        payment_id: payment.payment_id ? String(payment.payment_id) : null,
        invoice_id: payment.invoice_id ? String(payment.invoice_id) : null,
        invoice_url: payment.invoice_url || null,
        payment_status: payment.payment_status || "waiting",
        pay_address: payment.pay_address || null,
        pay_amount: payment.pay_amount == null ? null : Number(payment.pay_amount),
        payin_extra_id: payment.payin_extra_id || null,
        payin_extra_id_name: payment.payin_extra_id_name || null,
        metadata_json: {
          requestedAmountUsd: amountUsd,
          requestedCurrency: payCurrency,
          appUrl,
        },
        created_at: timestamp,
        updated_at: timestamp,
      }),
    })

    return res.status(200).json({
      orderId,
      amountUsd,
      status: payment.payment_status || "waiting",
      paymentId: payment.payment_id ? String(payment.payment_id) : null,
      invoiceUrl: payment.invoice_url || null,
      payAddress: payment.pay_address || null,
      payAmount: payment.pay_amount == null ? null : Number(payment.pay_amount),
      payCurrency,
      payinExtraId: payment.payin_extra_id || null,
      payinExtraIdName: payment.payin_extra_id_name || null,
      createdAt: timestamp,
    })
  } catch (error) {
    console.error("NOWPayments payment creation failed:", error)
    return res.status(502).json({ error: error.message || "Could not initialize cryptocurrency deposit." })
  }
}

export async function getCurrencies(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  try {
    authenticateRequest(req)
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message })
  }

  try {
    const result = await nowPaymentsRequest("/currencies")
    const currencies = Array.isArray(result?.currencies)
      ? result.currencies.filter((currency) => typeof currency === "string")
      : []

    return res.status(200).json({ currencies })
  } catch (error) {
    console.error("NOWPayments currency lookup failed:", error)
    return res.status(502).json({ error: "Could not load supported cryptocurrencies." })
  }
}

export async function getStatus(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

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

export async function handleWebhook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

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
      `/nowpayments_orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,amount_usd,invoice_id,payment_id,credited_at`,
    )

    if (!orders?.length) return res.status(404).json({ error: "Order not found" })

    const order = orders[0]
    const expectedAmount = Number(order.amount_usd)
    const invoiceId = payload.invoice_id == null ? "" : String(payload.invoice_id)
    const amount = Number(payload.price_amount)
    const currency = String(payload.price_currency || "").toLowerCase()

    if (
      (invoiceId && order.invoice_id && invoiceId !== String(order.invoice_id)) ||
      (order.payment_id && payload.payment_id && String(payload.payment_id) !== String(order.payment_id)) ||
      currency !== "usd" ||
      !Number.isFinite(amount) ||
      amount !== expectedAmount
    ) {
      return res.status(400).json({ error: "IPN does not match the stored payment" })
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

export default async function handler(req, res) {
  const action = req.query?.action || req.url?.split("?")[0].split("/").pop()

  if (action === "create-payment") {
    return createPayment(req, res)
  }

  if (action === "currencies") {
    return getCurrencies(req, res)
  }

  if (action === "status") {
    return getStatus(req, res)
  }

  if (action === "webhook") {
    return handleWebhook(req, res)
  }

  return res.status(404).json({ error: `NOWPayments action '${action}' not found` })
}

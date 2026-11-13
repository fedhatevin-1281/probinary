const crypto = require('crypto');
const { sendJson, supabaseRequest, verifyUser } = require('./makamescopay');

const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';
const SUPPORTED_CURRENCIES = new Set(['usdttrc20', 'usdterc20', 'btc', 'eth', 'sol', 'ltc']);

function sendError(res, status, error) {
  return sendJson(res, status, { success: false, error });
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('Request body is too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

async function callNowPayments(path, body) {
  const response = await fetch(`${NOWPAYMENTS_API}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(data?.message || `NOWPayments request failed (${response.status})`);
  return data;
}

async function createPayment(req, res, user) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendError(res, 400, error.message);
  }

  const amount = Number(body.amount);
  const amountUsd = Math.round(amount * 100) / 100;
  const currency = String(body.currency || '').toLowerCase();
  if (!Number.isFinite(amount) || amountUsd < 5) return sendError(res, 400, 'Minimum crypto deposit is $5 USD.');
  if (!SUPPORTED_CURRENCIES.has(currency)) return sendError(res, 400, 'Unsupported cryptocurrency.');
  if (!process.env.NOWPAYMENTS_API_KEY || !process.env.NOWPAYMENTS_IPN_SECRET) {
    return sendError(res, 503, 'NOWPayments is not configured yet.');
  }

  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) return sendError(res, 503, 'The public payment callback URL is not configured.');
  let callbackUrl;
  try {
    const base = new URL(appBaseUrl);
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
      return sendError(res, 503, 'The payment callback URL must use HTTPS.');
    }
    callbackUrl = `${base.origin}/api/payments/nowpayments/webhook`;
  } catch {
    return sendError(res, 503, 'The public payment callback URL is invalid.');
  }

  const orderId = `NOW-${crypto.randomUUID()}`;
  try {
    await supabaseRequest('nowpayments_orders', {}, 'POST', {
      order_id: orderId,
      user_id: String(user.id),
      amount_usd: amountUsd,
      pay_currency: currency.toUpperCase(),
      payment_status: 'creating'
    });
  } catch (error) {
    console.error('NOWPayments order creation failed:', error.message);
    return sendError(res, 503, 'Unable to start a crypto deposit right now.');
  }

  try {
    const payment = await callNowPayments('/payment', {
      price_amount: amountUsd,
      price_currency: 'usd',
      pay_currency: currency,
      order_id: orderId,
      order_description: `ProBinary wallet deposit ${orderId}`,
      ipn_callback_url: callbackUrl
    });
    if (!payment?.payment_id || !payment.pay_address || !payment.pay_amount) {
      throw new Error('NOWPayments returned an incomplete payment response');
    }

    await supabaseRequest('nowpayments_orders', { order_id: `eq.${orderId}` }, 'PATCH', {
      payment_id: String(payment.payment_id),
      pay_address: payment.pay_address,
      pay_amount: Number(payment.pay_amount),
      pay_currency: String(payment.pay_currency || currency).toUpperCase(),
      payment_status: String(payment.payment_status || 'waiting')
    });

    return sendJson(res, 200, {
      success: true,
      orderId,
      paymentId: String(payment.payment_id),
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency || currency,
      amountUsd
    });
  } catch (error) {
    console.error('NOWPayments payment creation failed:', error.message);
    try {
      await supabaseRequest('nowpayments_orders', { order_id: `eq.${orderId}` }, 'PATCH', { payment_status: 'failed' });
    } catch {}
    return sendError(res, 502, 'NOWPayments could not create the payment. Please try again.');
  }
}

async function getPaymentStatus(req, res, user) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const orderId = requestUrl.searchParams.get('orderId') || '';
  if (!/^NOW-[0-9a-f-]{36}$/i.test(orderId)) return sendError(res, 400, 'Invalid crypto payment order.');

  try {
    const orders = await supabaseRequest('nowpayments_orders', {
      select: 'order_id,amount_usd,payment_status,credited_at',
      order_id: `eq.${orderId}`,
      user_id: `eq.${user.id}`,
      limit: '1'
    });
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) return sendError(res, 404, 'Crypto payment order not found.');

    let balance;
    if (order.payment_status === 'finished' && order.credited_at) {
      const wallets = await supabaseRequest('wallets', {
        select: 'current_balance',
        user_id: `eq.${user.id}`,
        limit: '1'
      });
      balance = Number(wallets?.[0]?.current_balance || 0);
    }

    return sendJson(res, 200, {
      success: true,
      status: order.payment_status,
      credited: Boolean(order.credited_at),
      amountUsd: Number(order.amount_usd),
      ...(balance === undefined ? {} : { balance })
    });
  } catch (error) {
    console.error('NOWPayments order status check failed:', error.message);
    return sendError(res, 502, 'Unable to check crypto payment status.');
  }
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = sortObject(value[key]);
    return sorted;
  }, {});
}

function isValidIpn(req, body) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  const signature = req.headers['x-nowpayments-sig'];
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha512', secret).update(JSON.stringify(sortObject(body))).digest();
  const supplied = Buffer.from(signature, 'hex');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

async function handleWebhook(req, res) {
  if (!process.env.NOWPAYMENTS_IPN_SECRET) return sendError(res, 503, 'NOWPayments IPN verification is not configured.');

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendError(res, 400, 'Invalid IPN payload.');
  }
  if (!isValidIpn(req, body)) return sendError(res, 401, 'Invalid NOWPayments signature.');

  const orderId = String(body.order_id || '');
  const paymentId = String(body.payment_id || '');
  const paymentStatus = String(body.payment_status || '').toLowerCase();
  if (!orderId || !paymentId) return sendError(res, 400, 'IPN is missing payment identifiers.');

  try {
    if (paymentStatus !== 'finished') {
      await supabaseRequest('nowpayments_orders', { order_id: `eq.${orderId}` }, 'PATCH', {
        payment_id: paymentId,
        payment_status: paymentStatus || 'unknown',
        updated_at: new Date().toISOString()
      });
      return sendJson(res, 200, { received: true });
    }

    const amountUsd = Number(body.price_amount);
    const priceCurrency = String(body.price_currency || '');
    const payCurrency = String(body.pay_currency || '');
    if (!Number.isFinite(amountUsd) || !priceCurrency || !payCurrency) {
      return sendError(res, 400, 'Completed IPN is missing payment details.');
    }

    await supabaseRequest('rpc/complete_nowpayments_order', {}, 'POST', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_usd: amountUsd,
      p_price_currency: priceCurrency,
      p_pay_currency: payCurrency
    });
    return sendJson(res, 200, { received: true });
  } catch (error) {
    console.error('NOWPayments IPN processing failed:', error.message);
    return sendError(res, 500, 'Unable to process NOWPayments notification.');
  }
}

async function handleNowPayments(req, res) {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/api/payments/nowpayments/webhook' || route === '/api/crypto/webhook') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendError(res, 405, 'Method not allowed.');
    }
    return handleWebhook(req, res);
  }
  if (route === '/api/crypto/verify-payment') return sendError(res, 410, 'Crypto deposits are credited only after a verified NOWPayments IPN.');
  if (route === '/api/crypto/create-payment' && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed.');
  }
  if (route === '/api/crypto/status' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed.');
  }
  if (!['/api/crypto/create-payment', '/api/crypto/status', '/api/crypto/verify-payment'].includes(route)) {
    return sendError(res, 404, 'Not found.');
  }

  const user = verifyUser(req);
  if (!user) return sendError(res, 401, 'Please sign in before making a crypto deposit.');
  return route === '/api/crypto/create-payment'
    ? createPayment(req, res, user)
    : route === '/api/crypto/status'
      ? getPaymentStatus(req, res, user)
      : handleNowPayments(req, res);
}

module.exports = { handleNowPayments };
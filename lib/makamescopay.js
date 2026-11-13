const crypto = require('crypto');

const MAKAMESCOPAY_API = 'https://makamescopay.com/api';

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.end(JSON.stringify(data));
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch { return Promise.reject(new Error('Invalid JSON body')); }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('Request body is too large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function verifyUser(req) {
  const secret = process.env.JWT_SECRET;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!secret || !token) return null;

  try {
    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;

    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!user.id || (user.exp && user.exp < Math.floor(Date.now() / 1000))) return null;
    return user;
  } catch {
    return null;
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured');
  return { url, key };
}

async function supabaseRequest(resource, query = {}, method = 'GET', body) {
  const { url, key } = getSupabaseConfig();
  const endpoint = new URL(`/rest/v1/${resource}`, url);
  for (const [name, value] of Object.entries(query)) endpoint.searchParams.set(name, value);

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(data?.message || `Supabase request failed (${response.status})`);
  return data;
}

function normalizePhone(value) {
  let phone = String(value || '').replace(/[\s()+-]/g, '');
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`;
  else if (phone.startsWith('7') || phone.startsWith('1')) phone = `254${phone}`;
  return /^254[17]\d{8}$/.test(phone) ? phone : null;
}

function getProviderKey() {
  return process.env.MAKAMESCOPAY_API_KEY || '';
}

async function providerRequest(path, method = 'GET', body) {
  const response = await fetch(`${MAKAMESCOPAY_API}${path}`, {
    method,
    headers: {
      'X-API-Key': getProviderKey(),
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(data?.message || data?.error || `MakamescoPay request failed (${response.status})`);
  return data;
}

function fail(res, status, message) {
  return sendJson(res, status, { success: false, error: message });
}

async function createPayment(req, res, user) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const requestedAmount = Number(body.amount);
  const amountUsd = Math.round(requestedAmount * 100) / 100;
  const exchangeRate = Number(process.env.USD_KES_RATE || 129.5);
  const amountKes = Math.round(amountUsd * exchangeRate);
  const phoneNumber = normalizePhone(body.phone);

  if (!Number.isFinite(requestedAmount) || amountUsd < 1 || !Number.isFinite(amountKes) || amountKes < 1) {
    return fail(res, 400, 'Enter a valid deposit amount of at least $1 USD.');
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return fail(res, 503, 'The USD to KES exchange rate is not configured.');
  }
  if (!phoneNumber) return fail(res, 400, 'Enter a valid Kenyan mobile number, such as 0712345678.');
  if (!getProviderKey()) return fail(res, 503, 'M-Pesa deposits are not configured yet.');

  const orderReference = `MP-${crypto.randomUUID()}`;
  try {
    await supabaseRequest('makamescopay_orders', {}, 'POST', {
      order_reference: orderReference,
      user_id: String(user.id),
      amount_usd: amountUsd,
      amount_kes: amountKes,
      phone_number: phoneNumber,
      status: 'initiating'
    });
  } catch (error) {
    console.error('MakamescoPay order creation failed:', error.message);
    return fail(res, 503, 'Unable to start the deposit right now. Please try again.');
  }

  try {
    const payment = await providerRequest('/payments/stkpush', 'POST', {
      phoneNumber,
      amount: amountKes,
      accountReference: orderReference,
      transactionDesc: `ProBinary wallet deposit ${orderReference}`
    });
    if (String(payment?.responseCode) !== '0' || !payment.checkoutRequestId) {
      await supabaseRequest('makamescopay_orders', { order_reference: `eq.${orderReference}` }, 'PATCH', { status: 'failed' });
      return fail(res, 502, payment?.responseDescription || 'MakamescoPay did not accept the payment request.');
    }

    await supabaseRequest('makamescopay_orders', { order_reference: `eq.${orderReference}` }, 'PATCH', {
      checkout_request_id: payment.checkoutRequestId,
      merchant_request_id: payment.merchantRequestId || null,
      status: 'pending'
    });

    return sendJson(res, 200, {
      success: true,
      reference: orderReference,
      status: 'pending',
      amountUsd,
      amountKes
    });
  } catch (error) {
    console.error('MakamescoPay payment initiation failed:', error.message);
    try {
      await supabaseRequest('makamescopay_orders', { order_reference: `eq.${orderReference}` }, 'PATCH', { status: 'review' });
    } catch {}
    return fail(res, 502, 'The payment request could not be confirmed. Check your M-Pesa messages before retrying.');
  }
}

async function getPaymentStatus(req, res, user) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const reference = requestUrl.searchParams.get('reference') || '';
  if (!/^MP-[0-9a-f-]{36}$/i.test(reference)) return fail(res, 400, 'Invalid payment reference.');

  try {
    const orders = await supabaseRequest('makamescopay_orders', {
      select: '*',
      order_reference: `eq.${reference}`,
      user_id: `eq.${user.id}`,
      limit: '1'
    });
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) return fail(res, 404, 'Payment request not found.');

    if (order.status === 'completed') {
      const wallets = await supabaseRequest('wallets', {
        select: 'current_balance',
        user_id: `eq.${user.id}`,
        limit: '1'
      });
      return sendJson(res, 200, {
        success: true,
        status: 'completed',
        credited: true,
        balance: Number(wallets?.[0]?.current_balance || 0),
        amountUsd: Number(order.amount_usd)
      });
    }
    if (order.status === 'review') return sendJson(res, 200, { success: true, status: 'review' });
    if (['failed', 'cancelled'].includes(order.status)) {
      return sendJson(res, 200, { success: true, status: order.status });
    }
    if (!order.checkout_request_id) return sendJson(res, 200, { success: true, status: 'pending' });

    const payment = await providerRequest(`/payments/status/${encodeURIComponent(order.checkout_request_id)}`);
    const status = String(payment?.status || '').toLowerCase();

    if (status === 'completed') {
      const paidAmount = Number(payment.amount);
      const paidPhone = normalizePhone(payment.phoneNumber);
      if (paidAmount !== Number(order.amount_kes) || paidPhone !== order.phone_number) {
        await supabaseRequest('makamescopay_orders', { order_reference: `eq.${reference}` }, 'PATCH', { status: 'review' });
        return sendJson(res, 200, { success: true, status: 'review' });
      }

      const result = await supabaseRequest('rpc/complete_makamescopay_order', {}, 'POST', {
        p_order_reference: reference,
        p_checkout_request_id: order.checkout_request_id,
        p_amount_kes: Math.round(paidAmount),
        p_phone_number: paidPhone,
        p_mpesa_receipt_number: payment.mpesaReceiptNumber || null
      });
      const completed = Array.isArray(result) ? result[0] : result;
      return sendJson(res, 200, {
        success: true,
        status: 'completed',
        credited: Boolean(completed?.credited),
        balance: Number(completed?.current_balance || 0),
        amountUsd: Number(order.amount_usd)
      });
    }

    if (status === 'failed' || status === 'cancelled') {
      await supabaseRequest('makamescopay_orders', { order_reference: `eq.${reference}` }, 'PATCH', { status });
      return sendJson(res, 200, { success: true, status });
    }

    return sendJson(res, 200, { success: true, status: 'pending' });
  } catch (error) {
    console.error('MakamescoPay status check failed:', error.message);
    return fail(res, 502, 'Unable to verify payment status. Please check again.');
  }
}

function getPublicConfig(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'Method not allowed.');
  }
  const usdKesRate = Number(process.env.USD_KES_RATE || 129.5);
  if (!Number.isFinite(usdKesRate) || usdKesRate <= 0) {
    return fail(res, 503, 'The USD to KES exchange rate is not configured.');
  }
  return sendJson(res, 200, { success: true, usdKesRate });
}

async function handleMakamescoPay(req, res) {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/api/mpesa/config') return getPublicConfig(req, res);
  if (route === '/api/mpesa/create' && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed.');
  }
  if (route === '/api/mpesa/status' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'Method not allowed.');
  }
  if (!['/api/mpesa/create', '/api/mpesa/status'].includes(route)) return fail(res, 404, 'Not found.');
  if (!process.env.JWT_SECRET) return fail(res, 503, 'Payment authentication is not configured.');
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) return fail(res, 503, 'Payment storage is not configured.');
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) return fail(res, 503, 'Payment storage is not configured.');

  const user = verifyUser(req);
  if (!user) return fail(res, 401, 'Please sign in before making a deposit.');
  return route === '/api/mpesa/create' ? createPayment(req, res, user) : getPaymentStatus(req, res, user);
}

module.exports = { handleMakamescoPay, sendJson, supabaseRequest, verifyUser };
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.end(JSON.stringify(body));
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
      if (body.length > 32_768) reject(new Error('Request body is too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function getConfig() {
  return db.getConfig();
}

async function supabaseRequest(resource, query = {}, method = 'GET', body, prefer = 'return=representation') {
  const { url, key } = getConfig();
  const endpoint = new URL(`/rest/v1/${resource}`, url);
  for (const [name, value] of Object.entries(query)) endpoint.searchParams.set(name, value);

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!response.ok) {
    const error = new Error(data?.message || `Supabase request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function createToken(user) {
  const { jwtSecret } = getConfig();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    ...user,
    exp: Math.floor(Date.now() / 1000) + 24 * 3600 // 24 hours
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const { jwtSecret } = getConfig();
    const expected = crypto.createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!user.id || !user.exp || user.exp < Math.floor(Date.now() / 1000)) return null;
    return user;
  } catch {
    return null;
  }
}

async function findUser(email) {
  return await db.getUserByEmail(email);
}

async function login(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });

  let dbUser;
  let wallet;
  try {
    dbUser = await findUser(email);
    if (!dbUser) return sendJson(res, 401, { error: 'Invalid email or password.' });
    if (dbUser.account_status && dbUser.account_status !== 'active') {
      return sendJson(res, 403, { error: `This account is ${dbUser.account_status}. Please contact support.` });
    }
    const validPassword = dbUser.password_hash && await bcrypt.compare(password, dbUser.password_hash);
    if (!validPassword) return sendJson(res, 401, { error: 'Invalid email or password.' });

    wallet = await db.getWallet(dbUser.id);
  } catch (error) {
    console.error('Supabase login failed:', error.message);
    return sendJson(res, 503, { error: 'Unable to reach the account service. Please try again.' });
  }

  const roleName = dbUser.user_roles?.[0]?.roles?.name || 'client';
  const isAdmin = roleName === 'admin' || roleName === 'super_admin' || email === 'admin@probinary.com' || email === 'superadmin@probinary.com';
  const isSimulation = email === 'simulation@probinary.com' || String(dbUser.username || '').toLowerCase().includes('simulation');

  const user = {
    id: dbUser.id,
    name: dbUser.username || email.split('@')[0],
    email: dbUser.email,
    role: roleName === 'super_admin' ? 'superadmin' : (isAdmin ? 'admin' : 'trader'),
    simulation: isSimulation,
    is80WinRate: isSimulation,
    winRate: isSimulation ? 80 : null,
    balance: Number(wallet.current_balance || 0)
  };

  return sendJson(res, 200, { success: true, token: createToken(user), user });
}

async function register(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || body.name || '').trim();
  const password = String(body.password || '');
  if (!fullName || !email || !password) return sendJson(res, 400, { error: 'Name, email, and password are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Enter a valid email address.' });
  if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });

  let newUser;
  try {
    const existing = await findUser(email);
    if (existing) return sendJson(res, 409, { error: 'Account already exists. Please sign in.' });

    // Ensure client role
    const clientRoles = await supabaseRequest('roles', {
      select: 'id',
      name: 'eq.client',
      limit: '1'
    }).catch(() => []);
    const clientRoleId = Array.isArray(clientRoles) && clientRoles[0] ? clientRoles[0].id : null;

    const createdUsers = await supabaseRequest('users', {}, 'POST', {
      email,
      username: fullName,
      password_hash: await bcrypt.hash(password, 10),
      account_status: 'active'
    });
    newUser = Array.isArray(createdUsers) ? createdUsers[0] : null;
    if (!newUser?.id) throw new Error('Supabase did not return the created user');

    // Create wallet record immediately
    await db.getWallet(newUser.id);

    // Assign role if role id found
    if (clientRoleId) {
      await supabaseRequest('user_roles', {}, 'POST', {
        user_id: newUser.id,
        role_id: clientRoleId
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Supabase registration failed:', error.message);
    if (error.code === '23505' || error.status === 409) {
      return sendJson(res, 409, { error: 'Account already exists. Please sign in.' });
    }
    return sendJson(res, 503, { error: 'Unable to create account. Please try again.' });
  }

  const user = {
    id: newUser.id,
    name: fullName,
    email: newUser.email,
    role: 'trader',
    simulation: false,
    is80WinRate: false,
    balance: 0.00
  };

  return sendJson(res, 201, { success: true, token: createToken(user), user });
}

async function handleWalletBalance(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

  try {
    const wallet = await db.getWallet(user.id);
    return sendJson(res, 200, {
      success: true,
      balance: wallet.current_balance,
      currency: wallet.currency || 'USD',
      totalDeposits: wallet.total_deposits,
      totalWithdrawals: wallet.total_withdrawals
    });
  } catch (error) {
    console.error('Supabase wallet balance lookup failed:', error.message);
    return sendJson(res, 503, { error: 'Unable to load the account balance. Please try again.' });
  }
}

async function handleAuth(req, res) {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route !== '/api/auth/login' && route !== '/api/auth/register') {
    return sendJson(res, 404, { error: 'Not found.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  return route === '/api/auth/login' ? login(req, res) : register(req, res);
}

module.exports = {
  handleAuth,
  handleWalletBalance,
  supabaseRequest,
  verifyToken,
  createToken,
  sendJson,
  readJson
};

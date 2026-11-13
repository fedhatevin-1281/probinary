const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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
      if (body.length > 16_384) reject(new Error('Request body is too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  if (!url || !key || !jwtSecret) throw new Error('Supabase authentication is not configured');
  return { url, key, jwtSecret };
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
    signal: AbortSignal.timeout(10_000)
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
    exp: Math.floor(Date.now() / 1000) + 8 * 3600
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function findUser(email) {
  const users = await supabaseRequest('users', {
    select: 'id,email,username,password_hash,account_status',
    email: `eq.${email}`,
    limit: '1'
  });
  return Array.isArray(users) ? users[0] || null : null;
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
  let wallets;
  let userRoles;
  try {
    dbUser = await findUser(email);
    if (!dbUser) return sendJson(res, 401, { error: 'Invalid email or password.' });
    if (dbUser.account_status && dbUser.account_status !== 'active') {
      return sendJson(res, 403, { error: 'This account is not active.' });
    }
    const validPassword = dbUser.password_hash && await bcrypt.compare(password, dbUser.password_hash);
    if (!validPassword) return sendJson(res, 401, { error: 'Invalid email or password.' });

    [wallets, userRoles] = await Promise.all([
      supabaseRequest('wallets', {
        select: 'current_balance',
        user_id: `eq.${dbUser.id}`,
        limit: '1'
      }),
      supabaseRequest('user_roles', {
        select: 'role_id,roles(name)',
        user_id: `eq.${dbUser.id}`,
        limit: '1'
      })
    ]);
  } catch (error) {
    console.error('Supabase login failed:', error.message);
    return sendJson(res, 503, { error: 'Unable to reach the account service. Please try again.' });
  }

  const roleName = userRoles?.[0]?.roles?.name || 'client';
  const isAdmin = roleName === 'admin' || roleName === 'super_admin';
  const isSimulation = email === 'simulation@probinary.com' || String(dbUser.username || '').toLowerCase().includes('simulation');
  const user = {
    id: dbUser.id,
    name: dbUser.username || email.split('@')[0],
    email: dbUser.email,
    role: roleName === 'super_admin' ? 'superadmin' : (isAdmin ? 'admin' : 'trader'),
    simulation: isSimulation,
    is80WinRate: isSimulation,
    winRate: isSimulation ? 80 : null,
    balance: Number(wallets?.[0]?.current_balance || 0)
  };

  return sendJson(res, 200, { success: true, token: createToken(user), user });
}

async function rollbackRegistration(userId) {
  const query = { user_id: `eq.${userId}` };
  try { await supabaseRequest('user_roles', query, 'DELETE', undefined, ''); } catch {}
  try { await supabaseRequest('wallets', query, 'DELETE', undefined, ''); } catch {}
  try { await supabaseRequest('users', { id: `eq.${userId}` }, 'DELETE', undefined, ''); } catch {}
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

    const clientRoles = await supabaseRequest('roles', {
      select: 'id',
      name: 'eq.client',
      limit: '1'
    });
    const clientRoleId = Array.isArray(clientRoles) ? clientRoles[0]?.id : null;
    if (!clientRoleId) {
      console.error('Supabase signup failed: client role is missing');
      return sendJson(res, 503, { error: 'Account setup is incomplete. Please contact support.' });
    }

    const createdUsers = await supabaseRequest('users', {}, 'POST', {
      email,
      username: fullName,
      password_hash: await bcrypt.hash(password, 10),
      account_status: 'active'
    });
    newUser = Array.isArray(createdUsers) ? createdUsers[0] : null;
    if (!newUser?.id) throw new Error('Supabase did not return the created user');

    await supabaseRequest('wallets', {}, 'POST', {
      user_id: newUser.id,
      current_balance: 0,
      currency: 'USD',
      total_deposits: 0,
      total_withdrawals: 0
    });
    await supabaseRequest('user_roles', {}, 'POST', {
      user_id: newUser.id,
      role_id: clientRoleId
    });
  } catch (error) {
    if (newUser?.id) await rollbackRegistration(newUser.id);
    console.error('Supabase registration failed:', error.message);
    if (error.code === '23505' || error.status === 409) {
      return sendJson(res, 409, { error: 'Account already exists. Please sign in.' });
    }
    return sendJson(res, 503, { error: 'Unable to create the account. Check the Supabase schema and try again.' });
  }

  const user = {
    id: newUser.id,
    name: fullName,
    email: newUser.email,
    role: 'trader',
    simulation: false,
    is80WinRate: false,
    balance: 0
  };
  return sendJson(res, 201, { success: true, token: createToken(user), user });
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

async function handleWalletBalance(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

  try {
    const wallets = await supabaseRequest('wallets', {
      select: 'current_balance',
      user_id: `eq.${user.id}`,
      limit: '1'
    });
    if (!Array.isArray(wallets) || !wallets[0] || wallets[0].current_balance === null) {
      return sendJson(res, 404, { error: 'Wallet not found.' });
    }
    const balance = Number(wallets[0].current_balance);
    if (!Number.isFinite(balance)) throw new Error('Invalid wallet balance');
    return sendJson(res, 200, { success: true, balance });
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

  try {
    getConfig();
  } catch {
    return sendJson(res, 503, { error: 'Authentication is not configured. Set Supabase service credentials and JWT_SECRET.' });
  }

  return route === '/api/auth/login' ? login(req, res) : register(req, res);
}

module.exports = { handleAuth, handleWalletBalance };
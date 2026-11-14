const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const { handleApi } = require('./lib/api-router');

// 1. Auto-load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SITE_DIR = path.join(ROOT, 'www.probinary.site');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  let [rawPath] = req.url.split('?');
  let reqUrl = rawPath.split('#')[0];

  // API router handles all /api/* requests
  if (reqUrl.startsWith('/api/') || reqUrl === '/api') {
    return handleApi(req, res);
  }

  // --- STATIC ROUTING & REWRITES ---
  let filePath = null;

  if (reqUrl === '/' || reqUrl === '' || reqUrl === '/index.html') {
    filePath = path.join(ROOT, 'index.html');
  } else if (reqUrl === '/auth/login' || reqUrl === '/auth/login/' || reqUrl === '/auth/login.html' || reqUrl === '/login' || reqUrl === '/login.html') {
    filePath = path.join(ROOT, 'auth', 'login.html');
  } else if (reqUrl === '/auth/register' || reqUrl === '/auth/register/' || reqUrl === '/auth/register.html' || reqUrl === '/register' || reqUrl === '/register.html') {
    filePath = path.join(ROOT, 'auth', 'register.html');
  } else if (reqUrl === '/dashboard' || reqUrl === '/dashboard/' || reqUrl === '/dashboard/trade' || reqUrl === '/dashboard/trade/' || reqUrl === '/dashboard/trade.html' || reqUrl === '/trade' || reqUrl === '/trade.html') {
    filePath = path.join(ROOT, 'dashboard', 'trade.html');
  } else if (reqUrl === '/dashboard/bot' || reqUrl === '/dashboard/bot/' || reqUrl === '/dashboard/bot.html' || reqUrl === '/bot' || reqUrl === '/bot.html') {
    filePath = path.join(ROOT, 'dashboard', 'bot.html');
  } else if (reqUrl === '/dashboard/deposit' || reqUrl === '/dashboard/deposit/' || reqUrl === '/dashboard/deposit.html' || reqUrl === '/deposit' || reqUrl === '/deposit.html') {
    filePath = path.join(ROOT, 'dashboard', 'deposit.html');
  } else if (reqUrl === '/dashboard/withdraw' || reqUrl === '/dashboard/withdraw/' || reqUrl === '/dashboard/withdraw.html' || reqUrl === '/withdraw' || reqUrl === '/withdraw.html') {
    filePath = path.join(ROOT, 'dashboard', 'withdraw.html');
  } else if (reqUrl === '/dashboard/history' || reqUrl === '/dashboard/history/' || reqUrl === '/dashboard/history.html' || reqUrl === '/history' || reqUrl === '/history.html' || reqUrl === '/dashboard/portfolio' || reqUrl === '/portfolio') {
    filePath = path.join(ROOT, 'dashboard', 'history.html');
  } else if (reqUrl === '/dashboard/profile' || reqUrl === '/dashboard/profile/' || reqUrl === '/dashboard/profile.html' || reqUrl === '/profile' || reqUrl === '/profile.html' || reqUrl === '/kyc') {
    filePath = path.join(ROOT, 'dashboard', 'profile.html');
  } else if (reqUrl === '/dashboard/admin' || reqUrl === '/dashboard/admin/' || reqUrl === '/dashboard/admin.html' || reqUrl === '/admin' || reqUrl === '/admin.html') {
    filePath = path.join(ROOT, 'dashboard', 'admin.html');
  } else {
    let cleanRel = decodeURIComponent(reqUrl).replace(/^[\/\\]+/, '');
    let safeRel = path.normalize(cleanRel).replace(/^(\.\.[\/\\])+/, '');

    // Check root path
    let candidate = path.join(ROOT, safeRel);
    if (fs.existsSync(candidate)) {
      if (fs.statSync(candidate).isDirectory()) {
        const idx = path.join(candidate, 'index.html');
        if (fs.existsSync(idx)) filePath = idx;
      } else {
        filePath = candidate;
      }
    }

    if (!filePath && fs.existsSync(candidate + '.html')) {
      filePath = candidate + '.html';
    }

    // Check SITE_DIR
    if (!filePath) {
      let siteCandidate = path.join(SITE_DIR, safeRel);
      if (fs.existsSync(siteCandidate)) {
        if (fs.statSync(siteCandidate).isDirectory()) {
          const idx = path.join(siteCandidate, 'index.html');
          if (fs.existsSync(idx)) filePath = idx;
        } else {
          filePath = siteCandidate;
        }
      } else if (fs.existsSync(siteCandidate + '.html')) {
        filePath = siteCandidate + '.html';
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>404 — ProBinary</title><style>body{background:#090514;color:#f5f0ff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;text-align:center;}h1{font-size:36px;margin-bottom:8px;background:linear-gradient(135deg,#e0ccff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}p{color:#9d8ec2;margin-bottom:24px;}a{background:linear-gradient(135deg,#e0ccff,#a855f7);color:#090514;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;}</style></head><body><h1>404 · Page Not Found</h1><p>The page you are looking for does not exist.</p><a href="/dashboard/trade.html">Open Trading Desk →</a></body></html>`);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ProBinary Trading Desk Server Online (Supabase Backend)`);
  console.log(`  Website:      http://localhost:${PORT}`);
  console.log(`  Sign In:      http://localhost:${PORT}/auth/login`);
  console.log(`  Register:     http://localhost:${PORT}/auth/register`);
  console.log(`  Trading Desk: http://localhost:${PORT}/dashboard/trade`);
  console.log(`  Admin Portal: http://localhost:${PORT}/dashboard/admin`);
  console.log(`  Supabase URL: ${db.getConfig().url}`);
  console.log(`======================================================\n`);
});

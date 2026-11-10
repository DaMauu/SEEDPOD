/* SEEDPOD 最小后端：静态面板 + 健康检查 + 配置读写 + 日志流。
   不引第三方依赖，Node 20+ 直接跑：node server/app.js
   环境变量：PTA_PORT(8080) PTA_DATA(./data) PTA_TOKEN(可选) PTA_WEB(./pta/web) */
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const PORT = Number(process.env.PTA_PORT || 8080);
const DATA_DIR = path.resolve(process.env.PTA_DATA || './data');
const WEB_DIR = path.resolve(process.env.PTA_WEB || './pta/web');
const TOKEN = process.env.PTA_TOKEN || '';
const PTA_USER = process.env.PTA_USER || '';
const PTA_PASS = process.env.PTA_PASS || '';
const VERSION = require('../package.json').version;
const STARTED = Date.now();

const LIMITS = {
  test: { interval: [30, 120], dailySite: [1, 300], dailyAll: [50, 2000] },
  prod: { interval: [8, 120], dailySite: [1, 300], dailyAll: [50, 2000] }
};
const DEFAULTS = { runMode: 'test', interval: 60, dailySite: 20, dailyAll: 100 };

fs.mkdirSync(DATA_DIR, { recursive: true });
const CFG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'events.log');

/* ---------- 事件日志：写文件 + 内存环 + SSE 广播 ---------- */
let logSeq = 0;
const LOG_RING = [];
const SSE_CLIENTS = new Set();

function logEvent(level, src, msg) {
  const entry = { id: ++logSeq, ts: new Date().toISOString(), level, src, msg };
  LOG_RING.push(entry);
  if (LOG_RING.length > 500) LOG_RING.shift();
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n'); } catch (e) {}
  const payload = 'id: ' + entry.id + '\ndata: ' + JSON.stringify(entry) + '\n\n';
  SSE_CLIENTS.forEach(function (res) {
    try { res.write(payload); } catch (e) { SSE_CLIENTS.delete(res); }
  });
  console.log('[' + level + '] ' + src + ' ' + msg);
  return entry;
}

function loadRecentLogs(limit) {
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    const out = [];
    for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
      try { out.push(JSON.parse(lines[i])); } catch (e) {}
    }
    if (out.length) logSeq = Math.max(logSeq, out[out.length - 1].id || 0);
    return out;
  } catch (e) { return []; }
}

function clientIp(req) {
  return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
    return Object.assign({}, DEFAULTS, raw);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function writeConfig(cfg) {
  try {
    fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入配置失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}

function send(res, code, payload, headers) {
  const body = JSON.stringify(payload);
  res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {}));
  res.end(body);
}
function fail(res, code, errCode, message, extra) {
  send(res, code, { ok: false, error: Object.assign({ code: errCode, message: message }, extra || {}) });
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); } catch (e) { resolve(null); }
    });
  });
}

function validate(cfg, patch) {
  const mode = patch.runMode || cfg.runMode;
  if (!LIMITS[mode]) return { code: 'BAD_REQUEST', message: 'runMode 只能是 test 或 prod' };
  const lim = LIMITS[mode];
  for (const key of ['interval', 'dailySite', 'dailyAll']) {
    if (patch[key] === undefined) continue;
    const n = Number(patch[key]);
    if (!Number.isInteger(n)) return { code: 'BAD_REQUEST', message: key + ' 必须是整数' };
    const [lo, hi] = lim[key];
    if (n < lo || n > hi) return { code: 'OUT_OF_RANGE', message: key + ' 必须在 ' + lo + '–' + hi + ' 之间' };
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8'
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) return fail(res, 403, 'FORBIDDEN', '越界路径');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      /* 带扩展名的请求按 404 处理，别把 index.html 当 js/css 返回 */
      if (path.extname(rel)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('not found');
      }
      /* 单页应用：未知路径回退到 index.html，由前端 hash 路由接管 */
      const fallback = path.join(WEB_DIR, 'index.html');
      return fs.readFile(fallback, (e2, buf) => {
        if (e2) return fail(res, 404, 'NOT_FOUND', '页面不存在');
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache, must-revalidate' });
        res.end(buf);
      });
    }
    const ext = path.extname(file);
    const noCache = ['.html', '.js', '.css'].indexOf(ext) >= 0;
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=86400'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 会话 ---------- */
const SESSIONS = new Map();          // token -> expiresAt
const SESSION_TTL = 12 * 3600 * 1000;

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function sessionUser(req) {
  const tok = parseCookies(req).pta_sid || (req.headers['x-session'] || '');
  if (!tok) return null;
  const exp = SESSIONS.get(tok);
  if (!exp) return null;
  if (exp < Date.now()) { SESSIONS.delete(tok); return null; }
  return { token: tok };
}
function newSession() {
  const tok = crypto.randomBytes(24).toString('hex');
  SESSIONS.set(tok, Date.now() + SESSION_TTL);
  return tok;
}

function basicAuthOk(req) {
  if (!PTA_USER) return true;
  const h = req.headers.authorization || '';
  if (h.slice(0, 6).toLowerCase() !== 'basic ') return false;
  let raw = '';
  try { raw = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const i = raw.indexOf(':');
  if (i < 0) return false;
  return raw.slice(0, i) === PTA_USER && raw.slice(i + 1) === PTA_PASS;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  const p = u.pathname;

  if (p === '/api/health') {
    return send(res, 200, { ok: true, data: {
      version: VERSION, uptime: Math.round((Date.now() - STARTED) / 1000),
      db: 'file', loginFail: 0, nodesOnline: 0, nodesTotal: 0
    } });
  }

  const authConfigured = !!(PTA_USER || TOKEN);
  if (authConfigured && p.startsWith('/api/') && p !== '/api/health' && p !== '/api/login') {
    const authed = !!sessionUser(req) || basicAuthOk(req);
    if (!authed) return fail(res, 401, 'UNAUTHORIZED', '需要登录');
  }

  if (p.startsWith('/api/')) {
    if (TOKEN) {
      const auth = req.headers.authorization || '';
      if (auth !== 'Bearer ' + TOKEN) return fail(res, 401, 'UNAUTHORIZED', '令牌缺失或过期');
    }
    if (p === '/api/login' && req.method === 'POST') {
      if (!PTA_USER || !PTA_PASS) return fail(res, 503, 'NO_ACCOUNT', '服务端还没有设置面板账号');
      const body = await readBody(req);
      if (!body || body.user !== PTA_USER || body.pass !== PTA_PASS) {
        logEvent('warn', '登录', '密码错误 · 用户 ' + ((body && body.user) || '(空)') + ' · 来自 ' + clientIp(req));
        return fail(res, 401, 'BAD_CREDENTIALS', '用户名或密码不对');
      }
      logEvent('info', '登录', '登录成功 · 用户 ' + body.user + ' · 来自 ' + clientIp(req));
      const tok = newSession();
      res.setHeader('set-cookie', 'pta_sid=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_TTL / 1000));
      return send(res, 200, { ok: true, data: { user: PTA_USER, token: tok } });
    }
    if (p === '/api/session' && req.method === 'GET') {
      return send(res, 200, { ok: true, data: { user: PTA_USER } });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      const tok = parseCookies(req).pta_sid;
      if (tok) SESSIONS.delete(tok);
      logEvent('info', '登录', '退出登录 · ' + clientIp(req));
      res.setHeader('set-cookie', 'pta_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      return send(res, 200, { ok: true, data: {} });
    }
    if (p === '/api/config' && req.method === 'GET') {
      return send(res, 200, { ok: true, data: { sys: {
        concurrency: 1, minInterval: 8, retry: 3, backoff: 30, breaker: 15, audit: true
      }, user: readConfig(), limits: LIMITS } });
    }
    if (p === '/api/config/user' && (req.method === 'PATCH' || req.method === 'POST')) {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const cfg = readConfig();
      const err = validate(cfg, body);
      if (err) return fail(res, 400, err.code, err.message);
      const next = Object.assign({}, cfg);
      if (body.runMode) next.runMode = body.runMode;
      ["interval", "dailySite", "dailyAll"].forEach(function (k) {
        if (body[k] !== undefined) next[k] = Number(body[k]);
      });
      const changes = Object.keys(next).filter(function (k) { return cfg[k] !== next[k]; })
        .map(function (k) { return k + ' ' + cfg[k] + '→' + next[k]; });
      try {
        writeConfig(next);
      } catch (e) {
        return fail(res, 500, e.code || "INTERNAL", e.message);
      }
      if (changes.length) logEvent('info', '设置', '修改配置 · ' + changes.join(' · '));
      return send(res, 200, { ok: true, data: next });
    }
    if (p === '/api/logs' && req.method === 'GET') {
      const limit = Math.min(Number(u.searchParams.get('limit') || 100) || 100, 500);
      return send(res, 200, { ok: true, data: LOG_RING.slice(-limit) });
    }
    if (p === '/api/logs/stream' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      const last = Number(u.searchParams.get('last') || req.headers['last-event-id'] || 0) || 0;
      LOG_RING.filter(function (e) { return e.id > last; }).forEach(function (e) {
        res.write('id: ' + e.id + '\ndata: ' + JSON.stringify(e) + '\n\n');
      });
      SSE_CLIENTS.add(res);
      const ping = setInterval(function () { try { res.write(': ping\n\n'); } catch (e) {} }, 15000);
      req.on('close', function () { clearInterval(ping); SSE_CLIENTS.delete(res); });
      return;
    }
    return fail(res, 404, 'NOT_FOUND', '接口不存在：' + p);
  }

  return serveStatic(req, res, p);
});

LOG_RING.push.apply(LOG_RING, loadRecentLogs(200));
logEvent('info', '服务', '服务启动 v' + VERSION + ' · 端口 ' + PORT + ' · 数据目录 ' + DATA_DIR);

server.listen(PORT, () => {
  console.log('SEEDPOD 服务已启动 http://0.0.0.0:' + PORT + '  数据目录 ' + DATA_DIR +
    (PTA_USER ? '  已开启面板密码' : '  未设面板密码') + (TOKEN ? ' · API 令牌已开' : ''));
});

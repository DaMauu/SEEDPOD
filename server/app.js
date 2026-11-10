/* SEEDPOD 最小后端：静态面板 + 健康检查 + 配置读写 + 日志流。
   不引第三方依赖，Node 20+ 直接跑：node server/app.js
   环境变量：PTA_PORT(8080) PTA_DATA(./data) PTA_TOKEN(可选) PTA_WEB(./pta/web) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PTA_PORT || 8080);
const DATA_DIR = path.resolve(process.env.PTA_DATA || './data');
const WEB_DIR = path.resolve(process.env.PTA_WEB || './pta/web');
const TOKEN = process.env.PTA_TOKEN || '';
const VERSION = require('../package.json').version;
const STARTED = Date.now();

const LIMITS = {
  test: { interval: [30, 120], dailySite: [1, 300], dailyAll: [50, 2000] },
  prod: { interval: [8, 120], dailySite: [1, 300], dailyAll: [50, 2000] }
};
const DEFAULTS = { runMode: 'test', interval: 60, dailySite: 20, dailyAll: 100 };

fs.mkdirSync(DATA_DIR, { recursive: true });
const CFG_FILE = path.join(DATA_DIR, 'config.json');

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
    return Object.assign({}, DEFAULTS, raw);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function writeConfig(cfg) {
  fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
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
      /* 单页应用：未知路径回退到 index.html，由前端 hash 路由接管 */
      const fallback = path.join(WEB_DIR, 'index.html');
      return fs.readFile(fallback, (e2, buf) => {
        if (e2) return fail(res, 404, 'NOT_FOUND', '页面不存在');
        res.writeHead(200, { 'content-type': MIME['.html'] });
        res.end(buf);
      });
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
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

  if (p.startsWith('/api/')) {
    if (TOKEN) {
      const auth = req.headers.authorization || '';
      if (auth !== 'Bearer ' + TOKEN) return fail(res, 401, 'UNAUTHORIZED', '令牌缺失或过期');
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
      writeConfig(next);
      return send(res, 200, { ok: true, data: next });
    }
    if (p === '/api/logs/stream' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const push = (level, msg) => res.write('data: ' + JSON.stringify({ ts: new Date().toISOString(), level, src: 'server', msg }) + '\n\n');
      push('info', '已连接日志流');
      const timer = setInterval(() => push('info', '心跳 ' + new Date().toLocaleTimeString('zh-CN')), 5000);
      req.on('close', () => clearInterval(timer));
      return;
    }
    return fail(res, 404, 'NOT_FOUND', '接口不存在：' + p);
  }

  return serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log('SEEDPOD 服务已启动 http://0.0.0.0:' + PORT + '  数据目录 ' + DATA_DIR);
});

/* SEEDPOD 后端 v2：Node + Fastify + SQLite，线上唯一后端。
   旧 server/app.js 已删除，只保留 v2。 */
const path = require('path');
const sitePack = require('./site-pack')
const fs = require('fs');
const crypto = require('crypto');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const { openDB } = require('./db');
const { makeCrawl } = require('./crawl');

const PORT = Number(process.env.PTA_PORT || 8090);
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(__dirname, '..', '..', 'data'));
const WEB_DIR = (function () {
  if (process.env.PTA_WEB) return path.resolve(process.env.PTA_WEB);
  const dist = path.join(__dirname, '..', 'web', 'dist');
  return fs.existsSync(path.join(dist, 'index.html')) ? dist : path.join(__dirname, '..', 'web');
})();
const PKG = require('../../package.json');
const VERSION = PKG.version;
const DEV_DATE = '2026-11-14';
const DEP = PKG.dependencies || {};
const DEV_DEP = PKG.devDependencies || {};
const trimVer = (v) => String(v || '').replace(/^[~^]/, '');
const FRONT_STACK = 'Vue ' + trimVer(DEP.vue) + ' + Vite ' + trimVer(DEV_DEP.vite) + ' + SFC（构建）';
const BACK_STACK = 'Node ' + process.version.replace(/^v/, '') + ' + Fastify ' + trimVer(DEP.fastify) + ' + SQLite';
const PTA_USER = process.env.PTA_USER || '';
const PTA_PASS = process.env.PTA_PASS || '';

const db = openDB(path.join(DATA_DIR, 'seedpod.db'));
const LOGIN_FAILS = new Map();
const SESSION_TTL = 12 * 3600 * 1000;

function one(sql, ...args) { try { return db.prepare(sql).get(...args); } catch (e) { return null; } }
function all(sql, ...args) { try { return db.prepare(sql).all(...args); } catch (e) { return []; } }
function jparse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function body(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function bad(reply, code, msg, http) { return reply.code(http || 400).send({ ok: false, error: { code: code, message: msg } }); }
function ok(reply, data) { if (arguments.length === 1) return { ok: true, data: reply }; return reply.send({ ok: true, data: data }); }

function counts() {
  const one2 = (t) => { const r = one('SELECT COUNT(*) AS n FROM ' + t); return r ? r.n : 0; };
  return { catalog: one2('catalog'), queue: one2('queue'), sites: one2('sites'), downloaders: one2('downloaders'), credentials: one2('credentials') };
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sessionOk(req) {
  const tok = parseCookies(req).pta_sid;
  if (!tok) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(tok);
  if (!row) return false;
  if (Number(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(tok);
    return false;
  }
  return true;
}
function cookieSecure(req) {
  return process.env.PTA_COOKIE_SECURE === '1' ||
    String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

let logEvent = null;

async function build() {
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });

  /* 与旧后端一致的静态安全头；CSP 放行 Cloudflare 分析脚本 */
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    return payload;
  });

  /* ---- 认证 ---- */
  app.post('/api/login', async (req, reply) => {
    if (!PTA_USER || !PTA_PASS) return bad(reply, 'NO_ACCOUNT', '服务端还没有设置面板账号', 503);
    const b = body(req);
    const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || '').trim();
    const key = ip + '|' + String((b && b.user) || '').slice(0, 60);
    const nowMs = Date.now();
    const rec = LOGIN_FAILS.get(key);
    if (rec && rec.lockUntil > nowMs) {
      return bad(reply, 'RATE_LIMITED', '尝试太多，' + Math.ceil((rec.lockUntil - nowMs) / 1000) + ' 秒后再试', 429);
    }
    if (!b || b.user !== PTA_USER || b.pass !== PTA_PASS) {
      const r = rec && nowMs - rec.firstAt < 10 * 60000 ? rec : { count: 0, firstAt: nowMs, lockUntil: 0 };
      r.count += 1;
      if (r.count >= 5) { r.lockUntil = nowMs + 10 * 60000; r.count = 0; }
      LOGIN_FAILS.set(key, r);
      if (r.lockUntil > nowMs) return bad(reply, 'RATE_LIMITED', '尝试太多，10 分钟后再试', 429);
      return bad(reply, 'BAD_CREDENTIALS', '用户名或密码不对', 401);
    }
    LOGIN_FAILS.delete(key);
    const tok = crypto.randomBytes(24).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowMs);
    db.prepare('INSERT INTO sessions(token, user, expires_at) VALUES(?, ?, ?)').run(tok, PTA_USER, nowMs + SESSION_TTL);
    const secure = cookieSecure(req) ? '; Secure' : '';
    reply.header('set-cookie', 'pta_sid=' + tok + '; Path=/; HttpOnly; SameSite=Lax' + secure + '; Max-Age=' + (SESSION_TTL / 1000));
    if (logEvent) logEvent('info', '登录', '登录成功 · 用户 ' + PTA_USER);
    return ok(reply, { user: PTA_USER, token: tok });
  });
  app.get('/api/session', async (req, reply) => (sessionOk(req) ? ok(reply, { user: PTA_USER }) : reply.code(401).send({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } })));
  app.post('/api/logout', async (req, reply) => {
    const tok = parseCookies(req).pta_sid;
    if (tok) db.prepare('DELETE FROM sessions WHERE token = ?').run(tok);
    const secure = cookieSecure(req) ? '; Secure' : '';
    reply.header('set-cookie', 'pta_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + secure);
    return ok(reply, {});
  });

  app.get('/api/health', async () => ({ ok: true, data: { version: VERSION, uptime: Math.round(process.uptime()), db: 'sqlite', counts: counts() } }));

  /* 之后的接口都要求登录 */
  app.addHook('preHandler', async (req, reply) => {
    const p = req.raw.url.split('?')[0];
    if (!p.startsWith('/api/')) return;
    if (p === '/api/health' || p === '/api/login') return;
    if (!sessionOk(req)) return bad(reply, 'UNAUTHORIZED', '需要登录', 401);
  });

  app.get('/api/dev', async () => ({
    ok: true,
    data: {
      version: VERSION, devDate: DEV_DATE, node: process.version,
      stack: { front: FRONT_STACK, back: BACK_STACK },
      counts: counts(),
      pack: sitePack.status()
    }
  }));

  /* ---- 词条库 ---- */
  app.get('/api/catalog', async (req) => {
    const q = String(req.query.q || '').toLowerCase();
    const status = String(req.query.status || '');
    const site = String(req.query.site || '').toLowerCase();
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const where = [], args = [];
    if (status) { where.push('status = ?'); args.push(status); }
    if (site) { where.push('site = ?'); args.push(site); }
    if (q) { where.push('LOWER(title) LIKE ?'); args.push('%' + q + '%'); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = (one('SELECT COUNT(*) AS n FROM catalog' + w, ...args) || { n: 0 }).n;
    const rows = all('SELECT data FROM catalog' + w + ' ORDER BY created_at DESC LIMIT ? OFFSET ?', ...args, limit, offset);
    const byStatus = {};
    all('SELECT status, COUNT(*) AS n FROM catalog GROUP BY status').forEach(function (r) { byStatus[r.status] = r.n; });
    return ok({ total: total, matched: total, byStatus: byStatus, items: rows.map(function (r) { return jparse(r.data); }).filter(Boolean) });
  });

  /* ---- 队列 ---- */
  app.get('/api/queue', async (req) => {
    const statuses = String(req.query.status || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const where = [], args = [];
    if (statuses.length) {
      where.push('status IN (' + statuses.map(function () { return '?'; }).join(',') + ')');
      statuses.forEach(function (x) { args.push(x); });
    }
    if (q) { where.push('LOWER(title) LIKE ?'); args.push('%' + q + '%'); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const matched = (one('SELECT COUNT(*) AS n FROM queue' + w, ...args) || { n: 0 }).n;
    const rows = all('SELECT data FROM queue' + w + ' ORDER BY created_at ASC LIMIT ? OFFSET ?', ...args, limit, offset);
    const countsBy = {};
    all('SELECT status, COUNT(*) AS n FROM queue GROUP BY status').forEach(function (r) { countsBy[r.status] = r.n; });
    return ok({ items: rows.map(function (r) { const it = jparse(r.data); if (it) delete it.shots; return it; }).filter(Boolean),
      counts: countsBy, matched: matched, limit: limit, offset: offset });
  });
  app.get('/api/queue/:id', async (req, reply) => {
    const row = one('SELECT data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    return ok(reply, jparse(row.data));
  });

  /* ---- 下载器 ---- */
  app.get('/api/downloaders', async () => ok(publicDls()));

  function publicDls() {
    return all('SELECT data FROM downloaders').map(function (r) {
      const d = jparse(r.data) || {};
      return { id: d.id, name: d.name, kind: d.kind || 'qb', url: d.url || '', watchPath: d.watchPath || '', user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth, lastProbe: d.lastProbe || null };
    });
  }

  /* ---- 统计总览 ---- */
  app.get('/api/stats/overview', async () => {
    const q = {}, c = {};
    all('SELECT status, COUNT(*) AS n FROM queue GROUP BY status').forEach(function (r) { q[r.status] = r.n; });
    all('SELECT status, COUNT(*) AS n FROM catalog GROUP BY status').forEach(function (r) { c[r.status] = r.n; });
    const dls = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data) || {}; });
    const free = dls.reduce(function (a, d) { return a + Number((d.lastProbe && d.lastProbe.freeSpace) || 0); }, 0);
    const online = dls.filter(function (d) { return d.lastProbe && d.lastProbe.pass; }).length;
    return ok({
      queue: { counts: q }, catalog: { total: Object.keys(c).reduce(function (a, k) { return a + c[k]; }, 0), byStatus: c },
      library: { total: 0 }, downloaders: { total: dls.length, online: online, freeSpace: free },
      sites: { loginOk: 0, loginFail: 0, loginUnknown: counts().sites, enabled: counts().sites },
      crawl: { runsToday: 0, hostsToday: 0 }
    });
  });

  /* ---- 静态文件 ---- */
  app.register(fastifyStatic, { root: WEB_DIR, prefix: '/', wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url.startsWith('/api/')) return bad(reply, 'NOT_FOUND', '接口不存在：' + req.raw.url, 404);
    return reply.sendFile('index.html');
  });

  /* 写接口：词条库、队列、流程规则、配置 */
  const ctx = { db: db, one: one, all: all, ok: ok, bad: bad, jparse: jparse, DATA_DIR: DATA_DIR, WEB_DIR: WEB_DIR,
    allowReal: function (key) {
      if (String(process.env.PTA_ALLOW_REAL || '') === '1') return true;
      const r = one("SELECT v FROM meta WHERE k = 'config'");
      const cfg = JSON.parse(r ? r.v : 'null') || {};
      return cfg[key] === true;
    } };
  ctx.crawl = makeCrawl(ctx);
  ctx.notify = require('./notify').makeNotify(ctx);
  require('./routes-write')(app, ctx);
  require('./routes-data')(app, ctx);
  logEvent = ctx.logEvent || null;
  require('./routes-qb')(app, ctx);
  require('./routes-probe')(app, ctx);
  require('./routes-crawl')(app, ctx);
  require('./routes-tasks')(app, ctx);
  require('./routes-misc')(app, ctx);
  require('./routes-publish')(app, ctx);
  require('./routes-release')(app, ctx);
  require('./routes-target')(app, ctx);
  require('./routes-media')(app, ctx);
  require('./routes-notify')(app, ctx);
  require('./routes-extra')(app, ctx);

  const publisher = require('./publish').makePublisher(ctx);
  ctx.publisher = publisher;
  ctx.scheduler = require('./scheduler').makeScheduler(ctx, {
    crawl: ctx.crawl,
    screen: require('./screen'),
    publish: publisher
  });
  ctx.scheduler.start();

  return app;
}

if (require.main === module) {
  build().then((app) => app.listen({ port: PORT, host: '0.0.0.0' }))
    .then(() => console.info('SEEDPOD v2 (fastify+sqlite) on :' + PORT))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { build, db, counts };

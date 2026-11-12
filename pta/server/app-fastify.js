/* SEEDPOD 后端 v2：Node + Fastify + SQLite。
   接口路径与旧 server/app.js 一致，逐个搬；生产仍跑旧服务，本服务在 8090 联调，全绿后再切 systemd。 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const { openDB } = require('./db');

const PORT = Number(process.env.PTA_PORT || 8090);
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(__dirname, '..', '..', 'data'));
const WEB_DIR = path.resolve(process.env.PTA_WEB || path.join(__dirname, '..', 'web'));
const VERSION = require('../../package.json').version;
const DEV_DATE = '2026-11-13';
const PTA_USER = process.env.PTA_USER || '';
const PTA_PASS = process.env.PTA_PASS || '';

const db = openDB(path.join(DATA_DIR, 'seedpod.db'));
const SESSIONS = new Map();
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
  const exp = SESSIONS.get(tok);
  if (!exp || exp < Date.now()) { SESSIONS.delete(tok); return false; }
  return true;
}

async function build() {
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });

  /* ---- 认证 ---- */
  app.post('/api/login', async (req, reply) => {
    if (!PTA_USER || !PTA_PASS) return bad(reply, 'NO_ACCOUNT', '服务端还没有设置面板账号', 503);
    const b = body(req);
    if (!b || b.user !== PTA_USER || b.pass !== PTA_PASS) return bad(reply, 'BAD_CREDENTIALS', '用户名或密码不对', 401);
    const tok = crypto.randomBytes(24).toString('hex');
    SESSIONS.set(tok, Date.now() + SESSION_TTL);
    reply.header('set-cookie', 'pta_sid=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_TTL / 1000));
    return ok(reply, { user: PTA_USER, token: tok });
  });
  app.get('/api/session', async (req, reply) => (sessionOk(req) ? ok(reply, { user: PTA_USER }) : reply.code(401).send({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } })));
  app.post('/api/logout', async (req, reply) => {
    const tok = parseCookies(req).pta_sid;
    if (tok) SESSIONS.delete(tok);
    reply.header('set-cookie', 'pta_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
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
      stack: { front: 'Vue 3 + 原生 CSS（无构建）', back: 'Node ' + process.version.split('.')[0].replace('v', '') + ' + Fastify 5 + SQLite' },
      counts: counts()
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
    const status = String(req.query.status || '');
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = status
      ? all('SELECT data FROM queue WHERE status = ? ORDER BY created_at ASC LIMIT ?', status, limit)
      : all('SELECT data FROM queue ORDER BY created_at ASC LIMIT ?', limit);
    const countsBy = {};
    all('SELECT status, COUNT(*) AS n FROM queue GROUP BY status').forEach(function (r) { countsBy[r.status] = r.n; });
    return ok({ items: rows.map(function (r) { const it = jparse(r.data); if (it) delete it.shots; return it; }).filter(Boolean), counts: countsBy });
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
      return { id: d.id, name: d.name, url: d.url, user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth, lastProbe: d.lastProbe || null };
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
  require('./routes-write')(app, { db: db, one: one, all: all, ok: ok, bad: bad, jparse: jparse });

  return app;
}

if (require.main === module) {
  build().then((app) => app.listen({ port: PORT, host: '0.0.0.0' }))
    .then(() => console.log('SEEDPOD v2 (fastify+sqlite) on :' + PORT))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { build, db, counts };

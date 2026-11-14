/* 站点、凭据、日志与站点定义接口（Fastify v2）。 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const secretbox = require('./secretbox');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, WEB_DIR, one, all, ok, bad, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const SSE = new Set();
  const now = () => new Date().toISOString();

  /* ---- 日志：写库并推 SSE ---- */
  function logEvent(level, src, msg) {
    const ts = now();
    let id = 0;
    try {
      const r = db.prepare('INSERT INTO logs(ts, level, src, msg) VALUES(?, ?, ?, ?)').run(ts, level || 'info', src || '', String(msg || '').slice(0, 2000));
      id = Number(r.lastInsertRowid) || 0;
    } catch (e) {}
    pushOne({ id: id, t: ts.slice(11, 19), lvl: level || 'info', tag: src || '', msg: msg });
  }
  function pushOne(row) {
    const line = JSON.stringify(row);
    SSE.forEach(function (res) { try { res.write('data: ' + line + '\n\n'); } catch (e) { SSE.delete(res); } });
  }
  ctx.logEvent = logEvent;

  app.get('/api/logs', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const level = String(req.query.level || '');
    const rows = level
      ? all('SELECT * FROM logs WHERE level = ? ORDER BY id DESC LIMIT ?', level, limit).reverse()
      : all('SELECT * FROM logs ORDER BY id DESC LIMIT ?', limit).reverse();
    return ok(rows.map(function (r) { return { id: r.id, t: String(r.ts).slice(11, 19), lvl: r.level, tag: r.src, msg: r.msg }; }));
  });

  app.get('/api/logs/stream', async (req, reply) => {
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    reply.raw.write('retry: 3000\n\n');
    /* 先补最近 60 条历史，前端日志页靠这个回填 */
    const last = Number(req.query.last) || 0;
    try {
      const rows = last
        ? all('SELECT id, ts, level, src, msg FROM logs WHERE id > ? ORDER BY id ASC LIMIT 200', last)
        : all('SELECT id, ts, level, src, msg FROM logs ORDER BY id DESC LIMIT 60').reverse();
      rows.forEach(function (r) {
        reply.raw.write('data: ' + JSON.stringify({ id: r.id, t: String(r.ts).slice(11, 19), lvl: r.level, tag: r.src, msg: r.msg }) + '\n\n');
      });
    } catch (e) {}
    SSE.add(reply.raw);
    const ping = setInterval(function () { try { reply.raw.write(': ping\n\n'); } catch (e) {} }, 15000);
    req.raw.on('close', function () { clearInterval(ping); SSE.delete(reply.raw); });
    return reply;
  });

  /* ---- 站点清单（真实清单在数据目录，不进 web 根） ---- */
  function loadSiteList() {
    const files = [path.join(DATA_DIR, 'sites-data.local.js'), path.join(WEB_DIR, 'assets', 'sites-data.local.js')];
    const sandbox = { window: {} };
    try {
      let code = null;
      for (let i = 0; i < files.length && code === null; i++) {
        try { code = fs.readFileSync(files[i], 'utf8'); } catch (e) {}
      }
      if (code === null) return [];
      vm.runInNewContext(code, sandbox, { timeout: 1000 });
      const urls = (sandbox.window.SITE_URLS || []).slice();
      const arch = sandbox.window.PT_ARCH || {};
      const names = sandbox.window.PT_NAMES || {};
      const seen = {};
      return urls.map(function (u) {
        const host = String(u).replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
        return { host: host, url: u, arch: arch[host] || '?', title: names[host] || '' };
      }).filter(function (x) { return x.host && !seen[x.host] && (seen[x.host] = 1); });
    } catch (e) {
      return [];
    }
  }
  function readStatus() {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-status.json'), 'utf8')) || {}; } catch (e) { return {}; }
  }

  app.get('/api/sites', async () => {
    const list = loadSiteList();
    const counts = { total: list.length, np: 0, unit3d: 0, gz: 0, other: 0, unknown: 0 };
    list.forEach(function (x) {
      if (x.arch === 'NP') counts.np++;
      else if (x.arch === 'UNIT3D') counts.unit3d++;
      else if (x.arch === 'GZ') counts.gz++;
      else if (x.arch === 'OTHER') counts.other++;
      else counts.unknown++;
    });
    return ok({ counts: counts, sites: list, status: readStatus() });
  });

  /* ---- 站点配置 ---- */
  app.get('/api/site-config', async () => {
    const sites = {};
    all('SELECT host, data FROM sites').forEach(function (r) { sites[r.host] = jparse(r.data) || {}; });
    const metaRow = one("SELECT v FROM meta WHERE k = 'site-config-meta'");
    const meta = metaRow ? JSON.parse(metaRow.v) : {};
    return ok({ sites: sites, hidden: meta.hidden || [] });
  });
  app.put('/api/site-config/:host', async (req, reply) => {
    const host = req.params.host;
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const cur = one('SELECT data FROM sites WHERE host = ?', host);
    const prev = cur ? jparse(cur.data) : {};
    const next = Object.assign({}, prev, req.body || {});
    db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
      .run(host, JSON.stringify(next), now());
    logEvent('info', '站点', '更新站点配置 · ' + host);
    return ok(reply, { host: host, config: next });
  });
  app.delete('/api/site-config/:host', async (req, reply) => {
    db.prepare('DELETE FROM sites WHERE host = ?').run(req.params.host);
    return ok(reply, { host: req.params.host });
  });

  /* ---- 凭据：只回 hasCookie，不回明文 ---- */
  app.get('/api/credentials', async () => {
    const rows = all('SELECT host, cookie, updated_at FROM credentials');
    return ok(rows.map(function (r) { return { host: r.host, hasCookie: !!r.cookie, updatedAt: r.updated_at || null }; }));
  });
  app.put('/api/credentials/:host', async (req, reply) => {
    const host = req.params.host;
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const b = req.body || {};
    if (b.cookie !== undefined) {
      const cookie = String(b.cookie || '');
      if (cookie.length > 4096) return bad(reply, 'BAD_REQUEST', 'cookie 太长');
      const enc = cookie ? secretbox.encrypt(cookie, KEYRING.key) : null;
      db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET cookie=excluded.cookie, updated_at=excluded.updated_at')
        .run(host, enc, now());
      logEvent('info', '站点', '保存凭据 · ' + host);
    }
    return ok(reply, { host: host, hasCookie: !!b.cookie });
  });

  /* ---- 站点定义 ---- */
  const DEF_DIR = path.join(DATA_DIR, 'site-defs');
  function readDef(host) {
    try { return JSON.parse(fs.readFileSync(path.join(DEF_DIR, host + '.json'), 'utf8')); } catch (e) { return null; }
  }
  app.get('/api/site-def/:host', async (req, reply) => {
    const def = readDef(req.params.host);
    if (!def) return bad(reply, 'NOT_FOUND', '没有这个站的定义', 404);
    return ok(reply, def);
  });
  app.get('/api/site-defs', async () => {
    const out = {};
    try {
      fs.readdirSync(DEF_DIR).forEach(function (f) {
        if (!/\.json$/.test(f)) return;
        const host = f.replace(/\.json$/, '');
        const d = readDef(host);
        if (!d) return;
        out[host] = { engine: d.engine || '', base: d.base || '', groups: d.cats ? Object.keys(d.cats).length : 0,
          ids: d.cats ? Object.keys(d.cats).reduce(function (a, k) { return a + (d.cats[k] || []).length; }, 0) : 0,
          cats: d.cats || {} };
      });
    } catch (e) {}
    return ok(out);
  });
};

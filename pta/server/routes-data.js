/* 站点、凭据、日志与站点定义接口（Fastify v2）。 */
const path = require('path');
const fs = require('fs');
const jsonFile = require('./json-file');
const siteHidden = require('./site-hidden');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const cookieStore = require('./cookie-store')(DATA_DIR);
  const siteStore = require('./site-store')(DATA_DIR);
  function archOf(engine) { const e = String(engine || '').toLowerCase(); return e === 'nexusphp' ? 'NP' : (e === 'unit3d' ? 'UNIT3D' : (e === 'gazelle' ? 'GZ' : '?')); }
  function defOfRecord(rec) {
    const cats = rec.search.cats || {};
    const list = [];
    Object.keys(cats).forEach(function (label) { (cats[label] || []).forEach(function (id) { list.push({ id: String(id), label: String(label), purpose: String(label) }); }); });
    const catMap = list.length ? list : (rec.publish.catMap || {});
    return { engine: rec.engine, base: rec.url.base, searchPath: rec.search.path, params: rec.search.params || {},
      catMode: rec.search.catMode || 'single', catSlot: rec.search.catSlot || '', cats: cats, catMap: catMap,
      upload: rec.publish.upload || {}, uploadMap: rec.publish.upload || {}, verify: rec.publish.verify || {},
      tagMap: rec.publish.tagMap || {}, tagValue: rec.publish.tagValue || 'yes' };
  }
  const SSE = new Set();
  const now = () => new Date().toISOString();

  /* ---- 日志：写库并推 SSE ---- */
  function logEvent(level, src, msg) {
    const ts = now();
    let id = 0;
    try {
      const r = db.prepare('INSERT INTO logs(ts, level, src, msg) VALUES(?, ?, ?, ?)').run(ts, level || 'info', src || '', String(msg || '').slice(0, 2000));
      id = Number(r.lastInsertRowid) || 0;
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    pushOne({ id: id, t: ts.slice(11, 19), lvl: level || 'info', tag: src || '', msg: msg });
  }
  function pushOne(row) {
    const line = JSON.stringify(row);
    SSE.forEach(function (res) { try { res.write('data: ' + line + '\n\n'); } catch (e) { SSE.delete(res); } });
  }
  ctx.logEvent = logEvent;

  app.get('/api/logs', async (req) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
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
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    SSE.add(reply.raw);
    const ping = setInterval(function () { try { reply.raw.write(': ping\n\n'); } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) } }, 15000);
    req.raw.on('close', function () { clearInterval(ping); SSE.delete(reply.raw); });
    return reply;
  });

  /* ---- 站点清单：v2 以 SQLite sites 表为唯一事实源 ---- */
  function readStatus() {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-status.json'), 'utf8')) || {}; } catch (e) { return {}; }
  }

  app.get('/api/sites', async () => {
    const allSites = siteStore.list();
    const hidden = allSites.filter(function (x) { return x.settings.hidden === true; }).map(function (x) { return x.host; });
    const merged = allSites.filter(function (x) { return x.settings.hidden !== true; }).map(function (x) {
      return { host: x.host, url: x.url.base || ('https://' + x.host), arch: archOf(x.engine),
        title: x.name || x.host, added: true };
    });
    const counts = { total: merged.length, np: 0, unit3d: 0, gz: 0, other: 0, unknown: 0 };
    merged.forEach(function (x) {
      if (x.arch === 'NP') counts.np++;
      else if (x.arch === 'UNIT3D') counts.unit3d++;
      else if (x.arch === 'GZ') counts.gz++;
      else if (x.arch === 'OTHER') counts.other++;
      else counts.unknown++;
    });
    return ok({ counts: counts, sites: merged, hidden: hidden, status: readStatus() });
  });

  /* 面板内添加站点：写 sites 表，不碰 base 清单 */
  app.post('/api/sites', async (req, reply) => {
    const b = req.body || {};
    let raw = String(b.url || '').trim();
    if (!raw) return bad(reply, 'BAD_URL', '站点地址不能为空');
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    let u;
    try { u = new URL(raw); } catch (e) { return bad(reply, 'BAD_URL', '站点地址格式不对'); }
    const host = u.hostname.replace(/^www\./i, '');
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const prev = one('SELECT data FROM sites WHERE host = ?', host);
    const cfg = prev ? (jparse(prev.data) || {}) : {};
    const arch = ['NP', 'UNIT3D', 'GZ', 'OTHER', '?'].indexOf(b.arch) >= 0 ? b.arch : (cfg.arch || '?');
    const next = Object.assign({}, cfg, {
      url: u.origin + (u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : ''),
      arch: arch,
      title: String(b.title || cfg.title || host).slice(0, 80),
      added: cfg.base === true ? cfg.added === true : true
    });
    /* 重新添加同一域名等于恢复；基础站的 base 标记保留 */
    siteHidden.remove(db, host);
    db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
      .run(host, JSON.stringify(next), now());
    if (siteStore.has(host)) {
      siteStore.setHidden(host, false, db);
    } else {
      const engine = arch === 'NP' ? 'nexusphp' : (arch === 'UNIT3D' ? 'unit3d' : (arch === 'GZ' ? 'gazelle' : '?'));
      siteStore.add(host, { name: next.title, engine: engine, url: { base: next.url }, settings: { enabled: false } }, db);
    }
    logEvent('info', '站点', '添加站点 · ' + host);
    return ok(reply, { host: host, url: next.url, arch: next.arch, title: next.title, added: true });
  });

  app.delete('/api/sites/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const row = one('SELECT data FROM sites WHERE host = ?', host);
    if (!row) return bad(reply, 'NOT_FOUND', '站点不存在', 404);
    siteHidden.add(db, host);
    cookieStore.remove(host, db);
    siteStore.setHidden(host, true, db);
    logEvent('info', '站点', '移除站点（可恢复） · ' + host);
    return ok(reply, { host: host, hidden: true, soft: true });
  });

  app.post('/api/sites/:host/restore', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const row = one('SELECT data FROM sites WHERE host = ?', host);
    if (!row) return bad(reply, 'NOT_FOUND', '站点不在面板里，先重新添加', 404);
    const changed = siteHidden.remove(db, host);
    if (siteStore.has(host)) siteStore.setHidden(host, false, db);
    if (changed) logEvent('info', '站点', '恢复基础站点 · ' + host);
    return ok(reply, { host: host, restored: changed });
  });

  /* ---- 站点配置 ---- */
  app.get('/api/site-config', async () => {
    const sites = {};
    const hidden = [];
    siteStore.list().forEach(function (s) { sites[s.host] = Object.assign({}, s.settings); if (s.settings.hidden) hidden.push(s.host); });
    return ok({ sites: sites, hidden: hidden });
  });
  app.put('/api/site-config/:host', async (req, reply) => {
    const host = req.params.host;
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const cur = one('SELECT data FROM sites WHERE host = ?', host);
    const prev = cur ? jparse(cur.data) : {};
    const next = Object.assign({}, prev, req.body || {});
    db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
      .run(host, JSON.stringify(next), now());
    const sk = ['enabled', 'interval', 'priority', 'note', 'override', 'ovInterval', 'ovDetail', 'mode', 'queueMode', 'window', 'pages', 'concurrency', 'dupeCheck'];
    const settings = {};
    sk.forEach(function (k) { if (next[k] !== undefined) settings[k] = next[k]; });
    if (siteStore.has(host)) siteStore.save(host, { settings: settings }, db);
    logEvent('info', '站点', '更新站点配置 · ' + host);
    return ok(reply, { host: host, config: next });
  });
  app.delete('/api/site-config/:host', async (req, reply) => {
    db.prepare('DELETE FROM sites WHERE host = ?').run(req.params.host);
    return ok(reply, { host: req.params.host });
  });

  /* ---- 凭据：只回 hasCookie，不回明文 ---- */
  app.get('/api/credentials', async () => {
    return ok(cookieStore.list());
  });
  app.put('/api/credentials/:host', async (req, reply) => {
    const host = req.params.host;
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const b = req.body || {};
    if (b.cookie !== undefined) {
      const r = cookieStore.set(host, String(b.cookie || ''), db);
      if (!r.ok) return bad(reply, r.code, r.message, r.code === 'CRYPTO_UNAVAILABLE' ? 409 : 400);
      logEvent('info', '站点', (r.hasCookie ? '保存凭据 · ' : '删除凭据 · ') + host);
      return ok(reply, { host: host, hasCookie: r.hasCookie });
    }
    return ok(reply, { host: host, hasCookie: cookieStore.has(host) });
  });

  /* ---- 站点定义 ---- */
  const DEF_DIR = path.join(DATA_DIR, 'site-defs');
  function readDef(host) {
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(String(host || ''))) return null;
    try { return JSON.parse(fs.readFileSync(path.join(DEF_DIR, host + '.json'), 'utf8')); } catch (e) { return null; }
  }
  app.get('/api/site-def/:host', async (req, reply) => {
    const rec = siteStore.get(req.params.host);
    if (!rec) return bad(reply, 'NOT_FOUND', '没有这个站的定义', 404);
    return ok(reply, defOfRecord(rec));
  });
  app.put('/api/site-def/:host', async (req, reply) => {
    const host = req.params.host;
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return bad(reply, 'BAD_DEF', '站点定义必须是 JSON 对象');
    const text = JSON.stringify(b);
    if (text.length > 200 * 1024) return bad(reply, 'TOO_LARGE', '站点定义超过 200KB');
    if (b.base && !require('./url-guard').baseOk(host, b.base)) {
      return bad(reply, 'BAD_BASE', '站点 base 必须是该站域名或其子域，且非本机站点要用 https');
    }
    const CAT_MODES = ['single', 'multi', 'bracket', 'indexed'];
    if (b.catMode !== undefined && b.catMode !== '' && CAT_MODES.indexOf(String(b.catMode)) < 0) {
      return bad(reply, 'BAD_CAT_MODE', 'catMode 只能是 ' + CAT_MODES.join(' / '));
    }
    try {
      fs.mkdirSync(DEF_DIR, { recursive: true, mode: 0o700 });
      jsonFile.writeAtomic(path.join(DEF_DIR, host + '.json'), b, 0o600);
    } catch (e) {
      return bad(reply, 'WRITE_FAILED', '站点定义写入失败', 500);
    }
    const cur = siteStore.get(host) || { search: {}, publish: {} };
    const up = b.uploadMap || b.upload || {};
    const search = Object.assign({}, cur.search || {}, {
      path: b.searchPath || (cur.search && cur.search.path) || '/torrents.php',
      params: b.params || (cur.search && cur.search.params) || {},
      catMode: b.catMode || (cur.search && cur.search.catMode) || 'single',
      catSlot: b.catSlot != null ? String(b.catSlot) : ((cur.search && cur.search.catSlot) || ''),
      cats: b.cats || (cur.search && cur.search.cats) || {}
    });
    const publish = Object.assign({}, cur.publish || {}, {
      upload: { path: String(up.path || ''), formPath: String(up.formPath || ''), fileField: String(up.fileField || ''), fields: up.fields || {} },
      verify: { path: String((b.verify && b.verify.path) || (cur.publish && cur.publish.verify && cur.publish.verify.path) || '') },
      tagMap: b.tagMap || (cur.publish && cur.publish.tagMap) || {},
      tagValue: b.tagValue || (cur.publish && cur.publish.tagValue) || 'yes',
      baseValueMaps: b.valueMaps || (cur.publish && cur.publish.baseValueMaps) || {},
      form: b.form || (cur.publish && cur.publish.form) || null
    });
    if (Array.isArray(b.catMap)) {
      publish.catMap = {};
      publish.catLabels = {};
      b.catMap.forEach(function (x) { if (x && x.id != null) { if (x.purpose) publish.catMap[String(x.purpose)] = String(x.id); if (x.label) publish.catLabels[String(x.label)] = String(x.id); } });
    } else if (b.catMap && typeof b.catMap === 'object') {
      publish.catMap = b.catMap;
      publish.catLabels = b.catMap;
    }
    siteStore.save(host, { engine: b.engine || (cur.engine || '?'), search: search, publish: publish, url: b.base ? { base: b.base } : undefined }, db);
    return ok(reply, { host: host, def: b });
  });
  app.get('/api/site-defs', async () => {
    const out = {};
    siteStore.list().forEach(function (s) {
      const cats = s.search.cats || {};
      out[s.host] = { engine: s.engine || '', base: s.url.base || '', groups: Object.keys(cats).length,
        ids: Object.keys(cats).reduce(function (a, k) { return a + (cats[k] || []).length; }, 0), cats: cats };
    });
    return ok(out);
  });
};

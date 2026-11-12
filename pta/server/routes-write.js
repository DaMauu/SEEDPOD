/* 追加到 app-fastify.js 的写接口片段：词条库、队列、流程规则、配置。
   在 build() 内被 require 注入（见 app-fastify.js 末尾 require('./routes-write')(app, ctx)）。 */
module.exports = function (app, ctx) {
  const { db, one, all, ok, bad, jparse } = ctx;
  const now = () => new Date().toISOString();

  function updCatalog(id, patch) {
    const row = one('SELECT data FROM catalog WHERE id = ?', id);
    if (!row) return null;
    const it = Object.assign(jparse(row.data) || {}, patch);
    const st = it.status || 'new';
    db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(it), st, now(), id);
    return it;
  }
  function getCatalog(id) {
    const row = one('SELECT data FROM catalog WHERE id = ?', id);
    return row ? jparse(row.data) : null;
  }

  /* ---- 词条库写入 ---- */
  app.post('/api/catalog', async (req, reply) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const items = Array.isArray(b) ? b : b.items;
    if (!Array.isArray(items)) return bad(reply, 'BAD_REQUEST', 'items 必须是数组');
    let added = 0, updated = 0;
    const ins = db.prepare(`INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, title=excluded.title, updated_at=excluded.updated_at`);
    const mx = one("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS m FROM catalog WHERE id LIKE 'cat_%'") || { m: 0 };
    const seq = Number(mx.m) || 0;
    items.slice(0, 500).forEach(function (raw, i) {
      if (!raw || !raw.title) return;
      const it = Object.assign({}, raw);
      it.id = it.id || 'cat_' + String(seq + i + 1).padStart(6, '0');
      it.status = it.status || 'new';
      it.createdAt = it.createdAt || now();
      ins.run(String(it.id), it.site || '', it.siteId != null ? String(it.siteId) : '', it.infohash || '',
        it.title, it.status, JSON.stringify(it), it.createdAt, now());
      added++;
    });
    return ok(reply, { added: added, updated: updated, skipped: items.length - added });
  });

  app.post('/api/catalog/:id/status', async (req, reply) => {
    const status = String((req.body && req.body.status) || '');
    if (!['new', 'selected', 'archived', 'published', 'skipped'].includes(status)) return bad(reply, 'BAD_REQUEST', 'status 不合法');
    const it = updCatalog(req.params.id, { status: status });
    if (!it) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    return ok(reply, it);
  });

  app.post('/api/catalog/:id/marks', async (req, reply) => {
    const it = getCatalog(req.params.id);
    if (!it) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    const marks = {};
    const src = (req.body && req.body.marks) || {};
    ['noRedistribute', 'exclusive', 'diy', 'limited', 'limitedDays', 'existing'].forEach(function (k) {
      if (src[k]) marks[k] = src[k] === true ? true : Number(src[k]) || 0;
    });
    const next = updCatalog(req.params.id, { marks: marks });
    return ok(reply, next);
  });

  app.delete('/api/catalog/:id', async (req, reply) => {
    const row = one('SELECT id FROM catalog WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    db.prepare('DELETE FROM catalog WHERE id = ?').run(req.params.id);
    return ok(reply, { id: req.params.id });
  });

  app.post('/api/catalog/bulk', async (req, reply) => {
    const b = req.body || {};
    const status = String(b.status || '');
    if (!['new', 'selected', 'archived', 'published', 'skipped'].includes(status)) return bad(reply, 'BAD_REQUEST', 'status 不合法');
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    let want = ids;
    if (!ids.length && b.fromStatus) want = all('SELECT id FROM catalog WHERE status = ? LIMIT 1000', String(b.fromStatus)).map(function (r) { return r.id; });
    let changed = 0;
    want.slice(0, 1000).forEach(function (id) { if (updCatalog(id, { status: status })) changed++; });
    return ok(reply, { changed: changed, status: status });
  });

  /* ---- 队列写入 ---- */
  app.post('/api/queue', async (req, reply) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return bad(reply, 'BAD_REQUEST', 'title 必填');
    const mxq = one("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM queue WHERE id LIKE 'q_%'") || { m: 0 };
    const n = Number(mxq.m) || 0;
    const item = Object.assign({}, b, { id: 'q_' + String(n + 1).padStart(4, '0'), status: b.status || 'pending', createdAt: now() });
    db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
      .run(item.id, item.status, title, JSON.stringify(item), item.createdAt, now());
    return ok(reply, item);
  });

  app.post('/api/queue/:id/action', async (req, reply) => {
    const row = one('SELECT data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    const b = req.body || {};
    const target = { approve: 'approved', reject: 'rejected', skip: 'skipped', publish: 'published', retry: 'pending' }[b.action];
    if (!target) return bad(reply, 'BAD_REQUEST', 'action 只能是 approve / reject / skip / publish / retry');
    if (b.action === 'reject' && !String(b.reason || '').trim()) return bad(reply, 'BAD_REQUEST', '驳回要写理由');
    it.status = target;
    it.actionAt = now();
    if (b.reason) it.reason = String(b.reason).slice(0, 500);
    if (target === 'published') {
      it.publishedAt = now();
      db.prepare('INSERT INTO published(id, data, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
        .run(it.id, JSON.stringify(it), it.publishedAt);
    }
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?').run(target, JSON.stringify(it), now(), it.id);
    return ok(reply, it);
  });

  app.delete('/api/queue/:id', async (req, reply) => {
    const row = one('SELECT id FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    db.prepare('DELETE FROM queue WHERE id = ?').run(req.params.id);
    return ok(reply, { id: req.params.id });
  });

  /* ---- 流程规则 ---- */
  app.get('/api/flow', async () => {
    const row = one("SELECT v FROM meta WHERE k = 'flow'");
    return ok(JSON.parse(row ? row.v : 'null') || { sets: null, rx: {}, updatedAt: null });
  });
  app.put('/api/flow', async (req, reply) => {
    const b = req.body || {};
    const row = one("SELECT v FROM meta WHERE k = 'flow'");
    const prev = JSON.parse(row ? row.v : 'null') || { sets: {}, rx: {} };
    const sets = Object.assign({}, prev.sets || {}, b.sets || {});
    const rx = Object.assign({}, prev.rx || {});
    if (b.rx) {
      if (b.rx.deny !== undefined) rx.deny = String(b.rx.deny || '').slice(0, 200);
      if (b.rx.allow !== undefined) rx.allow = String(b.rx.allow || '').slice(0, 200);
      if (b.rx.scope !== undefined) rx.scope = String(b.rx.scope || '').slice(0, 40);
    }
    const flow = { sets: sets, rx: rx, updatedAt: now() };
    db.prepare("INSERT INTO meta(k, v) VALUES('flow', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(flow));
    return ok(reply, flow);
  });

  /* ---- 配置 ---- */
  const DEF = { runMode: 'test', interval: 60, dailySite: 20, dailyAll: 100, breaker: 3, autoDupe: false };
  const LIM = { test: { interval: [30, 120], dailySite: [1, 300], dailyAll: [50, 2000], breaker: [1, 10] }, prod: { interval: [8, 120], dailySite: [1, 300], dailyAll: [50, 2000], breaker: [1, 10] } };
  function readCfg() {
    const row = one("SELECT v FROM meta WHERE k = 'config'");
    return Object.assign({}, DEF, JSON.parse(row ? row.v : 'null') || {});
  }
  app.get('/api/config', async () => ok({ sys: { concurrency: 1, minInterval: 8, retry: 3, backoff: 30, breakerMinutes: 15, audit: true }, user: readCfg(), limits: LIM }));
  app.patch('/api/config/user', async (req, reply) => {
    const b = req.body || {};
    const cfg = readCfg();
    const mode = b.runMode || cfg.runMode;
    if (!LIM[mode]) return bad(reply, 'BAD_REQUEST', 'runMode 只能是 test 或 prod');
    const lim = LIM[mode];
    for (const k of ['interval', 'dailySite', 'dailyAll', 'breaker']) {
      if (b[k] === undefined) continue;
      const n = Number(b[k]);
      if (!Number.isInteger(n)) return bad(reply, 'BAD_REQUEST', k + ' 必须是整数');
      if (n < lim[k][0] || n > lim[k][1]) return bad(reply, 'OUT_OF_RANGE', k + ' 必须在 ' + lim[k][0] + '–' + lim[k][1] + ' 之间');
    }
    const next = Object.assign({}, cfg);
    if (b.runMode) next.runMode = b.runMode;
    if (b.autoDupe !== undefined) next.autoDupe = !!b.autoDupe;
    ['interval', 'dailySite', 'dailyAll', 'breaker'].forEach(function (k) { if (b[k] !== undefined) next[k] = Number(b[k]); });
    db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(next));
    return ok(reply, next);
  });
};

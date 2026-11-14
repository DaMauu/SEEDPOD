/* 其余业务接口（Fastify v2）：站点搜索预设、本地查重、按条件送审、已发布、本地库、抓取状态。 */
const fs = require('fs');
const path = require('path');
const screen = require('./screen');
const meta = require('./meta');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const now = () => new Date().toISOString();
  const readDef = (host) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-defs', host + '.json'), 'utf8')); } catch (e) { return null; } };
  const readPreset = () => { try { const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-search.local.json'), 'utf8')) || {}; return raw.sites || raw; } catch (e) { return {}; } };

  app.get('/api/meta/parse', async (req) => ok(meta.parseRelease(req.query.title || '')));

  app.get('/api/sites/:host/search', async (req, reply) => {
    const host = req.params.host;
    const preset = readPreset()[host] || null;
    return ok(reply, { host: host, preset: preset });
  });

  app.get('/api/site-search', async () => {
    const sites = readPreset();
    const out = {};
    Object.keys(sites).forEach(function (h) {
      const s = sites[h] || {};
      const cats = s.cats && typeof s.cats === 'object' ? s.cats : {};
      let ids = 0;
      Object.keys(cats).forEach(function (k) { ids += (cats[k] || []).length; });
      out[h] = { engine: s.engine || '', source: s.source || '', updatedAt: s.updatedAt || '',
        groups: Object.keys(cats).length, ids: ids, confirmed: s.confirmed === true || s.source === 'manual' || s.source === 'probe' };
    });
    return ok(out);
  });

  /* 本地查重：跟队列、已发布、词条库里已送审/已发布比对（不发请求） */
  app.post('/api/catalog/check', async (req) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const limit = Math.min(Number(b.limit) || 100, 500);
    const rows = all("SELECT id, data FROM catalog WHERE status = 'new' LIMIT ?", limit);
    const seen = {};
    all('SELECT id, data FROM queue').forEach(function (r) { const it = jparse(r.data) || {}; if (it.infohash) seen[String(it.infohash).toLowerCase()] = it.id || 'queue'; });
    let checked = 0, dup = 0;
    rows.forEach(function (r) {
      if (ids.length && ids.indexOf(r.id) < 0) return;
      const it = jparse(r.data) || {};
      checked++;
      const hash = String(it.infohash || '').toLowerCase();
      if (hash && seen[hash]) {
        dup++;
        it.marks = Object.assign({}, it.marks, { existing: true });
        it.dupNote = '跟队列里的 ' + seen[hash] + ' 重复';
        db.prepare('UPDATE catalog SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(it), now(), r.id);
      }
    });
    return ok({ checked: checked, dup: dup });
  });

  /* 按条件送审：与调度器共用 screen 模块 */
  app.post('/api/catalog/screen', async (req) => ok(screen.screenCatalog(ctx, req.body || {})));

  app.get('/api/published', async () => {
    const rows = all('SELECT data FROM published ORDER BY created_at DESC LIMIT 200');
    return ok({ items: rows.map(function (r) { return jparse(r.data); }).filter(Boolean) });
  });

  const LIB_FILE = path.join(DATA_DIR, 'library.json');
  app.get('/api/library', async () => {
    try { return ok(JSON.parse(fs.readFileSync(LIB_FILE, 'utf8')) || []); } catch (e) { return ok([]); }
  });
  app.post('/api/library', async (req, reply) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return bad(reply, 'BAD_REQUEST', 'title 必填');
    let items = [];
    try { items = JSON.parse(fs.readFileSync(LIB_FILE, 'utf8')) || []; } catch (e) { items = []; }
    const entry = { id: 'lib_' + String(items.length + 1).padStart(4, '0'), title: title, addedAt: now() };
    items.push(entry);
    try { fs.writeFileSync(LIB_FILE, JSON.stringify(items, null, 1), { mode: 0o600 }); } catch (e) { return bad(reply, 'STORAGE_FAILED', '写入本地库失败', 500); }
    return ok(reply, entry);
  });

  app.get('/api/scheduler', async () => ok(ctx.scheduler.status()));

  app.patch('/api/scheduler', async (req, reply) => {
    const r = ctx.scheduler.set(req.body || {});
    if (r.err) return bad(reply, 'BAD_REQUEST', r.err);
    return ok(reply, r.data);
  });

  app.post('/api/scheduler/run', async (req, reply) => {
    const r = await ctx.scheduler.runNow();
    if (!r.ok) return bad(reply, 'SCHEDULER_BUSY', r.error, 409);
    return ok(reply, r.steps);
  });

  app.get('/api/crawl/status', async (req) => {
    const row = one("SELECT v FROM meta WHERE k = 'crawl-state'");
    const state = JSON.parse(row ? row.v : 'null') || {};
    const host = String(req.query.host || '').trim().toLowerCase();
    if (!host) return ok({ state: state });
    const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
    const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
    const winMs = Math.max(1, Math.min(Number(cfg.windowMinutes) || 60, 1440)) * 60000;
    const maxWin = Math.max(1, Math.min(Number(cfg.maxPerWindow) || 20, 1000));
    const gapMs = Math.max(8, Math.min(Number(cfg.interval) || 60, 600)) * 1000;
    const rec = state[host] || {};
    const nowMs = Date.now();
    const times = Array.isArray(rec.times) ? rec.times.filter(function (t) { return t > nowMs - winMs; }) : [];
    const waitMs = Math.max(0, (Number(rec.lastAt) || 0) + gapMs - nowMs);
    const dayCount = Number(rec.dayCount) || 0;
    const dayMax = limits.dailyMax();
    return ok({ host: host, count: dayCount, dailyMax: dayMax, leftToday: Math.max(0, dayMax - dayCount),
      windowCount: times.length, windowMax: maxWin, windowMinutes: Math.round(winMs / 60000),
      waitMs: waitMs, lastAt: rec.lastAt || 0, lastError: rec.lastError || '', page: rec.page || 0, catIdx: rec.catIdx || 0 });
  });
};

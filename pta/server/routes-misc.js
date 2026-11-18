/* 其余业务接口（Fastify v2）：站点搜索预设、本地查重、按条件送审、已发布、本地库、抓取状态。 */
const fs = require('fs');
const path = require('path');
const screen = require('./screen');
const meta = require('./meta');
const mediainfo = require('./mediainfo');
const metaExt = require('./meta-ext');
const { makeErrorStats } = require('./error-stats');
const { makeFailureQueue } = require('./failure-queue');
const { makeTarget } = require('./target');
const { makeTargetService } = require('./target-service');
const { dedupeItem, hostsOf } = require('./dedupe-item');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const now = () => new Date().toISOString();
  const readDef = (host) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-defs', host + '.json'), 'utf8')); } catch (e) { return null; } };
  const readPreset = () => { try { const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-search.local.json'), 'utf8')) || {}; return raw.sites || raw; } catch (e) { return {}; } };
  const errorStats = makeErrorStats(ctx);
  const failureQueue = makeFailureQueue(ctx);
  const targetService = makeTargetService(ctx, makeTarget(ctx));

  app.get('/api/errors', async (req) => ok(errorStats.snapshot(req.query.limit)));

  app.get('/api/failures', async (req) => ok(failureQueue.list({
    limit: req.query.limit, offset: req.query.offset, dead: req.query.dead,
    days: req.query.days, maxItems: req.query.maxItems || req.query.max
  })));

  app.post('/api/failures/:id/replay', async (req, reply) => {
    const r = failureQueue.replay(req.params.id);
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r);
  });

  app.get('/api/meta/parse', async (req) => ok(meta.parseRelease(req.query.title || '')));
  app.post('/api/meta/mediainfo', async (req, reply) => {
    const b = req.body || {};
    const text = String(b.text || b.mediaInfo || b.bdinfo || '');
    if (!text.trim()) return bad(reply, 'BAD_REQUEST', 'text 必填');
    if (text.length > 200000) return bad(reply, 'TOO_LARGE', '文本超过 200000 字符', 413);
    const parsed = mediainfo.parse(text);
    if (!parsed.kind) return bad(reply, 'NO_MEDIAINFO', '没认出 MediaInfo / BDInfo 格式', 422);
    return ok(reply, parsed);
  });
  app.get('/api/meta/providers', async () => ok(metaExt.providers()));
  app.post('/api/meta/fetch', async (req, reply) => {
    const b = req.body || {};
    const r = await metaExt.fetchMeta({ title: b.title, year: b.year, type: b.type, provider: b.provider, key: b.key,
      requireYear: false, castLimit: 8 });
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r);
  });

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

  /* 按条件送审：本地初筛后，立刻对选中的条目查一次目标站，命中已有就跳过 */
  app.post('/api/catalog/screen', async (req) => {
    const b = req.body || {};
    const out = screen.screenCatalog(ctx, b);
    const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
    const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
    const targetHost = String(b.targetHost || cfg.targetHost || '').trim().toLowerCase();
    const limit = Math.max(0, Math.min(20, b.dedupeLimit === undefined ? 20 : Number(b.dedupeLimit) || 0));
    out.dupe = { target: targetHost, checked: 0, found: 0, skipped: 0, errors: 0, deferred: 0, noTarget: 0, skippedReason: '' };
    if (!out.selected || !Array.isArray(out.selectedIds)) return ok(out);
    if (!limit) { out.dupe.skippedReason = 'off'; return ok(out); }
    const ids = out.selectedIds.slice(0, limit);
    out.dupe.deferred = Math.max(0, out.selectedIds.length - ids.length);
    for (const id of ids) {
      const row = one('SELECT status, data FROM queue WHERE id = ?', id);
      if (!row) continue;
      const it = jparse(row.data) || {};
      const hosts = hostsOf(it, targetHost);
      if (!hosts.length) { out.dupe.noTarget++; continue; }
      const r = await dedupeItem({ item: it, hosts: hosts, targetService: targetService });
      out.dupe.checked++;
      out.dupe.found += r.found;
      out.dupe.skipped += r.skipped;
      out.dupe.errors += r.errors.length;
      if (r.allSkipped) {
        it.status = 'skipped';
        it.dupeSkipped = { at: now(), hosts: hosts };
        db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?').run('skipped', JSON.stringify(it), now(), id);
        if (it.catalogId) {
          const crow = one('SELECT data FROM catalog WHERE id = ?', it.catalogId);
          const cd = jparse(crow && crow.data) || {};
          cd.status = 'skipped';
          cd.dupe = 'dupe';
          cd.dupeTarget = String(hosts[0] || '').slice(0, 200);
          cd.dupeHosts = hosts;
          cd.dupeAt = now();
          db.prepare('UPDATE catalog SET status = ?, data = ?, updated_at = ? WHERE id = ?').run('skipped', JSON.stringify(cd), now(), it.catalogId);
        }
        out.selected--;
        out.skipped++;
        out.byReason['目标站已有'] = (out.byReason['目标站已有'] || 0) + 1;
      } else {
        it.dupePassedAt = it.dupePassedAt || now();
        db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(it), now(), id);
      }
    }
    if (!out.dupe.checked && out.dupe.noTarget) out.dupe.skippedReason = 'no-target';
    return ok(out);
  });

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
    const b = req.body || {};
    const r = await ctx.scheduler.runNow({
      steps: Array.isArray(b.steps) ? b.steps : null,
      batchLimit: b.batchLimit,
      screenLimit: b.screenLimit,
      publishLimit: b.publishLimit
    });
    if (!r.ok) return bad(reply, 'SCHEDULER_BUSY', r.error, 409);
    return ok(reply, Object.assign({}, r.steps, { partial: r.partial === true }));
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
    const gapMs = Math.max(6, Math.min(Number(cfg.listInterval) || 10, 60)) * 1000;
    const rec = state[host] || {};
    const nowMs = Date.now();
    const times = Array.isArray(rec.times) ? rec.times.filter(function (t) { return t > nowMs - winMs; }) : [];
    const waitMs = Math.max(0, (Number(rec.lastAt) || 0) + gapMs - nowMs);
    const dayCount = Number(rec.dayCount) || 0;
    return ok({ host: host, count: dayCount,
      windowCount: times.length, windowMax: maxWin, windowMinutes: Math.round(winMs / 60000),
      waitMs: waitMs, lastAt: rec.lastAt || 0, lastListAt: rec.lastListAt || 0, lastDetailAt: rec.lastDetailAt || 0, lastError: rec.lastError || '', page: rec.page || 0, catIdx: rec.catIdx || 0 });
  });
};

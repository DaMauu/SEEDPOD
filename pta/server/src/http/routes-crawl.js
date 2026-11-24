/* 查重与抓取计划（Fastify v2）。查重会真搜一次目标站，限条数；计划只读本地配置不发请求。 */
const adapters = require('../infra/adapters/index');
const dupeClassify = require('../features/screen/dupe-classify');
const { typeOf } = require('../features/crawl/category');
const configSchema = require('../features/settings/config-schema');
const urlGuard = require('../infra/url-guard');
const { summarizeDetection, mergeDetection, applyOverrides, mergeWithOverrides, diffCats } = require('../features/sites/detect-merge');
const { detectEngine } = require('../features/sites/detect');

function keyword(title) {
  let s = String(title || '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = s.search(/\b(?:1080p|2160p|1080i|720p|576p|480p|UHD|Blu-?Ray|REMUX|WEB-?DL|WEBRip|HDTV|AVC|HEVC|x264|x265|DTS|TrueHD|LPCM|Atmos)\b/i);
  if (cut > 0) s = s.slice(0, cut).trim();
  return s.split(/\s+/).slice(0, 8).join(' ');
}

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const cookieStore = require('../features/sites/credentials')(DATA_DIR);
  const siteStore = require('../features/sites/store')(DATA_DIR);
  const presets = require('../features/presets/store')(DATA_DIR);
  const now = () => new Date().toISOString();
  const readDef = (host) => siteStore.legacyDef(host);
  const readCookie = (host) => {
    const c = cookieStore.get(host);
    if (c.err === 'NO_COOKIE') return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie，查不了' } };
    if (c.err) return { err: { code: 'NO_COOKIE', message: 'cookie 解不开，请重新导入' } };
    return { cookie: c.cookie };
  };
  const cfgRow = () => { const r = one("SELECT v FROM meta WHERE k = 'config'"); return JSON.parse(r ? r.v : 'null') || {}; };

  function catsOf(host) {
    const def = readDef(host) || {};
    const list = def.catList || [];
    const seen = {};
    return list.filter(function (x) { return x && x.id != null; })
      .map(function (x) { return { id: String(x.id), label: String(x.label || x.purpose || x.id), purpose: String(x.purpose || '') }; })
      .filter(function (x) { if (seen[x.id]) return false; seen[x.id] = true; return true; });
  }
  function presetOf(host) {
    const rec = siteStore.get(host);
    return rec ? { types: rec.search.types || [], cats: rec.search.cats || {} } : null;
  }
  function selectedIds(host) {
    const p = presetOf(host);
    const cats = (p && p.cats) || {};
    const out = [];
    Object.keys(cats).forEach(function (k) { (cats[k] || []).forEach(function (id) { out.push(String(id)); }); });
    return out;
  }

  app.get('/api/crawl/types/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const p = presetOf(host) || {};
    if (Array.isArray(p.types) && p.types.length) return ok({ host: host, types: p.types.map(String) });
    const ids = selectedIds(host);
    const list = catsOf(host);
    const byId = {};
    list.forEach(function (c) { byId[c.id] = c; });
    const types = [];
    ids.forEach(function (id) {
      const t = typeOf((byId[id] && byId[id].label) || '');
      if (t && types.indexOf(t) < 0) types.push(t);
    });
    return ok({ host: host, types: types });
  });

  app.put('/api/crawl/types/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(host)) return bad(reply, 'BAD_HOST', '站点名不合法');
    const want = (Array.isArray(req.body && req.body.types) ? req.body.types : []).map(function (x) { return String(x); }).filter(Boolean);
    const list = catsOf(host);
    const cats = {};
    const matched = [];
    const unmatched = [];
    const seen = new Set();
    want.forEach(function (t) {
      const hits = list.filter(function (c) { return typeOf(c.label) === t || c.label === t; });
      if (!hits.length) { unmatched.push(t); return; }
      matched.push(t);
      hits.forEach(function (h) {
        const id = String(h.id);
        if (!seen.has(id)) { seen.add(id); (cats[t] = cats[t] || []).push(id); }
      });
    });
    const prevTypes = (siteStore.get(host) && siteStore.get(host).search.types) || [];
    const typesChanged = JSON.stringify(prevTypes.map(String)) !== JSON.stringify(want);
    const curSite = siteStore.get(host);
    if (curSite) siteStore.save(host, { search: Object.assign({}, curSite.search, { types: want, cats: cats }) }, db);
    /* 类型集合变了：下次抓取按全量重跑；单纯改分类预设仍走增量 */
    let rechecked = 0;
    if (typesChanged) {
      try {
        const stRow = one("SELECT v FROM meta WHERE k = 'crawl-state'");
        const st = stRow ? (JSON.parse(stRow.v) || {}) : {};
        if (st[host]) {
          delete st[host].fullDoneAt;
          st[host].page = 0;
          st[host].catIdx = 0;
          db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
        }
      } catch (e) { /* 清游标失败不阻塞类型保存 */ }
      /* 之前因“类型不符”被跳过的词条要回到待审，否则改类型也永远不会重审 */
      try {
        all("SELECT id, data FROM catalog WHERE site = ? AND status = 'skipped'", host).forEach(function (row) {
          let d = null;
          try { d = JSON.parse(row.data); } catch (e) { d = null; }
          if (!d || !/^类型(不符|未知)/.test(String(d.skipReason || ''))) return;
          delete d.skipReason;
          delete d.skippedAt;
          delete d.dupeOf;
          d.status = 'new';
          db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(d), 'new', now(), row.id);
          rechecked++;
        });
      } catch (e) { /* 重置失败不阻塞类型保存 */ }
    }
    return ok({ host: host, types: want, matched: matched, unmatched: unmatched, ids: seen.size, fullReset: typesChanged, rechecked: rechecked });
  });

  function defOf(host) { return readDef(host) || {}; }
  function filterFieldName(name) {
    const n = String(name || '').toLowerCase();
    if (/spstate|discount|free|优惠/.test(n)) return 'discount';
    if (/standard|resolution|分辨/.test(n)) return 'resolution';
    if (/medium|source|媒介/.test(n)) return 'medium';
    if (/restriction|limit|禁转|限转|hr/.test(n)) return 'restriction';
    return '';
  }
  async function detectFilters(host) {
    const rec = siteStore.get(host);
    if (rec && rec.url.base && !urlGuard.baseOk(host, rec.url.base)) {
      return { ok: false, code: 'BAD_BASE', message: '站点 base 不是该站域名' };
    }
    const def = defOf(host);
    if (!def.base) return { ok: false, code: 'NO_DEF', message: '没有站点定义' };
    const c = readCookie(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err.message };
    const path0 = String(def.searchPath || '/torrents.php');
    const url = def.base.replace(/\/+$/, '') + path0;
    let html = '';
    try {
      const dnsGate = await urlGuard.assertNoRebind(url);
      if (!dnsGate.ok) return { ok: false, code: 'DNS_BLOCKED', message: dnsGate.err };
      const r = await fetch(url, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0' }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      if (r.status !== 200) return { ok: false, code: 'HTTP_' + r.status, message: '搜索页返回 ' + r.status };
      html = await r.text();
    } catch (e) { return { ok: false, code: 'FETCH_FAILED', message: '搜索页请求失败' }; }
    const parsed = require('../features/sites/search-preset').parseSearchPreset(html, presets);
    const det = detectEngine(html, url);
    return { ok: true, data: Object.assign({ host, url, engine: det.engine, engineConfidence: det.confidence, engineHits: det.hits }, parsed) };

  }

  app.get('/api/crawl/filters/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const rec = siteStore.get(host);
    const f = (rec && rec.search.filters) || null;
    const selectedLabels = {};
    Object.keys((f && f.selected) || {}).forEach(function (d) { selectedLabels[d] = presets.labelsOfDim(d, f.selected[d]); });
    return ok({ host, filters: f, selectedLabels: selectedLabels });
  });

  app.post('/api/crawl/filters/:host/detect', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const r = await detectFilters(host);
    if (!r.ok) return bad(reply, r.code, r.message);
    return ok(r.data);
  });

  /* 一次 GET 搜索页，识别分类 ID + 各维度选项，直接写回站点预设 */
  app.post('/api/crawl/preset/:host/detect', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const rec = siteStore.get(host);
    if (!rec) return bad(reply, 'NOT_FOUND', '没有这个站的定义', 404);
    const r = await detectFilters(host);
    if (!r.ok) return bad(reply, r.code, r.message);
    const d = applyOverrides(r.data || {}, rec.search && rec.search.detect, { keyOf: presets.keyOf });
    const summary = summarizeDetection(d);
    const merged = mergeWithOverrides(rec.search, d, rec.search && rec.search.detect, { keyOf: presets.keyOf }).merged;
    const diff = diffCats(rec.search.cats, merged.search.cats);
    const nextEngine = (!rec.engine || rec.engine === '?') && d.engine && d.engine !== 'generic' && Number(d.engineConfidence) >= 0.6 ? d.engine : rec.engine;
    if (String(req.query && req.query.preview || '') === '1') {
      return ok({ host: host, preview: true, search: merged.search, detected: d, ambiguous: summary.ambiguous, unmatched: summary.unmatched, confidence: summary.confidence, engine: nextEngine, engineConfidence: d.engineConfidence, diff: diff, changed: merged.changed });
    }
    siteStore.save(host, { search: merged.search, engine: nextEngine }, db);
    return ok({ host: host, search: siteStore.get(host).search, detected: d, ambiguous: summary.ambiguous, unmatched: summary.unmatched, confidence: summary.confidence, engine: nextEngine, engineConfidence: d.engineConfidence, diff: diff, changed: merged.changed });
  });

  /* 预览后确认保存：用预览返回的 detected，不再请求站点 */
  app.post('/api/crawl/preset/:host/apply', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const rec = siteStore.get(host);
    if (!rec) return bad(reply, 'NOT_FOUND', '没有这个站的定义', 404);
    const d = req.body && req.body.detected;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return bad(reply, 'BAD_DETECTED', 'detected 必须是对象');
    if (JSON.stringify(d).length > 1024 * 1024) return bad(reply, 'TOO_LARGE', '识别结果超过 1MB');
    const overridden = mergeWithOverrides(rec.search, d, rec.search && rec.search.detect, { keyOf: presets.keyOf });
    const withOverride = overridden.detected;
    const summary = summarizeDetection(withOverride);
    const merged = overridden.merged;
    const diff = diffCats(rec.search.cats, merged.search.cats);
    const nextEngine = (!rec.engine || rec.engine === '?') && withOverride.engine && withOverride.engine !== 'generic' && Number(withOverride.engineConfidence) >= 0.6 ? withOverride.engine : rec.engine;
    const saved = siteStore.save(host, { search: merged.search, engine: nextEngine }, db);
    if (!saved || !saved.ok) return bad(reply, (saved && saved.code) || 'SAVE_FAILED', (saved && saved.message) || '保存失败', 500);
    return ok({ host: host, search: siteStore.get(host).search, ambiguous: summary.ambiguous, unmatched: summary.unmatched, confidence: summary.confidence, engine: nextEngine, engineConfidence: withOverride.engineConfidence, diff: diff, changed: merged.changed });
  });

  app.put('/api/crawl/preset/:host/override', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const rec = siteStore.get(host);
    if (!rec) return bad(reply, 'NOT_FOUND', '没有这个站的定义', 404);
    const detect = req.body && req.body.detect;
    if (detect !== null && (typeof detect !== 'object' || Array.isArray(detect))) return bad(reply, 'BAD_DETECT', 'detect 必须是对象');
    if (JSON.stringify(detect || {}).length > 64 * 1024) return bad(reply, 'TOO_LARGE', '识别覆盖超过 64KB');
    const saved = siteStore.save(host, { search: Object.assign({}, rec.search, { detect: detect || {} }) }, db);
    if (!saved || !saved.ok) return bad(reply, (saved && saved.code) || 'SAVE_FAILED', (saved && saved.message) || '保存失败', 500);
    return ok({ host: host, detect: siteStore.get(host).search.detect || {} });
  });

  app.put('/api/crawl/filters/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const sel = (req.body && req.body.selected) || {};
    const rec0 = siteStore.get(host);
    let cur = (rec0 && rec0.search.filters) || { values: {}, selected: {} };
    if (!cur.values || !Object.keys(cur.values).length) {
      const d = await detectFilters(host);
      if (d.ok) cur = { values: d.data.values, selected: {}, params: d.data.params || {} };
    }
    const values = cur.values || {};
    const params = cur.params || {};
    const selected = {};
    for (const dim of ['medium', 'codec', 'audio', 'resolution', 'team', 'discount']) {
      const alias = { medium: 'medium', codec: 'codec', audio: 'audio', resolution: 'standard', team: 'team', discount: 'spstate' }[dim];
      const labels = Array.isArray(sel[dim]) ? sel[dim].map(String) : (Array.isArray(sel[alias]) ? sel[alias].map(String) : []);
      labels.forEach(function (x) {
        const key = dim === 'team' ? String(x).trim() : presets.keyOfDim(dim, x);
        if (key) (selected[dim] = selected[dim] || []).push(key);
      });
    }
    if (rec0) siteStore.save(host, { search: Object.assign({}, rec0.search, { filters: { values: values, selected: selected, params: params } }) }, db);
    const out = siteStore.get(host);
    const labels = {};
    Object.keys(selected).forEach(function (d) { labels[d] = presets.labelsOfDim(d, selected[d]); });
    return ok({ host, filters: out.search.filters, selectedLabels: labels });
  });

  app.get('/api/crawl/cats/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const list = catsOf(host);
    const sel = selectedIds(host);
    return ok({ host: host, cats: list.map(function (c) { return Object.assign({}, c, { on: !sel.length || sel.indexOf(c.id) >= 0 }); }), selected: sel });
  });

  app.put('/api/crawl/cats/:host', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(host)) return bad(reply, 'BAD_HOST', '站点名不合法');
    const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map(function (x) { return String(x); });
    const list = catsOf(host);
    if (!list.length) return bad(reply, 'NO_CATS', '这个站还没有分类定义', 400);
    const known = {};
    list.forEach(function (c) { known[c.id] = c; });
    const cats = {};
    ids.filter(function (id) { return known[id]; }).forEach(function (id) {
      const g = known[id].label || known[id].purpose || '其他';
      (cats[g] = cats[g] || []).push(id);
    });
    const rec = siteStore.get(host);
    if (rec) siteStore.save(host, { search: Object.assign({}, rec.search, { cats: cats }) }, db);
    return ok({ host: host, ids: ids.filter(function (id) { return known[id]; }), groups: Object.keys(cats).length });
  });

  /* ---- 抓取计划：只读本地配置，不发请求 ---- */
  app.get('/api/crawl/plan', async (req, reply) => {
    const host = String(req.query.host || '').trim().toLowerCase();
    if (!host) return bad(reply, 'BAD_REQUEST', '缺少 host');
    const def = readDef(host);
    const cfg = cfgRow();
    const preset = presetOf(host);
    const cats = (preset && preset.cats) || {};
    const groups = Object.keys(cats);
    const allIds = [];
    groups.forEach(function (k) { (cats[k] || []).forEach(function (id) { allIds.push(id); }); });
    const ids = allIds.length;
    const warnings = [];
    if (!preset) warnings.push('还没有搜索预设，分类 id 未知');
    if (!def) warnings.push('没有站点定义，拼不出搜索 URL');
    const searchUrls = [];
    if (def && def.base) {
      const recF = siteStore.get(host);
      const flt = (recF && recF.search.filters) || {};
      const vals = flt.values || {};
      const sel = flt.selected || {};
      let u = adapters.buildSearchUrl(def, '{q}', allIds);
      try {
        const uu = new URL(u);
        [['medium', 'medium'], ['resolution', 'standard'], ['discount', 'spstate']].forEach(function (p) {
          (sel[p[0]] || []).forEach(function (k) {
            const v = (vals[p[0]] || {})[k];
            if (v != null && v !== '') uu.searchParams.append(p[1], String(v));
          });
        });
        u = uu.toString();
      } catch (e) { /* 保留原地址 */ }
      searchUrls.push({ cat: '合并', catId: allIds.join('/'), url: u });
    }
    return ok(reply, {
      siteHost: host, runMode: cfg.runMode || configSchema.DEFAULTS.runMode, listInterval: cfg.listInterval || configSchema.DEFAULTS.listInterval, interval: cfg.interval || configSchema.DEFAULTS.interval,
      catGroups: groups.length, catIds: ids, estimatedQueries: allIds.length ? 1 : 0,
      searchUrls: searchUrls, warnings: warnings, engine: preset && preset.engine || ''
    });
  });

  /* ---- 查重：拿词条标题去目标站搜一次 ---- */
  app.post('/api/dupe/check', async (req, reply) => {
    const b = req.body || {};
    const host = String(b.host || '').trim().toLowerCase();
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '目标站域名不合法');
    /* 查重范围已收敛：目标站始终搜索，体积容差固定 2% */
    const tolerance = 2;
    const ck = readCookie(host);
    if (ck.err) return bad(reply, ck.err.code, ck.err.message, 409);
    const def = readDef(host);
    if (!def || !def.base) return bad(reply, 'NO_DEF', '这个站点没有站点定义，拼不出搜索地址');
    const limit = Math.max(1, Math.min(10, Number(b.limit) || 3));
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const rows = all("SELECT id, data FROM catalog WHERE status = 'new' ORDER BY created_at DESC LIMIT 500");
    let pool = rows.map(function (r) { const it = jparse(r.data) || {}; it.id = r.id; return it; })
      .filter(function (x) { return x.dupe !== 'dupe'; });
    if (ids.length) pool = pool.filter(function (x) { return ids.indexOf(x.id) >= 0; });
    const picked = pool.slice(0, limit);
    const gap = Math.max(8, Math.min(Number(cfgRow().interval) || 30, 20)) * 1000;
    const out = [];
    for (let i = 0; i < picked.length; i++) {
      const it = picked[i];
      const kw = keyword(it.title);
      const url = adapters.buildSearchUrl(def, kw, null);
      const rec = { id: it.id, title: it.title, keyword: kw, url: url, status: 'error', rows: 0 };
      try {
        const dnsGate = await urlGuard.assertNoRebind(url);
        if (!dnsGate.ok) throw new Error(dnsGate.err);
        const t0 = Date.now();
        const res = await fetch(url, { headers: { cookie: ck.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        const html = await res.text().catch(function () { return ''; });
        const list = res.status === 200 ? adapters.parseList(html, def.engine || '') : [];
        const srcGB = Number(it.sizeBytes) ? Number(it.sizeBytes) / 1073741824 : 0;
        const verdict = dupeClassify.classify(it.title, srcGB, list, tolerance);
        rec.status = verdict.status;
        rec.rows = list.length;
        rec.ms = Date.now() - t0;
        rec.matched = verdict.row ? String(verdict.row.title || '').slice(0, 160) : '';
        rec.matchedGB = verdict.row && verdict.row.sizeBytes ? Math.round(Number(verdict.row.sizeBytes) / 107374182.4) / 10 : 0;
        const next = Object.assign({}, it, { dupe: verdict.status, dupeUrl: url, dupeAt: now(), dupeTitle: rec.matched, dupeSizeGB: rec.matchedGB, dupeTarget: host });
        db.prepare('UPDATE catalog SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), now(), it.id);
      } catch (e) {
        rec.error = String(e && e.message || e).slice(0, 120);
        const next = Object.assign({}, it, { dupe: 'error', dupeAt: now(), dupeTarget: host });
        db.prepare('UPDATE catalog SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), now(), it.id);
      }
      out.push(rec);
      if (i < picked.length - 1) await new Promise(function (r) { setTimeout(r, gap); });
    }
    const byStatus = out.reduce(function (a, x) { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
    return ok(reply, { host: host, engine: def.engine || '', checked: out.length, results: out, byStatus: byStatus });
  });
};

/* 查重与抓取计划（Fastify v2）。查重会真搜一次目标站，限条数；计划只读本地配置不发请求。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const adapters = require('./adapters');
const limits = require('./limits');
const flowConfig = require('./flow-config');
const dupeClassify = require('./dupe-classify');
const sitePack = require('./site-pack');
const siteMaps = require('./site-maps');

function keyword(title) {
  let s = String(title || '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = s.search(/\b(?:1080p|2160p|1080i|720p|576p|480p|UHD|Blu-?Ray|REMUX|WEB-?DL|WEBRip|HDTV|AVC|HEVC|x264|x265|DTS|TrueHD|LPCM|Atmos)\b/i);
  if (cut > 0) s = s.slice(0, cut).trim();
  return s.split(/\s+/).slice(0, 8).join(' ');
}

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const now = () => new Date().toISOString();
  const readDef = (host) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-defs', host + '.json'), 'utf8')); } catch (e) { return null; } };
  const readPresets = () => { try { const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-search.local.json'), 'utf8')) || {}; return raw.sites || raw; } catch (e) { return {}; } };
  const readCookie = (host) => {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', host);
    if (!r || !r.cookie) return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie，查不了' } };
    try { return { cookie: secretbox.decrypt(r.cookie, KEYRING.key) }; } catch (e) { return { err: { code: 'NO_COOKIE', message: 'cookie 解不开，请重新导入' } }; }
  };
  const cfgRow = () => { const r = one("SELECT v FROM meta WHERE k = 'config'"); return JSON.parse(r ? r.v : 'null') || {}; };

  function catsOf(host) {
    const def0 = readDef(host) || {};
    const built = sitePack.siteOf(host) || {};
    const def = Object.assign({}, built, def0);
    let list = [];
    if (Array.isArray(def.catList)) list = def.catList;
    else if (Array.isArray(def.catMap)) list = def.catMap.map(function (x) { return { id: x.id, label: x.label || x.purpose || '', purpose: x.purpose }; });
    else if (def.catMap && typeof def.catMap === 'object') {
      list = Object.keys(def.catMap).map(function (k) { return { id: def.catMap[k], label: k, purpose: k }; });
    }
    const maps = siteMaps.getHost(DATA_DIR, host);
    Object.keys(maps.cat || {}).forEach(function (k) { list.push({ id: maps.cat[k], label: k, purpose: k }); });
    const seen = {};
    return list.filter(function (x) { return x && x.id != null; })
      .map(function (x) { return { id: String(x.id), label: String(x.label || x.purpose || x.id), purpose: String(x.purpose || '') }; })
      .filter(function (x) { if (seen[x.id]) return false; seen[x.id] = true; return true; });
  }
  function presetOf(host) { return readPresets()[host] || null; }
  function selectedIds(host) {
    const p = presetOf(host);
    const cats = (p && p.cats) || {};
    const out = [];
    Object.keys(cats).forEach(function (k) { (cats[k] || []).forEach(function (id) { out.push(String(id)); }); });
    return out;
  }

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
    const file = path.join(DATA_DIR, 'site-search.local.json');
    let raw = {};
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { raw = {}; }
    const sites = raw.sites && typeof raw.sites === 'object' ? raw.sites : raw;
    sites[host] = Object.assign({}, sites[host] || {}, { cats: cats, updatedAt: now() });
    const out = raw.sites ? raw : { sites: sites };
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', { mode: 0o600 });
    return ok({ host: host, ids: ids.filter(function (id) { return known[id]; }), groups: Object.keys(cats).length });
  });

  /* ---- 抓取计划：只读本地配置，不发请求 ---- */
  app.get('/api/crawl/plan', async (req, reply) => {
    const host = String(req.query.host || '').trim().toLowerCase();
    if (!host) return bad(reply, 'BAD_REQUEST', '缺少 host');
    const def = readDef(host);
    const cfg = cfgRow();
    const preset = readPresets()[host] || null;
    const cats = (preset && preset.cats) || {};
    const groups = Object.keys(cats);
    let ids = 0;
    groups.forEach(function (k) { ids += (cats[k] || []).length; });
    const warnings = [];
    if (!preset) warnings.push('还没有搜索预设，分类 id 未知');
    if (!def) warnings.push('没有站点定义，拼不出搜索 URL');
    const searchUrls = [];
    if (def && def.base) {
      groups.forEach(function (k) {
        (cats[k] || []).forEach(function (id) {
          if (searchUrls.length >= 10) return;
          searchUrls.push({ cat: k, catId: id, url: adapters.buildSearchUrl(def, '{q}', [id]) });
        });
      });
    }
    return ok(reply, {
      siteHost: host, runMode: cfg.runMode || 'test', interval: cfg.interval || 60,
      dailyMax: limits.dailyMax(),
      catGroups: groups.length, catIds: ids, estimatedQueries: (ids || groups.length) * 1,
      searchUrls: searchUrls, warnings: warnings, engine: preset && preset.engine || ''
    });
  });

  /* ---- 查重：拿词条标题去目标站搜一次 ---- */
  app.post('/api/dupe/check', async (req, reply) => {
    const b = req.body || {};
    const host = String(b.host || '').trim().toLowerCase();
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '目标站域名不合法');
    const flow = flowConfig.read(ctx);
    if (!flowConfig.on(flow, '目标站搜索', true)) {
      return bad(reply, 'DUPE_DISABLED', '目标站搜索已在流程页关闭；打开后再试', 409);
    }
    const tolerance = flowConfig.number(flow, '体积容差', 0);
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

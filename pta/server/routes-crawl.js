/* 查重与抓取计划（Fastify v2）。查重会真搜一次目标站，限条数；计划只读本地配置不发请求。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const adapters = require('./adapters');
const limits = require('./limits');

const DISC_RE = /(?:UHD|Blu-?Ray|BluRay|BDMV|Full\s*Disc|原盘|ISO\b)/i;
const SKIP_RE = /(?:Remux|Encode|WEB-?DL|WEBRip|HDTV|DVDRip|x264|x265|H\.?264|H\.?265|AVC|HEVC)/i;
const DIY_RE = /\bDIY\b/i;
const UHD_RE = /(?:2160p|\b4K\b|\bUHD\b)/i;

function keyword(title) {
  let s = String(title || '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = s.search(/\b(?:1080p|2160p|1080i|720p|576p|480p|UHD|Blu-?Ray|REMUX|WEB-?DL|WEBRip|HDTV|AVC|HEVC|x264|x265|DTS|TrueHD|LPCM|Atmos)\b/i);
  if (cut > 0) s = s.slice(0, cut).trim();
  return s.split(/\s+/).slice(0, 8).join(' ');
}
function classify(srcTitle, srcGB, rows) {
  const src4k = UHD_RE.test(srcTitle);
  let diy = null;
  for (const r of rows || []) {
    const t = String(r.title || '');
    if (!t || !DISC_RE.test(t) || SKIP_RE.test(t)) continue;
    if (UHD_RE.test(t) !== src4k) continue;
    const gb = Number(r.sizeBytes) ? Number(r.sizeBytes) / 1073741824 : 0;
    const sizeOk = !(srcGB > 0 && gb > 0) || Math.abs(gb - srcGB) <= 2.5 || Math.abs(gb - srcGB) / srcGB <= 0.05;
    if (!sizeOk) continue;
    if (DIY_RE.test(t)) { if (!diy) diy = r; continue; }
    return { status: 'dupe', row: r };
  }
  if (diy) return { status: 'diy', row: diy };
  return { status: 'clean', row: null };
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
        const verdict = classify(it.title, srcGB, list);
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

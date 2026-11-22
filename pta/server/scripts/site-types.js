#!/usr/bin/env node
/* 站点类型补全：先从本地分类绑定离线补，再用已存 cookie 逐站探测分类页回填。
   站点只存 key（movie/tv/...）和分类 ID；中文名来自全局预设。
   默认只预览，--write 才写 data/sites.json。
   探测规则：单站 1 个请求、串行、间隔 ≥10 秒、失败即停；不打印站名/网址/cookie。
   用法：
     node pta/scripts/site-types.js --data /opt/seedpod/data --from-categories --dry
     node pta/scripts/site-types.js --data /opt/seedpod/data --probe --dry
     node pta/scripts/site-types.js --data /opt/seedpod/data --probe --write
*/
const path = require('path');
const jsonFile = require('../src/infra/json-file');
const makeSiteStore = require('../src/features/sites/store');
const makeCookieStore = require('../src/features/sites/credentials');
const makePresets = require('../src/features/presets/store');
const form = require('../form');
const urlGuard = require('../url-guard');
const { typeOf } = require('../category-policy');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
const PREVIEW = path.resolve(arg('--preview', path.join(DATA, 'site-types.preview.json')));
const DELAY = Math.max(10000, Number(arg('--delay', 10000)) || 10000);
const LIMIT = Math.max(1, Math.min(500, Number(arg('--limit', 500)) || 500));
const WRITE = argv.includes('--write');
const PROBE = argv.includes('--probe');
const FROM_CATS = argv.includes('--from-categories');
const FORCE = argv.includes('--force');
const ALL_TYPES = argv.includes('--all-types');
const HOST = String(arg('--host', '') || '').toLowerCase();
const TIMEOUT = Math.max(5000, Math.min(30000, Number(arg('--timeout', 20000)) || 20000));

const store = makeSiteStore(DATA);
const cookieStore = makeCookieStore(DATA);
const presets = makePresets(DATA);

function norm(host) { return String(host || '').trim().toLowerCase(); }
function uniq(list) { return list.filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }
function typesOfLabels(labels) {
  return uniq(labels.map(function (x) { return typeOf(x); }).filter(Boolean));
}
const PRIMARY = ['电影', '剧集', '动漫', '纪录片', '综艺', '音乐', '体育', '游戏', '电子书', '软件', '成人', '其他'];
function pickPrimary(types) { return PRIMARY.filter(function (t) { return types.indexOf(t) >= 0; }).slice(0, 1); }
function propose(types) { return ALL_TYPES ? types.slice(0, 12) : pickPrimary(types); }
function keyOfLabel(label) {
  const t = typeOf(label);
  return presets.keyOf(t) || presets.keyOf(label) || '';
}
/* 本地已有 cats：key 能认出来就保留，认不出就按中文分类名归一到 key */
function bindOfCats(cats) {
  const out = {};
  Object.keys(cats || {}).forEach(function (k) {
    const key = presets.keyOf(k) || keyOfLabel(presets.labelOf(k));
    if (!key) return;
    (cats[k] || []).forEach(function (id) { if (id == null || id === '') return; const v = String(id); (out[key] = out[key] || []); if (out[key].indexOf(v) < 0) out[key].push(v); });
  });
  return out;
}
function collectFromCategories() {
  const records = store.list().filter(function (s) { return !HOST || s.host === HOST; }).map(function (s) {
    const labels = Object.keys(s.search.cats || {}).map(function (k) { return presets.labelOf(k); }).filter(Boolean);
    const proposed = propose(typesOfLabels(labels));
    const bind = bindOfCats(s.search.cats);
    return { host: s.host, mode: 'categories', labels: labels.length, proposedTypes: proposed, bind: bind,
      status: proposed.length ? 'ok' : (labels.length ? 'no_type' : 'no_categories') };
  });
  return { records: records };
}
function pagePath(def) {
  const up = def && def.upload;
  return String((up && (up.formPath || up.path)) || (def && def.searchPath) || '/torrents.php');
}
function parseCategories(html) {
  const fields = [];
  form.parse(html).forEach(function (f) { (f.fields || []).forEach(function (x) { fields.push(x); }); });
  const out = [];
  fields.forEach(function (f) {
    if (!/type|cat|分类|类型/i.test(String(f.name || '') + ' ' + String(f.label || ''))) return;
    const opts = (f.options || []).map(function (o) {
      return { id: String(o.value == null ? '' : o.value).trim(), label: String(o.label || '').trim() };
    }).filter(function (o) { return o.id && o.id !== '0' && o.label && !/请选择|全部|不限|choose|select|all/i.test(o.label); });
    if (opts.length) out.push({ field: f.name, label: f.label || f.name, options: opts });
  });
  return out;
}
function bindOfCategories(cats) {
  const out = {};
  cats.forEach(function (f) {
    f.options.forEach(function (o) {
      const key = keyOfLabel(o.label);
      if (!key) return;
      (out[key] = out[key] || []);
      if (out[key].indexOf(o.id) < 0) out[key].push(o.id);
    });
  });
  return out;
}
async function probeOne(db, keyring, host) {
  const h = norm(host);
  const rec = store.get(h);
  if (!rec) return { host: h, status: 'NO_DEF', requests: 0 };
  if (rec.settings.hidden === true) return { host: h, status: 'hidden', requests: 0 };
  const c = cookieStore.get(h);
  if (c.err) return { host: h, status: c.err, requests: 0 };
  const def = store.legacyDef(h);
  if (!def || !def.base) return { host: h, status: 'NO_DEF', requests: 0 };
  let url;
  try { url = new URL(pagePath(def), String(def.base).replace(/\/+$/, '') + '/').toString(); }
  catch (e) { return { host: h, status: 'BAD_BASE', requests: 0 }; }
  const gate = await urlGuard.assertNoRebind(url);
  if (!gate.ok) return { host: h, status: 'DNS_BLOCKED', requests: 0 };
  let res;
  try {
    res = await fetch(url, {
      headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT)
    });
  } catch (e) { return { host: h, status: 'FETCH_FAILED', requests: 1 }; }
  const requests = 1;
  if (res.status === 429 || res.status === 403 || res.status === 503) return { host: h, status: 'RATE_LIMITED', http: res.status, requests: requests };
  if (res.status >= 300 && res.status < 400) return { host: h, status: 'REDIRECT', http: res.status, requests: requests };
  if (res.status !== 200) return { host: h, status: 'HTTP_' + res.status, requests: requests };
  const html = await res.text().catch(function () { return ''; });
  if (/takelogin\.php|login\.php|请先登录|not\s+authorized/i.test(html)) return { host: h, status: 'LOGIN_REQUIRED', requests: requests };
  const cats = parseCategories(html);
  const labels = [];
  cats.forEach(function (f) { f.options.forEach(function (o) { labels.push(o.label); }); });
  const proposed = propose(typesOfLabels(labels));
  return { host: h, status: proposed.length ? 'ok' : (cats.length ? 'no_type' : 'NO_CATEGORIES'),
    page: 'form', categories: cats.length, proposedTypes: proposed, bind: bindOfCategories(cats), requests: requests };
}
async function runProbe() {
  const rows = store.list()
    .filter(function (s) { return s.settings.enabled !== false && s.settings.hidden !== true; })
    .filter(function (s) { return !HOST || s.host === HOST; })
    .slice(0, LIMIT);
  const out = [];
  let stopped = '';
  for (const x of rows) {
    if (out.length) await new Promise(function (r) { setTimeout(r, DELAY); });
    const rec = await probeOne(null, null, x.host);
    out.push(rec);
    if (rec.status === 'RATE_LIMITED' || rec.status === 'LOGIN_REQUIRED') { stopped = rec.status; break; }
  }
  return { records: out, stopped: stopped, requests: out.reduce(function (a, x) { return a + (x.requests || 0); }, 0) };
}
function applyTypes(records) {
  let changed = 0, skipped = 0;
  records.forEach(function (r) {
    if (!r || !r.host || r.status !== 'ok') return;
    const rec = store.get(r.host);
    if (!rec) return;
    const existing = rec.search.cats || {};
    const bind = r.bind && Object.keys(r.bind).length ? r.bind : null;
    if (!bind && !Object.keys(existing).length) { skipped++; return; }
    if (Object.keys(existing).length && !FORCE && !bind) { skipped++; return; }
    const next = bind ? store.canonCats(bind) : store.canonCats(existing);
    if (!Object.keys(next).length) { skipped++; return; }
    if (JSON.stringify(next) === JSON.stringify(existing)) return;
    store.save(r.host, { search: Object.assign({}, rec.search, { cats: next }) }, null);
    changed++;
  });
  return { changed: changed, skipped: skipped };
}
async function main() {
  if (!PROBE && !FROM_CATS) {
    console.log('需要 --from-categories 或 --probe；加 --dry 预览，--write 落库');
    process.exit(2);
  }
  let records = [];
  let stopped = '';
  let requests = 0;
  if (FROM_CATS) records = collectFromCategories().records;
  if (PROBE) {
    const p = await runProbe();
    records = p.records;
    stopped = p.stopped;
    requests = p.requests;
  }
  const summary = {
    mode: [FROM_CATS ? 'from-categories' : '', PROBE ? 'probe' : ''].filter(Boolean).join('+'),
    sites: records.length,
    ok: records.filter(function (r) { return r.status === 'ok'; }).length,
    noType: records.filter(function (r) { return r.status === 'no_type' || r.status === 'NO_CATEGORIES' || r.status === 'no_categories'; }).length,
    noCookie: records.filter(function (r) { return r.status === 'NO_COOKIE' || r.status === 'COOKIE_UNREADABLE'; }).length,
    failed: records.filter(function (r) { return !['ok', 'no_type', 'NO_CATEGORIES', 'no_categories', 'NO_COOKIE', 'COOKIE_UNREADABLE'].includes(r.status); }).length,
    requests: requests,
    stopped: stopped,
    applied: 0,
    preview: PREVIEW
  };
  if (WRITE) {
    const a = applyTypes(records);
    summary.applied = a.changed;
    summary.skipped = a.skipped;
  }
  jsonFile.writeAtomic(PREVIEW, records, 0o600);
  console.log(JSON.stringify(summary, null, 2));
}
module.exports = { collectFromCategories, parseCategories, typesOfLabels, probeOne, runProbe, applyTypes, pagePath, bindOfCats };
if (require.main === module) main().catch(function (e) { console.error('site-types failed:', e && e.message || e); process.exit(1); });

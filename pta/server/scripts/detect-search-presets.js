#!/usr/bin/env node
/* 批量识别搜索预设：每站 1 次 GET 搜索页，串行、间隔默认 10 秒，失败即停。
   默认干跑：只写报告，不改 sites.json；--write 才把高置信度结果写回。
   不打印站名/网址/cookie；报告文件 0600，里面才有 host。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('../src/infra/json-file');
const urlGuard = require('../src/infra/url-guard');
const makeSiteStore = require('../src/features/sites/store');
const makeCookieStore = require('../src/features/sites/credentials');
const makePresets = require('../src/features/presets/store');
const { parseSearchPreset } = require('../src/features/sites/search-preset');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
function has(name) { return argv.indexOf(name) >= 0; }
function clone(x) { return JSON.parse(JSON.stringify(x || {})); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }

function summarizeDetection(d) {
  const types = Object.keys((d && d.cats) || {});
  const idTypes = {};
  types.forEach(function (t) { ((d.cats[t]) || []).forEach(function (id) { const v = String(id); (idTypes[v] = idTypes[v] || []).push(t); }); });
  const ambiguous = Object.keys(idTypes).filter(function (id) { return idTypes[id].length > 1; });
  const dims = {};
  ['values', 'params', 'labels'].forEach(function (sec) {
    dims[sec] = Object.keys((d && d[sec]) || {});
  });
  const hasDims = Object.keys(dims.values).length > 0;
  const confidence = types.length && d && d.catMode ? 'high' : (types.length ? 'medium' : 'low');
  return {
    types: types,
    typeCount: types.reduce(function (n, k) { return n + ((d.cats[k] || []).length); }, 0),
    ambiguous: ambiguous,
    dims: dims,
    hasDims: hasDims,
    confidence: confidence
  };
}

/* 把识别结果并进当前站点定义；默认只补缺失，不覆盖手工值；--force 才替换分类和维度值。
   selected 永远保留，识别不替用户勾选。 */
function mergeDetection(current, detected, opts) {
  const force = !!(opts && opts.force);
  const cur = current || {};
  const d = detected || {};
  const cats = (force && Object.keys(d.cats || {}).length) ? {} : clone(cur.cats || {});
  /* 同一个站点 ID 被识别成多个大分类时，宁可先不写，避免把电影塞进有声书 */
  const idTypes = {};
  Object.keys(d.cats || {}).forEach(function (t) { (d.cats[t] || []).forEach(function (id) { const v = String(id); (idTypes[v] = idTypes[v] || []).push(t); }); });
  const existingTypes = {};
  Object.keys(cur.cats || {}).forEach(function (t) { (cur.cats[t] || []).forEach(function (id) { const v = String(id); (existingTypes[v] = existingTypes[v] || []).push(t); }); });
  Object.keys(d.cats || {}).forEach(function (k) {
    (d.cats[k] || []).forEach(function (id) {
      const v = String(id);
      if ((idTypes[v] || []).length > 1) return;
      if (existingTypes[v] && existingTypes[v].indexOf(k) < 0) return;
      const list = cats[k] || (cats[k] = []);
      if (list.indexOf(v) < 0) list.push(v);
    });
  });
  const filters = clone(cur.filters || {});
  ['values', 'params', 'labels'].forEach(function (sec) {
    filters[sec] = clone(filters[sec] || {});
    Object.keys(d[sec] || {}).forEach(function (dim) {
      filters[sec][dim] = force ? {} : (filters[sec][dim] || {});
      Object.keys(d[sec][dim] || {}).forEach(function (k) {
        filters[sec][dim][k] = String(d[sec][dim][k]);
      });
    });
  });
  filters.selected = clone((cur.filters && cur.filters.selected) || {});
  let catMode = cur.catMode || 'single';
  if (d.catMode && (force || !cur.catMode || cur.catMode === 'single')) catMode = d.catMode;
  const next = Object.assign({}, cur, { cats: cats, catMode: catMode, filters: filters });
  const changed = JSON.stringify({ cats: cur.cats || {}, catMode: cur.catMode || '', filters: cur.filters || {} })
    !== JSON.stringify({ cats: cats, catMode: catMode, filters: filters });
  return { search: next, changed: changed };
}

function eligibleHosts(store, cookies) {
  const withCookie = {};
  cookies.list().forEach(function (c) { if (c.readable) withCookie[c.host] = true; });
  return store.list()
    .filter(function (s) { return withCookie[s.host] && s.url && s.url.base; })
    .sort(function (a, b) {
      const ac = Object.keys(a.search.cats || {}).length;
      const bc = Object.keys(b.search.cats || {}).length;
      if (ac !== bc) return ac - bc;
      return a.host.localeCompare(b.host);
    })
    .map(function (s) { return s.host; });
}

function pageUrl(def) {
  const base = String(def.base || '').replace(/\/+$/, '');
  const p = String(def.searchPath || '/torrents.php');
  try { return new URL(p, base + '/').toString(); } catch (e) { return ''; }
}

async function fetchHtml(url, cookie) {
  const gate = await urlGuard.assertNoRebind(url);
  if (!gate.ok) return { error: gate.err, status: 0 };
  const res = await fetch(url, {
    headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  });
  const html = await res.text().catch(function () { return ''; });
  return { status: res.status, html: html, url: url };
}

async function runBatch(opts) {
  const o = opts || {};
  const store = o.store;
  const cookieStore = o.cookieStore;
  const presets = o.presets || makePresets(o.dataDir);
  const limit = Math.max(0, Number(o.limit) || 0);
  const delay = Math.max(0, Number(o.delay) || 0);
  const dry = o.dry !== false;
  const force = !!o.force;
  const fetchHtmlFn = o.fetchHtml || fetchHtml;
  let pool = o.hosts;
  if (!pool) pool = eligibleHosts(store, cookieStore);
  const skip = Array.isArray(o.skip) ? o.skip : [];
  if (skip.length) pool = pool.filter(function (h) { return skip.indexOf(h) < 0; });
  if (limit) pool = pool.slice(0, limit);

  const results = [];
  let stopped = '';
  let requests = 0;
  for (let i = 0; i < pool.length; i++) {
    const host = pool[i];
    const rec = store.get(host);
    const def = store.legacyDef(host);
    const row = { host: host, status: 'SKIP', requests: 0, confidence: 'low', types: [], typeCount: 0 };
    if (!def || !def.base) { row.status = 'NO_BASE'; results.push(row); continue; }
    const c = cookieStore.get(host);
    if (c.err) { row.status = c.err; results.push(row); continue; }
    const url = pageUrl(def);
    if (!url) { row.status = 'BAD_URL'; results.push(row); continue; }
    if (i > 0) await sleep(delay);
    requests++;
    row.requests = 1;
    let got;
    try { got = await fetchHtmlFn(url, c.cookie); }
    catch (e) { row.status = 'FETCH_FAILED'; row.error = String(e && e.message || e).slice(0, 120); results.push(row); continue; }
    row.http = got.status || 0;
    if (got.error) { row.status = 'DNS_BLOCKED'; row.error = got.error; results.push(row); continue; }
    const html = String(got.html || '');
    const loggedOut = got.status === 302 || /takelogin\.php|login\.php|请先登录/i.test(html);
    if (loggedOut) { row.status = 'LOGIN_REQUIRED'; results.push(row); stopped = 'LOGIN_REQUIRED'; break; }
    if (got.status === 429 || got.status === 403 || got.status === 503) {
      row.status = 'RATE_LIMITED'; results.push(row); stopped = 'RATE_LIMITED'; break;
    }
    if (got.status !== 200) { row.status = 'HTTP_' + got.status; results.push(row); continue; }
    let detected;
    try { detected = parseSearchPreset(html, presets); }
    catch (e) { row.status = 'PARSE_FAILED'; row.error = String(e && e.message || e).slice(0, 120); results.push(row); continue; }
    const sum = summarizeDetection(detected);
    row.status = 'OK';
    row.confidence = sum.confidence;
    row.types = sum.types;
    row.typeCount = sum.typeCount;
    row.ambiguous = sum.ambiguous;
    row.dims = sum.dims;
    row.detected = { cats: detected.cats, catLabels: detected.catLabels || {}, catMode: detected.catMode, values: detected.values, params: detected.params };
    if (o.write) {
      const merged = mergeDetection(rec.search, detected, { force: force });
      row.changed = merged.changed;
      if (merged.changed && sum.confidence === 'high') {
        const saved = store.save(host, { search: merged.search }, null);
        row.written = !!(saved && saved.ok);
        if (!saved || !saved.ok) row.writeError = (saved && saved.code) || 'WRITE_FAILED';
      }
    }
    results.push(row);
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: dry ? 'dry' : 'write',
    delayMs: delay,
    limit: limit,
    eligible: pool.length,
    requests: requests,
    stopped: stopped,
    sites: results.length,
    ok: results.filter(function (r) { return r.status === 'OK'; }).length,
    high: results.filter(function (r) { return r.confidence === 'high'; }).length,
    medium: results.filter(function (r) { return r.confidence === 'medium'; }).length,
    low: results.filter(function (r) { return r.confidence === 'low'; }).length,
    written: results.filter(function (r) { return r.written; }).length
  };
  return { summary: summary, sites: results };
}

async function main() {
  const DATA = path.resolve(arg('--data', require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
  const LIMIT = Math.max(0, Number(arg('--limit', '5')) || 0);
  const DELAY = Math.max(10000, Number(arg('--delay', '10000')) || 10000);
  const DRY = !has('--write');
  const FORCE = has('--force');
  const RUN = has('--run');
  const FIXTURE = String(arg('--fixture', '') || '');
  const REPORT = path.resolve(arg('--report', path.join(DATA, 'search-preset-report.json')));
  const ONLY = String(arg('--host', '') || '').toLowerCase();
  const MANY = String(arg('--hosts', '') || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  const SKIP = String(arg('--skip-hosts', '') || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  const store = makeSiteStore(DATA);
  store.ensureRuntime();
  const cookieStore = makeCookieStore(DATA);
  const presets = makePresets(DATA);

  if (FIXTURE) {
    const html = fs.readFileSync(path.resolve(FIXTURE), 'utf8');
    const detected = parseSearchPreset(html, presets);
    const sum = summarizeDetection(detected);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'fixture',
      summary: { sites: 1, ok: 1, high: sum.confidence === 'high' ? 1 : 0, requests: 0 },
      sites: [{ host: 'fixture.example', status: 'OK', requests: 0, confidence: sum.confidence, types: sum.types, typeCount: sum.typeCount, dims: sum.dims }]
    };
    jsonFile.writeAtomic(REPORT, report, 0o600);
    console.log(JSON.stringify(report.summary, null, 2));
    return;
  }

  let hosts = MANY.length ? MANY : (ONLY ? [ONLY] : null);
  if (!RUN) {
    let pool = hosts || eligibleHosts(store, cookieStore);
    if (SKIP.length) pool = pool.filter(function (h) { return SKIP.indexOf(h) < 0; });
    if (LIMIT) pool = pool.slice(0, LIMIT);
    console.log(JSON.stringify({ mode: 'count', eligible: pool.length, cookies: cookieStore.list().filter(function (c) { return c.readable; }).length }, null, 2));
    return;
  }
  const out = await runBatch({
    dataDir: DATA, store: store, cookieStore: cookieStore, presets: presets,
    hosts: hosts, skip: SKIP, limit: LIMIT, delay: DELAY, dry: DRY, force: FORCE, write: !DRY
  });
  jsonFile.writeAtomic(REPORT, { generatedAt: out.summary.generatedAt, mode: out.summary.mode, summary: out.summary, sites: out.sites }, 0o600);
  console.log(JSON.stringify(out.summary, null, 2));
  if (out.summary.stopped) process.exitCode = 2;
}

module.exports = { summarizeDetection, mergeDetection, eligibleHosts, pageUrl, runBatch };
if (require.main === module) main().catch(function (e) { console.error('detect-search-presets failed:', e && e.message || e); process.exit(1); });

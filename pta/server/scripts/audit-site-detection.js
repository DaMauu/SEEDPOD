#!/usr/bin/env node
/* 全站识别体检：每站最多 GET 搜索页 1 次 + 上传页 1 次；只读，不写站点配置。
   结果放本地目录（默认 data/site-audit），原始 HTML 只给人工复核，不入库。 */
const fs = require('fs');
const path = require('path');
const makeSiteStore = require('../src/features/sites/store');
const makeCredentials = require('../src/features/sites/credentials');
const makePresets = require('../src/features/presets/store');
const { parseSearchPreset } = require('../src/features/sites/search-preset');
const form = require('../src/infra/form');
const urlGuard = require('../src/infra/url-guard');
const maps = require('../src/http/routes-maps');
const { ENGINES } = require('../src/features/publish/target');

const DEFAULT_DATA = path.resolve(__dirname, '..', '..', '..', 'data');
const MAX_HTML = 3 * 1024 * 1024;

function parseArgs(argv) {
  const out = { data: process.env.PTA_DATA || DEFAULT_DATA, out: '', limit: 5, offset: 0, delay: 10000, raw: true, resume: false, includeNoCookie: false, hosts: [], stopAfterRate: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data') out.data = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--limit') out.limit = Math.max(1, Number(argv[++i]) || 1);
    else if (a === '--offset') out.offset = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--delay') out.delay = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--host') out.hosts = String(argv[++i] || '').split(',').map(function (x) { return x.trim().toLowerCase() }).filter(Boolean);
    else if (a === '--no-raw') out.raw = false;
    else if (a === '--resume') out.resume = true;
    else if (a === '--include-no-cookie') out.includeNoCookie = true;
    else if (a === '--stop-after-rate') out.stopAfterRate = Math.max(1, Number(argv[++i]) || 2);
    else if (a === '--help' || a === '-h') { console.log('用法：node pta/server/scripts/audit-site-detection.js --limit 5 --delay 10000 [--out DIR] [--resume]'); process.exit(0); }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DATA = path.resolve(args.data);
const OUT = path.resolve(args.out || path.join(DATA, 'site-audit'));
const RAW = path.join(OUT, 'raw');
const SITES = path.join(OUT, 'sites');
fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
fs.mkdirSync(SITES, { recursive: true, mode: 0o700 });
if (args.raw) fs.mkdirSync(RAW, { recursive: true, mode: 0o700 });

const siteStore = makeSiteStore(DATA);
const credentials = makeCredentials(DATA);
const presets = makePresets(DATA);
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function safeHost(h) { return String(h || '').replace(/[^a-z0-9.-]+/gi, '_'); }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 1), { mode: 0o600 }); }
function issue(code, note) { return { code: code, note: String(note || '') }; }
function uniq(list) { return Array.from(new Set(list.filter(Boolean))); }
function valsOf(map) { return Object.keys(map || {}).map(function (k) { return String(map[k]); }).filter(Boolean); }
function duplicateIds(map) {
  const vals = valsOf(map);
  const counts = {};
  vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
  return Object.keys(counts).filter(function (v) { return counts[v] > 1; });
}
function sameMap(a, b) {
  const ka = Object.keys(a || {}).sort();
  const kb = Object.keys(b || {}).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i] || String(a[ka[i]]) !== String(b[kb[i]])) return false;
  return true;
}
function keyedCat(cat) {
  const out = {};
  Object.keys(cat || {}).forEach(function (k) {
    const key = presets.keyOf(k) || String(k);
    if (out[key] === undefined) out[key] = String(cat[k]);
  });
  return out;
}
function catFieldsOf(fields) {
  const picked = maps._test.pickCatFields(fields);
  const options = [];
  picked.forEach(function (f) {
    (f.options || []).forEach(function (o) {
      const value = String(o.value == null ? '' : o.value);
      const label = String(o.label == null ? value : o.label);
      if (!options.some(function (x) { return x.value === value && x.label === label; })) options.push({ value: value, label: label });
    });
  });
  return {
    fields: picked.map(function (f) { return { name: String(f.name || ''), type: String(f.type || ''), label: String(f.label || ''), options: (f.options || []).length }; }),
    options: options
  };
}
function summarizeSearch(parsed) {
  const cats = parsed.cats || {};
  const types = Object.keys(cats);
  const ids = [];
  Object.keys(cats).forEach(function (k) { (cats[k] || []).forEach(function (id) { ids.push(String(id)); }); });
  return {
    types: types,
    typeCount: types.length,
    idCount: ids.length,
    catLabels: Object.keys(parsed.catLabels || {}).length,
    ambiguous: [],
    unmatched: parsed.unmatched || [],
    catMode: parsed.catMode || '',
    dims: Object.keys(parsed.values || {})
  };
}
async function fetchPage(url, cookie) {
  const t0 = Date.now();
  let res;
  try {
    const gate = await urlGuard.assertNoRebind(url);
    if (!gate.ok) return { ok: false, code: 'DNS_BLOCKED', message: gate.err, ms: Date.now() - t0 };
    res = await fetch(url, {
      headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    return { ok: false, code: e && e.name === 'TimeoutError' ? 'TIMEOUT' : 'FETCH_FAILED', message: String(e && e.message || e).slice(0, 120), ms: Date.now() - t0 };
  }
  const ms = Date.now() - t0;
  if (res.status === 429 || res.status === 403 || res.status === 503) return { ok: false, code: 'HTTP_' + res.status, status: res.status, stop: true, ms: ms };
  if (res.status >= 300 && res.status < 400) return { ok: false, code: 'LOGIN_REQUIRED', status: res.status, ms: ms };
  if (res.status !== 200) return { ok: false, code: 'HTTP_' + res.status, status: res.status, ms: ms };
  let html = '';
  try { html = await res.text(); } catch (e) { return { ok: false, code: 'READ_FAILED', message: String(e && e.message || e).slice(0, 120), ms: ms }; }
  if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML);
  return { ok: true, status: res.status, html: html, bytes: html.length, ms: ms };
}
async function auditSearch(host, rec, cookie) {
  const base = String(rec.url && rec.url.base || '').replace(/\/+$/, '');
  if (!base) return { ok: false, code: 'NO_BASE', requests: 0 };
  if (!urlGuard.baseOk(host, base)) return { ok: false, code: 'BAD_BASE', requests: 0 };
  const p = String(rec.search && rec.search.path || '/torrents.php');
  const r = await fetchPage(base + p, cookie);
  const out = { path: p, status: r.status || 0, ms: r.ms || 0, bytes: r.bytes || 0, requests: 1 };
  if (!r.ok) return Object.assign(out, { ok: false, code: r.code, message: r.message || '', stop: !!r.stop });
  if (args.raw) {
    const dir = path.join(RAW, safeHost(host));
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'search.html'), r.html, { mode: 0o600 });
  }
  try {
    const parsed = parseSearchPreset(r.html, presets);
    out.ok = true;
    out.parsed = summarizeSearch(parsed);
    out.cats = parsed.cats || {};
    out.unmatched = parsed.unmatched || [];
    out.catLabels = parsed.catLabels || {};
    out.catMode = parsed.catMode || '';
    out.values = parsed.values || {};
    return out;
  } catch (e) {
    return Object.assign(out, { ok: false, code: 'PARSE_FAILED', message: String(e && e.message || e).slice(0, 120) });
  }
}
async function auditUpload(host, rec, cookie) {
  const base = String(rec.url && rec.url.base || '').replace(/\/+$/, '');
  if (!base) return { ok: false, code: 'NO_BASE', requests: 0 };
  const engine = String(rec.engine || '').toLowerCase();
  const def = ENGINES[engine] || {};
  const p = String(rec.publish && rec.publish.upload && (rec.publish.upload.formPath || rec.publish.upload.path) || def.formPath || '/upload.php');
  const r = await fetchPage(base + p, cookie);
  const out = { path: p, status: r.status || 0, ms: r.ms || 0, bytes: r.bytes || 0, requests: 1 };
  if (!r.ok) return Object.assign(out, { ok: false, code: r.code, message: r.message || '', stop: !!r.stop });
  if (args.raw) {
    const dir = path.join(RAW, safeHost(host));
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'upload.html'), r.html, { mode: 0o600 });
  }
  let forms = [];
  try { forms = form.parse(r.html); } catch (e) { return Object.assign(out, { ok: false, code: 'PARSE_FAILED', message: String(e && e.message || e).slice(0, 120) }); }
  if (!forms.length) return Object.assign(out, { ok: false, code: 'NO_FORM', message: '上传页没有表单（权限或未开放）' });
  const withFile = forms.filter(function (x) { return !!x.fileField; });
  const f = withFile.sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; })[0]
    || forms.slice().sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; })[0];
  const cat = catFieldsOf(f.fields || []);
  const aliases = (rec.publish && rec.publish.detect && rec.publish.detect.labels) || {};
  const matched = maps._test.matchCatsDetailed(cat.options, aliases);
  const matchedKeyed = keyedCat(matched.cat);
  const saved = (rec.publish && rec.publish.catMap) || {};
  out.ok = true;
  out.formPath = p;
  out.formCount = forms.length;
  out.fileField = String(f.fileField || '');
  out.fieldCount = (f.fields || []).length;
  out.catFields = cat.fields;
  out.catOptions = cat.options.length;
  out.matched = matchedKeyed;
  out.matchedCount = Object.keys(matchedKeyed).length;
  out.unmatched = matched.unmatched || [];
  out.notes = matched.notes || [];
  out.choices = matched.choices || [];
  out.saved = saved;
  out.savedDuplicates = duplicateIds(saved);
  out.matchedDuplicates = duplicateIds(matchedKeyed);
  out.diff = !sameMap(saved, matchedKeyed);
  out.genre = maps._test.looksGenre(cat.options);
  return out;
}

(async function () {
  let hosts = args.hosts.length ? args.hosts : siteStore.list().map(function (s) { return s.host; });
  if (!args.includeNoCookie) hosts = hosts.filter(function (h) { const c = credentials.get(h); return !c.err; });
  if (!args.hosts.length) hosts = hosts.slice(args.offset, args.offset + args.limit);
  const run = { at: new Date().toISOString(), data: DATA, out: OUT, delay: args.delay, limit: args.limit, offset: args.offset, total: hosts.length, requests: 0, rateStops: 0, sites: [] };
  let rateStops = 0;
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    const file = path.join(SITES, safeHost(host) + '.json');
    if (args.resume && fs.existsSync(file)) continue;
    const rec = siteStore.get(host);
    const c = credentials.get(host);
    const row = { host: host, name: String(rec && rec.name || ''), engine: String(rec && rec.engine || ''), enabled: !!(rec && rec.settings && rec.settings.enabled !== false), at: new Date().toISOString(), issues: [], requests: 0 };
    if (!rec) { row.issues.push(issue('NO_RECORD')); row.status = 'ERROR'; writeJson(file, row); run.sites.push(row); continue; }
    if (c.err) { row.issues.push(issue('NO_COOKIE', c.err)); row.status = 'BLOCKED_COOKIE'; writeJson(file, row); run.sites.push(row); continue; }
    try {
      const search = await auditSearch(host, rec, c.cookie);
      row.search = search; row.requests += search.requests || 0; run.requests += search.requests || 0;
      if (!search.ok) {
        row.issues.push(issue(search.code, search.message || ''));
        if (search.stop) { row.status = 'BLOCKED_RATE'; rateStops++; run.rateStops = rateStops; }
        else if (/LOGIN|HTTP_401|HTTP_302/.test(search.code)) row.status = 'BLOCKED_LOGIN';
        else row.status = 'ERROR';
      } else {
        const savedCats = (rec.search && rec.search.cats) || {};
        const searchTypes = Object.keys(search.cats || {});
        const savedTypes = Object.keys(savedCats);
        row.search.compare = {
          savedTypes: savedTypes.length,
          newTypes: searchTypes.length,
          savedIds: Object.keys(savedCats).reduce(function (n, t) { return n + ((savedCats[t] || []).length); }, 0),
          newIds: Object.keys(search.cats || {}).reduce(function (n, t) { return n + ((search.cats[t] || []).length); }, 0),
          missingTypes: searchTypes.filter(function (t) { return savedTypes.indexOf(t) < 0; }),
          lostTypes: savedTypes.filter(function (t) { return searchTypes.indexOf(t) < 0; })
        };
        if (!searchTypes.length) row.issues.push(issue('SEARCH_EMPTY'));
        if (search.unmatched && search.unmatched.length) row.issues.push(issue('SEARCH_UNMATCHED', search.unmatched.length + ' 个'));
        if (search.unmatched && search.unmatched.slice(0, 8).some(function (x) { return x.dim === 'type'; })) row.issues.push(issue('SEARCH_TYPE_UNMATCHED'));
      }
      await sleep(args.delay);
      if (!search.stop) {
        const upload = await auditUpload(host, rec, c.cookie);
        row.upload = upload; row.requests += upload.requests || 0; run.requests += upload.requests || 0;
        if (!upload.ok) {
          row.issues.push(issue(upload.code, upload.message || ''));
          if (upload.stop) { row.status = 'BLOCKED_RATE'; rateStops++; run.rateStops = rateStops; }
          else if (upload.code === 'NO_FORM') row.status = row.status === 'ERROR' ? 'PARTIAL' : (row.status === 'BLOCKED_RATE' ? row.status : 'PARTIAL');
          else if (upload.code === 'LOGIN_REQUIRED' || upload.code === 'HTTP_401') row.status = 'BLOCKED_LOGIN';
          else if (upload.code === 'HTTP_404' || upload.code === 'HTTP_405') row.issues.push(issue('UPLOAD_PATH_MISSING'));
        } else {
          if (!upload.catFields.length) row.issues.push(issue('UPLOAD_NO_CAT_FIELD'));
          if (upload.genre) row.issues.push(issue('UPLOAD_GENRE_FIELD'));
          if (upload.savedDuplicates.length) row.issues.push(issue('PUBLISH_DUP', upload.savedDuplicates.length + ' 个 ID'));
          if (upload.diff) row.issues.push(issue('PUBLISH_DIFF'));
          if (upload.unmatched && upload.unmatched.length) row.issues.push(issue('UPLOAD_UNMATCHED', upload.unmatched.length + ' 个'));
          if (upload.catFields.some(function (x) { return /checkbox|radio/.test(x.type); })) row.issues.push(issue('UPLOAD_CHOICE_GROUP'));
          if (upload.catFields.length > 1) row.issues.push(issue('UPLOAD_MULTI_CAT_FIELD'));
          if (!row.status) row.status = (upload.diff || upload.unmatched.length || upload.savedDuplicates.length || !upload.catFields.length) ? 'PARTIAL' : 'OK';
        }
      }
      if (!row.status) row.status = row.issues.length ? 'PARTIAL' : 'OK';
    } catch (e) {
      row.status = 'ERROR';
      row.issues.push(issue('AUDIT_FAILED', String(e && e.message || e).slice(0, 160)));
    }
    writeJson(file, row);
    run.sites.push(row);
    console.log((row.status + '    ').slice(0, 8) + row.name + '  ' + row.host + '  ' + row.issues.map(function (x) { return x.code; }).join(','));
    if (rateStops >= args.stopAfterRate) { run.stopped = '连续限流，停止本次批次'; break; }
    if (i < hosts.length - 1) await sleep(args.delay);
  }
  writeJson(path.join(OUT, 'last-run.json'), run);
  console.log(JSON.stringify({ sites: run.sites.length, requests: run.requests, rateStops: run.rateStops, out: OUT }, null, 1));
})().catch(function (e) { console.error('FAILED', e && e.message ? e.message : e); process.exit(1); });

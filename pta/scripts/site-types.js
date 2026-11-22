#!/usr/bin/env node
/* 站点类型补全：先从本地分类数据离线补，再用已存 cookie 逐站探测分类页回填。
   默认只预览，不写库；--write 才更新 data/site-search.local.json。
   探测规则：单站 1 个请求、串行、间隔 ≥10 秒、失败即停；不打印站名/网址/cookie。
   用法：
     node pta/scripts/site-types.js --data /opt/seedpod/data --from-categories --dry
     node pta/scripts/site-types.js --data /opt/seedpod/data --probe --dry
     node pta/scripts/site-types.js --data /opt/seedpod/data --probe --write
*/
const fs = require('fs');
const path = require('path');
const { openDB } = require('../server/db');
const secretbox = require('../server/secretbox');
const jsonFile = require('../server/json-file');
const sitePack = require('../server/site-pack');
const siteHidden = require('../server/site-hidden');
const form = require('../server/form');
const urlGuard = require('../server/url-guard');
const { typeOf } = require('../server/category-policy');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', require('../server/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
const PREVIEW = path.resolve(arg('--preview', path.join(DATA, 'site-types.preview.json')));
const SEARCH_FILE = path.join(DATA, 'site-search.local.json');
const DELAY = Math.max(10000, Number(arg('--delay', 10000)) || 10000);
const LIMIT = Math.max(1, Math.min(500, Number(arg('--limit', 500)) || 500));
const WRITE = argv.includes('--write');
const PROBE = argv.includes('--probe');
const FROM_CATS = argv.includes('--from-categories');
const FORCE = argv.includes('--force');
const ALL_TYPES = argv.includes('--all-types');
const HOST = String(arg('--host', '') || '').toLowerCase();
const TIMEOUT = Math.max(5000, Math.min(30000, Number(arg('--timeout', 20000)) || 20000));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function norm(host) { return String(host || '').trim().toLowerCase(); }
function uniq(list) { return list.filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }
function typesOfLabels(labels) {
  return uniq(labels.map(function (x) { return typeOf(x); }).filter(Boolean));
}
const PRIMARY = ['电影', '剧集', '动漫', '纪录片', '综艺', '音乐', '体育', '游戏', '电子书', '软件', '成人', '其他'];
function pickPrimary(types) { return PRIMARY.filter(function (t) { return types.indexOf(t) >= 0; }).slice(0, 1); }
function propose(types) { return ALL_TYPES ? types.slice(0, 12) : pickPrimary(types); }
function searchSites(raw) { return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : raw; }
function ensureSearch(raw) {
  if (raw && raw.sites && typeof raw.sites === 'object') return raw;
  return { sites: raw && typeof raw === 'object' ? raw : {} };
}
function privateDef(host) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'site-defs', host + '.json'), 'utf8')); }
  catch (e) { return null; }
}
function defOf(host) {
  const built = sitePack.siteOf(host) || {};
  const priv = privateDef(host) || {};
  return Object.assign({}, built, priv);
}
function labelsFromSearch(entry) {
  const cats = entry && entry.cats && typeof entry.cats === 'object' ? entry.cats : {};
  return Object.keys(cats).filter(function (k) { return Array.isArray(cats[k]) && cats[k].length; });
}
function labelsFromPack(host) {
  const def = sitePack.siteOf(host);
  if (!def || !Array.isArray(def.catList)) return [];
  return def.catList.map(function (x) { return String((x && (x.label || x.purpose)) || ''); }).filter(Boolean);
}
function collectFromCategories() {
  const raw = ensureSearch(readJson(SEARCH_FILE, { sites: {} }));
  const sites = searchSites(raw) || {};
  const out = [];
  Object.keys(sites).forEach(function (host) {
    const entry = sites[host] || {};
    const labels = uniq(labelsFromSearch(entry).concat(labelsFromPack(host)));
    const proposed = propose(typesOfLabels(labels));
    out.push({ host: host, mode: 'categories', labels: labels.length, proposedTypes: proposed,
      status: proposed.length ? 'ok' : (labels.length ? 'no_type' : 'no_categories') });
  });
  return { raw: raw, records: out };
}
async function cookieOf(db, keyring, host) {
  const row = db.prepare('SELECT cookie FROM credentials WHERE host = ?').get(host);
  if (!row || !row.cookie) return { err: 'NO_COOKIE' };
  try { return { cookie: secretbox.decrypt(row.cookie, keyring) }; }
  catch (e) { return { err: 'COOKIE_UNREADABLE' }; }
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
async function probeOne(db, keyring, host) {
  if (siteHidden.has(db, host)) return { host: host, status: 'hidden', requests: 0 };
  const c = await cookieOf(db, keyring, host);
  if (c.err) return { host: host, status: c.err, requests: 0 };
  const def = defOf(host);
  if (!def || !def.base) return { host: host, status: 'NO_DEF', requests: 0 };
  let url;
  try { url = new URL(pagePath(def), String(def.base).replace(/\/+$/, '') + '/').toString(); }
  catch (e) { return { host: host, status: 'BAD_BASE', requests: 0 }; }
  const gate = await urlGuard.assertNoRebind(url);
  if (!gate.ok) return { host: host, status: 'DNS_BLOCKED', requests: 0 };
  let res;
  try {
    res = await fetch(url, {
      headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT)
    });
  } catch (e) { return { host: host, status: 'FETCH_FAILED', requests: 1 }; }
  const requests = 1;
  if (res.status === 429 || res.status === 403 || res.status === 503) return { host: host, status: 'RATE_LIMITED', http: res.status, requests: requests };
  if (res.status >= 300 && res.status < 400) return { host: host, status: 'REDIRECT', http: res.status, requests: requests };
  if (res.status !== 200) return { host: host, status: 'HTTP_' + res.status, requests: requests };
  const html = await res.text().catch(function () { return ''; });
  if (/takelogin\.php|login\.php|请先登录|not\s+authorized/i.test(html)) return { host: host, status: 'LOGIN_REQUIRED', requests: requests };
  const cats = parseCategories(html);
  const labels = [];
  cats.forEach(function (f) { f.options.forEach(function (o) { labels.push(o.label); }); });
  const proposed = propose(typesOfLabels(labels));
  return { host: host, status: proposed.length ? 'ok' : (cats.length ? 'no_type' : 'NO_CATEGORIES'),
    page: 'form', categories: cats.length, proposedTypes: proposed, requests: requests };
}
async function runProbe() {
  const db = openDB(path.join(DATA, 'seedpod.db'));
  const keyring = secretbox.loadKey(DATA);
  const rows = db.prepare('SELECT host, data FROM sites').all().map(function (r) {
    return { host: norm(r.host), data: (function () { try { return JSON.parse(r.data) || {}; } catch (e) { return {}; } })() };
  }).filter(function (x) { return x.host && x.data.enabled !== false; })
    .filter(function (x) { return !HOST || x.host === HOST; })
    .slice(0, LIMIT);
  const out = [];
  let stopped = '';
  for (const x of rows) {
    if (out.length) await new Promise(function (r) { setTimeout(r, DELAY); });
    const rec = await probeOne(db, keyring, x.host);
    out.push(rec);
    if (rec.status === 'RATE_LIMITED' || rec.status === 'LOGIN_REQUIRED') { stopped = rec.status; break; }
  }
  db.close();
  return { records: out, stopped: stopped, requests: out.reduce(function (a, x) { return a + (x.requests || 0); }, 0) };
}
function applyTypes(raw, records) {
  const doc = ensureSearch(raw);
  const sites = searchSites(doc);
  let changed = 0;
  records.forEach(function (r) {
    if (r.status !== 'ok' || !r.proposedTypes || !r.proposedTypes.length) return;
    const host = norm(r.host);
    if (!sites[host]) sites[host] = {};
    const cur = Array.isArray(sites[host].types) ? sites[host].types : [];
    if (cur.length && !FORCE) return;
    sites[host].types = r.proposedTypes.slice(0, 12);
    changed++;
  });
  return { doc: doc, changed: changed };
}
async function main() {
  if (!PROBE && !FROM_CATS) {
    console.log('需要 --from-categories 或 --probe；加 --dry 预览，--write 落库');
    process.exit(2);
  }
  let raw = ensureSearch(readJson(SEARCH_FILE, { sites: {} }));
  let records = [];
  let stopped = '';
  let requests = 0;
  if (FROM_CATS) {
    const c = collectFromCategories();
    raw = c.raw;
    records = c.records;
  }
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
    const a = applyTypes(raw, records);
    if (a.changed) {
      try { fs.copyFileSync(SEARCH_FILE, SEARCH_FILE + '.bak'); } catch (e) { /* 没有原文件就跳过 */ }
      jsonFile.writeAtomic(SEARCH_FILE, a.doc, 0o600);
    }
    summary.applied = a.changed;
  }
  jsonFile.writeAtomic(PREVIEW, records, 0o600);
  console.log(JSON.stringify(summary, null, 2));
}
module.exports = { collectFromCategories, parseCategories, typesOfLabels, probeOne, runProbe, applyTypes, pagePath };
if (require.main === module) main().catch(function (e) { console.error('site-types failed:', e && e.message || e); process.exit(1); });

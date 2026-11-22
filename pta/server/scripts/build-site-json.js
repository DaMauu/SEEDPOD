#!/usr/bin/env node
/* 站点 JSON 生成器：运行时 sites.json / site-urls.json 是唯一事实源。
   默认从运行时生成 pta/pack 预设；--runtime 只规范化运行时文件。
   --check 校验预设与运行时一致；--disable-all 生成预设时全部停用。
   不打印站名/网址/cookie。 */
const fs = require('fs');
const path = require('path');
const makeSiteStore = require('../src/features/sites/store');
const jsonFile = require('../src/infra/json-file');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
const OUT = path.resolve(arg('--out', path.join(ROOT, 'server', 'pack')));
const RUNTIME = argv.includes('--runtime');
const CHECK = argv.includes('--check');
const DRY = argv.includes('--dry');
const DISABLE_ALL = argv.includes('--disable-all');
const store = makeSiteStore(DATA);

function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function clone(x) { return JSON.parse(JSON.stringify(x || {})); }
function sortKeys(obj) {
  const out = {};
  Object.keys(obj || {}).sort().forEach(function (k) { out[k] = obj[k]; });
  return out;
}
function normDoc(doc, opts) {
  const o = opts || {};
  const src = clone(doc && doc.sites ? doc.sites : {});
  const sites = {};
  Object.keys(src).sort().forEach(function (host) {
    const rec = src[host] || {};
    /* 未知字段原样保留；全局站点模板补齐 limits/downloadLink/refreshCron 等缺失项 */
    const out = store.normalizeRecord(rec);
    out.name = String(rec.name || host);
    out.nameZh = String(rec.nameZh || '');
    out.engine = String(rec.engine || '?');
    out.urlRef = String(rec.urlRef || ('site-urls.json#' + host));
    out.localEdited = o.preset ? false : rec.localEdited === true;
    if (o.preset) delete out.settings;
    else out.settings.enabled = DISABLE_ALL ? false : out.settings.enabled !== false;
    sites[host] = out;
  });
  return { version: 1, presets: 'presets.preset.json', generatedAt: new Date().toISOString(), sites: sites };
}
function urlDocOf(raw) {
  const src = clone(raw && raw.sites ? raw.sites : {});
  const sites = {};
  Object.keys(src).sort().forEach(function (h) { sites[h] = src[h]; });
  return { version: 1, generatedAt: new Date().toISOString(), sites: sites };
}
function count(docs) {
  const sites = docs.sites.sites || {};
  const hosts = Object.keys(sites);
  let search = 0, publish = 0;
  hosts.forEach(function (h) {
    if (Object.keys((sites[h].search || {}).cats || {}).length) search++;
    if (Object.keys((sites[h].publish || {}).catMap || {}).length) publish++;
  });
  return { sites: hosts.length, urls: Object.keys((docs.urls.sites) || {}).length, search: search, publish: publish };
}

store.ensureRuntime();
const sitesRaw = read(store.FILE) || { version: 1, sites: {} };
const urlsRaw = read(store.URL_FILE) || { version: 1, sites: {} };
const runtimeSites = normDoc(sitesRaw, { preset: false });
const presetSites = normDoc(sitesRaw, { preset: true });
const runtimeUrls = urlDocOf(urlsRaw);
const presetUrls = urlDocOf(urlsRaw);

if (CHECK) {
  const packSites = read(path.join(OUT, 'sites.preset.json')) || { sites: {} };
  const packUrls = read(path.join(OUT, 'site-urls.preset.json')) || { sites: {} };
  const same = JSON.stringify(sortKeys(packSites.sites)) === JSON.stringify(sortKeys(presetSites.sites))
    && JSON.stringify(sortKeys(packUrls.sites)) === JSON.stringify(sortKeys(presetUrls.sites));
  console.log(JSON.stringify(Object.assign({ ok: same }, count({ sites: runtimeSites, urls: runtimeUrls })), null, 2));
  if (!same) process.exit(1);
  return;
}
if (DRY) {
  console.log(JSON.stringify(Object.assign({ dry: true }, count({ sites: runtimeSites, urls: runtimeUrls })), null, 2));
  return;
}
if (RUNTIME) {
  jsonFile.writeAtomic(store.FILE, runtimeSites, 0o600);
  jsonFile.writeAtomic(store.URL_FILE, runtimeUrls, 0o600);
  console.log(JSON.stringify(Object.assign({ out: DATA }, count({ sites: runtimeSites, urls: runtimeUrls })), null, 2));
  return;
}
fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
jsonFile.writeAtomic(path.join(OUT, 'sites.preset.json'), presetSites, 0o600);
jsonFile.writeAtomic(path.join(OUT, 'site-urls.preset.json'), presetUrls, 0o600);
const cookies = { version: 1, cookies: {} };
Object.keys(presetSites.sites).forEach(function (h) { cookies.cookies[h] = { cookie: '' }; });
jsonFile.writeAtomic(path.join(OUT, 'cookies.example.json'), cookies, 0o600);
console.log(JSON.stringify(Object.assign({ out: OUT }, count({ sites: runtimeSites, urls: runtimeUrls })), null, 2));

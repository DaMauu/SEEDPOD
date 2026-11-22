#!/usr/bin/env node
/* 从现有 SQLite sites / site-defs / site-search / site-maps 生成站点 JSON 与网址 JSON。
   只读源数据；默认写 pta/pack 的 preset，--runtime 才写数据目录的 sites.json。
   不打印站名/网址/cookie。 */
const fs = require('fs');
const path = require('path');
const { openDB } = require('../server/db');
const jsonFile = require('../server/json-file');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', require('../server/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
const OUT = path.resolve(arg('--out', path.join(ROOT, 'pack')));
const RUNTIME = argv.includes('--runtime');
const DRY = argv.includes('--dry');
const CHECK = argv.includes('--check');
const DISABLE_ALL = argv.includes('--disable-all');

function b64(s) { return 'b64:' + Buffer.from(String(s || ''), 'utf8').toString('base64'); }
function decode(v) { const s = String(v || ''); if (!s.startsWith('b64:')) return ''; try { return Buffer.from(s.slice(4), 'base64').toString('utf8'); } catch (e) { return ''; } }
function readJson(file, fb) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fb; } }
function hostOf(x) { return String(x || '').trim().toLowerCase(); }
function defsOf() {
  const dir = path.join(DATA, 'site-defs');
  const out = {};
  let files = [];
  try { files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.json'); }); } catch (e) { return out; }
  files.forEach(function (f) {
    const h = f.slice(0, -5).toLowerCase();
    try { out[h] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) || {}; } catch (e) { /* skip */ }
  });
  return out;
}
function searchOf() {
  const raw = readJson(path.join(DATA, 'site-search.local.json'), {});
  return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : (raw || {});
}
function mapsOf() {
  const raw = readJson(path.join(DATA, 'site-maps.json'), {});
  return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : (raw || {});
}
function hiddenOf(db) {
  try {
    const row = db.prepare("SELECT v FROM meta WHERE k = 'site-config-meta'").get();
    const meta = JSON.parse(row ? row.v : '{}') || {};
    return Array.isArray(meta.hidden) ? meta.hidden.map(hostOf) : [];
  } catch (e) { return []; }
}
function publishOf(def, mp) {
  const up = def.upload || {};
  const fields = up.fields && typeof up.fields === 'object' ? up.fields : {};
  const publish = {
    upload: { path: String(up.path || ''), formPath: String(up.formPath || ''), fileField: String(up.fileField || ''), fields: fields },
    verify: { path: String((def.verify && def.verify.path) || '') },
    catMap: {},
    catLabels: {}
  };
  const raw = def.catMap;
  if (Array.isArray(raw)) {
    raw.forEach(function (x) {
      if (!x || x.id == null) return;
      if (x.purpose) publish.catMap[String(x.purpose)] = String(x.id);
      if (x.label) publish.catLabels[String(x.label)] = String(x.id);
    });
  } else if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach(function (k) {
      if (raw[k] == null) return;
      publish.catMap[String(k)] = String(raw[k]);
      publish.catLabels[String(k)] = String(raw[k]);
    });
  }
  const mcat = (mp && mp.cat && typeof mp.cat === 'object') ? mp.cat : {};
  Object.keys(mcat).forEach(function (label) {
    if (mcat[label] == null) return;
    publish.catLabels[String(label)] = String(mcat[label]);
    if (!publish.catMap[String(label)]) publish.catMap[String(label)] = String(mcat[label]);
  });
  return publish;
}
function settingsOf(d, hidden) {
  const keys = ['enabled', 'interval', 'priority', 'note', 'override', 'ovInterval', 'ovDetail', 'mode', 'queueMode', 'window', 'pages', 'concurrency', 'dupeCheck'];
  const s = {};
  keys.forEach(function (k) { if (d[k] !== undefined) s[k] = d[k]; });
  s.hidden = hidden;
  return s;
}
function main() {
  const db = openDB(path.join(DATA, 'seedpod.db'));
  const dbRows = db.prepare('SELECT host, data FROM sites').all();
  const hidden = hiddenOf(db);
  db.close();
  const defs = defsOf();
  const search = searchOf();
  const maps = mapsOf();
  const sites = {};
  const urls = {};
  const cookies = {};
  let settingsCount = 0, searchCount = 0, publishCount = 0, urlCount = 0;
  dbRows.forEach(function (r) {
    const host = hostOf(r.host);
    if (!host) return;
    let d = {}; try { d = JSON.parse(r.data) || {}; } catch (e) { d = {}; }
    const def = defs[host] || {};
    const se = search[host] || {};
    const mp = maps[host] || {};
    const base = String(def.base || d.url || '').replace(/\/+$/, '');
    const publish = publishOf(def, mp);
    const cats = (se.cats && Object.keys(se.cats).length) ? se.cats : (def.cats || {});
    const rec = {
      name: String(d.title || def.title || host),
      nameZh: String(d.titleZh || d.cn || ''),
      engine: String(def.engine || d.engine || '?'),
      urlRef: 'site-urls.json#' + host,
      search: {
        path: String(def.searchPath || '/torrents.php'),
        params: def.params && typeof def.params === 'object' ? def.params : {},
        cats: cats,
        types: Array.isArray(se.types) ? se.types : []
      },
      publish: publish,
      localEdited: false
    };
    if (RUNTIME) {
      rec.settings = settingsOf(d, hidden.indexOf(host) >= 0);
      if (DISABLE_ALL) rec.settings.enabled = false;
      if (Object.keys(rec.settings).length > 1) settingsCount++;
    }
    sites[host] = rec;
    if (base) {
      urls[host] = { base: b64(base), upload: b64(publish.upload.path), verify: b64(publish.verify.path) };
      urlCount++;
    }
    cookies[host] = { cookie: '' };
    if (Object.keys(cats).length) searchCount++;
    if (Object.keys(publish.catMap).length || Object.keys(publish.catLabels).length) publishCount++;
  });
  const summary = { sites: Object.keys(sites).length, urls: urlCount, search: searchCount, publish: publishCount, settings: settingsCount, hidden: hidden.filter(function (h) { return sites[h]; }).length };
  if (CHECK) {
    const bad = [];
    const norm = function (x) { return JSON.stringify(x || {}); };
    Object.keys(sites).forEach(function (h) {
      const rec = sites[h];
      const d = dbRows.filter(function (r) { return hostOf(r.host) === h; })[0] || {};
      let dbd = {}; try { dbd = JSON.parse(d.data || '{}') || {}; } catch (e) { dbd = {}; }
      const def = defs[h] || {};
      const se = search[h] || {};
      const base = String(def.base || dbd.url || '').replace(/\/+$/, '');
      if (decode(urls[h] && urls[h].base) !== base) bad.push({ host: h, field: 'base' });
      if (urls[h] && decode(urls[h].upload) !== String((def.upload && def.upload.path) || '')) bad.push({ host: h, field: 'upload' });
      if (urls[h] && decode(urls[h].verify) !== String((def.verify && def.verify.path) || '')) bad.push({ host: h, field: 'verify' });
      const cats = (se.cats && Object.keys(se.cats).length) ? se.cats : (def.cats || {});
      if (norm(rec.search.cats) !== norm(cats)) bad.push({ host: h, field: 'search.cats' });
      if (norm(rec.search.types) !== norm(Array.isArray(se.types) ? se.types : [])) bad.push({ host: h, field: 'search.types' });
      if (RUNTIME) {
        const wantEnabled = DISABLE_ALL ? false : dbd.enabled !== false;
        if (rec.settings.enabled !== wantEnabled) bad.push({ host: h, field: 'settings.enabled' });
      }
    });
    if (bad.length) {
      try { jsonFile.writeAtomic(path.join(DATA, 'site-json-mismatches.json'), bad, 0o600); } catch (e) { /* 忽略 */ }
    }
    console.log(JSON.stringify(Object.assign({ mismatches: bad.length, mismatchFile: bad.length ? path.join(DATA, 'site-json-mismatches.json') : '' }, summary), null, 2));
    if (bad.length) process.exit(1);
    return;
  }
  if (DRY) { console.log(JSON.stringify(summary, null, 2)); return; }
  const dir = RUNTIME ? DATA : OUT;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const prefix = RUNTIME ? '' : 'sites.preset';
  const urlPrefix = RUNTIME ? 'site-urls' : 'site-urls.preset';
  jsonFile.writeAtomic(path.join(dir, prefix + '.json'), { version: 1, generatedAt: new Date().toISOString(), sites: sites }, 0o600);
  jsonFile.writeAtomic(path.join(dir, urlPrefix + '.json'), { version: 1, generatedAt: new Date().toISOString(), sites: urls }, 0o600);
  if (!RUNTIME) jsonFile.writeAtomic(path.join(dir, 'cookies.example.json'), { version: 1, cookies: cookies }, 0o600);
  console.log(JSON.stringify(Object.assign({ out: dir }, summary), null, 2));
}
main();

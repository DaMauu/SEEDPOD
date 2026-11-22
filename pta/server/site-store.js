/* 站点 JSON 仓库：运行时只读 data/sites.json + data/site-urls.json。
   首次启动从 pta/pack/*.preset.json 复制；写入原子写 + SQLite 锁 + .bak。
   不再读 site-defs / site-search / site-maps / sites 表。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('./json-file');
const uploadLock = require('./upload-lock');
const { openDB } = require('./db');

const VERSION = 1;
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PRESET = path.join(ROOT, 'pack');

function b64(s) { return 'b64:' + Buffer.from(String(s || ''), 'utf8').toString('base64'); }
function unb64(v) {
  const s = String(v || '');
  if (!s.startsWith('b64:')) return '';
  try { return Buffer.from(s.slice(4), 'base64').toString('utf8'); } catch (e) { return ''; }
}
function cleanHost(h) { return String(h || '').trim().toLowerCase(); }
function validHost(h) { return /^[a-z0-9][a-z0-9.-]*$/i.test(String(h || '')); }
function clone(x) { return JSON.parse(JSON.stringify(x || {})); }

function makeSiteStore(dataDir, opts) {
  const DIR = path.resolve(dataDir || '.');
  const o = opts || {};
  const PRESET = path.resolve(o.presetDir || DEFAULT_PRESET);
  const SITES_FILE = path.join(DIR, 'sites.json');
  const URLS_FILE = path.join(DIR, 'site-urls.json');
  const SITES_PRESET = path.join(PRESET, 'sites.preset.json');
  const URLS_PRESET = path.join(PRESET, 'site-urls.preset.json');
  const CACHE = { sites: null, urls: null };

  function readJson(file, fb) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  }
  function cachedDoc(key, file, presetFile) {
    let st = null;
    try { st = fs.statSync(file); } catch (e) { st = null; }
    if (st && CACHE[key] && CACHE[key].mtime === st.mtimeMs && CACHE[key].size === st.size) return CACHE[key].doc;
    let d = readJson(file, null);
    if (!d || typeof d !== 'object') d = readJson(presetFile, null);
    if (!d || typeof d !== 'object') d = { version: VERSION, sites: {} };
    if (st) CACHE[key] = { mtime: st.mtimeMs, size: st.size, doc: d };
    return d;
  }
  function docOf(file, presetFile) {
    return file === SITES_FILE ? cachedDoc('sites', file, presetFile) : cachedDoc('urls', file, presetFile);
  }
  function writeDoc(file, doc) {
    try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* 备份失败不挡写入 */ }
    jsonFile.writeAtomic(file, doc, 0o600);
    if (file === SITES_FILE) CACHE.sites = null;
    if (file === URLS_FILE) CACHE.urls = null;
  }
  function readLegacyDefs() {
    const dir = path.join(DIR, 'site-defs');
    const out = {};
    let files = [];
    try { files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.json'); }); } catch (e) { return out; }
    files.forEach(function (f) {
      const h = f.slice(0, -5).toLowerCase();
      try { out[h] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) || {}; } catch (e) { /* skip */ }
    });
    return out;
  }
  function readLegacySearch() {
    const raw = readJson(path.join(DIR, 'site-search.local.json'), {});
    return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : (raw || {});
  }
  function readLegacyPack() {
    const raw = readJson(path.join(DIR, 'site-pack.json'), {});
    return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : {};
  }
  function readLegacyMaps() {
    const raw = readJson(path.join(DIR, 'site-maps.json'), {});
    return raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : (raw || {});
  }
  function legacyPublish(def, mp) {
    const up = def.uploadMap || def.upload || {};
    const publish = { upload: { path: String(up.path || ''), formPath: String(up.formPath || ''), fileField: String(up.fileField || ''), fields: up.fields && typeof up.fields === 'object' ? up.fields : {} },
      verify: { path: String((def.verify && def.verify.path) || '') }, catMap: {}, catLabels: {},
      tagMap: def.tagMap && typeof def.tagMap === 'object' ? def.tagMap : {}, tagValue: String(def.tagValue || 'yes'),
      form: (mp && mp.form) || def.form || null,
      baseValueMaps: def.valueMaps && typeof def.valueMaps === 'object' ? def.valueMaps : {},
      valueMaps: Object.assign({}, (mp && mp.valueMaps) || {}, { team: (mp && mp.team) || {} }) };
    const raw = def.catMap;
    if (Array.isArray(raw)) raw.forEach(function (x) { if (x && x.id != null) { if (x.purpose) publish.catMap[String(x.purpose)] = String(x.id); if (x.label) publish.catLabels[String(x.label)] = String(x.id); } });
    else if (raw && typeof raw === 'object') Object.keys(raw).forEach(function (k) { if (raw[k] != null) { publish.catMap[String(k)] = String(raw[k]); publish.catLabels[String(k)] = String(raw[k]); } });
    const mcat = (mp && mp.cat && typeof mp.cat === 'object') ? mp.cat : {};
    Object.keys(mcat).forEach(function (label) { if (mcat[label] != null) { publish.catLabels[String(label)] = String(mcat[label]); if (!publish.catMap[String(label)]) publish.catMap[String(label)] = String(mcat[label]); } });
    return publish;
  }
  /* 一次性迁移：只在 sites.json 不存在时调用；之后不再读旧表/旧文件 */
  function migrateLegacy() {
    let db = null;
    try { db = openDB(path.join(DIR, 'seedpod.db')); } catch (e) { return 0; }
    try {
      let rows = [];
      try { rows = db.prepare('SELECT host, data FROM sites').all(); } catch (e) { rows = []; }
      let hidden = [];
      try {
        const mr = db.prepare("SELECT v FROM meta WHERE k = 'site-config-meta'").get();
        const meta = JSON.parse(mr ? mr.v : '{}') || {};
        hidden = Array.isArray(meta.hidden) ? meta.hidden.map(cleanHost) : [];
      } catch (e) { hidden = []; }
      const defs = readLegacyDefs();
      const pack = readLegacyPack();
      const search = readLegacySearch();
      const maps = readLegacyMaps();
      const sites = { version: VERSION, sites: {} };
      const urls = { version: VERSION, sites: {} };
      const rowMap = {};
      rows.forEach(function (r) { rowMap[cleanHost(r.host)] = r; });
      const hosts = Array.from(new Set(Object.keys(rowMap).concat(Object.keys(defs), Object.keys(pack), Object.keys(search), Object.keys(maps))));
      hosts.forEach(function (host) {
        const r = rowMap[host] || { host: host, data: '{}' };
        if (!host) return;
        let d = {}; try { d = JSON.parse(r.data) || {}; } catch (e) { d = {}; }
        const def = Object.assign({}, defs[host] || {}, pack[host] || {});
        const se = search[host] || {};
        const mp = maps[host] || {};
        const base = String(def.base || d.url || '').replace(/\/+$/, '');
        const publish = legacyPublish(def, mp);
        const cats = (se.cats && Object.keys(se.cats).length) ? se.cats : (def.cats || {});
        sites.sites[host] = {
          name: String(d.title || def.title || host), nameZh: String(d.titleZh || d.cn || ''),
          engine: String(def.engine || d.engine || '?'), urlRef: 'site-urls.json#' + host,
          search: { path: String(def.searchPath || '/torrents.php'), params: def.params && typeof def.params === 'object' ? def.params : {}, catMode: String(def.catMode || 'single'), catSlot: String(def.catSlot || ''), cats: cats, types: Array.isArray(se.types) ? se.types : [], filters: (mp && mp.filters) || {} },
          publish: publish, localEdited: false,
          settings: (function () {
            const st = normalizeSettings(Object.assign({}, d, { hidden: hidden.indexOf(host) >= 0 }));
            if (d.enabled === undefined) st.enabled = true;
            return st;
          })()
        };
        if (base) urls.sites[host] = { base: b64(base), upload: b64(publish.upload.path), verify: b64(publish.verify.path) };
      });
      writeDoc(SITES_FILE, sites);
      writeDoc(URLS_FILE, urls);
      return Object.keys(sites.sites).length;
    } finally { try { db.close(); } catch (e) { /* 已关 */ } }
  }
  function ensureRuntime() {
    const missSites = !fs.existsSync(SITES_FILE);
    const missUrls = !fs.existsSync(URLS_FILE);
    if (!missSites && !missUrls) return false;
    if (missSites && missUrls) {
      const n = migrateLegacy();
      if (!n) {
        writeDoc(SITES_FILE, readJson(SITES_PRESET, null) || { version: VERSION, sites: {} });
        writeDoc(URLS_FILE, readJson(URLS_PRESET, null) || { version: VERSION, sites: {} });
      }
      return true;
    }
    if (missSites) writeDoc(SITES_FILE, readJson(SITES_PRESET, null) || { version: VERSION, sites: {} });
    if (missUrls) writeDoc(URLS_FILE, readJson(URLS_PRESET, null) || { version: VERSION, sites: {} });
    return true;
  }
  function siteDoc() { ensureRuntime(); return clone(docOf(SITES_FILE, SITES_PRESET)); }
  function urlDoc() { ensureRuntime(); return clone(docOf(URLS_FILE, URLS_PRESET)); }
  function defaults() { return { enabled: false, interval: null, priority: 'normal', note: '', hidden: false }; }
  function normalizeSettings(s) { return Object.assign(defaults(), s && typeof s === 'object' ? s : {}); }
  function urlOf(host, urls) {
    const u = (urls.sites || {})[host] || {};
    return { base: unb64(u.base), upload: unb64(u.upload), verify: unb64(u.verify) };
  }
  function recordOf(host, sites, urls) {
    const raw = (sites.sites || {})[host];
    if (!raw) return null;
    return {
      host: host,
      name: String(raw.name || host),
      nameZh: String(raw.nameZh || ''),
      engine: String(raw.engine || '?'),
      urlRef: String(raw.urlRef || ('site-urls.json#' + host)),
      search: clone(raw.search || {}),
      publish: clone(raw.publish || {}),
      localEdited: raw.localEdited === true,
      settings: normalizeSettings(raw.settings),
      url: urlOf(host, urls)
    };
  }
  function get(host) {
    const h = cleanHost(host);
    if (!validHost(h)) return null;
    const sites = siteDoc();
    const urls = urlDoc();
    return recordOf(h, sites, urls);
  }
  function list() {
    const sites = siteDoc();
    const urls = urlDoc();
    return Object.keys(sites.sites || {}).map(function (h) { return recordOf(h, sites, urls); }).filter(Boolean);
  }
  function has(host) { return !!get(host); }
  function withLock(db, fn) {
    if (!db) return fn();
    if (!uploadLock.acquire('sites', db)) return { ok: false, code: 'SITE_BUSY', message: '站点文件正在写入，稍后再试' };
    try { return fn(); } finally { uploadLock.release('sites', db); }
  }
  function save(host, patch, db) {
    const h = cleanHost(host);
    if (!validHost(h)) return { ok: false, code: 'BAD_HOST', message: '站点域名不合法' };
    const p = patch || {};
    return withLock(db, function () {
      const sites = siteDoc();
      const urls = urlDoc();
      if (!sites.sites || typeof sites.sites !== 'object') sites.sites = {};
      if (!urls.sites || typeof urls.sites !== 'object') urls.sites = {};
      const cur = sites.sites[h] || {
        name: h, nameZh: '', engine: '?', urlRef: 'site-urls.json#' + h,
        search: { path: '', params: {}, cats: {}, types: [] },
        publish: { upload: { path: '', formPath: '', fileField: '', fields: {} }, verify: { path: '' }, catMap: {}, catLabels: {} },
        settings: defaults(), localEdited: false
      };
      ['name', 'nameZh', 'engine', 'search', 'publish'].forEach(function (k) { if (p[k] !== undefined) cur[k] = p[k]; });
      if (p.settings !== undefined) cur.settings = normalizeSettings(Object.assign({}, cur.settings, p.settings));
      if (p.localEdited !== undefined) cur.localEdited = p.localEdited === true;
      else cur.localEdited = true;
      if (!cur.urlRef) cur.urlRef = 'site-urls.json#' + h;
      sites.sites[h] = cur;
      if (p.url && typeof p.url === 'object') {
        const old = urls.sites[h] || {};
        urls.sites[h] = {
          base: p.url.base !== undefined ? b64(p.url.base) : (old.base || ''),
          upload: p.url.upload !== undefined ? b64(p.url.upload) : (old.upload || ''),
          verify: p.url.verify !== undefined ? b64(p.url.verify) : (old.verify || '')
        };
      }
      writeDoc(SITES_FILE, sites);
      writeDoc(URLS_FILE, urls);
      return { ok: true, site: recordOf(h, sites, urls) };
    });
  }
  function add(host, data, db) {
    return save(host, Object.assign({ localEdited: true }, data || {}), db);
  }
  function remove(host, db) {
    const h = cleanHost(host);
    if (!validHost(h)) return { ok: false, code: 'BAD_HOST', message: '站点域名不合法' };
    return withLock(db, function () {
      const sites = siteDoc();
      const urls = urlDoc();
      const had = !!(sites.sites && sites.sites[h]);
      if (sites.sites) delete sites.sites[h];
      if (urls.sites) delete urls.sites[h];
      writeDoc(SITES_FILE, sites);
      writeDoc(URLS_FILE, urls);
      return { ok: true, removed: had };
    });
  }
  function setHidden(host, hidden, db) {
    const cur = get(host);
    if (!cur) return { ok: false, code: 'NOT_FOUND', message: '站点不存在' };
    return save(host, { settings: { hidden: !!hidden }, localEdited: true }, db);
  }
  function legacyDef(host) {
    const s = get(host);
    if (!s) return null;
    const catList = [];
    Object.keys(s.search.cats || {}).forEach(function (label) {
      (s.search.cats[label] || []).forEach(function (id) { catList.push({ id: String(id), label: String(label), purpose: String(label) }); });
    });
    return {
      host: s.host, engine: s.engine, base: s.url.base,
      searchPath: s.search.path, params: s.search.params || {}, catMode: s.search.catMode || 'single', catSlot: s.search.catSlot || '', filters: s.search.filters || {},
      cats: s.search.cats || {}, catList: catList, types: s.search.types || [],
      upload: s.publish.upload || {}, verify: s.publish.verify || {},
      catMap: s.publish.catMap || {}, catLabels: s.publish.catLabels || {},
      enabled: s.settings.enabled !== false, hidden: s.settings.hidden === true
    };
  }
  function targetDef(host) {
    const s = get(host);
    if (!s) return null;
    return {
      host: s.host, engine: s.engine, base: s.url.base,
      upload: { path: s.publish.upload.path, formPath: s.publish.upload.formPath, fileField: s.publish.upload.fileField, fields: s.publish.upload.fields },
      tagMap: s.publish.tagMap || {}, tagValue: s.publish.tagValue || 'yes',
      verify: { path: s.publish.verify.path },
      catMap: Object.assign({}, s.publish.catMap || {}, s.publish.catLabels || {}),
      catLabels: s.publish.catLabels || {},
      form: s.publish.form || null,
      valueMaps: (function () {
        const base = s.publish.baseValueMaps || {};
        const over = s.publish.valueMaps || {};
        return Object.assign({}, base, over, { team: Object.assign({}, base.team || {}, over.team || {}) });
      })()
    };
  }
  return {
    FILE: SITES_FILE, URL_FILE: URLS_FILE,
    ensureRuntime: ensureRuntime, migrateLegacy: migrateLegacy, legacyDef: legacyDef, targetDef: targetDef, get: get, list: list, has: has,
    save: save, add: add, remove: remove, setHidden: setHidden,
    _b64: b64, _unb64: unb64
  };
}

module.exports = makeSiteStore;
module.exports.makeSiteStore = makeSiteStore;
module.exports.VERSION = VERSION;

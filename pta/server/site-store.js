/* 站点 JSON 仓库：运行时只读 data/sites.json + data/site-urls.json。
   首次启动从 pta/pack/*.preset.json 复制；写入原子写 + SQLite 锁 + .bak。
   不再读 site-defs / site-search / site-maps / sites 表。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('./json-file');
const uploadLock = require('./upload-lock');

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

  function readJson(file, fb) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  }
  function docOf(file, presetFile) {
    let d = readJson(file, null);
    if (d && typeof d === 'object') return d;
    d = readJson(presetFile, null);
    return d && typeof d === 'object' ? d : { version: VERSION, sites: {} };
  }
  function writeDoc(file, doc) {
    try { if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); } catch (e) { /* 备份失败不挡写入 */ }
    jsonFile.writeAtomic(file, doc, 0o600);
  }
  function ensureRuntime() {
    let changed = false;
    if (!fs.existsSync(SITES_FILE)) { writeDoc(SITES_FILE, docOf(SITES_FILE, SITES_PRESET)); changed = true; }
    if (!fs.existsSync(URLS_FILE)) { writeDoc(URLS_FILE, docOf(URLS_FILE, URLS_PRESET)); changed = true; }
    return changed;
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
  return {
    FILE: SITES_FILE, URL_FILE: URLS_FILE,
    ensureRuntime: ensureRuntime, get: get, list: list, has: has,
    save: save, add: add, remove: remove, setHidden: setHidden,
    _b64: b64, _unb64: unb64
  };
}

module.exports = makeSiteStore;
module.exports.makeSiteStore = makeSiteStore;
module.exports.VERSION = VERSION;

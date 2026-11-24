/* 站点 JSON 仓库：运行时只读 data/sites.json + data/site-urls.json。
   首次启动从 pta/pack/*.preset.json 复制；写入原子写 + SQLite 锁 + .bak。
   不再读 site-defs / site-search / site-maps / sites 表。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('../../infra/json-file');
const uploadLock = require('../../infra/upload-lock');
const { openDB } = require('../../infra/db');
const makePresets = require('../presets/store');
const fmt = require('./format');

const VERSION = 1;
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PRESET = path.join(__dirname, '..', '..', '..', 'pack');
const SEARCH_DIMS = ['medium', 'resolution', 'discount', 'restriction', 'codec', 'audio', 'team'];
const ALWAYS_DIM = ['medium', 'resolution', 'discount', 'restriction'];
const SEARCH_KNOWN = ['path', 'params', 'catMode', 'catSlot', 'type', 'medium', 'codec', 'audio',
  'resolution', 'discount', 'restriction', 'team', 'selected', 'labels', 'limits', 'downloadLink', 'refreshCron'];
const PUBLISH_KNOWN = ['upload', 'verify', 'type', 'medium', 'codec', 'audio', 'resolution', 'discount',
  'restriction', 'team', 'tagMap', 'tagValue', 'form', 'valueMaps', 'baseValueMaps'];
const TOP_KNOWN = ['name', 'nameZh', 'engine', 'urlRef', 'search', 'publish', 'settings', 'localEdited',
  'limits', 'downloadLink', 'refreshCron'];
const DEFAULT_PARAM = { medium: 'medium', resolution: 'standard', discount: 'spstate', restriction: 'limit', codec: 'codec', audio: 'audiocodec', team: 'team' };

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
  const presets = makePresets(DIR);

  /* ---------- 新结构 <-> 内部旧结构 ----------
     文件只写 meta / search / publish / settings(+extra)；
     程序内部继续用 name / cats / catMap / filters，避免抓取和发布改一遍。 */
  function uploadOf(u0) {
    const u = u0 && typeof u0 === 'object' ? u0 : {};
    const out = {
      path: String(u.path || ''),
      formPath: String(u.formPath || ''),
      fileField: String(u.fileField || ''),
      fields: u.fields && typeof u.fields === 'object' ? clone(u.fields) : {}
    };
    Object.keys(u).forEach(function (k) {
      if (['path', 'formPath', 'fileField', 'fields'].indexOf(k) < 0) out[k] = clone(u[k]);
    });
    return out;
  }
  function paramOf(pv, key, dim) {    const def = DEFAULT_PARAM[dim] || dim;
    if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
      if (pv[key] !== undefined && pv[key] !== '') return String(pv[key]);
      if (pv['*'] !== undefined && pv['*'] !== '') return String(pv['*']);
      return def;
    }
    return pv != null && pv !== '' ? String(pv) : def;
  }
  function searchFromPersisted(s0) {
    const s = s0 && typeof s0 === 'object' ? s0 : {};
    const out = {
      path: String(s.path || ''),
      params: s.params && typeof s.params === 'object' && !Array.isArray(s.params) ? clone(s.params) : {},
      catMode: String(s.catMode || 'single'),
      catSlot: String(s.catSlot || ''),
      cats: canonCats(s.type || s.cats),
      filters: {}
    };
    const values = {}, params = {}, selected = {}, labels = {};
    SEARCH_DIMS.forEach(function (dim) {
      const src = s[dim];
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      Object.keys(src).forEach(function (group) {
        const list = Array.isArray(src[group]) ? src[group] : [src[group]];
        list.forEach(function (entry) {
          if (entry == null || entry === '') return;
          let key = group, param = DEFAULT_PARAM[dim] || dim, value = '';
          if (entry && typeof entry === 'object') {
            key = entry.key || group;
            param = entry.param || param;
            value = entry.value == null ? '' : String(entry.value);
          } else {
            const withKey = dim === 'medium' || dim === 'team';
            const o = fmt.parseSearchOption(entry, withKey);
            if (withKey && o.key) key = o.key;
            param = o.param || param;
            value = o.value;
          }
          if (value === '') return;
          (values[dim] = values[dim] || {})[key] = value;
          (params[dim] = params[dim] || {})[key] = param;
          if (s.labels && s.labels[dim] && s.labels[dim][key] != null) {
            (labels[dim] = labels[dim] || {})[key] = String(s.labels[dim][key]);
          }
        });
      });
    });
    Object.keys(s.selected || {}).forEach(function (dim) {
      const v = s.selected[dim];
      if (Array.isArray(v) && v.length) selected[dim] = v.map(String);
    });
    if (Object.keys(values).length) out.filters.values = values;
    if (Object.keys(params).length) out.filters.params = params;
    if (Object.keys(selected).length) out.filters.selected = selected;
    if (Object.keys(labels).length || (s.labels && typeof s.labels === 'object')) out.filters.labels = Object.assign({}, s.labels || {}, labels);
    out.limits = s.limits && typeof s.limits === 'object' && !Array.isArray(s.limits) ? clone(s.limits) : {};
    out.downloadLink = String(s.downloadLink || '');
    out.refreshCron = String(s.refreshCron || '');
    Object.keys(s).forEach(function (k) {
      if (SEARCH_KNOWN.indexOf(k) < 0) out[k] = clone(s[k]);
    });
    return out;
  }
  function publishFromPersisted(p0) {
    const p = p0 && typeof p0 === 'object' ? p0 : {};
    const out = {
      upload: uploadOf(p.upload),
      verify: p.verify && typeof p.verify === 'object' ? clone(p.verify) : { path: '' },
      catMap: canonMap(p.type || p.catMap),
      tagMap: p.tagMap && typeof p.tagMap === 'object' ? clone(p.tagMap) : {},
      tagValue: String(p.tagValue || 'yes'),
      form: p.form || null,
      valueMaps: p.valueMaps && typeof p.valueMaps === 'object' ? clone(p.valueMaps) : {}
    };
    if (p.baseValueMaps && typeof p.baseValueMaps === 'object') out.baseValueMaps = clone(p.baseValueMaps);
    SEARCH_DIMS.forEach(function (dim) {
      if (p[dim] !== undefined && p[dim] !== null) out[dim] = clone(p[dim]);
    });
    Object.keys(p).forEach(function (k) {
      if (PUBLISH_KNOWN.indexOf(k) < 0 && k !== 'catMap' && k !== 'catLabels') out[k] = clone(p[k]);
    });
    return out;
  }
  function fromPersistedSite(raw, host) {
    const r = raw && typeof raw === 'object' ? raw : {};
    if (!r.meta || typeof r.meta !== 'object' || Array.isArray(r.meta)) return clone(r);
    const meta = r.meta;
    const search = searchFromPersisted(r.search);
    const rec = {
      name: meta.name !== undefined && meta.name !== '' ? String(meta.name) : host,
      nameZh: String(meta.nameZh || ''),
      engine: String(meta.engine || '?'),
      urlRef: String(meta.urlRef || ('site-urls.json#' + host)),
      search: search,
      publish: publishFromPersisted(r.publish),
      settings: normalizeSettings(r.settings),
      localEdited: meta.localEdited === true,
      limits: clone(search.limits || {}),
      downloadLink: String(search.downloadLink || ''),
      refreshCron: String(search.refreshCron || '')
    };
    delete search.limits;
    delete search.downloadLink;
    delete search.refreshCron;
    if (r.extra && typeof r.extra === 'object' && !Array.isArray(r.extra)) {
      Object.keys(r.extra).forEach(function (k) { if (rec[k] === undefined) rec[k] = clone(r.extra[k]); });
    }
    return rec;
  }
  function searchToPersisted(rec) {
    const s = rec.search || {};
    const flt = s.filters || {};
    const values = flt.values || {};
    const params = flt.params || {};
    const out = {
      path: String(s.path || ''),
      params: s.params && typeof s.params === 'object' && !Array.isArray(s.params) ? clone(s.params) : {},
      catMode: String(s.catMode || 'single'),
      catSlot: String(s.catSlot || ''),
      type: canonCats(s.cats)
    };
    ALWAYS_DIM.forEach(function (dim) { out[dim] = {}; });
    SEARCH_DIMS.forEach(function (dim) {
      const src = values[dim];
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      const dst = out[dim] || {};
      Object.keys(src).forEach(function (key) {
        const v = src[key];
        if (v == null || v === '') return;
        const group = presets.parentOf(dim, key);
        (dst[group] = dst[group] || []).push(fmt.formatSearchOption(key, paramOf(params[dim], key, dim), String(v), dim === 'medium' || dim === 'team'));
      });
      if (Object.keys(dst).length) {
        if (dim !== 'medium') {
          Object.keys(dst).forEach(function (g) { if (dst[g].length === 1) dst[g] = dst[g][0]; });
        }
        out[dim] = dst;
      }
    });
    const selected = {};
    Object.keys(flt.selected || {}).forEach(function (dim) {
      if (Array.isArray(flt.selected[dim]) && flt.selected[dim].length) selected[dim] = flt.selected[dim].map(String);
    });
    if (Object.keys(selected).length) out.selected = selected;
    if (flt.labels && typeof flt.labels === 'object' && Object.keys(flt.labels).length) out.labels = clone(flt.labels);
    out.limits = rec.limits && typeof rec.limits === 'object' && !Array.isArray(rec.limits) ? clone(rec.limits) : {};
    out.downloadLink = String(rec.downloadLink || '');
    out.refreshCron = String(rec.refreshCron || '');
    Object.keys(s).forEach(function (k) {
      if (SEARCH_KNOWN.indexOf(k) < 0 && k !== 'types' && k !== 'cats' && k !== 'filters') out[k] = clone(s[k]);
    });
    return out;
  }
  function publishToPersisted(rec) {
    const p = rec.publish || {};
    const out = {
      upload: uploadOf(p.upload),
      verify: p.verify && typeof p.verify === 'object' ? clone(p.verify) : { path: '' },
      type: canonMap(p.catMap)
    };
    ALWAYS_DIM.forEach(function (dim) {
      out[dim] = p[dim] && typeof p[dim] === 'object' && !Array.isArray(p[dim]) ? clone(p[dim]) : {};
    });
    ['codec', 'audio', 'team'].forEach(function (dim) {
      if (p[dim] && typeof p[dim] === 'object' && Object.keys(p[dim]).length) out[dim] = clone(p[dim]);
    });
    out.tagMap = p.tagMap && typeof p.tagMap === 'object' ? clone(p.tagMap) : {};
    out.tagValue = String(p.tagValue || 'yes');
    out.form = p.form || null;
    out.valueMaps = p.valueMaps && typeof p.valueMaps === 'object' ? clone(p.valueMaps) : {};
    if (p.baseValueMaps && typeof p.baseValueMaps === 'object' && Object.keys(p.baseValueMaps).length) out.baseValueMaps = clone(p.baseValueMaps);
    Object.keys(p).forEach(function (k) {
      if (PUBLISH_KNOWN.indexOf(k) < 0 && k !== 'catMap' && k !== 'catLabels') out[k] = clone(p[k]);
    });
    return out;
  }
  function toPersistedSite(raw, host) {
    const src = raw && raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
      ? fromPersistedSite(raw, host)
      : raw;
    const rec = normalizeRecord(src || {});
    const meta = {
      name: String(rec.name || host),
      nameZh: String(rec.nameZh || ''),
      engine: String(rec.engine || '?'),
      urlRef: String(rec.urlRef || ('site-urls.json#' + host))
    };
    if (rec.localEdited === true) meta.localEdited = true;
    const out = { meta: meta, search: searchToPersisted(rec), publish: publishToPersisted(rec) };
    out.settings = normalizeSettings(rec.settings);
    const extra = {};
    Object.keys(rec).forEach(function (k) {
      if (TOP_KNOWN.indexOf(k) < 0 && k !== 'host' && k !== 'url') extra[k] = clone(rec[k]);
    });
    if (Object.keys(extra).length) out.extra = extra;
    return out;
  }
  function toPersistedDoc(doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    const sites = d.sites && typeof d.sites === 'object' ? d.sites : {};
    const out = {};
    Object.keys(d).forEach(function (k) { if (k !== 'sites') out[k] = clone(d[k]); });
    out.sites = {};
    Object.keys(sites).forEach(function (h) { out.sites[h] = toPersistedSite(sites[h], h); });
    return out;
  }

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
    if (file === SITES_FILE) {
      jsonFile.writeAtomicText(file, fmt.formatSitesDoc(toPersistedDoc(doc)), 0o600);
      CACHE.sites = null;
    } else {
      jsonFile.writeAtomic(file, doc, 0o600);
      CACHE.urls = null;
    }
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
        const publish = canonPublish(legacyPublish(def, mp));
        const cats = (se.cats && Object.keys(se.cats).length) ? se.cats : (def.cats || {});
        const searchRec = canonSearch({ path: String(def.searchPath || '/torrents.php'), params: def.params && typeof def.params === 'object' ? def.params : {}, catMode: String(def.catMode || 'single'), catSlot: String(def.catSlot || ''), cats: cats, filters: (mp && mp.filters) || {} });
        delete searchRec.types;
        const rec = normalizeRecord({
          name: String(d.title || def.title || host), nameZh: String(d.titleZh || d.cn || ''),
          engine: String(def.engine || d.engine || '?'), urlRef: 'site-urls.json#' + host,
          search: searchRec,
          publish: publish, localEdited: false,
          settings: (function () {
            const st = normalizeSettings(Object.assign({}, d, { hidden: hidden.indexOf(host) >= 0 }));
            if (d.enabled === undefined) st.enabled = true;
            return st;
          })()
        });
        delete rec.search.types;
        sites.sites[host] = rec;
        if (base) urls.sites[host] = { base: b64(base), upload: b64((publish.upload && publish.upload.path) || ''), verify: b64((publish.verify && publish.verify.path) || '') };
      });
      writeDoc(SITES_FILE, sites);
      writeDoc(URLS_FILE, urls);
      return Object.keys(sites.sites).length;
    } finally { try { db.close(); } catch (e) { /* 已关 */ } }
  }
  let verified = false;
  function ensureRuntime() {
    const missSites = !fs.existsSync(SITES_FILE);
    const missUrls = !fs.existsSync(URLS_FILE);
    if (missSites || missUrls) {
      if (missSites && missUrls) {
        const n = migrateLegacy();
        if (!n) {
          writeDoc(SITES_FILE, readJson(SITES_PRESET, null) || { version: VERSION, sites: {} });
          writeDoc(URLS_FILE, readJson(URLS_PRESET, null) || { version: VERSION, sites: {} });
        }
      } else {
        if (missSites) writeDoc(SITES_FILE, readJson(SITES_PRESET, null) || { version: VERSION, sites: {} });
        if (missUrls) writeDoc(URLS_FILE, readJson(URLS_PRESET, null) || { version: VERSION, sites: {} });
      }
    }
    /* 旧结构或普通缩进：启动后第一次读就迁成块状格式，只写一次 */
    if (!verified) {
      verified = true;
      try {
        const text = fs.readFileSync(SITES_FILE, 'utf8');
        const raw = JSON.parse(text);
        const want = fmt.formatSitesDoc(toPersistedDoc(raw));
        if (text !== want) writeDoc(SITES_FILE, raw);
      } catch (e) { /* 文件坏了先不覆盖，留给上层报错 */ }
    }
    return missSites || missUrls;
  }
  function siteDoc() {
    ensureRuntime();
    const raw = docOf(SITES_FILE, SITES_PRESET);
    const out = {};
    Object.keys(raw).forEach(function (k) { if (k !== 'sites') out[k] = clone(raw[k]); });
    out.sites = {};
    Object.keys(raw.sites || {}).forEach(function (h) { out.sites[h] = fromPersistedSite(raw.sites[h], h); });
    return out;
  }
  function urlDoc() { ensureRuntime(); return clone(docOf(URLS_FILE, URLS_PRESET)); }
  function defaults() { return { enabled: false, interval: null, priority: 'normal', note: '', hidden: false }; }
  function normalizeSettings(s) { return Object.assign(defaults(), s && typeof s === 'object' ? s : {}); }
  function urlOf(host, urls) {
    const u = (urls.sites || {})[host] || {};
    return { base: unb64(u.base), upload: unb64(u.upload), verify: unb64(u.verify) };
  }
  /* 站点只存 key；中文名由全局预设补，读的时候派生 types 给现有流程用 */
  const TYPE_MOVE = { full_disc: 'other', remux: 'other', encode: 'other', sample: 'other', trailer: 'other' };
  function typeKey(k) { const key = presets.keyOf(k) || String(k); return TYPE_MOVE[key] || key; }
  function canonCats(cats) {
    const out = {};
    if (!cats || typeof cats !== 'object' || Array.isArray(cats)) return out;
    Object.keys(cats).forEach(function (k) {
      const key = typeKey(k);
      const list = Array.isArray(cats[k]) ? cats[k] : (cats[k] == null ? [] : [cats[k]]);
      list.forEach(function (id) {
        if (id == null || id === '') return;
        const v = String(id);
        if (!out[key]) out[key] = [];
        if (out[key].indexOf(v) < 0) out[key].push(v);
      });
    });
    return out;
  }
  function canonMap(map) {
    const out = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
    const all = presets.types();
    /* 已经是标准 key 的优先，避免中文旧值覆盖新值 */
    Object.keys(map).forEach(function (k) {
      if (map[k] == null || map[k] === '' || !all[k]) return;
      if (out[k] == null) out[k] = String(map[k]);
    });
    Object.keys(map).forEach(function (k) {
      if (map[k] == null || map[k] === '') return;
      const key = typeKey(k);
      if (out[key] == null) out[key] = String(map[k]);
    });
    return out;
  }
  function typesOfCats(cats) {
    const out = [];
    Object.keys(cats || {}).forEach(function (k) {
      const zh = presets.labelOf(k);
      if (zh && out.indexOf(zh) < 0) out.push(zh);
    });
    return out;
  }
  const FILTER_DIM = { medium: 'medium', standard: 'resolution', resolution: 'resolution', spstate: 'discount', discount: 'discount', restriction: 'restriction' };
  function canonFilters(flt) {
    const out = { values: {}, selected: {} };
    if (!flt || typeof flt !== 'object' || Array.isArray(flt)) return out;
    if (flt.params && typeof flt.params === 'object' && !Array.isArray(flt.params)) {
      const pm = {};
      Object.keys(flt.params).forEach(function (d) {
        const dim = FILTER_DIM[d] || d;
        const v = flt.params[d];
        if (!v) return;
        if (typeof v === 'object' && !Array.isArray(v)) {
          const one = {};
          Object.keys(v).forEach(function (k) { if (v[k]) one[k] = String(v[k]); });
          if (Object.keys(one).length) pm[dim] = one;
        } else pm[dim] = String(v);
      });
      if (Object.keys(pm).length) out.params = pm;
    }
    function addValue(dim, label, val) {
      const key = dim === 'team' ? String(label || '').trim() : presets.keyOfDim(dim, label);
      if (!key || val == null || val === '') return;
      out.values[dim] = out.values[dim] || {};
      if (out.values[dim][key] == null) out.values[dim][key] = String(val);
    }
    function addSel(dim, x) {
      const key = dim === 'team' ? String(x || '').trim() : presets.keyOfDim(dim, x);
      if (!key) return;
      out.selected[dim] = out.selected[dim] || [];
      if (out.selected[dim].indexOf(key) < 0) out.selected[dim].push(key);
    }
    /* 新格式：values/selected 都已经是 key */
    Object.keys(flt.values || {}).forEach(function (d) {
      const dim = FILTER_DIM[d] || d;
      Object.keys(flt.values[d] || {}).forEach(function (k) { addValue(dim, k, flt.values[d][k]); });
    });
    /* 旧格式：map 是站点选项名 → 值 */
    Object.keys(flt.map || {}).forEach(function (d) {
      const dim = FILTER_DIM[d] || d;
      Object.keys(flt.map[d] || {}).forEach(function (label) { addValue(dim, label, flt.map[d][label]); });
    });
    Object.keys(flt.selected || {}).forEach(function (d) {
      const dim = FILTER_DIM[d] || d;
      (Array.isArray(flt.selected[d]) ? flt.selected[d] : []).forEach(function (x) { addSel(dim, x); });
    });
    Object.keys(flt.selectedLabels || {}).forEach(function (d) {
      const dim = FILTER_DIM[d] || d;
      (Array.isArray(flt.selectedLabels[d]) ? flt.selectedLabels[d] : []).forEach(function (x) { addSel(dim, x); });
    });
    /* 旧格式只有 selectedValues 时，用 map 反查回 key */
    Object.keys(flt.selectedValues || {}).forEach(function (d) {
      const dim = FILTER_DIM[d] || d;
      const map = (flt.map && flt.map[d]) || {};
      (Array.isArray(flt.selectedValues[d]) ? flt.selectedValues[d] : []).forEach(function (v) {
        const label = Object.keys(map).filter(function (l) { return String(map[l]) === String(v); })[0];
        if (label) addSel(dim, label);
      });
    });
    Object.keys(out.values).forEach(function (d) { if (!Object.keys(out.values[d]).length) delete out.values[d]; });
    Object.keys(out.selected).forEach(function (d) { if (!out.selected[d].length) delete out.selected[d]; });
    if (!Object.keys(out.values).length) delete out.values;
    if (!Object.keys(out.selected).length) delete out.selected;
    return out;
  }
  function canonSearch(search) {
    const s0 = clone(search || {});
    s0.cats = canonCats(s0.cats);
    s0.types = typesOfCats(s0.cats);
    s0.filters = canonFilters(s0.filters);
    return s0;
  }
  /* 上传表单只留 target-plan 会读的必填下拉，去掉搜索页/样式类噪声 */
  const FORM_SELECT = /^(type|category|category_id|type_id|source|source_sel|medium|medium_sel|standard|standard_sel|codec|codec_sel|audiocodec|audiocodec_sel|team|team_sel|processing|processing_sel)(\[\d+\])?$/;
  function compactForm(form) {
    if (!form || typeof form !== 'object') return null;
    const out = {};
    if (form.at) out.at = String(form.at);
    if (form.catField) out.catField = String(form.catField);
    if (form.teamField) out.teamField = String(form.teamField);
    const selects = {};
    Object.keys(form.selects || {}).forEach(function (k) { if (FORM_SELECT.test(k)) selects[k] = form.selects[k]; });
    if (Object.keys(selects).length) out.selects = selects;
    const defaults = {};
    Object.keys(form.defaults || {}).forEach(function (k) { if (FORM_SELECT.test(k)) defaults[k] = String(form.defaults[k]); });
    if (Object.keys(defaults).length) out.defaults = defaults;
    if (!out.selects && !out.defaults) return null;
    return out;
  }
  function compactPublish(p0) {
    const form = compactForm(p0.form);
    if (form) p0.form = form; else delete p0.form;
    if (!p0.tagMap || !Object.keys(p0.tagMap).length) delete p0.tagMap;
    if (!p0.baseValueMaps || !Object.keys(p0.baseValueMaps).length) delete p0.baseValueMaps;
    if (p0.valueMaps) {
      if (!p0.valueMaps.team || !Object.keys(p0.valueMaps.team).length) delete p0.valueMaps.team;
      if (!Object.keys(p0.valueMaps).length) delete p0.valueMaps;
    }
    if (p0.upload && !p0.upload.path && !p0.upload.formPath && !p0.upload.fileField && !Object.keys(p0.upload.fields || {}).length) delete p0.upload;
    if (p0.verify && !p0.verify.path) delete p0.verify;
    return p0;
  }
  function canonPublish(publish) {
    const p0 = clone(publish || {});
    p0.catMap = canonMap(p0.catMap);
    delete p0.catLabels;
    return compactPublish(p0);
  }
  function isPlain(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function mergeDefaults(base, def) {
    const out = clone(base || {});
    Object.keys(def || {}).forEach(function (k) {
      if (out[k] === undefined) out[k] = (def[k] && typeof def[k] === 'object') ? clone(def[k]) : def[k];
      else if (isPlain(out[k]) && isPlain(def[k])) out[k] = mergeDefaults(out[k], def[k]);
    });
    return out;
  }
  /* 全局站点模板：补齐缺失字段，但不覆盖用户已有值；未知字段原样保留 */
  function normalizeRecord(raw) {
    const out = mergeDefaults(raw, presets.siteDefaults());
    out.search = canonSearch(out.search);
    delete out.search.types;
    out.publish = canonPublish(out.publish);
    out.settings = normalizeSettings(out.settings);
    out.limits = isPlain(out.limits) ? clone(out.limits) : {};
    out.downloadLink = String(out.downloadLink || '');
    out.refreshCron = String(out.refreshCron || '');
    return out;
  }
  function recordOf(host, sites, urls) {
    const raw = (sites.sites || {})[host];
    if (!raw) return null;
    const rec = normalizeRecord(raw);
    rec.search.types = typesOfCats(rec.search.cats);
    rec.host = host;
    rec.name = String(raw.name || host);
    rec.nameZh = String(raw.nameZh || '');
    rec.engine = String(raw.engine || '?');
    rec.urlRef = String(raw.urlRef || ('site-urls.json#' + host));
    rec.localEdited = raw.localEdited === true;
    rec.url = urlOf(host, urls);
    return rec;
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
      let cur = normalizeRecord(sites.sites[h] || {
        name: h, nameZh: '', engine: '?', urlRef: 'site-urls.json#' + h,
        search: { path: '', params: {}, cats: {} },
        publish: { upload: { path: '', formPath: '', fileField: '', fields: {} }, verify: { path: '' }, catMap: {} },
        settings: defaults(), localEdited: false
      });
      ['name', 'nameZh', 'engine'].forEach(function (k) { if (p[k] !== undefined) cur[k] = p[k]; });
      /* 站点专有字段（limits/downloadLink/refreshCron 以及以后新增的）原样写回，不丢 */
      Object.keys(p).forEach(function (k) {
        if (['name', 'nameZh', 'engine', 'search', 'publish', 'settings', 'localEdited', 'url', 'host'].indexOf(k) < 0) cur[k] = clone(p[k]);
      });
      cur.search = canonSearch(p.search !== undefined ? p.search : cur.search);
      delete cur.search.types;
      cur.publish = canonPublish(p.publish !== undefined ? p.publish : cur.publish);
      if (p.settings !== undefined) cur.settings = normalizeSettings(Object.assign({}, cur.settings, p.settings));
      if (p.localEdited !== undefined) cur.localEdited = p.localEdited === true;
      else cur.localEdited = true;
      if (!cur.urlRef) cur.urlRef = 'site-urls.json#' + h;
      cur = normalizeRecord(cur);
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
    Object.keys(s.search.cats || {}).forEach(function (key) {
      const label = presets.labelOf(key) || String(key);
      (s.search.cats[key] || []).forEach(function (id) { catList.push({ id: String(id), label: label, purpose: key }); });
    });
    return {
      host: s.host, engine: s.engine, base: s.url.base,
      searchPath: s.search.path, params: s.search.params || {}, catMode: s.search.catMode || 'single', catSlot: s.search.catSlot || '', filters: s.search.filters || {},
      cats: s.search.cats || {}, catList: catList, types: s.search.types || [],
      limits: s.limits || {}, downloadLink: s.downloadLink || '', refreshCron: s.refreshCron || '',
      upload: s.publish.upload || {}, verify: s.publish.verify || {},
      catMap: s.publish.catMap || {},
      enabled: s.settings.enabled !== false, hidden: s.settings.hidden === true
    };
  }
  function targetDef(host) {
    const s = get(host);
    if (!s) return null;
    const catMap = canonMap(s.publish.catMap);
    Object.keys(catMap).forEach(function (k) {
      const zh = presets.labelOf(k);
      if (zh && catMap[zh] == null) catMap[zh] = catMap[k];
    });
    return {
      host: s.host, engine: s.engine, base: s.url.base,
      limits: s.limits || {}, downloadLink: s.downloadLink || '', refreshCron: s.refreshCron || '',
      upload: Object.assign({ path: '', formPath: '', fileField: '', fields: {} }, s.publish.upload || {}),
      tagMap: s.publish.tagMap || {}, tagValue: s.publish.tagValue || 'yes',
      verify: { path: (s.publish.verify && s.publish.verify.path) || '' },
      catMap: catMap,
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
    canonCats: canonCats, canonMap: canonMap, typesOfCats: typesOfCats, canonSearch: canonSearch, canonPublish: canonPublish, normalizeRecord: normalizeRecord,
    fromPersisted: fromPersistedSite, toPersisted: toPersistedSite, toPersistedDoc: toPersistedDoc,
    _b64: b64, _unb64: unb64
  };
}

module.exports = makeSiteStore;
module.exports.makeSiteStore = makeSiteStore;
module.exports.VERSION = VERSION;

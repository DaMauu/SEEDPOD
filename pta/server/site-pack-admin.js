/* 站点包例外：读内置包算覆盖率，确认后只写私有 data/site-defs，不改密文包。 */
const fs = require('fs');
const path = require('path');
const sitePack = require('./site-pack');
const categories = require('./categories');

const PURPOSES = new Set(categories.PURPOSES.map(function (p) { return p.v; }));

function safeHost(host) {
  return /^[a-z0-9][a-z0-9.-]*$/i.test(String(host || '')) && String(host || '').length <= 253;
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function privateDef(dataDir, host) {
  return readJson(path.join(dataDir, 'site-defs', host + '.json'), null);
}
function catListOf(site) {
  const s = site || {};
  if (Array.isArray(s.catList)) {
    return s.catList.map(function (x) {
      return { id: String(x && x.id != null ? x.id : ''), label: String(x && x.label || ''), purpose: String(x && x.purpose || 'other') };
    });
  }
  if (Array.isArray(s.catMap)) {
    return s.catMap.map(function (x) {
      return { id: String(x && x.id != null ? x.id : ''), label: String(x && x.label || ''), purpose: String(x && x.purpose || 'other') };
    });
  }
  const out = [];
  if (s.catMap && typeof s.catMap === 'object') {
    Object.keys(s.catMap).forEach(function (p) {
      out.push({ id: String(s.catMap[p]), label: String(s.catMap[p]), purpose: String(p) });
    });
  }
  if (s.cats && typeof s.cats === 'object') {
    Object.keys(s.cats).forEach(function (p) {
      (Array.isArray(s.cats[p]) ? s.cats[p] : []).forEach(function (id) {
        out.push({ id: String(id), label: String(id), purpose: String(p) });
      });
    });
  }
  return out;
}
function privatePurposes(def) {
  const out = {};
  if (!def) return out;
  /* 只认例外确认写入的 catList；生成包的源 site-defs 里的 catMap 不拿来覆盖自动匹配。 */
  if (Array.isArray(def.catList)) {
    def.catList.forEach(function (x) {
      if (x && x.id != null && x.purpose) out[String(x.id)] = String(x.purpose);
    });
  }
  return out;
}
function privateCount(dataDir) {
  let n = 0;
  try { n += fs.readdirSync(path.join(dataDir, 'site-defs')).filter(function (f) { return /\.json$/.test(f); }).length; } catch (e) { /* 目录不存在 */ }
  return n;
}
function overview(ctx, opts) {
  const o = opts || {};
  const dataDir = ctx.DATA_DIR;
  const status = sitePack.status(o);
  const result = {
    available: false, reason: status.reason || '', status: status,
    coverage: { total: 0, mapped: 0, other: 0, percent: 0 },
    privateSites: privateCount(dataDir), totalExceptions: 0, exceptions: [],
    purposes: categories.PURPOSES
  };
  const r = sitePack.load(o);
  if (!r.ok) return result;
  result.available = true;
  const q = String(o.q || '').trim().toLowerCase();
  const hostFilter = String(o.host || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(1000, Number(o.limit) || 200));
  let total = 0, mapped = 0, other = 0, totalExceptions = 0;
  const exceptions = [];
  Object.keys(r.pack.sites || {}).forEach(function (host) {
    if (hostFilter && host !== hostFilter) return;
    const site = (r.pack.sites || {})[host] || {};
    const list = catListOf(site);
    const priv = privatePurposes(privateDef(dataDir, host));
    list.forEach(function (c) {
      const purpose = priv[c.id] || c.purpose || 'other';
      total++;
      if (purpose === 'other') { other++; totalExceptions++; } else { mapped++; }
      if (purpose !== 'other') return;
      const needle = (host + ' ' + c.id + ' ' + c.label).toLowerCase();
      if (q && needle.indexOf(q) < 0) return;
      exceptions.push({
        host: host, id: c.id, label: c.label, current: 'other',
        suggested: categories.suggest(c.label)
      });
    });
  });
  exceptions.sort(function (a, b) {
    return String(a.label || '').localeCompare(String(b.label || '')) || a.host.localeCompare(b.host) || a.id.localeCompare(b.id);
  });
  result.coverage = { total: total, mapped: mapped, other: other, percent: total ? Math.round(mapped / total * 1000) / 10 : 0 };
  result.totalExceptions = totalExceptions;
  result.exceptions = exceptions.slice(0, limit);
  return result;
}
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* 退化为忙等 */ }
}
/* 跨进程互斥：mkdir 是原子的；锁目录超过 15 秒视为残留 */
function acquireLock(dir) {
  const lock = path.join(dir, '.site-pack.lock');
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(lock, { mode: 0o700 }); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let st;
      try { st = fs.statSync(lock); } catch (e2) { continue; }
      if (Date.now() - st.mtimeMs > 15000) { try { fs.rmdirSync(lock); } catch (e3) { /* 别人刚删 */ } continue; }
      const waitMs = Number(require('./env').read('SITE_PACK_LOCK_WAIT_MS', 'PTA_SITE_PACK_LOCK_WAIT_MS') || 5000);
      if (Date.now() - t0 > Math.max(50, Math.min(60000, waitMs))) throw new Error('站点包正在写入，稍后重试');
      sleepSync(20);
    }
  }
  return function () { try { fs.rmdirSync(lock); } catch (e) { /* 已释放 */ } };
}

function confirm(ctx, body, opts) {
  const b = body || {};
  const host = String(b.host || '').trim().toLowerCase();
  if (!safeHost(host)) return { ok: false, code: 'BAD_HOST', message: '站点域名不合法', http: 400 };
  const rawIds = (Array.isArray(b.ids) ? b.ids : [b.id]).map(function (x) { return String(x == null ? '' : x); }).filter(Boolean);
  const ids = Array.from(new Set(rawIds)).slice(0, 500);
  if (!ids.length) return { ok: false, code: 'BAD_CATEGORY', message: '至少选一个分类', http: 400 };
  const purpose = String(b.purpose || '');
  if (!PURPOSES.has(purpose)) return { ok: false, code: 'BAD_PURPOSE', message: '分类用途不合法', http: 400 };
  const r = sitePack.load(opts || {});
  if (!r.ok) return { ok: false, code: 'SITE_PACK_UNAVAILABLE', message: '站点包没解密：' + r.reason, http: 409 };
  const built = (r.pack.sites || {})[host];
  if (!built) return { ok: false, code: 'NO_SITE', message: '站点包里没有这个站', http: 404 };
  const dataDir = ctx.DATA_DIR;
  const dir = path.join(dataDir, 'site-defs');
  let release;
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    release = acquireLock(dir);
  } catch (e) {
    return { ok: false, code: 'SITE_PACK_BUSY', message: '站点包正在写入，稍后重试', http: 409 };
  }
  try {
    /* 测试钩子：持锁后延迟，用来复现并发读改写 */
    const delay = Number(require('./env').read('SITE_PACK_TEST_DELAY_MS', 'PTA_SITE_PACK_TEST_DELAY_MS') || 0);
    if (delay > 0 && delay < 5000) sleepSync(delay);
    const priv = privateDef(dataDir, host) || {};
    const source = (Array.isArray(priv.catList) && priv.catList.length) ? priv.catList : catListOf(built);
    const list = source.map(function (x) {
      return { id: String(x && x.id != null ? x.id : ''), label: String(x && x.label || ''), purpose: String(x && x.purpose || 'other') };
    });
    let changed = 0;
    list.forEach(function (x) {
      if (ids.indexOf(String(x.id)) >= 0) { x.purpose = purpose; changed++; }
    });
    if (!changed) return { ok: false, code: 'NO_CATEGORY', message: '站点包里没有这些分类', http: 404 };
    const cats = {};
    list.forEach(function (x) { (cats[x.purpose] = cats[x.purpose] || []).push(String(x.id)); });
    const catMap = {};
    Object.keys(cats).forEach(function (p) { if (cats[p].length) catMap[p] = String(cats[p][0]); });
    const next = Object.assign({}, priv, { catList: list, cats: cats, catMap: catMap });
    delete next._catStats;
    const file = path.join(dir, host + '.json');
    const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, file);
    return { ok: true, data: { host: host, ids: ids, purpose: purpose, changed: changed, saved: true, at: new Date().toISOString() } };
  } finally {
    release();
  }
}

module.exports = { overview: overview, confirm: confirm, catListOf: catListOf, privatePurposes: privatePurposes };

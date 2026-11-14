/* 内置站点包加载：只解密、校验、缓存；不含 cookie/凭据。
   包文件默认 pta/pack/site-pack.enc；密钥只从 PTA_SITE_PACK_KEY 读。
   缺密钥/坏包时返回 ok:false，调用方回退私有 data/ 定义，不阻塞启动。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');

const DEFAULT_FILE = path.join(__dirname, '..', 'pack', 'site-pack.enc');
const cache = { file: '', mtime: 0, keyHash: '', result: null };

function fail(reason) { return { ok: false, reason: reason }; }

function keyHash(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex').slice(0, 16);
}

function load(opts) {
  const o = opts || {};
  const file = o.file || process.env.PTA_SITE_PACK_FILE || DEFAULT_FILE;
  const rawKey = o.key !== undefined ? o.key : process.env.PTA_SITE_PACK_KEY;
  const key = secretbox.parseKey(rawKey);
  if (!key) return fail('NO_KEY');
  let st;
  try { st = fs.statSync(file); } catch (e) { return fail('NO_PACK'); }
  const kh = keyHash(rawKey);
  if (cache.result && cache.file === file && cache.mtime === st.mtimeMs && cache.keyHash === kh) return cache.result;
  let pack;
  try {
    const payload = fs.readFileSync(file, 'utf8').trim();
    const json = secretbox.decrypt(payload, key);
    pack = JSON.parse(json);
  } catch (e) {
    const result = fail('BAD_PACK');
    cache.file = file; cache.mtime = st.mtimeMs; cache.keyHash = kh; cache.result = result;
    return result;
  }
  if (!pack || pack.v !== 1 || !pack.sites || typeof pack.sites !== 'object' || Array.isArray(pack.sites)) {
    const result = fail('BAD_PACK');
    cache.file = file; cache.mtime = st.mtimeMs; cache.keyHash = kh; cache.result = result;
    return result;
  }
  const result = { ok: true, pack: pack, file: file, loadedAt: new Date().toISOString() };
  cache.file = file; cache.mtime = st.mtimeMs; cache.keyHash = kh; cache.result = result;
  return result;
}

function status(opts) {
  const r = load(opts);
  if (!r.ok) return { ok: false, reason: r.reason, sites: 0, version: 0, updatedAt: '' };
  return { ok: true, reason: '', sites: Object.keys(r.pack.sites || {}).length,
    version: Number(r.pack.version || r.pack.v || 0), updatedAt: r.pack.updatedAt || '', loadedAt: r.loadedAt };
}

function siteOf(host, opts) {
  const r = load(opts);
  if (!r.ok) return null;
  return (r.pack.sites || {})[String(host || '').toLowerCase()] || null;
}

function reset() {
  cache.file = ''; cache.mtime = 0; cache.keyHash = ''; cache.result = null;
}

module.exports = { load: load, status: status, siteOf: siteOf, reset: reset, DEFAULT_FILE: DEFAULT_FILE };

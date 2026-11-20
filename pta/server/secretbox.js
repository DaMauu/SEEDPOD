/* 凭据加密：AES-256-GCM。密钥来源优先级：SECRET → SECRET_FILE → data/.secret（自动生成，0600）。
   密钥与密文都不入库；解密接口永不回显明文。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^[0-9a-f]{64}$/i.test(s)) return Buffer.from(s, 'hex');
  try {
    const b = Buffer.from(s, 'base64');
    if (b.length === 32) return b;
  } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  if (s.length === 32) return Buffer.from(s, 'utf8');
  return null;
}

/* 密钥 id 只用于选key，不泄露密钥本身 */
function keyId(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
}
function readKeyList(raw) {
  return String(raw || '').split(/[,\s]+/).map(parseKey).filter(Boolean);
}

/* 显式密钥无效/目录不可写时，同一进程内复用同一个临时 key；否则各模块各生成一把，密文互相解不开 */
const FALLBACK_KEYS = new Map();
function fallbackKey(tag) {
  const id = String(tag || 'default');
  if (!FALLBACK_KEYS.has(id)) FALLBACK_KEYS.set(id, crypto.randomBytes(32));
  return FALLBACK_KEYS.get(id);
}

function loadKey(dataDir) {
  const explicit = String(require('./env').read('SECRET','PTA_SECRET') || '').trim();
  const previous = readKeyList(require('./env').read('SECRET_PREVIOUS','PTA_SECRET_PREVIOUS'));
  if (explicit) {
    const fromEnv = parseKey(explicit);
    if (fromEnv) return { key: fromEnv, keys: [fromEnv].concat(previous), oldKeys: previous, keyId: keyId(fromEnv), source: 'env', ok: true };
    // 显式给了密钥但解不开：不要回退生成新 key，避免把旧密文“洗掉”
    console.warn('[seedpod] SECRET 格式不对，拒绝生成新 key');
    const fallback = fallbackKey('env:' + String(dataDir || ''));
    return { key: fallback, keys: [fallback].concat(previous), oldKeys: previous, keyId: keyId(fallback), source: 'invalid-env-secret', ok: false, reason: 'SECRET 格式不对' };
  }
  const secretFile = String(require('./env').read('SECRET_FILE','PTA_SECRET_FILE') || '').trim();
  if (secretFile) {
    try {
      const k = parseKey(fs.readFileSync(secretFile, 'utf8'));
      if (k) return { key: k, keys: [k].concat(previous), oldKeys: previous, keyId: keyId(k), source: 'secret-file', ok: true };
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    // 显式指定了密钥文件但读不到/无效：不要偷偷写 data/.secret
    console.warn('[seedpod] SECRET_FILE 读不到或格式不对，拒绝生成 data/.secret');
    const fallback = fallbackKey('file:' + String(dataDir || ''));
    return { key: fallback, keys: [fallback].concat(previous), oldKeys: previous, keyId: keyId(fallback), source: 'invalid-secret-file', ok: false, reason: 'SECRET_FILE 读不到或格式不对' };
  }
  const file = path.join(dataDir, '.secret');
  try {
    const k = parseKey(fs.readFileSync(file, 'utf8'));
    if (k) {
      /* 同目录 .secret.previous：一行一个旧 key，用于轮换过渡 */
      let old = previous.slice();
      try { old = old.concat(readKeyList(fs.readFileSync(file + '.previous', 'utf8'))); } catch (e) { /* 没有旧 key 文件 */ }
      return { key: k, keys: [k].concat(old), oldKeys: old, keyId: keyId(k), source: 'file', ok: true };
    }
  } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(file, generated.toString('hex') + '\n', { mode: 0o600 });
  } catch (e) {
    const fallback = fallbackKey('memory:' + String(dataDir || ''));
    return { key: fallback, keys: [fallback].concat(previous), oldKeys: previous, keyId: keyId(fallback), source: 'memory', ok: false, reason: '数据目录不可写，密钥只在内存' };
  }
  return { key: generated, keys: [generated].concat(previous), oldKeys: previous, keyId: keyId(generated), source: 'generated', ok: true };
}

function status(dataDir) {
  const k = loadKey(dataDir);
  return { ok: k.ok !== false, source: k.source, reason: k.reason || '', keyId: k.keyId, oldKeys: (k.oldKeys || []).length };
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  /* v2 带 key id：轮换后知道用哪把钥匙解；v1 旧密文继续可读 */
  return 'v2:' + keyId(key) + ':' + Buffer.concat([iv, tag, ct]).toString('base64');
}

function keysOf(keyOrRing) {
  if (keyOrRing && Array.isArray(keyOrRing.keys)) return keyOrRing.keys;
  if (keyOrRing && Buffer.isBuffer(keyOrRing)) return [keyOrRing];
  return [];
}
function openWith(key, iv, tag, ct) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
function decrypt(payload, keyOrRing) {
  const s = String(payload || '');
  const keys = keysOf(keyOrRing);
  if (!keys.length) throw new Error('没有可用密钥');
  if (s.slice(0, 3) === 'v1:') {
    const raw = Buffer.from(s.slice(3), 'base64');
    const iv = raw.slice(0, 12), tag = raw.slice(12, 28), ct = raw.slice(28);
    let last = null;
    for (const key of keys) {
      try { return openWith(key, iv, tag, ct); } catch (e) { last = e; }
    }
    throw last || new Error('密文解不开');
  }
  if (s.slice(0, 3) === 'v2:') {
    const rest = s.slice(3);
    const cut = rest.indexOf(':');
    if (cut < 0) throw new Error('不认识的密文格式');
    const id = rest.slice(0, cut);
    const raw = Buffer.from(rest.slice(cut + 1), 'base64');
    const iv = raw.slice(0, 12), tag = raw.slice(12, 28), ct = raw.slice(28);
    const ordered = keys.slice().sort(function (a, b) { return (keyId(a) === id ? -1 : 0) - (keyId(b) === id ? -1 : 0); });
    let last = null;
    for (const key of ordered) {
      try { return openWith(key, iv, tag, ct); } catch (e) { last = e; }
    }
    throw last || new Error('密文解不开');
  }
  throw new Error('不认识的密文格式');
}

module.exports = { loadKey: loadKey, status: status, encrypt: encrypt, decrypt: decrypt, parseKey: parseKey, keyId: keyId, readKeyList: readKeyList };

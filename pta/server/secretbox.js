/* 凭据加密：AES-256-GCM。密钥来源优先级：PTA_SECRET → PTA_SECRET_FILE → data/.secret（自动生成，0600）。
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

function loadKey(dataDir) {
  const explicit = String(process.env.PTA_SECRET || '').trim();
  if (explicit) {
    const fromEnv = parseKey(explicit);
    if (fromEnv) return { key: fromEnv, source: 'env', ok: true };
    // 显式给了密钥但解不开：不要回退生成新 key，避免把旧密文“洗掉”
    console.warn('[seedpod] PTA_SECRET 格式不对，拒绝生成新 key');
    return { key: crypto.randomBytes(32), source: 'invalid-env-secret', ok: false, reason: 'PTA_SECRET 格式不对' };
  }
  const secretFile = String(process.env.PTA_SECRET_FILE || '').trim();
  if (secretFile) {
    try {
      const k = parseKey(fs.readFileSync(secretFile, 'utf8'));
      if (k) return { key: k, source: 'secret-file', ok: true };
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    // 显式指定了密钥文件但读不到/无效：不要偷偷写 data/.secret
    console.warn('[seedpod] PTA_SECRET_FILE 读不到或格式不对，拒绝生成 data/.secret');
    return { key: crypto.randomBytes(32), source: 'invalid-secret-file', ok: false, reason: 'PTA_SECRET_FILE 读不到或格式不对' };
  }
  const file = path.join(dataDir, '.secret');
  try {
    const k = parseKey(fs.readFileSync(file, 'utf8'));
    if (k) return { key: k, source: 'file', ok: true };
  } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(file, generated.toString('hex') + '\n', { mode: 0o600 });
  } catch (e) {
    return { key: generated, source: 'memory', ok: false, reason: '数据目录不可写，密钥只在内存' };
  }
  return { key: generated, source: 'generated', ok: true };
}

function status(dataDir) {
  const k = loadKey(dataDir);
  return { ok: k.ok !== false, source: k.source, reason: k.reason || '' };
}

function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return 'v1:' + Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(payload, key) {
  const s = String(payload || '');
  if (s.slice(0, 3) !== 'v1:') throw new Error('不认识的密文格式');
  const raw = Buffer.from(s.slice(3), 'base64');
  const iv = raw.slice(0, 12), tag = raw.slice(12, 28), ct = raw.slice(28);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

module.exports = { loadKey: loadKey, status: status, encrypt: encrypt, decrypt: decrypt, parseKey: parseKey };

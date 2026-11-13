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
  } catch (e) {}
  if (s.length === 32) return Buffer.from(s, 'utf8');
  return null;
}

function loadKey(dataDir) {
  const fromEnv = parseKey(process.env.PTA_SECRET);
  if (fromEnv) return { key: fromEnv, source: 'env' };
  const secretFile = String(process.env.PTA_SECRET_FILE || '').trim();
  if (secretFile) {
    try {
      const k = parseKey(fs.readFileSync(secretFile, 'utf8'));
      if (k) return { key: k, source: 'secret-file' };
    } catch (e) {}
  }
  const file = path.join(dataDir, '.secret');
  try {
    const k = parseKey(fs.readFileSync(file, 'utf8'));
    if (k) return { key: k, source: 'file' };
  } catch (e) {}
  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(file, generated.toString('hex') + '\n', { mode: 0o600 });
  } catch (e) {
    return { key: generated, source: 'memory' };
  }
  return { key: generated, source: 'generated' };
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

module.exports = { loadKey: loadKey, encrypt: encrypt, decrypt: decrypt, parseKey: parseKey };

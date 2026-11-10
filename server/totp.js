/* TOTP（RFC 6238）：只用 Node 内置 crypto，无依赖。
   base32 解码按 RFC 4648，忽略空格、大小写不敏感。 */
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const s = String(input || '').replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
  if (!s) return Buffer.alloc(0);
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('不是合法的 base32：' + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key, counter, digits, algo) {
  const d = digits || 6;
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const mac = crypto.createHmac((algo || 'sha1').replace('-', '').toLowerCase(), key).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(code % Math.pow(10, d)).padStart(d, '0');
}

/* secret 可以是 base32 字符串，也可以是 Buffer；t 是毫秒时间戳 */
function totp(secret, opts) {
  const o = opts || {};
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const step = o.step || 30;
  const now = o.t === undefined ? Date.now() : o.t;
  const counter = Math.floor(now / 1000 / step);
  return hotp(key, counter, o.digits || 6, o.algo);
}

/* 校验：允许前后各 1 个时间窗的容错 */
function verify(token, secret, opts) {
  const o = opts || {};
  const want = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(want)) return false;
  const now = o.t === undefined ? Date.now() : o.t;
  const step = (o.step || 30) * 1000;
  for (let i = -1; i <= 1; i++) {
    if (totp(secret, { t: now + i * step, digits: want.length, step: o.step, algo: o.algo }) === want) return true;
  }
  return false;
}

module.exports = { base32Decode: base32Decode, hotp: hotp, totp: totp, verify: verify };

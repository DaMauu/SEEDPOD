/* 种子清洗：只替换 announce / announce-list，保留 info 原始字节。
   这样 infohash 不变，qB 才能跨站辅种；不读写 cookie/passkey 以外的站点配置。 */
const crypto = require('crypto');

function bad(msg) { throw new Error(msg || '不是合法种子'); }

function readString(buf, i) {
  const c = buf.indexOf(0x3a, i); // ':'
  if (c < 0) bad('字符串长度缺失');
  const head = buf.slice(i, c).toString('utf8');
  if (!/^\d+$/.test(head)) bad('字符串长度不合法');
  const len = Number(head);
  const start = c + 1;
  const end = start + len;
  if (end > buf.length) bad('字符串越界');
  return { value: buf.slice(start, end), raw: buf.slice(i, end), next: end };
}

function readInt(buf, i) {
  const e = buf.indexOf(0x65, i); // 'e'
  if (e < 0) bad('整数未结束');
  return { raw: buf.slice(i, e + 1), next: e + 1 };
}

function skipValue(buf, i) {
  const c = buf[i];
  if (c === 0x69) return readInt(buf, i).next; // i
  if (c >= 0x30 && c <= 0x39) return readString(buf, i).next; // digit
  if (c === 0x6c) { // l
    i++;
    while (i < buf.length && buf[i] !== 0x65) i = skipValue(buf, i);
    if (buf[i] !== 0x65) bad('列表未结束');
    return i + 1;
  }
  if (c === 0x64) { // d
    i++;
    while (i < buf.length && buf[i] !== 0x65) {
      const k = readString(buf, i);
      i = skipValue(buf, k.next);
    }
    if (buf[i] !== 0x65) bad('字典未结束');
    return i + 1;
  }
  return bad('未知 bencode 类型');
}

function topEntries(buf) {
  if (!Buffer.isBuffer(buf) || buf[0] !== 0x64) bad('种子应以 d 开头');
  const entries = [];
  let i = 1;
  while (i < buf.length && buf[i] !== 0x65) {
    const k = readString(buf, i);
    const key = k.value.toString('utf8');
    const start = k.next;
    const end = skipValue(buf, start);
    entries.push({ key: key, keyRaw: k.raw, valueRaw: buf.slice(start, end) });
    i = end;
  }
  if (buf[i] !== 0x65) bad('字典未结束');
  return entries;
}

function strBuf(s) {
  const b = Buffer.from(String(s), 'utf8');
  return Buffer.concat([Buffer.from(b.length + ':', 'ascii'), b]);
}

function announceOf(buf) {
  const e = topEntries(buf).filter(function (x) { return x.key === 'announce'; })[0];
  if (!e) return '';
  try { return readString(e.valueRaw, 0).value.toString('utf8'); } catch (err) { return ''; }
}

function infoHashOf(buf) {
  const e = topEntries(buf).filter(function (x) { return x.key === 'info'; })[0];
  if (!e) bad('缺少 info');
  return crypto.createHash('sha1').update(e.valueRaw).digest('hex');
}

function replaceAnnounce(buf, announce) {
  const target = String(announce || '').trim();
  if (!/^https?:\/\//i.test(target)) bad('announce 必须是 http/https');
  const beforeHash = infoHashOf(buf);
  const entries = topEntries(buf);
  let found = false;
  const out = entries.map(function (e) {
    if (e.key === 'announce') {
      found = true;
      return Buffer.concat([e.keyRaw, strBuf(target)]);
    }
    if (e.key === 'announce-list') {
      return Buffer.concat([e.keyRaw, Buffer.from('ll'), strBuf(target), Buffer.from('ee')]);
    }
    return Buffer.concat([e.keyRaw, e.valueRaw]);
  });
  if (!found) out.unshift(Buffer.concat([strBuf('announce'), strBuf(target)]));
  const next = Buffer.concat([Buffer.from('d'), Buffer.concat(out), Buffer.from('e')]);
  if (infoHashOf(next) !== beforeHash) bad('清洗后 infohash 变了');
  return next;
}

function clean(buf, announce) {
  const before = announceOf(buf);
  const out = replaceAnnounce(buf, announce);
  return { buf: out, announce: String(announce), beforeAnnounce: before, infohash: infoHashOf(out) };
}

module.exports = { announceOf: announceOf, infoHashOf: infoHashOf, replaceAnnounce: replaceAnnounce, clean: clean };

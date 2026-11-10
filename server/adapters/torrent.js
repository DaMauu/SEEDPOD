/* BitTorrent 种子文件的解析：bencode 解码 + infohash / 体积 / 名字。
   纯函数、零依赖，用来说明「这条种子是不是同一个」——交叉做种先比 infohash，再退回标题+大小。
   参考做法：infohash = SHA1(bencode(info))，与 qBittorrent 报的 hash 一致。 */
const crypto = require('crypto');

function decode(buf) {
  let i = 0;
  function fail(why) { throw new Error('bencode: ' + why + ' @' + i); }
  function parse() {
    if (i >= buf.length) fail('意外结束');
    const c = buf[i];
    if (c === 0x69) {                       /* i123e */
      i++;
      const s0 = i;
      while (i < buf.length && buf[i] !== 0x65) i++;
      if (i >= buf.length) fail('整数没闭合');
      const v = Number(buf.slice(s0, i).toString('latin1'));
      i++;                                  /* 跳过 e */
      if (!Number.isFinite(v)) fail('整数不合法');
      return v;
    }
    if (c === 0x6c) {                       /* l...e */
      i++;
      const arr = [];
      while (i < buf.length && buf[i] !== 0x65) arr.push(parse());
      if (i >= buf.length) fail('列表没闭合');
      i++;
      return arr;
    }
    if (c === 0x64) {                       /* d...e */
      i++;
      const obj = {};
      while (i < buf.length && buf[i] !== 0x65) {
        const k = parse();
        if (typeof k !== 'string') fail('字典键不是字符串');
        obj[k] = parse();
      }
      if (i >= buf.length) fail('字典没闭合');
      i++;
      return obj;
    }
    if (c >= 0x30 && c <= 0x39) {           /* 3:abc */
      const s = start();
      const n = Number(s);
      if (!Number.isFinite(n) || i + n > buf.length) fail('字符串长度不合法');
      const out = buf.slice(i, i + n).toString('binary');
      i += n;
      return out;
    }
    return fail('未知标记 ' + String.fromCharCode(c));
  }
  function start() {
    let s = i;
    while (i < buf.length && buf[i] !== 0x3a) i++;
    if (i >= buf.length) throw new Error('bencode: 缺分隔符');
    const out = buf.slice(s, i).toString('latin1');
    i++;                                    /* 跳过 : */
    return out;
  }
  return parse();
}

/* 用原始字节切出 info 段：keeps 排序与字符集不变，infohash 才不会算错。
   注意整数也以 e 结尾，不能简单数 e 配对，要按 bencode 结构跳过去。 */
function valueEnd(buf, start) {
  let i = start;
  const c = buf[i];
  if (c === 0x69) {                       /* i...e */
    i++;
    while (i < buf.length && buf[i] !== 0x65) i++;
    return i + 1;
  }
  if (c === 0x6c || c === 0x64) {         /* l...e / d...e */
    const isDict = c === 0x64;
    i++;
    while (i < buf.length && buf[i] !== 0x65) {
      if (isDict) i = valueEnd(buf, i);   /* 键 */
      i = valueEnd(buf, i);               /* 值 */
    }
    return i + 1;
  }
  if (c >= 0x30 && c <= 0x39) {           /* 长度:内容 */
    let s = i;
    while (i < buf.length && buf[i] !== 0x3a) i++;
    const n = Number(buf.slice(s, i).toString('latin1'));
    return i + 1 + (Number.isFinite(n) ? n : 0);
  }
  return buf.length;
}

function infoSlice(buf) {
  const marker = Buffer.from('4:info');
  const at = buf.indexOf(marker);
  if (at < 0) return null;
  const start = at + marker.length;
  const end = valueEnd(buf, start);
  return buf.slice(start, Math.min(end, buf.length));
}

function infoHash(buf) {
  const info = infoSlice(buf);
  if (!info) return '';
  return crypto.createHash('sha1').update(info).digest('hex');
}

function torrentInfo(buf) {
  let t;
  try { t = decode(buf); } catch (e) { return null; }
  const info = t && t.info;
  if (!info) return null;
  let size = 0;
  if (Array.isArray(info.files)) info.files.forEach(function (f) { size += Number(f.length) || 0; });
  else size = Number(info.length) || 0;
  return {
    name: typeof info.name === 'string' ? info.name : '',
    size: size,
    infohash: infoHash(buf),
    pieceLength: Number(info['piece length']) || 0,
    files: Array.isArray(info.files) ? info.files.length : 1,
    private: info.private === 1
  };
}

module.exports = { decode: decode, infoHash: infoHash, torrentInfo: torrentInfo, infoSlice: infoSlice };

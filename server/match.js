/* 判「两个种子是不是同一个东西」：交叉做种/转载前先比对，纯函数、不联网。
   判定顺序（从硬到软）：
     1) 两边都有 infohash：相等就是同一个；不等就一定不是
     2) 标题归一（去站点前缀、分辨率、来源、编码、组名）后相等
     3) 年份、分辨率必须一致（两边都有时）
     4) 体积差超过 8% 判为不同版本；2% 以内加权
     5) 组名相同加分
   返回 { same, score, reasons }，调用方把 reasons 直接展示给人看。 */

const SOURCE_WORDS = /\b(blu-?ray|bdrip|brrip|web-?dl|web-?rip|webrip|hdtv|dvd-?r|dvdrip|remux|uhd|hdcam|hdtc)\b/gi;
const CODEC_WORDS = /\b(x264|x265|h\.?264|h\.?265|hevc|avc|av1|vc-?1|10bit|8bit|hdr10\+?|hdr|dv|dolby\s*vision)\b/gi;
const AUDIO_WORDS = /\b(ddp?\s*\d(\.\d)?(\s*atmos)?|truehd|dts(-hd)?(\s*ma)?|aac(\s*\d(\.\d)?)?|flac|mp3|ac3|e-?ac3|opus|atmos)\b/gi;
const RES_WORDS = /\b(2160p|1080p|1080i|720p|576p|480p|4k|8k)\b/gi;
const TAG_WORDS = /\b(repack|proper|internal|limited|dubbed|subbed|hardsub|multi|chs|cht|中字|国语|简繁|双语|内封|内嵌|外挂)\b/gi;
const GROUP_TAIL = /\s*[-–—]\s*([a-z0-9@._-]{2,24})\s*$/i;

function normTitle(t) {
  let s = String(t || '');
  /* 去掉开头的站点前缀，如 "[52PT] "、"【某站】" */
  s = s.replace(/^\s*[\[【(][^\]】)]{1,20}[\]】)]\s*/, ' ');
  s = s.replace(GROUP_TAIL, ' ');
  s = s.replace(RES_WORDS, ' ').replace(SOURCE_WORDS, ' ').replace(CODEC_WORDS, ' ')
    .replace(AUDIO_WORDS, ' ').replace(TAG_WORDS, ' ');
  s = s.replace(/[_.]/g, ' ').replace(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

function yearOf(s) {
  const m = String(s || '').match(/(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/);
  return m ? Number(m[1]) : 0;
}
function resOf(s) {
  const m = String(s || '').match(/\b(2160p|1080p|1080i|720p|576p|480p|4k|8k)\b/i);
  if (!m) return '';
  const v = m[1].toLowerCase();
  return v === '4k' ? '2160p' : v === '8k' ? '4320p' : v;
}
function groupOf(s) {
  const m = String(s || '').match(GROUP_TAIL);
  return m ? m[1].toLowerCase() : '';
}
function sizeBytesOf(item) {
  if (item && Number(item.sizeBytes) > 0) return Number(item.sizeBytes);
  const m = /([\d.]+)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB)/i.exec(String((item && item.size) || ''));
  if (!m) return 0;
  const n = Number(m[1]);
  const u = m[2].toUpperCase();
  const mul = { KB: 1024, KIB: 1024, MB: 1048576, MIB: 1048576, GB: 1073741824, GIB: 1073741824, TB: 1099511627776, TIB: 1099511627776 }[u] || 0;
  return Number.isFinite(n) ? Math.round(n * mul) : 0;
}

/* a、b：{title, year, res, size 或 sizeBytes, infohash} */
function compare(a, b) {
  const reasons = [];
  const ha = String((a && a.infohash) || '').toLowerCase();
  const hb = String((b && b.infohash) || '').toLowerCase();
  if (ha && hb) {
    if (ha === hb) return { same: true, score: 100, reasons: ['infohash 相同'] };
    return { same: false, score: 0, reasons: ['infohash 不同'] };
  }

  const ka = normTitle(a && a.title);
  const kb = normTitle(b && b.title);
  if (!ka || !kb) return { same: false, score: 0, reasons: ['标题为空，无法判断'] };

  let score = 0;
  if (ka === kb) { score += 50; reasons.push('标题归一后相同'); }
  else {
    /* 一方是另一方的前缀（站点标题常截断）也算相关 */
    const short = ka.length < kb.length ? ka : kb;
    const long = ka.length < kb.length ? kb : ka;
    if (short.length >= 12 && long.indexOf(short) === 0) { score += 35; reasons.push('标题前缀相同'); }
    else return { same: false, score: 0, reasons: ['标题不同（' + ka.slice(0, 24) + ' / ' + kb.slice(0, 24) + '）'] };
  }

  const ya = Number(a && a.year) || yearOf(a && a.title);
  const yb = Number(b && b.year) || yearOf(b && b.title);
  if (ya && yb) {
    if (ya !== yb) return { same: false, score: 0, reasons: ['年份不同（' + ya + ' / ' + yb + '）'] };
    score += 10; reasons.push('年份相同 ' + ya);
  }

  const ra = String((a && a.res) || resOf(a && a.title)).toLowerCase();
  const rb = String((b && b.res) || resOf(b && b.title)).toLowerCase();
  if (ra && rb) {
    if (ra !== rb) return { same: false, score: 0, reasons: ['分辨率不同（' + ra + ' / ' + rb + '）'] };
    score += 10; reasons.push('分辨率相同 ' + ra);
  }

  const sa = sizeBytesOf(a), sb = sizeBytesOf(b);
  if (sa && sb) {
    const diff = Math.abs(sa - sb) / Math.max(sa, sb);
    if (diff > 0.08) return { same: false, score: 0, reasons: ['体积差 ' + (diff * 100).toFixed(1) + '%，不是同一个版本'] };
    if (diff <= 0.02) { score += 30; reasons.push('体积基本一致'); }
    else { score += 15; reasons.push('体积相差 ' + (diff * 100).toFixed(1) + '%'); }
  }

  const ga = groupOf(a && a.title), gb = groupOf(b && b.title);
  if (ga && gb && ga === gb) { score += 10; reasons.push('发布组相同 ' + ga); }

  return { same: score >= 50, score: score, reasons: reasons };
}

module.exports = { compare: compare, normTitle: normTitle, yearOf: yearOf, resOf: resOf, groupOf: groupOf, sizeBytesOf: sizeBytesOf };

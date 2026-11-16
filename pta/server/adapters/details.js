/* 详情页解析：纯函数，不发请求。把 NexusPHP / UNIT3D 常见详情页里的
   大小、分类、媒介、标签、副标题、infohash、简介、海报地址抠出来。
   站点版式差异大，所以先按「rowhead → 下一个 td」的表格结构找，
   找不到再退回全文正则；认不出就留空，绝不猜。 */
const sizeLib = require('./size');

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}
function text(s) { return decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function preText(s) {
  return decode(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* Unit3D 把原始 BBCode 塞进“复制”按钮的 atob('...')，直接解出来最准 */
function unit3dBbcode(html) {
  const re = /atob\(\s*['"]([A-Za-z0-9+/=]{40,})['"]\s*\)/g;
  let best = '';
  let m;
  while ((m = re.exec(String(html || '')))) {
    try {
      const raw = Buffer.from(m[1], 'base64').toString('utf8');
      if (raw.length < 20) continue;
      if (!/\[/.test(raw)) continue;
      if (raw.length > best.length) best = raw;
    } catch (e) { /* ignore */ }
  }
  return best;
}
/* 简介 HTML → BBCode：保留图片与换行，其余标签丢掉；目标站 descr 直接可用 */
function toBbcode(html) {
  let s = String(html || '');
  /* NexusPHP：codetop + hide/codemain 还原成 [hide=MediaInfo] / [code] */
  s = s.replace(/<div\b[^>]*class=["'][^"']*codetop[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*hide[^"']*["'][^>]*>\s*<div\b[^>]*class=["'][^"']*codemain[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi, function (_, top, inner) {
    const label = text(top);
    let open = '[code]', close = '[/code]';
    if (/^mediainfo\b/i.test(label)) { open = '[hide=mediainfo]'; close = '[/hide]'; }
    else if (/^bdinfo\b/i.test(label)) { open = '[hide=bdinfo]'; close = '[/hide]'; }
    else if (/隐藏内容/i.test(label)) { open = '[hide]'; close = '[/hide]'; }
    return '\n' + open + '\n' + inner + '\n' + close + '\n';
  });
  /* 其它 code 块 */
  s = s.replace(/<div\b[^>]*class=["'][^"']*codemain[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi, function (_, inner) { return '\n[code]\n' + inner + '\n[/code]\n'; })
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, function (_, inner) { return '\n[code]' + text(inner) + '[/code]\n'; })
    .replace(/<fieldset\b[^>]*>/gi, '\n[quote]\n')
    .replace(/<\/fieldset>/gi, '\n[/quote]\n')
    .replace(/<legend\b[^>]*>/gi, '').replace(/<\/legend>/gi, '\n')
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, function (_, inner) { return '\n[quote]' + text(inner) + '[/quote]\n'; });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(?:p|div|li|tr|h\d)>/gi, '\n');
  s = s.replace(/<img\b[^>]*(?:data-src|src)\s*=\s*["']([^"']+)["'][^>]*>/gi, function (_, src) {
    const u = decode(src).trim();
    return /^https?:\/\//i.test(u) ? '[img]' + u + '[/img]\n' : '';
  });
  s = s.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, function (_, href, txt) {
    const t = text(txt);
    return t || (/^https?:\/\//i.test(href) ? decode(href) : '');
  });
  s = s.replace(/<[^>]+>/g, ' ');
  return decode(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 60000);
}
function attr(s, name) {
  const m = new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(String(s || ''));
  return m ? decode(m[1]) : '';
}

const LABELS = {
  size: ['大小', '文件大小', 'Size'],
  category: ['分类', '类别', 'Category'],
  medium: ['媒介', '类型', 'Type', 'Medium'],
  tags: ['标签', 'Tags'],
  subtitle: ['副标题', 'Subtitle'],
  region: ['地区', '国家', 'Region', 'Country'],
  bdinfo: ['BDInfo', 'BD Info', 'BDINFO', 'Disc Info', '影片参数', '视频参数'],
  mediainfo: ['MediaInfo', 'Media Info', 'MEDIAINFO', '媒体信息'],
  language: ['语言', 'Language'],
  infohash: ['Info Hash', '信息哈希', '哈希'],
  uploader: ['发布者', 'Uploader', '上传者']
};

/* 表格里的 rowhead 行：<td class="rowhead">大小</td><td>9.07 GB</td> */
function tableRows(html) {
  const map = {};
  const re = /<(?:td|th)\b[^>]*class=["'][^"']*rowhead[^"']*["'][^>]*>([\s\S]{0,80}?)<\/(?:td|th)>\s*<(?:td|th)\b[^>]*>([\s\S]{0,800}?)<\/(?:td|th)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const k = text(m[1]).replace(/[:：]\s*$/, '');
    if (!k || map[k]) continue;
    map[k] = text(m[2]);
  }
  return map;
}

function pick(map, names) {
  for (const n of names) {
    if (map[n]) return map[n];
    const key = Object.keys(map).filter(function (k) { return k.toLowerCase().indexOf(n.toLowerCase()) >= 0; })[0];
    if (key) return map[key];
  }
  return '';
}

/* kdescr 里常套着多层 div（引用、表格、图片），不能用第一个 </div> 截断 */
function extractDivByAttr(html, attr, value) {
  const re = new RegExp('<div\\b[^>]*' + attr + '\\s*=\\s*["\'][^"\']*' + value + '[^"\']*["\'][^>]*>', 'i');
  const m = re.exec(html);
  if (!m) return '';
  let i = m.index + m[0].length;
  let depth = 1;
  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  tagRe.lastIndex = i;
  let t;
  while ((t = tagRe.exec(html))) {
    if (/^<div/i.test(t[0])) depth++;
    else depth--;
    if (depth === 0) return html.slice(i, t.index);
  }
  return html.slice(i);
}

function parse(html) {
  const s = String(html || '');
  const rows = tableRows(s);
  const out = {};

  const sizeText = pick(rows, LABELS.size);
  if (sizeText) {
    out.sizeText = sizeText;
    out.sizeBytes = sizeLib.parseSize(sizeText);
  } else {
    const m = /(?:大小|Size)[^0-9]{0,40}([\d.,]+\s*(?:TiB|GiB|MiB|KiB|TB|GB|MB|KB))/i.exec(text(s));
    if (m) { out.sizeText = m[1].trim(); out.sizeBytes = sizeLib.parseSize(m[1]); }
  }

  const category = pick(rows, LABELS.category);
  if (category) out.category = category;

  const medium = pick(rows, LABELS.medium);
  if (medium) out.medium = medium;

  const tags = pick(rows, LABELS.tags);
  if (tags) out.tags = tags;

  const subtitle = pick(rows, LABELS.subtitle);
  if (subtitle) out.subtitle = subtitle;

  const region = pick(rows, LABELS.region);
  if (region) out.region = region;
  const language = pick(rows, LABELS.language);
  if (language) out.language = language;
  const bdinfo = pick(rows, LABELS.bdinfo);
  if (bdinfo) out.bdinfo = bdinfo.slice(0, 60000);
  const mediainfo = pick(rows, LABELS.mediainfo);
  if (mediainfo) out.mediainfo = mediainfo.slice(0, 60000);

  const infohash = pick(rows, LABELS.infohash);
  if (infohash) out.infohash = infohash.toLowerCase();

  const uploader = pick(rows, LABELS.uploader);
  if (uploader) out.uploader = uploader;

  /* 简介：kdescr 是 NexusPHP 的固定容器；没有就退到第一个描述块 */
  const rawUnit3d = unit3dBbcode(s);
  if (rawUnit3d) out.descrBb = rawUnit3d.slice(0, 60000);
  const rendered = extractDivByAttr(s, 'class', 'bbcode-rendered');
  if (rendered) {
    const plain = text(rendered);
    if (plain) out.descr = plain.slice(0, 1200);
  }
  if (!out.descrBb) {
    let descHtml = extractDivByAttr(s, 'id', 'kdescr');
    if (!descHtml) descHtml = extractDivByAttr(s, 'class', '(?:description|kdescr)');
    if (descHtml) {
      const plain = text(descHtml);
      if (plain) out.descr = plain.slice(0, 1200);
      const bb = toBbcode(descHtml);
      if (bb) out.descrBb = bb.slice(0, 60000);
    }
  }

  /* 海报 */
  const poster = /<img\b[^>]*class=["'][^"']*poster[^"']*["'][^>]*src=["']([^"']+)["']/i.exec(s)
    || /<img\b[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*poster[^"']*["']/i.exec(s);
  if (poster) out.poster = poster[1];

  /* 原盘判定：媒介/标签里出现原盘、Full Disc、BDMV 就算；只在有值时才下结论 */
  const disc = [out.medium, out.tags].filter(Boolean).join(' ');
  if (disc) out.fullDisc = /(原盘|full\s*disc|bdmv|blu-?ray|bd\b)/i.test(disc);

  const title = /<title>([\s\S]{1,200}?)<\/title>/i.exec(s);
  if (title) out.pageTitle = text(title[1]);

  /* Unit3D 独立面板：torrent-mediainfo-dump / torrent-bdinfo-dump / x-ref */
  if (!out.mediainfo) {
    const mi = /<div\b[^>]*class=["'][^"']*torrent-mediainfo-dump[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(s)
      || /<pre>\s*<code[^>]*(?:x-ref=["']mediainfo["']|id=["']mediainfo["'])[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(s);
    if (mi) out.mediainfo = preText(mi[1]).slice(0, 60000);
  }
  if (!out.bdinfo) {
    const bd = /<div\b[^>]*class=["'][^"']*torrent-bdinfo-dump[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(s)
      || /<pre>\s*<code[^>]*(?:x-ref=["']bdinfo["']|id=["']bdinfo["'])[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i.exec(s);
    if (bd) out.bdinfo = preText(bd[1]).slice(0, 60000);
  }
  if (!out.bdinfo) {
    const bd = extractDivByAttr(s, 'class', 'bdinfo') || extractDivByAttr(s, 'id', 'bdinfo')
      || extractDivByAttr(s, 'class', 'bd-info') || extractDivByAttr(s, 'id', 'bd-info');
    if (bd) out.bdinfo = toBbcode(bd).slice(0, 60000);
  }
  if (!out.mediainfo) {
    const mi = extractDivByAttr(s, 'class', 'mediainfo') || extractDivByAttr(s, 'id', 'mediainfo')
      || extractDivByAttr(s, 'class', 'media-info') || extractDivByAttr(s, 'id', 'media-info');
    if (mi) out.mediainfo = toBbcode(mi).slice(0, 60000);
  }

  return out;
}

module.exports = { parse: parse, tableRows: tableRows, unit3dBbcode: unit3dBbcode };

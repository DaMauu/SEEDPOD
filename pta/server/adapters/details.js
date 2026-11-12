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

  const infohash = pick(rows, LABELS.infohash);
  if (infohash) out.infohash = infohash.toLowerCase();

  const uploader = pick(rows, LABELS.uploader);
  if (uploader) out.uploader = uploader;

  /* 简介：kdescr 是 NexusPHP 的固定容器；没有就退到第一个描述块 */
  const d = /<div\b[^>]*id=["']kdescr["'][^>]*>([\s\S]*?)<\/div>/i.exec(s)
    || /<div\b[^>]*class=["'][^"']*(?:description|kdescr)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(s);
  if (d) {
    const plain = text(d[1]);
    if (plain) out.descr = plain.slice(0, 1000);
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

  return out;
}

module.exports = { parse: parse, tableRows: tableRows };

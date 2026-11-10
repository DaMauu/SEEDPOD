const sizeLib = require('./size');
/* Gazelle 站点适配：只做解析与 URL 拼装，不发任何请求。
   Gazelle 的种子页是 /torrents.php，种子组是 /torrents.php?id=<gid>，单个种子是 ?torrentid=<tid>，
   下载是 ?action=download&id=<tid>，搜索参数是 searchstr + filter_cat[<槽位>]。
   分类在页面上有三种写法：filter_cat[n] 复选框 + label、下拉框、链接，这里都认。 */

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}
function text(s) { return decode(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); }
function flat(s) {
  return decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const SIZE_RE = /([\d.]+\s*(?:TiB|GiB|MiB|KiB|TB|GB|MB|KB))\b/i;

function parseCategories(html) {
  const out = [];
  const seen = {};
  const push = function (id, label) {
    if (!id || !label || label.length > 30 || seen[id]) return;
    seen[id] = 1;
    out.push({ id: String(id), label: label });
  };
  const src = String(html || '');

  /* 复选框：<input type="checkbox" name="filter_cat[1]" id="cat_1" value="1"> + <label for="cat_1">Music</label> */
  const box = /<input\b[^>]*name=["']?filter_cat\[(\d+)\]?["']?[^>]*>/gi;
  let m;
  while ((m = box.exec(src))) {
    const slot = m[1];
    const idm = /value=["']?(\d+)["']?/i.exec(m[0]) || [null, slot];
    let label = '';
    const idAttr = (/id=["']([^"']+)["']/i.exec(m[0]) || [])[1];
    if (idAttr) {
      const esc = idAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      label = text((new RegExp('<label[^>]*for=["\']' + esc + '["\'][^>]*>([\\s\\S]{1,80}?)<\\/label>', 'i').exec(src) || [])[1] || '');
    }
    if (!label) label = text(src.slice(box.lastIndex, box.lastIndex + 120).split('<')[0] || '');
    push(idm[1], label);
  }

  const select = /<select\b[^>]*name=["']?filter_cat\[[^\]]*\]?["']?[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = select.exec(src))) {
    const opt = /<option[^>]+value=["']?(\d{1,4})["']?[^>]*>([^<]{1,40})<\/option>/gi;
    let o;
    while ((o = opt.exec(m[1]))) push(o[1], text(o[2]));
  }

  const link = /<a\b[^>]*href=["']([^"']*filter_cat\[\d+\]=(\d+)[^"']*)["'][^>]*>([\s\S]{1,200}?)<\/a>/gi;
  while ((m = link.exec(src))) push(m[2], text(m[3]));
  return out;
}

/* 列表：一个种子一行，用下载链接（或 torrentid 链接）定位；大小在该行的 td_size 里，
   标题取最近的一个种子组链接（/torrents.php?id=<gid>），找不到就退回行内文字。 */
function parseList(html) {
  const src = String(html || '');
  const rows = [];
  const seen = {};
  const marks = [];
  const dlRe = /<a\b[^>]*?href=["']([^"']*?torrents\.php\?(?:[^"']*?)action=download[^"']*?[?&]?id=(\d+)[^"']*)["'][^>]*>/gi;
  let m;
  while ((m = dlRe.exec(src))) marks.push({ idx: m.index, id: m[2], href: m[1], kind: 'dl' });

  for (let i = 0; i < marks.length; i++) {
    const mk = marks[i];
    if (seen[mk.id]) continue;
    seen[mk.id] = 1;
    const start = Math.max(0, mk.idx - 3500);
    const end = marks[i + 1] ? marks[i + 1].idx : Math.min(src.length, mk.idx + 2500);
    const win = src.slice(start, end);

    /* 标题：窗口内最后一个 torrents.php?id=<gid> 链接 */
    const gl = /<a\b[^>]*?href=["'][^"']*torrents\.php\?id=(\d+)[^"']*["'][^>]*>([\s\S]{1,300}?)<\/a>/gi;
    let last = null, g;
    while ((g = gl.exec(win))) { if (/torrentid=/.test(g[0])) continue; if (text(g[2])) last = g; }
    const size = SIZE_RE.exec(flat(win));
    const cat = /class=["'][^"']*cats_([a-z0-9_]+)/i.exec(win);
    rows.push({
      id: mk.id,
      groupId: last ? last[1] : '',
      title: (last ? text(last[2]) : '').slice(0, 300),
      catId: '',                                  /* Gazelle 行上给的是分类名不是 id */
      catName: cat ? cat[1] : '',
      size: size ? size[1].replace(/\s+/g, ' ') : '',
      sizeBytes: size ? sizeLib.parseSize(size[1]) : 0,
      detailsUrl: last ? 'torrents.php?id=' + last[1] + '&torrentid=' + mk.id : 'torrents.php?torrentid=' + mk.id,
      downloadUrl: mk.href
    });
  }
  return rows;
}

function buildSearchUrl(def, q, cats) {
  const base = String(def.base || '').replace(/\/+$/, '');
  const path = String(def.searchPath || '/torrents.php');
  const parts = [];
  const ids = (cats || []).map(String).filter(Boolean);
  if (q != null && q !== '') parts.push('searchstr=' + encodeURIComponent(q));
  const slot = String(def.catSlot || 1);
  ids.forEach(function (id) { parts.push(encodeURIComponent('filter_cat[' + slot + ']') + '=' + encodeURIComponent(id)); });
  return base + path + (parts.length ? '?' + parts.join('&') : '');
}

function isLoggedIn(html) {
  const s = String(html || '');
  if (/href=["'][^"']*logout\.php/i.test(s)) return true;
  if (/user\.php\?id=\d+/i.test(s) && !/login\.php/i.test(s)) return true;
  if (/torrents\.php\?action=download/i.test(s)) return true;
  if (/login\.php/i.test(s) && !/logout\.php/i.test(s)) return false;
  return null;
}

function detect(html) {
  const s = String(html || '');
  if (/torrents\.php\?[^"']*action=download/i.test(s)) return true;
  if (/filter_cat\[/i.test(s) && /searchstr/i.test(s)) return true;
  return false;
}

module.exports = {
  name: 'gazelle',
  detect: detect,
  parseCategories: parseCategories,
  parseList: parseList,
  buildSearchUrl: buildSearchUrl,
  isLoggedIn: isLoggedIn
};

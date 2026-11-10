/* 通用适配：认不出 NexusPHP / UNIT3D / Gazelle 的站，用一个「链接驱动」的兜底解析。
   只做解析与 URL 拼装，不发任何请求。目标是「有种子列表页就能列出条目」，
   不追求字段完备：标题、大小、详情链接、下载链接拿得到就填，拿不到就留空。 */

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

/* 详情页链接的常见写法：details.php?id=、torrents.php?id=、/torrent/123、/t/123、viewtopic.php?t= */
const DETAIL = /(?:details\.php\?id=|\/torrents?\/|torrents\.php\?id=|viewtopic\.php\?t=|\/topic\/)(\d+)/i;

function parseCategories(html) {
  const out = [];
  const seen = {};
  const push = function (id, label) {
    if (!id || !label || label.length > 30 || seen[id]) return;
    seen[id] = 1;
    out.push({ id: String(id), label: label });
  };
  const link = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{1,200}?)<\/a>/gi;
  let m;
  while ((m = link.exec(html))) {
    const idm = /cat(?:egory)?(?:\[\])?=(\d+)/i.exec(m[1]) || /filter_cat\[\d+\]=(\d+)/i.exec(m[1]) || /categories(?:\[|%5B)\d*(?:\]|%5D)=(\d+)/i.exec(m[1]);
    if (!idm) continue;
    push(idm[1], text(m[2]));
  }
  /* 下拉框：名字里带 cat 的才算分类，免得把排序/页码的 0/1 当分类 */
  const select = /<select\b[^>]*name=["']?([a-zA-Z0-9_\[\]]*cat[a-zA-Z0-9_\[\]]*)["']?[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = select.exec(html))) {
    const opt = /<option[^>]+value=["']?(\d{1,4})["']?[^>]*>([^<]{1,40})<\/option>/gi;
    let o;
    while ((o = opt.exec(m[2]))) push(o[1], text(o[2]));
  }
  return out;
}

function parseList(html) {
  const src = String(html || '');
  const marks = [];
  const seen = {};
  const link = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let m;
  while ((m = link.exec(src))) {
    const idm = DETAIL.exec(m[1]);
    if (!idm) continue;
    const id = idm[1];
    if (seen[id]) continue;
    const label = text(m[2]) || text((/title=["']([^"']+)["']/i.exec(m[0]) || [])[1] || '');
    if (!label) continue;
    seen[id] = 1;
    marks.push({ idx: m.index, end: link.lastIndex, id: id, href: m[1], title: label });
  }
  return marks.map(function (mk, i) {
    const start = Math.max(0, mk.idx - 400);
    const end = marks[i + 1] ? marks[i + 1].idx : Math.min(src.length, mk.end + 2500);
    const win = src.slice(start, end);
    const size = SIZE_RE.exec(flat(win));
    const dl = (/href=["']([^"']*(?:download|dl|get)\.php\?[^"']*id=\d+[^"']*)["']/i.exec(win) || [])[1];
    return {
      id: mk.id,
      title: mk.title.slice(0, 300),
      catId: '',
      size: size ? size[1].replace(/\s+/g, ' ') : '',
      detailsUrl: mk.href,
      downloadUrl: dl || ''
    };
  });
}

function buildSearchUrl(def, q, cats) {
  const base = String(def.base || '').replace(/\/+$/, '');
  const path = String(def.searchPath || '/');
  const params = def.params || { search: '{q}' };
  const ids = (cats || []).map(String).filter(Boolean);
  const parts = [];
  Object.keys(params).forEach(function (k) {
    const tpl = params[k];
    if (tpl === '{cats}') {
      if (ids.length) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(ids[0]));
      return;
    }
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(tpl === '{q}' ? String(q == null ? '' : q) : tpl));
  });
  return base + path + (parts.length ? '?' + parts.join('&') : '');
}

function isLoggedIn(html) {
  const s = String(html || '');
  if (/href=["'][^"']*(?:logout|signout|exit)/i.test(s)) return true;
  if (/userdetails\.php|user\.php\?id=\d+|\/profile\b/i.test(s)) return true;
  if (/<form[^>]+action=["'][^"']*login/i.test(s) && !/(?:logout|userdetails)/i.test(s)) return false;
  return null;
}

/* 兜底：页面上有足够多的「详情链接」才认，避免把普通页面当列表页 */
function detect(html) {
  const s = String(html || '');
  const hits = (s.match(/(?:details\.php\?id=|\/torrents?\/|torrents\.php\?id=|\/topic\/)\d+/gi) || []).length;
  if (hits >= 15) return true;
  /* 论坛式 tracker（TorrentPier 一类）行数不多但写法很固定 */
  return (s.match(/(?:viewtopic\.php\?t=|\/topic\/)\d+/gi) || []).length >= 3;
}

module.exports = {
  name: 'custom',
  detect: detect,
  parseCategories: parseCategories,
  parseList: parseList,
  buildSearchUrl: buildSearchUrl,
  isLoggedIn: isLoggedIn
};

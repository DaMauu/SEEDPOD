const sizeLib = require('./size');
/* UNIT3D 站点适配：只做解析与 URL 拼装，不发任何请求。
   UNIT3D 的种子页是 /torrents，每个种子是 /torrents/<id>，下载是 /torrents/<id>/download，
   搜索参数是 name + categories[0][]。
   UNIT3D 各站主题差异大（有的把下载按钮做成 Livewire 事件），所以「有 /torrents/<id> 链接」就算种子行，
   下载地址按标准路由补，页面里真有 /download 链接时优先用它。 */

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
/* categories[0]=1、categories%5B0%5D=1、categories[0][]=1 都算 */
const CATQ = /categories(?:\[|%5B)\s*\d*\s*(?:\]|%5D)\s*(?:\[\]|%5B%5D)?\s*=\s*(\d+)/i;

function parseCategories(html) {
  const out = [];
  const seen = {};
  const push = function (id, label) {
    if (!id || !label || label.length > 30 || seen[id]) return;
    seen[id] = 1;
    out.push({ id: String(id), label: label });
  };
  const src = String(html || '');
  const link = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{1,200}?)<\/a>/gi;
  let m;
  while ((m = link.exec(src))) {
    const q = CATQ.exec(m[1]);
    if (!q) continue;
    push(q[1], text(m[2]));
  }
  const box = /<input\b[^>]*name=["']?categories(?:\[[^\]]*\])+(?:\[\])?["']?[^>]*>/gi;
  while ((m = box.exec(src))) {
    const idm = /value=["']?(\d+)["']?/i.exec(m[0]);
    if (!idm) continue;
    let label = '';
    const idAttr = (/id=["']([^"']+)["']/i.exec(m[0]) || [])[1];
    if (idAttr) {
      const esc = idAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      label = text((new RegExp('<label[^>]*for=["\']' + esc + '["\'][^>]*>([\\s\\S]{1,80}?)<\\/label>', 'i').exec(src) || [])[1] || '');
    }
    push(idm[1], label || text(src.slice(box.lastIndex, box.lastIndex + 100).split('<')[0] || ''));
  }
  const select = /<select\b[^>]*name=["']?categories(?:\[[^\]]*\])?(?:\[\])?["']?[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = select.exec(src))) {
    const opt = /<option[^>]+value=["']?(\d{1,4})["']?[^>]*>([^<]{1,40})<\/option>/gi;
    let o;
    while ((o = opt.exec(m[1]))) push(o[1], text(o[2]));
  }
  return out;
}

function parseList(html) {
  const src = String(html || '');
  const marks = [];
  const seenId = {};
  const link = /<a\b[^>]*?href=["']([^"']*?\/torrents\/(\d+)(?![\d\/]*(?:\/download|\/peers|\/history))[^"']*)["'][^>]*>([\s\S]{1,400}?)<\/a>/gi;
  let m;
  while ((m = link.exec(src))) {
    const id = m[2];
    if (m[1].indexOf("/user/torrents/") >= 0 || m[1].indexOf("/users/") >= 0) continue;
    const label = text(m[3]);
    if (!label) continue;                        /* 图标/头像链接没有文字，跳过 */
    if (seenId[id]) continue;
    seenId[id] = 1;
    marks.push({ idx: m.index, end: link.lastIndex, id: id, href: m[1], title: label });
  }

  return marks.map(function (mk, i) {
    const start = Math.max(0, mk.idx - 600);
    const end = marks[i + 1] ? marks[i + 1].idx : Math.min(src.length, mk.end + 1200);
    const win = src.slice(start, end);
    const size = SIZE_RE.exec(flat(win));
    const cat = CATQ.exec(win);
    const dl = (/href=["']([^"']*\/torrents\/\d+\/download[^"']*)["']/i.exec(win) || [])[1];
    /* 行里常带 <time datetime="...">，有就用来判「未满 7 天」，没有就留空 */
    const dt = /<time\b[^>]*datetime=["']([^"']+)["']/i.exec(win);
    return {
      id: mk.id,
      title: mk.title.slice(0, 300),
      catId: cat ? cat[1] : '',
      size: size ? size[1].replace(/\s+/g, ' ') : '',
      sizeBytes: size ? sizeLib.parseSize(size[1]) : 0,
      detailsUrl: mk.href,
      downloadUrl: dl || '/torrents/' + mk.id + '/download',
      addedAt: dt && !isNaN(Date.parse(dt[1])) ? new Date(Date.parse(dt[1])).toISOString() : ''
    };
  });
}

function buildSearchUrl(def, q, cats) {
  const base = String(def.base || '').replace(/\/+$/, '');
  const path = String(def.searchPath || '/torrents');
  const parts = [];
  const ids = (cats || []).map(String).filter(Boolean);
  if (q != null && q !== '') parts.push('name=' + encodeURIComponent(q));
  ids.forEach(function (id) { parts.push('categories%5B0%5D%5B%5D=' + encodeURIComponent(id)); });
  return base + path + (parts.length ? '?' + parts.join('&') : '');
}

function isLoggedIn(html) {
  const s = String(html || '');
  if (/href=["'][^"']*\/logout/i.test(s)) return true;
  if (/href=["'][^"']*\/users\/[^"'\/]+/i.test(s) && !/href=["'][^"']*\/login\b/i.test(s)) return true;
  if (/\/torrents\/\d+\/download/i.test(s)) return true;
  if (/href=["'][^"']*\/login\b/i.test(s) && !/\/users\//i.test(s)) return false;
  return null;
}

function detect(html) {
  const s = String(html || '');
  if (/\/torrents\/\d+\/download/i.test(s)) return true;
  if (CATQ.test(s) && /name=["']?name\b/i.test(s)) return true;
  /* 有 20 个以上 /torrents/<id> 链接，基本只能是 UNIT3D 系的列表 */
  if ((s.match(/\/torrents\/\d{2,}/g) || []).length >= 20) return true;
  return false;
}

module.exports = {
  name: 'unit3d',
  detect: detect,
  parseCategories: parseCategories,
  parseList: parseList,
  buildSearchUrl: buildSearchUrl,
  isLoggedIn: isLoggedIn
};

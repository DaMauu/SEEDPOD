const sizeLib = require('./size');

/* NexusPHP 站点适配：只做解析与 URL 拼装，不发任何请求。
   所有函数都是纯函数，输入 HTML/配置，输出结构化数据，方便用夹具回归。 */

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}
function text(s) { return decode(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); }
/* 行内文本：把 <br> 当空格（NexusPHP 常把「9.07<br>GB」拆成两行），再去标签 */
function flat(s) {
  return decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const SIZE_RE = /([\d.]+\s*(?:TiB|GiB|MiB|KiB|TB|GB|MB|KB))\b/i;

/* 分类：站内种子页上的「分类链接」与「下拉框」两种写法都能认 */
function parseCategories(html) {
  const out = [];
  const seen = {};
  const push = function (id, label) {
    if (!id || !label || label.length > 24) return;
    if (seen[id]) return;               /* 同一个分类 id 只留第一次出现的标签 */
    seen[id] = 1;
    out.push({ id: String(id), label: label });
  };

  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{1,400}?)<\/a>/gi;
  let m;
  while ((m = anchor.exec(html))) {
    const href = m[1];
    const idm = /cat\[\]=(\d+)/i.exec(href) || /cat=(\d+)/i.exec(href) || /cat(\d+)=/i.exec(href);
    if (!idm) continue;
    let label = text(m[2]);
    if (!label) {
      const t = /<img[^>]*?(?:title|alt)=["']([^"']{1,30})["']/i.exec(m[2]);
      if (t) label = text(t[1]);
    }
    push(idm[1], label);
  }

  /* 下拉框只认 name 里带 cat 的，避免把 search_area / search_mode 的 0/1 当成分类 */
  const select = /<select\b[^>]*name=["']?([a-zA-Z0-9_\[\]]*cat[a-zA-Z0-9_\[\]]*)["']?[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = select.exec(html))) {
    const opt = /<option[^>]+value=["']?(\d{1,4})["']?[^>]*>([^<]{1,40})<\/option>/gi;
    let o;
    while ((o = opt.exec(m[2]))) push(o[1], text(o[2]));
  }

  return out;
}

/* 列表：先用 details.php?id= 定位每一行（标题、分类、详情地址），
   再用 download.php?id= 说话（它一行一个，正好是行边界，大小在前后的列里）。
   这样不怕行内嵌套 table，也不怕标题链接和海报链接指向同一个 id。 */
/* 新版主题（含 Vertex 支持的那些站）会把字段挂在行的 data-* 上：
   data-torrent-id / data-title / data-size-bytes / data-seeders …，比抠文本可靠得多，优先用它们 */
const bytesToSize = sizeLib.formatSize;

function parseDataRows(src) {
  const out = [];
  const seen = {};
  const tagRe = /<([a-z][a-z0-9]*)\b([^>]*\bdata-torrent-id\s*=\s*["'](\d+)["'][^>]*)>([\s\S]{0,6000}?)<\/\1>/gi;
  let m;
  while ((m = tagRe.exec(src))) {
    const attrs = m[2];
    const id = m[3];
    if (seen[id]) continue;
    seen[id] = 1;
    const inner = m[4];
    const attr = function (name) {
      const re = new RegExp('\\b' + name + '\\s*=\\s*["\u0027]([^"\u0027]*)["\u0027]', 'i');
      const r = re.exec(attrs);
      return r ? decode(r[1]).trim() : '';
    };
    let title = attr('data-title') || attr('data-name') || '';
    if (!title) {
      const t = /<a\b[^>]*?title=["']([^"']+)["']/i.exec(inner);
      if (t) title = decode(t[1]);
    }
    if (!title) {
      const a = /<a\b[^>]*href=["'][^"']*(?<![a-z0-9])details\.php\?id=\d+[^"']*["'][^>]*>([\s\S]{1,300}?)<\/a>/i.exec(inner);
      if (a) title = text(a[1]);
    }
    let sizeBytes = Number(attr('data-size-bytes')) || sizeLib.parseSize(attr('data-size')) || 0;
    let size = sizeBytes ? bytesToSize(sizeBytes) : '';
    if (!size) {
      const f = SIZE_RE.exec(flat(inner));
      if (f) { size = f[1].replace(/\s+/g, ' '); sizeBytes = sizeLib.parseSize(size); }
    }
    const catAttr = attr('data-category') || attr('data-cat');
    const catLink = /[?&]cat=(\d+)/i.exec(inner) || /cat(\d+)=/i.exec(inner);
    const dl = (/href=["']([^"']*download\.php\?[^"']*(?<![a-z0-9])id=\d+[^"']*)["']/i.exec(inner) || [])[1];
    const det = (/href=["']([^"']*(?<![a-z0-9])details\.php\?id=\d+[^"']*)["']/i.exec(inner) || [])[1];
    /* 分类名直接在行里取（分类链接的文字），面板就不必只显示裸 id */
    const catNameM = /<a\b[^>]*[?&]cat=\d+[^>]*>([\s\S]{0,80}?)<\/a>/i.exec(inner);
    const catName = catNameM ? text(catNameM[1]).slice(0, 40) : '';
    const seeders = attr('data-seeders') || attr('data-seeds');
    out.push({
      id: id,
      title: (title || '').slice(0, 300),
      catId: catAttr || (catLink ? catLink[1] : ''),
      catName: catName,
      size: size,
      sizeBytes: sizeBytes,
      detailsUrl: det || 'details.php?id=' + id,
      downloadUrl: dl || '',
      seeders: seeders ? Number(seeders) || 0 : undefined
    });
  }
  return out.map(function (r) {
    if (r.seeders === undefined) delete r.seeders;
    return r;
  });
}

function parseList(html) {
  const src = String(html || '');
  /* 优先走 data-* 行；认不出来再退回「按详情链接定位行」的老路子 */
  const dataRows = parseDataRows(src);
  if (dataRows.length) return dataRows.filter(function (r) { return r.title || r.id; });
  const rows = {};
  const order = [];

  function rec(id) {
    if (!rows[id]) { rows[id] = { id: id, title: '', catId: '', size: '', sizeBytes: 0, detailsUrl: '', downloadUrl: '' }; order.push(id); }
    return rows[id];
  }

  const dRe = /<a\b([^>]*?)href=["']([^"']*(?<![a-z0-9])details\.php\?id=(\d+)[^"']*)["']([^>]*)>([\s\S]{0,400}?)<\/a>/gi;
  const dIdx = {};
  let m;
  while ((m = dRe.exec(src))) {
    const id = m[3];
    const attrs = m[1] + ' ' + m[4];
    const r = rec(id);
    if (!dIdx[id]) dIdx[id] = { idx: m.index, end: dRe.lastIndex };
    const titleAttr = (/title=["']([^"']+)["']/i.exec(attrs) || [])[1];
    const label = text(titleAttr || '') || text(m[5]);
    if (label && (label.length > r.title.length || !r.title)) r.title = label.slice(0, 300);
    if (!r.detailsUrl) r.detailsUrl = m[2];
    if (!r.catId) {
      const before = src.slice(Math.max(0, m.index - 1400), m.index);
      r.catId = (/[?&]cat=(\d+)/i.exec(before) || /cat(\d+)=/i.exec(before) || [])[1] || '';
    }
  }

  const lRe = /<a\b[^>]*?href=["']([^"']*download\.php\?[^"']*?(?<![a-z0-9])id=(\d+)[^"']*)["'][^>]*>/gi;
  const dl = [];
  while ((m = lRe.exec(src))) {
    const id = m[2];
    if (!rows[id]) continue;                     /* 没有对应详情链接的下载链接（广告位等）直接忽略 */
    if (!rows[id].downloadUrl) rows[id].downloadUrl = m[1];
    dl.push({ idx: m.index, id: id });
  }

  /* 行窗口：本行下载链接 → 下一行下载链接 */
  const startOf = {};
  const endOf = {};
  dl.forEach(function (d, i) {
    const s = Math.min(d.idx, dIdx[d.id] ? dIdx[d.id].idx : d.idx);
    startOf[d.id] = Math.max(0, s - 300);
    endOf[d.id] = dl[i + 1] ? dl[i + 1].idx : Math.min(src.length, d.idx + 4000);
  });

  order.forEach(function (id) {
    const r = rows[id];
    const start = startOf[id] != null ? startOf[id] : Math.max(0, (dIdx[id] ? dIdx[id].idx : 0) - 500);
    const end = endOf[id] != null ? endOf[id] : Math.min(src.length, start + 5000);
    const win = src.slice(start, end);
    const size = SIZE_RE.exec(flat(win));
    if (size) { r.size = size[1].replace(/\s+/g, ' '); r.sizeBytes = sizeLib.parseSize(size[1]); }
  });

  return order.map(function (id) { return rows[id]; }).filter(function (r) { return r.title; });
}

/* 搜索 URL：参数名以站点定义里的 params 为准，{q} / {cats} 是占位符 */
function buildSearchUrl(def, q, cats) {
  const base = String(def.base || '').replace(/\/+$/, '');
  const path = String(def.searchPath || '/torrents.php');
  const params = def.params || { search: '{q}', cat: '{cats}' };
  const mode = def.catMode || 'single';
  const ids = (cats || []).map(String).filter(Boolean);
  const parts = [];
  Object.keys(params).forEach(function (k) {
    const tpl = params[k];
    if (tpl === '{cats}') {
      if (!ids.length) return;
      if (mode === 'multi') ids.forEach(function (id) { parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(id)); });
      else if (mode === 'bracket') ids.forEach(function (id) { parts.push(encodeURIComponent(k + '[]') + '=' + encodeURIComponent(id)); });
      else parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(ids[0]));
      return;
    }
    const val = tpl === '{q}' ? String(q == null ? '' : q) : tpl;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(val));
  });
  return base + path + (parts.length ? '?' + parts.join('&') : '');
}

/* 登录页：拿到提交地址与字段名，交给请求层填值 */
function parseLoginForm(html) {
  const form = /<form[^>]+action=["']([^"']*takelogin[^"']*)["'][^>]*>([\s\S]*?)<\/form>/i.exec(html);
  if (!form) return null;
  const fields = [];
  const input = /<input[^>]+>/gi;
  let m;
  while ((m = input.exec(form[2]))) {
    const name = (/name=["']([^"']+)["']/i.exec(m[0]) || [])[1];
    const type = (/type=["']([^"']+)["']/i.exec(m[0]) || [])[1] || 'text';
    if (!name) continue;
    fields.push({ name: name, type: type });
  }
  return { action: form[1], fields: fields };
}

/* 登录态：页面里有退出链接、或当前用户详情链接，就算已登录 */
function isLoggedIn(html) {
  const s = String(html || '');
  if (/href=["'][^"']*(?:logout|signout)/i.test(s)) return true;
  if (/userdetails\.php\?[^"']*id=\d+/i.test(s)) return true;
  if (/takelogin\.php/i.test(s) && !/userdetails\.php/i.test(s)) return false;
  return null;
}

function detect(html) {
  const s = String(html || '');
  if (/takelogin\.php|Powered by NexusPHP/i.test(s)) return true;
  if ((s.match(/details\.php\?id=\d+/g) || []).length >= 5) return true;
  return false;
}

module.exports = {
  name: 'nexusphp',
  detect: detect,
  parseCategories: parseCategories,
  parseList: parseList,
  buildSearchUrl: buildSearchUrl,
  parseLoginForm: parseLoginForm,
  isLoggedIn: isLoggedIn
};

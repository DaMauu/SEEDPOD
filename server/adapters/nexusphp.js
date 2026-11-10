/* NexusPHP 站点适配：只做解析与 URL 拼装，不发任何请求。
   所有函数都是纯函数，输入 HTML/配置，输出结构化数据，方便用夹具回归。 */

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}
function text(s) { return decode(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); }

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

/* 列表：按「详情链接」定位每个种子，再在前后窗口里取分类与大小。
   这样不怕行内嵌套 table（NexusPHP 的标题单元格里就有嵌套表格）。 */
function parseList(html) {
  const src = String(html || '');
  const rows = [];
  const seen = {};
  const link = /<a\b[^>]*?href=["']([^"']*(?<![a-z0-9])details\.php\?id=(\d+)[^"']*)["'][^>]*>([\s\S]{1,240}?)<\/a>/gi;
  let m;
  while ((m = link.exec(src))) {
    const href = m[1];
    const id = m[2];
    if (!id || seen[id]) continue;
    seen[id] = 1;
    const before = src.slice(Math.max(0, m.index - 1200), m.index);
    const after = src.slice(m.index, Math.min(src.length, m.index + 2500));
    let title = (/<a\b[^>]*?title=["']([^"']+)["'][^>]*?href=["'][^"']*(?<![a-z0-9])details\.php\?id=\d+/i.exec(before + src.slice(m.index, m.index + 240)) || [])[1];
    if (!title) title = text(m[3]);
    const sizeMatch = /([\d.]+\s*(?:TB|GB|MB|KB))/i.exec(decode(after));
    const catId = (/[?&]cat=(\d+)/i.exec(before) || /cat(\d+)=/i.exec(before) || [])[1];
    const dl = (/href=["']([^"']*download\.php\?[^"']*)["']/i.exec(after) || [])[1];
    rows.push({
      id: id,
      title: text(title).slice(0, 300),
      catId: catId || '',
      size: sizeMatch ? sizeMatch[1].replace(/\s+/g, ' ') : '',
      detailsUrl: href,
      downloadUrl: dl || ''
    });
  }
  return rows;
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

function detect(html) {
  return /NexusPHP|Powered by NexusPHP|takelogin\.php/i.test(String(html || ''));
}

module.exports = {
  name: 'nexusphp',
  detect: detect,
  parseCategories: parseCategories,
  parseList: parseList,
  buildSearchUrl: buildSearchUrl,
  parseLoginForm: parseLoginForm
};

/* 适配器入口：按引擎分发，三种引擎（NexusPHP / UNIT3D / Gazelle）对外都是同一组纯函数。
   任何解析都不发请求；请求由调用方决定。 */
const nexusphp = require('./nexusphp');
const generic = require('./generic');
const unit3d = require('./unit3d');
const gazelle = require('./gazelle');

const ADAPTERS = [unit3d, gazelle, nexusphp, generic];      /* 先认特征更强的，NexusPHP 的检测最宽松放到最后 */
const BY_NAME = { nexusphp: nexusphp, unit3d: unit3d, gazelle: gazelle, custom: generic, generic: generic };

function byName(name) {
  const key = String(name || '').toLowerCase();
  return BY_NAME[key] || null;
}

/* 识别引擎：返回适配器对象或 null */
function detectAdapter(html) {
  for (const a of ADAPTERS) {
    try { if (a.detect(html)) return a; } catch (e) {}
  }
  return null;
}

function detectEngine(html) {
  const a = detectAdapter(html);
  return a ? a.name : '';
}

function resolve(def) {
  const a = byName(def && def.engine);
  if (a) return a;
  return detectAdapter(def && def.html) || nexusphp;
}

function buildSearchUrl(def, q, cats) { return resolve(def).buildSearchUrl(def, q, cats); }

/* 翻页：三种引擎都用 page=N，直接在已拼好的搜索地址后面补一个参数 */
function withPage(url, page) {
  const p = Math.max(1, Number(page) || 1);
  if (p <= 1) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('page', String(p));
    return u.toString();
  } catch (e) {
    const sep = String(url).indexOf('?') >= 0 ? '&' : '?';
    return String(url) + sep + 'page=' + p;
  }
}
function parseList(html, engine) { const a = byName(engine) || detectAdapter(html); return a ? a.parseList(html) : []; }
function parseCategories(html, engine) { const a = byName(engine) || detectAdapter(html); return a ? a.parseCategories(html) : []; }

/* 登录态判定：先看跨引擎都成立的特征，再看各引擎自己的判断。
   返回 true 已登录 / false 未登录 / null 判断不了。 */
function isLoggedIn(html) {
  const s = String(html || '');
  if (!s) return null;
  if (/href=["'][^"']*(?:logout|signout|sign_out)/i.test(s)) return true;
  if (/userdetails\.php\?[^"']*id=\d+/i.test(s)) return true;
  if (/href=["'][^"']*\/users\/self\b/i.test(s)) return true;
  const hasLoginForm = /takelogin\.php/i.test(s) || /<form[^>]+action=["'][^"']*login/i.test(s) || /href=["'][^"']*\/login\b/i.test(s);
  if (hasLoginForm) {
    for (const a of ADAPTERS) {
      if (!a.isLoggedIn) continue;
      const r = a.isLoggedIn(s);
      if (r === true) return true;
    }
    return false;
  }
  for (const a of ADAPTERS) {
    if (!a.isLoggedIn) continue;
    const r = a.isLoggedIn(s);
    if (r === true) return true;
  }
  return null;
}

/* 从一个真实的种子页里反推搜索参数：用来生成站点定义里的 params / catMode。
   只读 HTML，不发请求。 */
function detectSearchSpec(html) {
  const s = String(html || '');
  const out = { params: null, catMode: 'single', catParam: '', engine: detectEngine(s) };
  if (/name=["']?searchstr/i.test(s)) {
    out.params = { searchstr: '{q}' };
    const slot = (/name=["']?filter_cat\[(\d+)\]/i.exec(s) || [])[1];
    if (slot) { out.catMode = 'multi'; out.catParam = 'filter_cat[' + slot + ']'; out.params[out.catParam] = '{cats}'; }
    return out;
  }
  if (/name=["']?name["']?/i.test(s) && /categories(?:\[|%5B)/i.test(s)) {
    out.params = { name: '{q}' };
    out.catMode = 'bracket';
    out.catParam = 'categories[0]';
    out.params[out.catParam] = '{cats}';
    return out;
  }
  if (/name=["']?search\b/i.test(s)) {
    out.params = { search: '{q}' };
    const sel = /<select\b[^>]*name=["']?([a-zA-Z0-9_\[\]]*cat[a-zA-Z0-9_\[\]]*)["']?/i.exec(s);
    if (sel) {
      out.catParam = sel[1];
      out.catMode = /\[\]/.test(sel[1]) ? 'bracket' : 'single';
      out.params[sel[1]] = '{cats}';
    }
    return out;
  }
  return out;
}

/* 页面是 JS 空壳（列表要靠浏览器渲染）时，用资源与框架特征判断引擎。
   只在三种适配器都认不出时用，返回引擎名或空串。 */
function detectShellEngine(html) {
  const s = String(html || '');
  if (!s) return '';
  const u3d = [
    /unit3d/i.test(s),
    /torrent-search--list/i.test(s),
    /(?:livewire|wire:model|wire:click)/i.test(s) && /(?:build\/assets|vite)/i.test(s)
  ].filter(Boolean).length;
  if (u3d >= 1) return 'unit3d';
  if (/gazelle/i.test(s) && /torrents\.php|filter_cat|searchstr|browse/i.test(s)) return 'gazelle';
  if (/details\.php\?id=/i.test(s)) return 'nexusphp';
  return '';
}

module.exports = {
  detectAdapter: detectAdapter,
  detectEngine: detectEngine,
  detectShellEngine: detectShellEngine,
  detectSearchSpec: detectSearchSpec,
  names: function () { return ADAPTERS.map(function (a) { return a.name; }); },
  byName: byName,
  buildSearchUrl: buildSearchUrl,
  withPage: withPage,
  parseList: parseList,
  parseCategories: parseCategories,
  isLoggedIn: isLoggedIn,
  nexusphp: nexusphp,
  unit3d: unit3d,
  gazelle: gazelle,
  custom: generic
};

/* 适配器入口：按引擎分发，三种引擎（NexusPHP / UNIT3D / Gazelle）对外都是同一组纯函数。
   任何解析都不发请求；请求由调用方决定。 */
const nexusphp = require('./nexusphp');
const unit3d = require('./unit3d');
const gazelle = require('./gazelle');

const ADAPTERS = [unit3d, gazelle, nexusphp];      /* 先认特征更强的，NexusPHP 的检测最宽松放到最后 */
const BY_NAME = { nexusphp: nexusphp, unit3d: unit3d, gazelle: gazelle };

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

module.exports = {
  detectAdapter: detectAdapter,
  detectEngine: detectEngine,
  detectSearchSpec: detectSearchSpec,
  names: function () { return ADAPTERS.map(function (a) { return a.name; }); },
  byName: byName,
  buildSearchUrl: buildSearchUrl,
  parseList: parseList,
  parseCategories: parseCategories,
  isLoggedIn: isLoggedIn,
  nexusphp: nexusphp,
  unit3d: unit3d,
  gazelle: gazelle
};

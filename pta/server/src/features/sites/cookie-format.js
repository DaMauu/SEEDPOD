/* Cookie 头清洗：支持 Cookie / Set-Cookie / cURL，只保留 name=value。
   不做站点请求；解析失败返回空串，由调用方报错。 */
const ATTR = /^(expires|max-age|path|domain|samesite|secure|httponly|priority|partitioned|version|comment)$/i;
const NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function pairsOf(raw) {
  const out = new Map();
  String(raw || '').split(/\r?\n/).forEach(function (line) {
    line = line.trim().replace(/^(?:set-)?cookie:\s*/i, '');
    if (!line) return;
    line.split(';').forEach(function (part) {
      const i = part.indexOf('=');
      if (i <= 0) return;
      const name = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      if (!name || !NAME.test(name) || ATTR.test(name)) return;
      out.set(name, value);
    });
  });
  return out;
}

function normalizeCookie(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  /* 整段 cURL 里提取 -H 'Cookie: ...' */
  const m = s.match(/(?:-H|--header)\s+['"]?Cookie:\s*([^'"]+)/i);
  if (m) s = m[1];
  const map = pairsOf(s);
  return Array.from(map.entries()).map(function (x) { return x[0] + '=' + x[1] }).join('; ');
}

/* 把响应里的 Set-Cookie 合并进现有 cookie；只接受同一次请求返回的 header 数组。
   Max-Age=0 或空值视为删除。 */
function mergeSetCookies(current, setCookies) {
  const map = pairsOf(normalizeCookie(current));
  (Array.isArray(setCookies) ? setCookies : []).forEach(function (sc) {
    const line = String(sc || '').split(/\r?\n/)[0].replace(/^set-cookie:\s*/i, '').trim();
    const first = line.split(';')[0];
    const i = first.indexOf('=');
    if (i <= 0) return;
    const name = first.slice(0, i).trim();
    const value = first.slice(i + 1).trim();
    if (!name || !NAME.test(name) || ATTR.test(name)) return;
    if (!value || /(?:^|;)\s*max-age\s*=\s*0\s*(?:;|$)/i.test(line)) map.delete(name);
    else map.set(name, value);
  });
  return Array.from(map.entries()).map(function (x) { return x[0] + '=' + x[1] }).join('; ');
}

function setCookieHeaders(headers) {
  if (!headers) return [];
  try {
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
    const one = typeof headers.get === 'function' ? headers.get('set-cookie') : '';
    return one ? [one] : [];
  } catch (e) { return []; }
}

module.exports = { normalizeCookie: normalizeCookie, mergeSetCookies: mergeSetCookies, pairsOf: pairsOf, setCookieHeaders: setCookieHeaders };

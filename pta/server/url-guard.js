/* URL 归属校验：给 host 和它允许的域名/子域做统一判断，避免 cookie 被带到外部。 */
function normHost(h) { return String(h || '').trim().toLowerCase().replace(/\.$/, ''); }

function hostOf(raw) {
  try { return normHost(new URL(String(raw || '')).hostname); } catch (e) { return ''; }
}
function matches(host, hostname) {
  const h = normHost(host);
  const n = normHost(hostname);
  if (!h || !n) return false;
  return n === h || n.endsWith('.' + h);
}
function isLocalHost(h) {
  const x = normHost(h);
  return x === 'localhost' || x === '127.0.0.1' || x === '::1' || x.endsWith('.localhost');
}
/* base 必须落在站点 host 或其子域；非本机站点强制 https */
function baseOk(host, base) {
  let u;
  try { u = new URL(String(base || '')); } catch (e) { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  if (u.protocol === 'http:' && !isLocalHost(host) && !isLocalHost(u.hostname)) return false;
  return matches(host, u.hostname);
}
/* 绝对/相对 URL 必须落在站点 base 的子域内 */
function sameSite(host, base, raw) {
  let u;
  try { u = new URL(String(raw || ''), base ? String(base).replace(/\/+$/, '') + '/' : undefined); } catch (e) { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  return matches(host, u.hostname);
}

module.exports = { normHost, hostOf, matches, isLocalHost, baseOk, sameSite };

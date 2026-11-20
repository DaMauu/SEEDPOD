/* URL 归属校验：给 host 和它允许的域名/子域做统一判断，避免 cookie 被带到外部。 */
const dns = require('dns').promises;
const net = require('net');
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


function privateIp(ip) {
  const v = String(ip || '').replace(/^::ffff:/, '');
  if (net.isIPv4(v)) {
    const p = v.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    return false;
  }
  if (net.isIPv6(v)) {
    const x = v.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
  }
  return false;
}
/* 异步 DNS 校验：防止域名解析到内网；调用方是 untrusted URL 时才用 */
async function assertPublicHttp(raw, opts) {
  const o = opts || {};
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return { ok: false, err: 'URL 不合法' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, err: '只允许 http/https' };
  const h = normHost(u.hostname);
  if (!h) return { ok: false, err: 'URL 没有域名' };
  if (isLocalHost(h)) return o.allowPrivate ? { ok: true, url: u.toString() } : { ok: false, err: '不允许本机地址' };
  if (privateIp(h)) return o.allowPrivate ? { ok: true, url: u.toString() } : { ok: false, err: '不允许内网地址' };
  let list = [];
  try { list = await dns.lookup(h, { all: true }); } catch (e) { return { ok: false, err: '域名解析失败' }; }
  if (!list.length) return { ok: false, err: '域名没有解析结果' };
  if (!o.allowPrivate && list.some(function (x) { return privateIp(x.address); })) return { ok: false, err: '域名解析到内网地址' };
  return { ok: true, url: u.toString() };
}

module.exports = { normHost, hostOf, matches, isLocalHost, baseOk, sameSite, assertPublicHttp, privateIp };


/* 下载器探测地址策略：默认只允许公网；内网/回环必须显式放行。
   环境变量：
     PTA_DOWNLOADER_ALLOW=192.168.1.0/24,10.0.0.5
     PTA_DOWNLOADER_DENY=169.254.169.254
     PTA_DOWNLOADER_ALLOW_PRIVATE=1  （开发机临时放开所有内网） */
const dns = require('dns').promises;
const net = require('net');
const env = require('./src/infra/env');

function listOf(name) {
  return String(env.read(name, name) || '').split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}
function ipv4ToInt(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some(function (x) { return !Number.isInteger(x) || x < 0 || x > 255; })) return -1;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inCidr(ip, cidr) {
  const m = /^([0-9.]+)\/(\d{1,2})$/.exec(String(cidr || ''));
  if (!m || net.isIP(ip) !== 4 || net.isIP(m[1]) !== 4) return false;
  const bits = Number(m[2]);
  if (bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(m[1]) & mask) >>> 0);
}
function matchEntry(host, entry) {
  const h = String(host || '').toLowerCase();
  const e = String(entry || '').toLowerCase();
  if (!h || !e) return false;
  if (inCidr(h, e)) return true;
  if (net.isIP(h)) return h === e;
  return h === e || h.endsWith('.' + e);
}
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31);
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
  }
  return false;
}
function isPrivateHost(host) {
  const h = String(host || '').toLowerCase();
  return h === 'localhost' || h === '::1' || isPrivateIp(h) || h.endsWith('.local') || h.endsWith('.internal');
}
async function assertProbeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return { ok: false, code: 'BAD_URL', message: '地址不合法' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, code: 'BAD_URL', message: '只允许 http/https' };
  if (u.username || u.password) return { ok: false, code: 'BAD_URL', message: '地址不能带账号密码' };
  const host = u.hostname.toLowerCase();
  const deny = listOf('PTA_DOWNLOADER_DENY');
  if (deny.some(function (x) { return matchEntry(host, x); })) return { ok: false, code: 'DOWNLOADER_DENIED', message: '这个下载器地址在黑名单' };
  const allow = listOf('PTA_DOWNLOADER_ALLOW');
  if (allow.some(function (x) { return matchEntry(host, x); })) return { ok: true };
  if (env.read('PTA_DOWNLOADER_ALLOW_PRIVATE','PTA_DOWNLOADER_ALLOW_PRIVATE') === '1') return { ok: true };
  let addrs = [];
  if (net.isIP(host)) addrs = [host];
  else {
    try { const list = await dns.lookup(host, { all: true }); addrs = list.map(function (x) { return x.address; }); }
    catch (e) { return { ok: false, code: 'DOWNLOADER_DNS_FAILED', message: '下载器域名解析失败' }; }
  }
  if (!addrs.length) return { ok: false, code: 'DOWNLOADER_DNS_FAILED', message: '下载器域名没有解析结果' };
  if (addrs.some(isPrivateIp)) return { ok: false, code: 'DOWNLOADER_PRIVATE_BLOCKED', message: '内网下载器地址未放行；设 PTA_DOWNLOADER_ALLOW 或 PTA_DOWNLOADER_ALLOW_PRIVATE=1' };
  return { ok: true };
}
module.exports = { assertProbeUrl, isPrivateIp, matchEntry, listOf };

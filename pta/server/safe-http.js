/* 只给不可信图片/页面 URL 用：DNS 解析一次后固定 IP 连接，避免解析后再变。
   允许 allowPrivate 时退回普通 fetch（本地图床/测试用）。 */
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const urlGuard = require('./url-guard');

function headersObj(h) {
  const out = {};
  if (h && typeof h.forEach === 'function') h.forEach(function (v, k) { out[String(k).toLowerCase()] = v; });
  else if (h && typeof h === 'object') Object.keys(h).forEach(function (k) { out[String(k).toLowerCase()] = h[k]; });
  return out;
}
function responseLike(res, body, finalUrl) {
  return {
    status: res.statusCode || 0,
    ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
    url: finalUrl,
    headers: { get: function (name) { const v = res.headers[String(name).toLowerCase()]; return Array.isArray(v) ? v[0] : (v || ''); } },
    text: function () { return Promise.resolve(body.toString('utf8')); },
    arrayBuffer: function () { return Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)); },
    body: { cancel: function () {} }
  };
}
function requestOnce(u, address, opts) {
  return new Promise(function (resolve, reject) {
    const lib = u.protocol === 'https:' ? https : http;
    const headers = Object.assign({}, headersObj(opts.headers));
    headers.host = u.host;
    const req = lib.request({
      protocol: u.protocol,
      hostname: address.address,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: headers,
      servername: u.hostname, agent: false,
      timeout: Number(opts.timeoutMs) || 20000,
      lookup: function (hostname, options, cb) {
        if (options && options.all) return cb(null, [address]);
        return cb(null, address.address, address.family);
      }
    }, function (res) {
      const chunks = [];
      let size = 0;
      const max = Number(opts.maxBytes) || 10 * 1024 * 1024;
      res.on('data', function (c) {
        size += c.length;
        if (size > max) { req.destroy(new Error('响应超过大小限制')); return; }
        chunks.push(c);
      });
      res.on('end', function () { resolve(responseLike(res, Buffer.concat(chunks), u.toString())); });
    });
    req.on('timeout', function () { req.destroy(new Error('请求超时')); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
async function limitedResponse(raw, opts) {
  const res = await fetch(raw, opts);
  const max = Number(opts.maxBytes) || 10 * 1024 * 1024;
  const len = Number(res.headers.get('content-length')) || 0;
  if (len > max) { try { res.body && res.body.cancel(); } catch (e) { /* 忽略 */ } throw new Error('响应超过大小限制'); }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new Error('响应超过大小限制');
  return {
    status: res.status, ok: res.ok, url: res.url || String(raw),
    headers: res.headers,
    text: function () { return Promise.resolve(buf.toString('utf8')); },
    arrayBuffer: function () { return Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)); },
    body: { cancel: function () {} }
  };
}
async function safeFetch(raw, opts) {
  const o = opts || {};
  if (o.allowPrivate) return limitedResponse(raw, o);
  let current = String(raw || '');
  for (let hop = 0; hop < 5; hop++) {
    const gate = await urlGuard.assertPublicHttp(current, {});
    if (!gate.ok) throw new Error(gate.err);
    const u = new URL(current);
    let list = [];
    try { list = await dns.lookup(u.hostname, { all: true }); } catch (e) { throw new Error('域名解析失败'); }
    const address = list.filter(function (x) { return !urlGuard.privateIp(x.address); })[0];
    if (!address) throw new Error('域名解析到内网地址');
    const res = await requestOnce(u, address, o);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      const next = new URL(loc, u).toString();
      if (!urlGuard.sameSite(u.hostname, u.toString(), next)) throw new Error('重定向到外部域名');
      current = next;
      continue;
    }
    return res;
  }
  throw new Error('重定向次数过多');
}
module.exports = { safeFetch };

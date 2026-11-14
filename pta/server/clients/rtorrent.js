/* rTorrent XML-RPC 客户端：探测、加种、按 infohash 回查。
   不依赖本机路径；URL/账号/密码由下载器配置传入。 */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function xml(method, params) {
  const parts = (params || []).map(function (p) {
    if (p && p.b64) return '<param><value><base64>' + p.v + '</base64></value></param>';
    return '<param><value><string>' + esc(p && p.v !== undefined ? p.v : p) + '</string></value></param>';
  }).join('');
  return '<?xml version="1.0"?><methodCall><methodName>' + esc(method) + '</methodName><params>' + parts + '</params></methodCall>';
}
function endpoint(url) {
  const u = String(url || '').replace(/\/+$/, '');
  if (!u) throw new Error('rTorrent 地址为空');
  return /\/RPC2$/i.test(u) ? u : u + '/RPC2';
}
function decode(s) {
  return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
async function rpc(d, method, params, timeout) {
  const headers = { 'content-type': 'text/xml' };
  if (d.user) headers.authorization = 'Basic ' + Buffer.from(String(d.user) + ':' + String(d.pass || '')).toString('base64');
  const r = await fetch(endpoint(d.url), {
    method: 'POST', headers: headers,
    body: xml(method, params), signal: AbortSignal.timeout(timeout || 8000)
  });
  const text = await r.text();
  const fault = /<fault>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<string>([^<]*)<\/string>/.exec(text);
  if (!r.ok || fault) {
    throw new Error('rTorrent ' + method + ' 失败：' + (fault ? fault[2] : 'HTTP ' + r.status));
  }
  return text;
}
function firstString(text) {
  const m = /<string>([\s\S]*?)<\/string>/.exec(text);
  return m ? decode(m[1]) : '';
}
async function test(d) {
  const t0 = Date.now();
  const text = await rpc(d, 'system.client_version', []);
  return { pass: true, version: firstString(text) || 'rTorrent',
    steps: [{ step: 'xmlrpc', ok: true, ms: Date.now() - t0 }] };
}
async function addTorrent(d, buf, opts) {
  const text = await rpc(d, 'load.raw_start', [{ v: '' }, { v: Buffer.from(buf).toString('base64'), b64: true }], 20000);
  return { ok: true, message: firstString(text) || 'load.raw_start', name: (opts && opts.filename) || 'upload.torrent' };
}
async function findTorrent(d, hash) {
  if (!hash) return { found: false, state: '', progress: 0 };
  const text = await rpc(d, 'd.multicall2', [{ v: '' }, { v: '' }, { v: 'd.hash=' }]);
  const found = text.toLowerCase().indexOf(String(hash).toLowerCase()) >= 0;
  return { found: found, state: found ? 'rTorrent' : '', progress: 0 };
}
module.exports = { test, addTorrent, findTorrent };

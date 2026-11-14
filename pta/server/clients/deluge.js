/* Deluge Web JSON-RPC 客户端：探测、加种、按 infohash 回查。
   URL/密码由下载器配置传入；不依赖本机路径。 */
function endpoint(url) {
  const u = String(url || '').replace(/\/+$/, '');
  if (!u) throw new Error('Deluge 地址为空');
  return /\/json$/i.test(u) ? u : u + '/json';
}
async function call(d, method, params, cookie, timeout) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const r = await fetch(endpoint(d.url), {
    method: 'POST', headers: headers,
    body: JSON.stringify({ method: method, params: params || [], id: 1 }),
    signal: AbortSignal.timeout(timeout || 8000)
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('Deluge 返回不是 JSON：' + text.slice(0, 80)); }
  if (!r.ok || j.error) throw new Error('Deluge ' + method + ' 失败：' + ((j.error && j.error.message) || ('HTTP ' + r.status)));
  const sc = (r.headers.get('set-cookie') || '').split(';')[0];
  return { result: j.result, cookie: sc };
}
async function login(d) {
  const r = await call(d, 'auth.login', [String(d.pass || '')], '');
  if (r.result !== true) throw new Error('Deluge 登录失败：密码不对或 Web 未启用');
  return r.cookie;
}
async function test(d) {
  const t0 = Date.now();
  const cookie = await login(d);
  const r = await call(d, 'daemon.get_version', [], cookie);
  return { pass: true, version: String(r.result || 'Deluge'),
    steps: [{ step: 'login', ok: true, ms: Date.now() - t0 }, { step: 'version', ok: true }] };
}
async function addTorrent(d, buf, opts) {
  const cookie = await login(d);
  const filename = (opts && opts.filename) || 'upload.torrent';
  const options = { add_paused: false };
  if (opts && opts.savePath) options.download_location = opts.savePath;
  const r = await call(d, 'core.add_torrent_file', [filename, Buffer.from(buf).toString('base64'), options], cookie, 20000);
  return { ok: !!r.result, message: 'add_torrent_file', hash: String(r.result || '') };
}
async function findTorrent(d, hash) {
  if (!hash) return { found: false, state: '', progress: 0 };
  const cookie = await login(d);
  const r = await call(d, 'core.get_torrents_status', [{}, ['name', 'state', 'progress', 'hash']], cookie);
  const map = r.result || {};
  const hit = map[hash] || map[String(hash).toLowerCase()];
  if (!hit) return { found: false, state: '', progress: 0 };
  return { found: true, state: hit.state || '', progress: Number(hit.progress) || 0 };
}
module.exports = { test, addTorrent, findTorrent };

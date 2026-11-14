/* rTorrent / Deluge 客户端夹具：本地 mock XML-RPC / JSON-RPC。不连真实下载器。 */
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rt = require(path.join(ROOT, 'server', 'clients', 'rtorrent.js'));
const dl = require(path.join(ROOT, 'server', 'clients', 'deluge.js'));
const INFO = Buffer.from('d4:name4:test6:lengthi1ee');
const HASH = crypto.createHash('sha1').update(INFO).digest('hex');
const TORRENT = Buffer.concat([Buffer.from('d8:announce15:http://mock/ann4:info'), INFO, Buffer.from('e')]);
const results = [];
const hits = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function listen(handler) {
  return new Promise(function (resolve) {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', function () { resolve({ server: s, base: 'http://127.0.0.1:' + s.address().port }); });
  });
}
function read(req) {
  return new Promise(function (resolve) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}

async function main() {
  const rtMock = await listen(async function (req, res) {
    const body = await read(req);
    hits.push({ kind: 'rt', path: req.url, body: body });
    let out = '';
    if (body.indexOf('system.client_version') >= 0) {
      out = '<?xml version="1.0"?><methodResponse><params><param><value><string>0.9.8</string></value></param></params></methodResponse>';
    } else if (body.indexOf('load.raw_start') >= 0) {
      out = '<?xml version="1.0"?><methodResponse><params><param><value><string>ok</string></value></param></params></methodResponse>';
    } else if (body.indexOf('d.multicall2') >= 0) {
      out = '<?xml version="1.0"?><methodResponse><params><param><value><array><data><value><string>' + HASH + '</string></value></data></array></value></param></params></methodResponse>';
    } else {
      out = '<?xml version="1.0"?><methodResponse><fault><value><struct><member><name>faultString</name><value><string>unknown</string></value></member></struct></value></fault></methodResponse>';
    }
    res.writeHead(200, { 'content-type': 'text/xml' });
    res.end(out);
  });

  const dlMock = await listen(async function (req, res) {
    const body = await read(req);
    let j = {};
    try { j = JSON.parse(body); } catch (e) {}
    hits.push({ kind: 'dl', path: req.url, body: j });
    let result = null;
    const headers = { 'content-type': 'application/json' };
    if (j.method === 'auth.login') { result = true; headers['set-cookie'] = '_session_id=abc; Path=/'; }
    else if (j.method === 'daemon.get_version') result = '2.1.1';
    else if (j.method === 'core.add_torrent_file') result = HASH;
    else if (j.method === 'core.get_torrents_status') result = {};
    if (j.method === 'core.get_torrents_status') result[HASH] = { hash: HASH, state: 'Seeding', progress: 100 };
    res.writeHead(200, headers);
    res.end(JSON.stringify({ result: result, error: null, id: j.id || 1 }));
  });

  const RT = { url: rtMock.base, user: 'u', pass: 'p' };
  const DL = { url: dlMock.base, pass: 'secret' };

  await check('rTorrent 探测', async function () {
    const r = await rt.test(RT);
    need(r.pass === true && /^0\.9/.test(r.version), '版本不对：' + JSON.stringify(r));
    const hit = hits.filter(function (x) { return x.kind === 'rt'; })[0];
    need(hit && /system\.client_version/.test(hit.body), '没发 XML-RPC');
  });

  await check('rTorrent 加种并回查', async function () {
    const add = await rt.addTorrent(RT, TORRENT, { filename: 'test.torrent' });
    need(add.ok === true, '加种失败：' + JSON.stringify(add));
    const hit = hits.filter(function (x) { return x.kind === 'rt' && /load\.raw_start/.test(x.body); })[0];
    need(hit && /<base64>/.test(hit.body), '没发 load.raw_start/base64');
    const chk = await rt.findTorrent(RT, HASH);
    need(chk.found === true, '回查没找到：' + JSON.stringify(chk));
  });

  await check('Deluge 探测', async function () {
    const r = await dl.test(DL);
    need(r.pass === true && r.version === '2.1.1', '版本不对：' + JSON.stringify(r));
    const login = hits.filter(function (x) { return x.kind === 'dl' && x.body.method === 'auth.login'; })[0];
    need(login && login.body.params[0] === 'secret', '登录密码没带');
  });

  await check('Deluge 加种并回查', async function () {
    const add = await dl.addTorrent(DL, TORRENT, { filename: 'test.torrent' });
    need(add.ok === true && add.hash === HASH, '加种失败：' + JSON.stringify(add));
    const hit = hits.filter(function (x) { return x.kind === 'dl' && x.body.method === 'core.add_torrent_file'; })[0];
    need(hit && hit.body.params[0] === 'test.torrent', '文件名没带');
    need(hit && hit.body.params[1] === TORRENT.toString('base64'), 'base64 不对');
    const chk = await dl.findTorrent(DL, HASH);
    need(chk.found === true && chk.state === 'Seeding', '回查不对：' + JSON.stringify(chk));
  });

  rtMock.server.close();
  dlMock.server.close();
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});

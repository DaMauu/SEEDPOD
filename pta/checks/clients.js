/* 客户端夹具：watch 目录 + 临时 v2 后端 + mock 种子源。
   验证 watch 写入/探测、下载器 kind、连接测试、发布链路。不联网。 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8100);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-clients-'));
const WATCH = path.join(DATA, 'watch');
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const watch = require(path.join(ROOT, 'server', 'clients', 'watch.js'));
const { makeQb } = require(path.join(ROOT, 'server', 'qb.js'));
const qb = makeQb(DATA);
const INFO = Buffer.from('d4:name4:test6:lengthi1ee');
const HASH = crypto.createHash('sha1').update(INFO).digest('hex');
const TORRENT = Buffer.concat([Buffer.from('d8:announce15:http://mock/ann4:info'), INFO, Buffer.from('e')]);
const results = [];
let cookie = '';
let sourceHits = 0;

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function fetchA(url, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookie) o.headers.cookie = cookie;
  return fetch(url, o);
}
async function json(url, opts) {
  const r = await fetchA(url, opts);
  return { status: r.status, body: await r.json().catch(function () { return null; }) };
}
function listen(handler) {
  return new Promise(function (resolve) {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', function () { resolve({ server: s, base: 'http://127.0.0.1:' + s.address().port }); });
  });
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('v2 服务没起来');
}
function torrentFiles() {
  try { return fs.readdirSync(WATCH).filter(function (f) { return /\.torrent$/i.test(f); }); } catch (e) { return []; }
}

async function main() {
  await check('watch 模块：路径校验、写入、探测', async function () {
    need(watch.normDir('relative/path').err, '相对路径没被拒');
    need(watch.normDir('/').err, '根目录没被拒');
    const t = watch.test({ dir: WATCH });
    need(t.pass === true, '目录探测失败：' + t.error);
    const w = watch.addTorrent({ dir: WATCH, buf: TORRENT, filename: 'test.torrent' });
    need(w.ok === true && fs.existsSync(w.path), '写入失败：' + w.message);
    need(fs.readFileSync(w.path).equals(TORRENT), '写入内容不一致');
    need((fs.statSync(w.path).mode & 0o777) === 0o600, '权限不是 0600');
  });

  const src = await listen(function (req, res) {
    if (req.url.split('?')[0] === '/t.torrent') {
      sourceHits++;
      res.writeHead(200, { 'content-type': 'application/x-bittorrent' });
      res.end(TORRENT);
      return;
    }
    res.writeHead(404); res.end('');
  });

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS, PTA_ALLOW_REAL: '1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill(); src.server.close(); process.exit(2);
  }
  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  need(login.ok && cookie.indexOf('pta_sid=') === 0, '登录失败');

  let dlId = '';

  await check('创建 watch 下载器并列出', async function () {
    const j = await json(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'watch', name: 'watch', watchPath: WATCH })
    });
    need(j.status === 200 && j.body.ok, '创建失败：' + JSON.stringify(j.body && j.body.error));
    dlId = j.body.data.id;
    need(j.body.data.kind === 'watch' && j.body.data.watchPath === WATCH, 'kind/watchPath 不对');
    const l = await json(BASE + '/api/downloaders');
    const hit = (l.body.data || []).filter(function (x) { return x.id === dlId; })[0];
    need(hit && hit.kind === 'watch', '列表没回 kind');
  });

  await check('watch 连接测试', async function () {
    const j = await json(BASE + '/api/downloaders/' + encodeURIComponent(dlId) + '/test', { method: 'POST' });
    need(j.status === 200 && j.body.ok && j.body.data.pass === true, '测试失败：' + JSON.stringify(j.body));
    need(j.body.data.version === 'watch', 'version 不对：' + j.body.data.version);
    const l = await json(BASE + '/api/downloaders');
    const hit = (l.body.data || []).filter(function (x) { return x.id === dlId; })[0];
    need(hit && hit.lastProbe && hit.lastProbe.pass === true, 'lastProbe 没写');
  });

  await check('发布到 watch 目录', async function () {
    const cred = await json(BASE + '/api/credentials/demo-a.example', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'sid=source-cookie' })
    });
    need(cred.status === 200 && cred.body.ok, '来源 cookie 保存失败');
    const item = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Watch Publish 2020 1080p', site: 'demo-a.example', targetSite: 'target.example',
        downloadUrl: src.base + '/t.torrent', status: 'approved', size: '20 GB' })
    });
    need(item.status === 200 && item.body.ok, '建队列失败');
    const id = item.body.data.id;
    const before = torrentFiles().length;
    const dry = await json(BASE + '/api/publish/' + encodeURIComponent(id), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true })
    });
    need(dry.body.ok && dry.body.data.dryRun === true, '演练失败');
    need(torrentFiles().length === before, '演练不该写 watch 目录');
    const real = await json(BASE + '/api/publish/' + encodeURIComponent(id), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: false })
    });
    need(real.status === 200 && real.body.ok, '发布失败：' + JSON.stringify(real.body && real.body.error));
    need(real.body.data.qb && real.body.data.qb.client === 'watch', '发布没走 watch：' + JSON.stringify(real.body.data.qb));
    need(real.body.data.qb.verified === true && real.body.data.qb.hash === HASH, 'watch 校验/hash 不对');
    need(sourceHits === 1, '种子源请求次数不对：' + sourceHits);
    const files = torrentFiles();
    need(files.length === before + 1, 'watch 目录没多一个种子：' + files.join(','));
    const added = files.filter(function (f) { return f !== 'test.torrent'; });
    need(added.length === 1, '找不到新增的种子');
    const buf = fs.readFileSync(path.join(WATCH, added[0]));
    need(buf.equals(TORRENT), 'watch 里的种子内容不一致');
    need(qb.parseTorrent(buf).hash === HASH, 'watch 种子 hash 不一致');
    const g = await json(BASE + '/api/queue/' + encodeURIComponent(id));
    need(g.body.data.status === 'published', '状态不是 published：' + g.body.data.status);
    need(g.body.data.qb && g.body.data.qb.client === 'watch', '队列没记 watch');
    need(/watch/.test(g.body.data.pubMsg || ''), 'pubMsg 没提 watch：' + g.body.data.pubMsg);
  });

  child.kill();
  src.server.close();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) {}
  process.exit(1);
});

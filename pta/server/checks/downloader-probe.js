/* 路由级夹具：/api/downloaders/probe 的私网策略。
   服务端用 PTA_DOWNLOADER_ALLOW=127.0.0.1、DENY=10.0.0.9 启动。 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8103);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-dl-probe-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const results = [];
let cookie = '';

function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
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

(async function () {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS,
      PTA_DOWNLOADER_ALLOW: '127.0.0.1', PTA_DOWNLOADER_DENY: '10.0.0.9',
      PTA_DOWNLOADER_ALLOW_PRIVATE: '',
      PTA_DL_TIMEOUT_MS: '500'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  let slow = null, qbmock = null;
  let qbLogins = 0, qbDlId = '', slowDlId = '';
  let catsExpire = false, cats403 = false;
  try {
    slow = http.createServer(function (req, res) { setTimeout(function () { try { res.writeHead(200); res.end('v4.6.0'); } catch (e) { /* 已断开 */ } }, 1500); });
    await new Promise(function (r) { slow.listen(0, '127.0.0.1', r); });
    const slowUrl = 'http://127.0.0.1:' + slow.address().port;
    qbmock = http.createServer(function (req, res) {
      if (req.method === 'POST' && req.url === '/api/v2/auth/login') { qbLogins++; res.writeHead(200, { 'set-cookie': 'SID=good; Path=/' }); res.end('Ok.'); return; }
      if (req.url.indexOf('/api/v2/torrents/categories') === 0 && catsExpire) { catsExpire = false; res.writeHead(401); res.end('expired'); return; }
      if (req.url.indexOf('/api/v2/torrents/categories') === 0 && cats403) { res.writeHead(403); res.end('forbidden'); return; }
      if (String(req.headers.cookie || '').indexOf('SID=good') < 0) { res.writeHead(401); res.end('Forbidden'); return; }
      if (req.url === '/api/v2/app/version') { res.writeHead(200); res.end('v4.6.0'); return; }
      if (req.url === '/api/v2/sync/maindata') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ server_state: { free_space_on_disk: 123, save_path: '/dl' } })); return; }
      if (req.url.indexOf('/api/v2/torrents/categories') === 0) {
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ movie: { name: '电影', savePath: '/dl' } })); return;
      }
      res.writeHead(404); res.end();
    });
    await new Promise(function (r) { qbmock.listen(0, '127.0.0.1', r); });
    const qbUrl = 'http://127.0.0.1:' + qbmock.address().port;
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) { /* 等启动 */ }
      await new Promise(function (r) { setTimeout(r, 120); });
    }
    const lr = await fetch(BASE + '/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: USER, pass: PASS })
    });
    cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    need(lr.ok && cookie.indexOf('pta_sid=') === 0, '登录失败：' + lr.status);

    await check('默认拒绝私网探针', async function () {
      const r = await json(BASE + '/api/downloaders/probe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'qb', url: 'http://192.168.1.5:8080' })
      });
      need(r.status === 409, '私网状态码不对：' + r.status);
      need(r.body && r.body.error && r.body.error.code === 'DOWNLOADER_PRIVATE_BLOCKED', '错误码不对：' + JSON.stringify(r.body && r.body.error));
    });

    await check('白名单允许探针到指定内网', async function () {
      const r = await json(BASE + '/api/downloaders/probe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'qb', url: 'http://127.0.0.1:1' })
      });
      need(r.status === 200 && r.body && r.body.ok, '白名单被拒：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
      need(r.body.data && r.body.data.pass === false, '端口 1 不该探测成功');
    });

    await check('已存下载器测试会重新登录并记录 lastProbe', async function () {
      const add = await json(BASE + '/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'probe-stored', url: qbUrl, user: 'u', pass: 'p' })
      });
      need(add.status === 200 && add.body.ok, '建下载器失败：' + JSON.stringify(add.body && add.body.error));
      const id = add.body.data.id;
      const r = await json(BASE + '/api/downloaders/' + encodeURIComponent(id) + '/test', { method: 'POST', body: '{}' });
      need(r.status === 200 && r.body.ok && r.body.data.pass === true, '测试失败：' + JSON.stringify(r.body && r.body.error));
      need(qbLogins >= 1, '没走登录');
      const list = await (await fetchA(BASE + '/api/downloaders')).json();
      const hit = (list.data || []).filter(function (x) { return x.id === id; })[0];
      need(hit && hit.lastProbe && hit.lastProbe.pass === true, 'lastProbe 没写：' + JSON.stringify(hit && hit.lastProbe));
      qbDlId = id;
    });

    await check('已存下载器测试超时快速失败并记 lastProbe', async function () {
      const add = await json(BASE + '/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'probe-slow', url: slowUrl, user: 'u', pass: 'p' })
      });
      need(add.status === 200 && add.body && add.body.ok, '建慢下载器失败：' + JSON.stringify(add.body && add.body.error));
      const id = add.body.data.id;
      slowDlId = id;
      const t = Date.now();
      const r = await json(BASE + '/api/downloaders/' + encodeURIComponent(id) + '/test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ timeoutMs: 150 })
      });
      need(r.status === 200 && r.body.data.pass === false, '超时测试没失败');
      need(Date.now() - t < 1200, '超时测试没快速返回：' + (Date.now() - t));
      const list = await (await fetchA(BASE + '/api/downloaders')).json();
      const hit = (list.data || []).filter(function (x) { return x.id === id; })[0];
      need(hit && hit.lastProbe && hit.lastProbe.pass === false, '超时 lastProbe 不对：' + JSON.stringify(hit && hit.lastProbe));
    });

    await check('分类读取会自动重登并返回列表', async function () {
      const r = await json(BASE + '/api/downloaders/' + encodeURIComponent(qbDlId) + '/cats');
      need(r.status === 200 && r.body.ok && r.body.data.cats.length === 1, '分类读取失败：' + JSON.stringify(r.body));
      const before = qbLogins;
      catsExpire = true;
      const r2 = await json(BASE + '/api/downloaders/' + encodeURIComponent(qbDlId) + '/cats');
      need(r2.status === 200 && r2.body.data.cats.length === 1, '过期后分类失败：' + JSON.stringify(r2.body));
      need(qbLogins > before, '过期后没重登');
    });

    await check('分类读取 403/404/超时都返回明确错误', async function () {
      cats403 = true;
      const r403 = await json(BASE + '/api/downloaders/' + encodeURIComponent(qbDlId) + '/cats');
      cats403 = false;
      need(r403.status === 502 && r403.body.error.code === 'QB_CATS_FAILED', '403 错误不对：' + JSON.stringify(r403));
      const r404 = await json(BASE + '/api/downloaders/no-such-id/cats');
      need(r404.status === 404, '404 状态不对：' + r404.status);
      const t = Date.now();
      const rSlow = await json(BASE + '/api/downloaders/' + encodeURIComponent(slowDlId) + '/cats');
      need(rSlow.status === 502 && Date.now() - t < 1200, '超时分类没快速失败：' + rSlow.status + ' / ' + (Date.now() - t));
    });

    await check('探测超时返回失败且不卡住', async function () {
      const t = Date.now();
      const r = await json(BASE + '/api/downloaders/probe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'qb', url: slowUrl, timeoutMs: 150 })
      });
      const ms = Date.now() - t;
      need(r.status === 200 && r.body && r.body.ok, '超时状态不对：' + r.status);
      need(r.body.data && r.body.data.pass === false, '超时没返回失败');
      need(ms < 1200, '超时没及时返回：' + ms);
      need(JSON.stringify(r.body.data.steps).indexOf('超时') >= 0, '步骤没标超时：' + JSON.stringify(r.body.data.steps));
    });

    await check('并发探测各自超时互不阻塞', async function () {
      const t = Date.now();
      const list = await Promise.all([0, 1, 2].map(function () {
        return json(BASE + '/api/downloaders/probe', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'qb', url: slowUrl, timeoutMs: 150 })
        });
      }));
      need(list.every(function (x) { return x.status === 200 && x.body.data && x.body.data.pass === false; }), '并发结果不对：' + JSON.stringify(list.map(function (x) { return x.status; })));
      need(Date.now() - t < 1500, '并发探测串行超时：' + (Date.now() - t));
    });

    await check('黑名单优先于私网默认拒绝', async function () {
      const r = await json(BASE + '/api/downloaders/probe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'qb', url: 'http://10.0.0.9:8080' })
      });
      need(r.status === 409, '黑名单状态码不对：' + r.status);
      need(r.body && r.body.error && r.body.error.code === 'DOWNLOADER_DENIED', '黑名单错误码不对：' + JSON.stringify(r.body && r.body.error));
    });
  } finally {
    if (slow) slow.close();
    if (qbmock) qbmock.close();
    child.kill('SIGTERM');
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

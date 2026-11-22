/* qB 会话续期：会话过期自动重登、模拟服务重启后新实例重新登录；watch 探测失败可见。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeQb } = require('../src/features/downloaders/qb');
const watch = require('../clients/watch');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-qbrec-'));
const qb = makeQb(DATA);
const results = [];
let sid = 'SID=good';
let logins = 0;
let expireNext = false;
let slowVersion = false;
const server = http.createServer(function (req, res) {
  const cookie = String(req.headers.cookie || '');
  if (req.method === 'POST' && req.url === '/api/v2/auth/login') {
    logins++;
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      if (!/username=u/.test(body) || !/password=p/.test(body)) { res.writeHead(403); res.end('Fails.'); return; }
      sid = 'SID=good';
      res.writeHead(200, { 'set-cookie': sid + '; Path=/' });
      res.end('Ok.');
    });
    return;
  }
  if (req.url.indexOf('/api/v2/') === 0) {
    if (req.url === '/api/v2/app/version' && slowVersion) { setTimeout(function () { try { res.writeHead(200); res.end('v4.6.0'); } catch (e) { /* 已断开 */ } }, 400); return; }
    if (expireNext) { expireNext = false; res.writeHead(401); res.end('expired'); return; }
    if (cookie.indexOf(sid.split('=')[1]) < 0) { res.writeHead(401); res.end('Forbidden'); return; }
    if (req.url === '/api/v2/app/version') { res.writeHead(200); res.end('v4.6.0'); return; }
    if (req.url === '/api/v2/sync/maindata') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ server_state: { free_space_on_disk: 12345, save_path: '/dl' } })); return; }
    if (req.url === '/api/v2/torrents/info') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify([{ hash: 'a'.repeat(40), name: 'x', progress: 1, state: 'uploading', save_path: '/dl' }])); return; }
    if (req.url === '/api/v2/torrents/categories') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
    if (req.url === '/api/v2/torrents/add' || req.url === '/api/v2/torrents/delete') { res.writeHead(200); res.end('Ok.'); return; }
  }
  res.writeHead(404); res.end();
});
const BUF = Buffer.from('d4:infod4:name1:x6:lengthi1eeee');

(async function () {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const probe = { url: base, user: 'u', pass: 'p' };
    const r1 = await qb.probeDownloader(probe);
    if (!(r1.pass === true && logins >= 1)) throw new Error('首次探测失败：' + JSON.stringify(r1));
    results.push([true, '首次探测会登录', '']);

    expireNext = true;
    const add = await qb.addTorrent(probe, BUF, { filename: 'x.torrent' });
    if (!(add.ok && logins >= 2)) throw new Error('会话过期没重登：' + JSON.stringify({ add: add, logins: logins }));
    results.push([true, '会话过期后自动重登再提交', '']);

    const qb2 = makeQb(DATA);
    const before = logins;
    const r2 = await qb2.probeDownloader(probe);
    if (!(r2.pass === true && logins === before + 1)) throw new Error('重启后没重新登录：' + JSON.stringify({ r: r2, logins: logins - before }));
    results.push([true, '模拟重启后新实例重新登录', '']);

    const qb3 = makeQb(DATA);
    const [c1, c2] = await Promise.all([qb2.probeDownloader(probe), qb3.probeDownloader(probe)]);
    if (!(c1.pass === true && c2.pass === true)) throw new Error('并发探测失败：' + JSON.stringify({ c1: c1, c2: c2 }));
    results.push([true, '并发探测各自登录不串会话', '']);

    slowVersion = true;
    const beforeCancel = logins;
    const ac = new AbortController();
    const tCancel = Date.now();
    const pending = qb.probeDownloader(probe, { signal: ac.signal });
    setTimeout(function () { ac.abort(); }, 80);
    const cancelled = await pending;
    slowVersion = false;
    if (cancelled.pass !== false) throw new Error('取消后仍成功：' + JSON.stringify(cancelled));
    if (Date.now() - tCancel > 800) throw new Error('取消没快速返回：' + (Date.now() - tCancel));
    if (logins !== beforeCancel) throw new Error('取消后仍去登录：' + (logins - beforeCancel));
    results.push([true, '调用方 AbortSignal 取消快速返回且不登录', '']);

    const prevTimeout = process.env.PTA_DL_TIMEOUT_MS;
    process.env.PTA_DL_TIMEOUT_MS = '120';
    const qbFast = makeQb(DATA);
    slowVersion = true;
    const slow = await qbFast.probeDownloader(probe);
    slowVersion = false;
    if (prevTimeout === undefined) delete process.env.PTA_DL_TIMEOUT_MS; else process.env.PTA_DL_TIMEOUT_MS = prevTimeout;
    if (slow.pass !== false) throw new Error('超时探测没失败：' + JSON.stringify(slow));
    results.push([true, '探测超时会明确失败', '']);

    const ro = path.join(DATA, 'readonly');
    fs.mkdirSync(ro, { recursive: true, mode: 0o500 });
    const w = watch.test({ dir: ro });
    fs.chmodSync(ro, 0o700);
    if (w.pass !== false || !w.error) throw new Error('只读 watch 没报错：' + JSON.stringify(w));
    results.push([true, 'watch 目录不可写会明确失败', '']);
  } catch (e) {
    results.push([false, 'qb-recovery', e && e.message ? e.message : String(e)]);
  } finally {
    server.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

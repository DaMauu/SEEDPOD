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
process.env.PTA_DATA = DATA;
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
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* 忽略：失败不影响主流程 */ }
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
    need(watch.normDir('/etc').err, '系统目录没被拒');
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

  await check('watch 写入失败不留临时文件，修复后可重试', async function () {
    const dir = path.join(DATA, 'watch-fail');
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'blocked.torrent'));
    const bad = watch.addTorrent({ dir: dir, buf: TORRENT, filename: 'blocked.torrent' });
    need(!bad.ok, '冲突目录仍写入成功');
    const leftovers = fs.readdirSync(dir).filter(function (f) { return /\.tmp$/.test(f); });
    need(leftovers.length === 0, '失败后留了临时文件：' + JSON.stringify(leftovers));
    fs.rmdirSync(path.join(dir, 'blocked.torrent'));
    const ok = watch.addTorrent({ dir: dir, buf: TORRENT, filename: 'blocked.torrent' });
    need(ok.ok && fs.existsSync(ok.path), '修复后仍写不进');
    fs.unlinkSync(ok.path);
  });

  await check('watch 并发写入不留临时文件', async function () {
    const dir = path.join(DATA, 'watch-concurrent');
    fs.mkdirSync(dir, { recursive: true });
    const list = await Promise.all([0, 1, 2, 3, 4].map(function (i) {
      return Promise.resolve(watch.addTorrent({ dir: dir, buf: TORRENT, filename: 'c' + i + '.torrent' }));
    }));
    need(list.every(function (x) { return x.ok; }), '并发写入失败：' + JSON.stringify(list));
    need(list.every(function (x) { return fs.existsSync(x.path); }), '并发文件缺失');
    const leftovers = fs.readdirSync(dir).filter(function (f) { return /\.tmp$/.test(f); });
    need(leftovers.length === 0, '并发后留了临时文件：' + JSON.stringify(leftovers));
    list.forEach(function (x) { fs.unlinkSync(x.path); });
  });

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
    const cred = await json(BASE + '/api/credentials/127.0.0.1', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'sid=source-cookie' })
    });
    need(cred.status === 200 && cred.body.ok, '来源 cookie 保存失败');
    const item = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Watch Publish 2020 1080p', site: '127.0.0.1', targetSite: 'target.example',
        downloadUrl: src.base + '/t.torrent', status: 'approved', size: '20 GB', infohash: HASH })
    });
    need(item.status === 200 && item.body.ok, '建队列失败');
    const id = item.body.data.id;
    const before = torrentFiles().length;
    const inj = await json(BASE + '/api/queue/' + encodeURIComponent(id) + '/inject', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true })
    });
    need(inj.status === 200 && inj.body.ok, '注入演练失败：' + JSON.stringify(inj.body && inj.body.error));
    need(inj.body.data.client === 'watch' && inj.body.data.wouldWrite === true, 'watch 演练没写计划：' + JSON.stringify(inj.body.data));
    need(inj.body.data.watchPath === WATCH && inj.body.data.hash === HASH, 'watch 路径/hash 不对');
    need(inj.body.data.idempotent === false && inj.body.data.retry === false, '初次演练不该是幂等/重试');
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
    const again = await json(BASE + '/api/queue/' + encodeURIComponent(id) + '/inject', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true })
    });
    need(again.body.ok && again.body.data.idempotent === true && again.body.data.alreadyInjected === true && again.body.data.skipped === true, '注入幂等不对：' + JSON.stringify(again.body.data));
  });

  await check('调度重试 failed 条目', async function () {
    const item = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Watch Retry 2020 1080p', site: '127.0.0.1', targetSite: 'target.example',
        downloadUrl: src.base + '/t.torrent', status: 'failed', size: '20 GB', retries: 0 })
    });
    need(item.status === 200 && item.body.ok, '建 failed 队列失败：' + JSON.stringify(item.body && item.body.error));
    const id = item.body.data.id;
    const before = torrentFiles().length;
    const run = await json(BASE + '/api/scheduler/run', { method: 'POST' });
    need(run.status === 200 && run.body.ok, '调度运行失败：' + JSON.stringify(run.body && run.body.error));
    const retry = run.body.data.retry;
    need(retry && retry.checked >= 1 && retry.ok >= 1, '重试没跑：' + JSON.stringify(retry));
    const g = await json(BASE + '/api/queue/' + encodeURIComponent(id));
    need(g.body.data.status === 'published', '重试后状态不是 published：' + g.body.data.status);
    need(g.body.data.qb && g.body.data.qb.client === 'watch', '重试没走 watch');
    need(torrentFiles().length === before + 1, '重试没写 watch 目录');
  });

  await check('注入演练：qB 计划与失败重试', async function () {
    const qbDl = await json(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'qb', name: 'qb-dry', url: 'http://127.0.0.1:1' })
    });
    need(qbDl.status === 200 && qbDl.body.ok, 'qB 下载器创建失败：' + JSON.stringify(qbDl.body && qbDl.body.error));
    const item = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Inject Retry 2020 1080p', site: '127.0.0.1', targetSite: 'target.example',
        downloadUrl: src.base + '/t.torrent', status: 'approved', size: '20 GB', infohash: HASH,
        stage: 'failed', stageFailedFrom: 'injected', stageNextRetryAt: new Date(Date.now() + 60000).toISOString() })
    });
    need(item.status === 200 && item.body.ok, '建重试队列失败');
    const r = await json(BASE + '/api/queue/' + encodeURIComponent(item.body.data.id) + '/inject', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun: true, downloaderId: qbDl.body.data.id })
    });
    need(r.status === 200 && r.body.ok, 'qB 演练失败：' + JSON.stringify(r.body && r.body.error));
    need(r.body.data.client === 'qb' && r.body.data.wouldAdd === true, 'qB 演练计划不对：' + JSON.stringify(r.body.data));
    need(r.body.data.retry === true && r.body.data.nextRetryAt, '失败重试标记不对：' + JSON.stringify(r.body.data));
  });

  await check('rTorrent/Deluge 类型已移除', async function () {
    for (const kind of ['rtorrent', 'deluge']) {
      const j = await json(BASE + '/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: kind, url: 'http://127.0.0.1:1' })
      });
      need(j.status === 400 && j.body && j.body.error && j.body.error.code === 'UNSUPPORTED_DOWNLOADER',
        kind + ' 没被拒：' + j.status + ' ' + JSON.stringify(j.body && j.body.error));
    }
  });

  child.kill();
  src.server.close();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) { /* 忽略：失败不影响主流程 */ }
  process.exit(1);
});

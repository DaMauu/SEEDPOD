/* CLI 夹具：临时 v2 后端 + 真实 `pta` 子进程。
   覆盖 status/crawl 干跑/screen/queue/publish 干跑/targets/参数校验。 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8101);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-cli-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const PKG = require(path.join(ROOT, '..', 'package.json'));
const results = [];
let cookie = '';
let queueId = '';

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
  if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  if (o.body) o.headers['content-type'] = o.headers['content-type'] || 'application/json';
  return fetch(BASE + url, o);
}
async function json(url, opts) {
  const r = await fetchA(url, opts);
  return { status: r.status, body: await r.json().catch(function () { return null; }) };
}
function cli(args) {
  return new Promise(function (resolve) {
    execFile(process.execPath, [path.join(ROOT, 'cli.js')].concat(args), {
      env: Object.assign({}, process.env, { PTA_BASE: BASE, PTA_USER: USER, PTA_PASS: PASS }),
      timeout: 20000
    }, function (err, stdout, stderr) {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}
function cliLocal(args) {
  const env = Object.assign({}, process.env, { PTA_DATA: DATA });
  delete env.PTA_BASE; delete env.PTA_USER; delete env.PTA_PASS;
  return new Promise(function (resolve) {
    execFile(process.execPath, [path.join(ROOT, 'cli.js')].concat(args), { env, timeout: 20000 }, function (err, stdout, stderr) {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}
function tinyTorrent(file) {
  const announce = 'http://127.0.0.1:1/announce';
  const name = 'cli-local-test';
  const info = Buffer.concat([
    Buffer.from('d6:lengthi1048576e4:name' + Buffer.byteLength(name) + ':'),
    Buffer.from(name),
    Buffer.from('6:pieces20:'),
    Buffer.from('a'.repeat(20)),
    Buffer.from('e')
  ]);
  const buf = Buffer.concat([
    Buffer.from('d8:announce' + Buffer.byteLength(announce) + ':'),
    Buffer.from(announce),
    Buffer.from('4:info'),
    info,
    Buffer.from('e')
  ]);
  fs.writeFileSync(file, buf);
  return file;
}
function parse(r) {
  try { return JSON.parse(r.stdout); }
  catch (e) { throw new Error('CLI 输出不是 JSON：' + r.stdout.slice(0, 100) + ' / ' + r.stderr.slice(0, 100)); }
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('v2 服务没起来');
}

async function main() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill(); process.exit(2);
  }
  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  need(login.ok && cookie.indexOf('pta_sid=') === 0, '登录失败');

  const dl = await json('/api/downloaders', {
    method: 'POST', body: { name: 'cli-qb', url: 'http://127.0.0.1:1' }
  });
  need(dl.status === 200 && dl.body.ok, '下载器创建失败');
  const item = await json('/api/queue', {
    method: 'POST', body: { title: 'CLI Publish 2020 1080p', site: 'source.example',
      targetSite: 'target.example', status: 'approved', size: '20 GB' }
  });
  need(item.status === 200 && item.body.ok, '队列创建失败');
  queueId = item.body.data.id;
  const item2 = await json('/api/queue', {
    method: 'POST', body: { title: 'CLI Prepare 2021 2160p', site: 'source.example',
      targetSite: 'target.example', status: 'pending', size: '60 GB' }
  });
  need(item2.status === 200 && item2.body.ok, '第二个队列创建失败');
  const queueId2 = item2.body.data.id;

  await check('status --json', async function () {
    const j = parse(await cli(['status', '--json']));
    need(j.version === PKG.version, '版本不对：' + j.version + ' / ' + PKG.version);
    need(j.db === 'sqlite', 'db 不对：' + j.db);
    need(j.scheduler && typeof j.scheduler.on === 'boolean', '没有 scheduler');
  });

  await check('crawl 默认干跑', async function () {
    const j = parse(await cli(['crawl', '--site', 'demo.example', '--json']));
    need(j.dryRun === true, '默认不是干跑');
    need(Array.isArray(j.steps) && j.steps.length > 0, '没有演练步骤');
  });

  await check('screen --json', async function () {
    const j = parse(await cli(['screen', '--limit', '5', '--json']));
    need(typeof j.checked === 'number' && typeof j.selected === 'number', '返回字段不对');
  });

  await check('queue --status approved', async function () {
    const j = parse(await cli(['queue', '--status', 'approved', '--json']));
    need(Array.isArray(j.items) && j.items.some(function (x) { return x.id === queueId; }), '队列里没找到条目');
  });

  await check('publish 默认干跑', async function () {
    const j = parse(await cli(['publish', queueId, '--json']));
    need(j.dryRun === true, '默认不是干跑');
    need(j.qb && j.qb.wouldAdd === true, '没有 wouldAdd');
  });

  await check('prepare / preview / advance 阶段链', async function () {
    const p = parse(await cli(['prepare', queueId, '--json']));
    need(p.stage === 'prepared', 'prepare 阶段不对：' + p.stage);
    need(p.prepared && p.prepared.title, 'prepare 没有标题');
    const a = parse(await cli(['advance', queueId, '--json']));
    need(a.stage === 'previewed', 'advance 阶段不对：' + a.stage);
    const v = parse(await cli(['preview', queueId, '--json']));
    need(v.stage === 'previewed', 'preview 阶段不对：' + v.stage);
    need(v.prepared && v.prepared.subtitle, 'preview 没有副标题');
  });

  await check('run --stage prepared 批量准备', async function () {
    const j = parse(await cli(['run', '--stage', 'prepared', '--limit', '10', '--json']));
    need(j.checked >= 2, 'run 没检查到队列：' + j.checked);
    need(j.prepared >= 1, 'run 没有准备任何条目');
    const q = parse(await cli(['queue', '--json']));
    const it = q.items.find(function (x) { return x.id === queueId2; });
    need(it && it.stage === 'prepared', '第二个条目阶段不是 prepared：' + JSON.stringify(it && it.stage));
  });

  await check('targets --json 是数组', async function () {
    const j = parse(await cli(['targets', '--json']));
    need(Array.isArray(j), 'targets 不是数组');
  });

  await check('本地 status / queue 不启 HTTP', async function () {
    const status = JSON.parse((await cliLocal(['status', '--json'])).stdout);
    need(status.version === PKG.version && status.db === 'sqlite', '本地 status 不对');
    const q = JSON.parse((await cliLocal(['queue', '--json'])).stdout);
    need(Array.isArray(q.items) && q.items.some(function (x) { return x.id === queueId; }), '本地 queue 没找到条目');
  });

  await check('本地 prepare / preview / publish 干跑', async function () {
    const p = parse(await cliLocal(['prepare', queueId2, '--host', 'target.example', '--json']));
    need(p.stage === 'prepared' && p.prepared, '本地 prepare 失败');
    const v = parse(await cliLocal(['preview', queueId2, '--json']));
    need(v.stage === 'previewed', '本地 preview 失败');
    const pub = parse(await cliLocal(['publish', queueId, '--json']));
    need(pub.dryRun === true, '本地 publish 不是干跑');
  });

  await check('本地 target-upload 干跑', async function () {
    fs.mkdirSync(path.join(DATA, 'site-defs'), { recursive: true });
    fs.writeFileSync(path.join(DATA, 'site-defs', 'target.example.json'), JSON.stringify({
      host: 'target.example', base: 'https://target.example', engine: 'nexusphp'
    }));
    fs.writeFileSync(path.join(DATA, 'site-defs', 'target2.example.json'), JSON.stringify({
      host: 'target2.example', base: 'https://target2.example', engine: 'nexusphp'
    }));
    const torrent = tinyTorrent(path.join(DATA, 'tiny.torrent'));
    const prep = parse(await cliLocal(['prepare', queueId2, '--targets', 'target.example,target2.example,bad.example', '--json']));
    const u = parse(await cliLocal(['target-upload', queueId2, '--targets', 'target.example,target2.example,bad.example', '--torrent', torrent, '--json']));
    need(u.dryRun === true && Array.isArray(u.targets) && u.targets.length === 3, '多目标干跑数量不对');
    need(u.targets.filter(function (x) { return x.ok; }).length === 2, '多目标干跑成功数不对');
    need(u.targets.some(function (x) { return !x.ok && x.host === 'bad.example'; }), '缺定义的站没被单独标记失败');
    const planned = (prep.prepared && prep.prepared.targets && prep.prepared.targets[0] && prep.prepared.targets[0].target.fields) || {};
    const first = u.targets[0].data || {};
    Object.keys(planned).forEach(function (k) { need(first.fields[k] === planned[k], '上传字段没使用 prepared：' + k); });
  });

  await check('缺 --host 时退出码 2', async function () {
    const r = await cli(['verify', queueId]);
    need(r.code === 2, '退出码不是 2：' + r.code);
    need(/--host/.test(r.stderr), '错误提示没有 --host：' + r.stderr.slice(0, 100));
  });

  child.kill();
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

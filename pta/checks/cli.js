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

  await check('targets --json 是数组', async function () {
    const j = parse(await cli(['targets', '--json']));
    need(Array.isArray(j), 'targets 不是数组');
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

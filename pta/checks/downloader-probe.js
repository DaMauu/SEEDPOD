/* 路由级夹具：/api/downloaders/probe 的私网策略。
   服务端用 PTA_DOWNLOADER_ALLOW=127.0.0.1、DENY=10.0.0.9 启动。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
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
      PTA_DOWNLOADER_ALLOW_PRIVATE: ''
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  try {
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

    await check('黑名单优先于私网默认拒绝', async function () {
      const r = await json(BASE + '/api/downloaders/probe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'qb', url: 'http://10.0.0.9:8080' })
      });
      need(r.status === 409, '黑名单状态码不对：' + r.status);
      need(r.body && r.body.error && r.body.error.code === 'DOWNLOADER_DENIED', '黑名单错误码不对：' + JSON.stringify(r.body && r.body.error));
    });
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

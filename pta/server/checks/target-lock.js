/* 目标站真实提交硬闸：测试种子拦截、主站需输入域名确认。纯本地临时库，不发请求。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const uploadLock = require('../src/infra/upload-lock');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8099);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-lock-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const results = [];
let cookie = '';

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

(async function () {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'src', 'main.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, { PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'), PTA_USER: USER, PTA_PASS: PASS }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) { /* 等启动 */ }
      await new Promise(function (r) { setTimeout(r, 120); });
    }
    const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: USER, pass: PASS }) });
    cookie = (lr.headers.get('set-cookie') || '').split(';')[0];

    async function mk(title, targetSite) {
      const r = await fetchA(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, targetSite: targetSite, status: 'pending', downloadUrl: 'http://127.0.0.1:1/x.torrent' })
      });
      const j = await r.json();
      need(j.ok, '建队列失败：' + JSON.stringify(j));
      return j.data.id;
    }
    async function upload(id, extra) {
      const r = await fetchA(BASE + '/api/queue/' + encodeURIComponent(id) + '/targets/upload', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ dryRun: false, targets: [extra && extra.host] }, extra || {}))
      });
      const j = await r.json().catch(function () { return null; });
      return { status: r.status, body: j };
    }

    await check('提交锁被占用时回查/补标题都返回 409', async function () {
      const id = await mk('Lock Verify 2026 1080p', '127.0.0.1');
      const db = openDB(path.join(DATA, 'seedpod.db'));
      need(uploadLock.acquire(id, db) === true, '预占锁失败');
      try {
        const v = await fetchA(BASE + '/api/targets/127.0.0.1/verify', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: id })
        });
        const vj = await v.json().catch(function () { return null; });
        need(v.status === 409 && vj && vj.error && vj.error.code === 'UPLOAD_IN_PROGRESS', '回查没被锁拦住：' + v.status + ' ' + JSON.stringify(vj));
        const f = await fetchA(BASE + '/api/queue/' + encodeURIComponent(id) + '/fill-source-title', { method: 'POST' });
        const fj = await f.json().catch(function () { return null; });
        need(f.status === 409 && fj && fj.error && fj.error.code === 'UPLOAD_IN_PROGRESS', '补标题没被锁拦住：' + f.status + ' ' + JSON.stringify(fj));
      } finally {
        uploadLock.release(id, db);
        db.close();
      }
    });

    await check('标题像测试种子 → 403 TEST_ITEM_BLOCKED', async function () {
      const id = await mk('Sample 2026 720p', 'test.example');
      const r = await upload(id, { host: 'test.example' });
      need(r.status === 403 && r.body && r.body.error && r.body.error.code === 'TEST_ITEM_BLOCKED', '没拦住测试标题：' + JSON.stringify(r));
    });

    await check('测试站模式 → 主站 403 TEST_ONLY', async function () {
      const id = await mk('Normal Movie 2024 1080p', 'main.example');
      const r = await upload(id, { host: 'main.example' });
      need(r.status === 403 && r.body && r.body.error && r.body.error.code === 'TEST_ONLY', '没拦住主站：' + JSON.stringify(r));
    });

    await check('测试站模式 → 输入域名也不能发主站', async function () {
      const id = await mk('Normal Movie 2024 1080p', 'main.example');
      const r = await upload(id, { host: 'main.example', confirmHosts: ['main.example'] });
      need(r.status === 403 && r.body && r.body.error && r.body.error.code === 'TEST_ONLY', '确认后仍应拦：' + JSON.stringify(r));
    });

    await check('关闭测试站模式后，主站仍需输入域名', async function () {
      await fetchA(BASE + '/api/config/user', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ testOnly: false }) });
      const id = await mk('Normal Movie 2024 1080p', 'main.example');
      let r = await upload(id, { host: 'main.example' });
      need(r.status === 403 && r.body && r.body.error && r.body.error.code === 'MAIN_TARGET_LOCKED', '没要求确认：' + JSON.stringify(r));
      r = await upload(id, { host: 'main.example', confirmHosts: ['main.example'] });
      need(r.status === 409 && r.body && r.body.error && r.body.error.code === 'REAL_PUBLISH_DISABLED', '确认后状态不对：' + JSON.stringify(r));
      await fetchA(BASE + '/api/config/user', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ testOnly: true }) });
    });

    await check('测试站不需要主站确认', async function () {
      const id = await mk('Normal Movie 2024 1080p', 'test.example');
      const r = await upload(id, { host: 'test.example' });
      need(r.status === 409 && r.body && r.body.error && r.body.error.code === 'REAL_PUBLISH_DISABLED', '测试站被误拦：' + JSON.stringify(r));
    });
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

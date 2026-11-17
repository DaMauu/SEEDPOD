/* 阶段失败注入：NODE_ENV=test 时才读 SEEDPOD_FAIL_STEP；验证失败阶段不拖死后续阶段。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8095);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-failpoint-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const results = [];
let cookie = '';

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function fetchA(url, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookie) o.headers.cookie = cookie;
  return fetch(url, o);
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('临时后端没起来');
}
async function main() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test', SEEDPOD_FAIL_STEP: 'screen',
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS, PTA_ALLOW_REAL: '1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  try { await waitUp(); } catch (e) { console.error(e.message + '\n' + out); child.kill(); process.exit(2); }
  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  await check('screen 失败后 review 仍执行，steps.errors 有记录', async () => {
    await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Failpoint Review 2024 1080p', site: 'demo-a.example', status: 'pending' })
    });
    const j = await (await fetchA(BASE + '/api/scheduler/run', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ steps: ['screen', 'review'], batchLimit: 2 })
    })).json();
    need(j.ok && j.data.partial === true, '没标 partial：' + JSON.stringify(j));
    const err = (j.data.errors || []).filter(x => x.phase === 'screen')[0];
    need(err && err.code === 'FAILPOINT', '没记录 screen failpoint：' + JSON.stringify(j.data.errors));
    need(j.data.review && j.data.review.checked >= 1, 'review 没继续执行：' + JSON.stringify(j.data.review));
    need(j.data.screen && /failpoint/.test(j.data.screen.error || ''), 'screen 错误没写回 steps：' + JSON.stringify(j.data.screen));
  });
  child.kill();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  process.exit(pass === results.length ? 0 : 1);
}
main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

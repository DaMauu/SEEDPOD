/* 调度器检查：开关、间隔校验、送审复用、发布失败记录。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8094);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sch-'));
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
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS, PTA_ALLOW_REAL: '1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill(); process.exit(2);
  }

  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  await check('默认关闭，间隔 60', async () => {
    const j = await (await fetchA(BASE + '/api/scheduler')).json();
    need(j.ok && j.data.on === false, '默认不是关闭：' + JSON.stringify(j.data));
    need(j.data.everyMinutes === 60, '默认间隔不是 60');
  });

  await check('间隔越界被拦', async () => {
    const r = await fetchA(BASE + '/api/scheduler', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ everyMinutes: 10 })
    });
    need(r.status === 400, '状态码是 ' + r.status);
  });

  await check('可以打开并设 30 分钟', async () => {
    const j = await (await fetchA(BASE + '/api/scheduler', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ on: true, everyMinutes: 30 })
    })).json();
    need(j.ok && j.data.on === true && j.data.everyMinutes === 30, '设置失败：' + JSON.stringify(j));
  });

  await check('手动跑一轮：送审复用、发布失败留记录', async () => {
    await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[
        { t: '分辨率要求', v: '2160p 及以上' },
        { t: '体积范围', v: '10 GB 起' },
        { t: '必须带中字', on: true }
      ]] }, rx: {} })
    });
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'demo-a.example', title: 'Sch A 2020 2160p 中字', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
        { site: 'demo-a.example', title: 'Sch B 2020 1080p 中字', res: '1080p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
        { site: 'demo-a.example', title: 'Sch C 2020 2160p 中字 禁转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 }
      ] })
    });
    await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Approved No Dl', site: 'demo-a.example', targetSite: 'target.example', downloadUrl: 'http://127.0.0.1:1/t.torrent', status: 'approved' })
    });
    const j = await (await fetchA(BASE + '/api/scheduler/run', { method: 'POST' })).json();
    need(j.ok, '跑失败：' + JSON.stringify(j));
    need(j.data.screen.checked === 3, '送审 checked 不对：' + j.data.screen.checked);
    need(j.data.screen.selected === 1, '送审 selected 不对：' + j.data.screen.selected);
    need(j.data.screen.skipped === 2, '送审 skipped 不对：' + j.data.screen.skipped);
    need(j.data.publish && j.data.publish.failed === 1, '发布失败没记录：' + JSON.stringify(j.data.publish));
    need(j.data.crawl && j.data.crawl.sites === 0, '空库不该有抓取站：' + JSON.stringify(j.data.crawl));
    const st = await (await fetchA(BASE + '/api/scheduler')).json();
    need(st.data.lastRunAt > 0, 'lastRunAt 没写');
    need(st.data.lastResult && st.data.lastResult.publish.failed === 1, 'lastResult 没保存');
  });

  await check('可以暂停', async () => {
    const j = await (await fetchA(BASE + '/api/scheduler', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ on: false })
    })).json();
    need(j.ok && j.data.on === false, '暂停失败：' + JSON.stringify(j));
  });

  child.kill();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

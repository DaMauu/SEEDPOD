/* 后端契约检查：起一个临时实例，按 docs/API.md 验字段与错误码。
   用法：node pta/checks/api.js（PTA_NODE 指向 node，环境里不需要额外依赖）
   退出码 0 = 全部符合契约，1 = 有不符合，2 = 起不来。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8099);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-api-'));
const BASE = 'http://127.0.0.1:' + PORT;

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e.message]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('服务 6 秒内没有起来');
}

async function main() {
  const child = spawn(process.env.PTA_NODE || process.execPath, [path.join(ROOT, 'server', 'app.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'pta', 'web') }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });

  try {
    await waitUp();
  } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill();
    process.exit(2);
  }

  await check('health 结构', async () => {
    const j = await (await fetch(BASE + '/api/health')).json();
    need(j.ok === true, 'ok 不为 true');
    need(j.data && typeof j.data.version === 'string', '缺少 version');
    need(typeof j.data.uptime === 'number', '缺少 uptime');
  });

  await check('config 默认值与双模式区间', async () => {
    const j = await (await fetch(BASE + '/api/config')).json();
    need(j.ok, 'ok 不为 true');
    need(j.data.user.runMode === 'test', '默认不是测试模式');
    need(j.data.user.interval === 60, '默认间隔应为 60');
    need(j.data.limits.test.interval[0] === 30, '测试模式下限应为 30');
    need(j.data.limits.prod.interval[0] === 8, '正式模式下限应为 8');
    need(j.data.sys.concurrency === 1, '并发应固定为 1');
  });

  await check('越界返回 400 OUT_OF_RANGE', async () => {
    const r = await fetch(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 3 })
    });
    need(r.status === 400, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.ok === false && j.error.code === 'OUT_OF_RANGE', '错误码不对：' + JSON.stringify(j));
  });

  await check('合法修改落盘', async () => {
    const r = await fetch(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: '45', dailySite: 15 })
    });
    need(r.ok, '修改失败');
    const j = await r.json();
    need(j.data.interval === 45, '间隔没转成数字：' + j.data.interval);
    const disk = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
    need(disk.interval === 45, '没有写进 config.json');
  });

  await check('切换正式模式后下限变 8', async () => {
    await fetch(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runMode: 'prod' })
    });
    const r = await fetch(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 10 })
    });
    need(r.ok, '正式模式 10 秒应被接受');
    const bad = await fetch(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 5 })
    });
    need(bad.status === 400, '正式模式 5 秒应被拒绝');
  });

  await check('静态页面与未知接口', async () => {
    const home = await fetch(BASE + '/');
    need(home.ok && /SEEDPOD/.test(await home.text()), '首页不对');
    const spa = await fetch(BASE + '/whatever/route');
    need(spa.ok, '未知路径没有回退到首页');
    const api = await fetch(BASE + '/api/nope');
    need(api.status === 404, '未知接口状态码是 ' + api.status);
  });

  child.kill();
  await new Promise(r => setTimeout(r, 200));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}

  for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
  const failed = results.filter(r => !r[0]).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('契约检查自身出错：' + e.message); process.exit(1); });

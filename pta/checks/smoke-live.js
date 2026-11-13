/* 在线冒烟：临时 v2 后端 + dist，真实登录与主要页面交互。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywright, launchChromium } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8091);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-live-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'admin';
const PASS = 'demo-pass';
const results = [];
const { chromium } = loadPlaywright();

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('临时后端没起来');
}

async function main() {
  const dist = path.join(ROOT, 'web', 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('没有 dist，先 npm run build'); process.exit(2); }
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: dist,
      PTA_USER: USER, PTA_PASS: PASS
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

  const browser = await launchChromium(chromium);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/#dashboard', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await check('登录页出现，错误密码有提示', async () => {
    need(await page.locator('#login-mask').isVisible(), '没有登录页');
    await page.fill('#login-user', USER);
    await page.fill('#login-pass', 'wrong');
    await page.click('#login-submit');
    await page.waitForTimeout(350);
    const err = await page.textContent('#login-err');
    need(/不对/.test(err), '没有报错：' + err);
  });

  await check('正确密码进入面板', async () => {
    await page.fill('#login-user', USER);
    await page.fill('#login-pass', PASS);
    await page.click('#login-submit');
    await page.waitForTimeout(800);
    need(!(await page.locator('#login-mask').isVisible().catch(() => false)), '登录页没消失');
    need(await page.locator('.dock').isVisible(), '面板没出现');
  });

  for (const r of ['dashboard', 'sites', 'crawl', 'queue', 'sources', 'logs', 'settings']) {
    await check('路由 ' + r, async () => {
      await page.evaluate(x => { location.hash = '#' + x; }, r);
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const v = [...document.querySelectorAll('.view:not([hidden])')];
        return { n: v.length, view: v[0] ? v[0].getAttribute('data-view') : '', len: v[0] ? v[0].innerText.trim().length : 0 };
      });
      need(info.n === 1 && info.view === r && info.len > 20, JSON.stringify(info));
    });
  }

  await check('站点抽屉只有一个 #site-detail', async () => {
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(500);
    const items = await page.locator('.site-item').count();
    need(items > 0, '站点列表为空');
    await page.locator('.site-item').first().click();
    await page.waitForTimeout(400);
    need(await page.locator('#site-detail').count() === 1, '详情 id 重复或缺失');
    need(await page.locator('#site-detail').isVisible(), '详情没打开');
    await page.keyboard.press('Escape');
  });

  await check('流程卡与未接规则', async () => {
    await page.evaluate(() => { location.hash = '#crawl'; });
    await page.waitForTimeout(700);
    need(await page.locator('.flow-group').count() === 8, '规则组数量不对');
    need(await page.locator('.limits-panel input').count() === 4, '请求限制输入数量不对');
    need(await page.locator('.todo-badge').count() === 50, '未接标记数量不对');
    need(!(await page.locator('#rx-deny').isDisabled()), '排除正则被误禁用');
  });

  await check('设置页有调度卡', async () => {
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.waitForTimeout(500);
    const txt = await page.locator('#set-panel').innerText();
    need(/调度/.test(txt), '没有调度卡');
    need(/当前版本/.test(txt), '没有版本信息');
  });

  await check('设置页调度开关可用', async () => {
    const card = page.locator('.set-card').filter({ hasText: '调度' });
    const sw = card.locator('button.switch');
    await sw.click();
    await page.waitForTimeout(500);
    let j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === true, 'UI 没打开调度');
    await sw.click();
    await page.waitForTimeout(500);
    j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === false, 'UI 没关闭调度');
  });

  await check('调度 API 默认关闭、可开关', async () => {
    const j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === false && j.data.everyMinutes === 60, JSON.stringify(j.data));
    const on = await page.evaluate(async () => (await fetch('/api/scheduler', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: true, everyMinutes: 30 }) })).json());
    need(on.ok && on.data.on === true, '打开失败');
    const off = await page.evaluate(async () => (await fetch('/api/scheduler', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: false }) })).json());
    need(off.ok && off.data.on === false, '关闭失败');
  });

  await check('日志与队列空状态', async () => {
    await page.evaluate(() => { location.hash = '#logs'; });
    await page.waitForTimeout(500);
    need(await page.locator('.log-wrap').isVisible(), '日志页没渲染');
    await page.evaluate(() => { location.hash = '#queue'; });
    await page.waitForTimeout(500);
    const txt = await page.locator('.queue-items').innerText();
    need(/没有|空/.test(txt), '队列没有空状态：' + txt.slice(0, 60));
  });

  await check('无 JS 报错', async () => {
    need(errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await browser.close();
  child.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

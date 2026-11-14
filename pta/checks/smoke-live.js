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
  fs.writeFileSync(path.join(DATA, 'sites-data.local.js'), [
    'window.SITE_URLS = [' + JSON.stringify([
      'https://demo-a.example/index.php',
      'https://demo-b.example/',
      'https://demo-c.example/'
    ]).slice(1, -1) + '];',
    'window.PT_ARCH = ' + JSON.stringify({ 'demo-a.example': 'NP', 'demo-b.example': 'UNIT3D', 'demo-c.example': 'GZ' }) + ';',
    'window.PT_NAMES = ' + JSON.stringify({ 'demo-a.example': 'Demo A', 'demo-b.example': 'Demo B', 'demo-c.example': 'Demo C' }) + ';'
  ].join('\n'));

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

  await check('总览数据块渲染', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(700);
    const stats = await page.locator('.stat-card').innerText();
    need(/统计/.test(stats) && /抓取总数/.test(stats), '统计卡没渲染：' + stats.slice(0, 60));
    need(await page.locator('#dash-logs').count() === 1, '实时日志块缺失');
    need(await page.locator('#health-strip .status-hero').count() === 1, '系统状态没渲染');
    need(await page.locator('#dash-pending').count() === 1, '待审核块缺失');
  });

  await check('站点列表、筛选与抽屉', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(800);
    const items = page.locator('.site-item');
    need(await items.count() === 3, '站点列表数量不对：' + await items.count());
    need(/Demo A/.test(await page.locator('#sites-list').innerText()), '站点标题没渲染');
    await page.selectOption('#site-arch', 'UNIT3D');
    await page.waitForTimeout(250);
    need(await items.count() === 1, '架构筛选不对：' + await items.count());
    await page.selectOption('#site-arch', 'all');
    await page.waitForTimeout(250);
    await items.first().click();
    await page.waitForTimeout(500);
    need(await page.locator('#site-detail').count() === 1, '详情 id 重复或缺失');
    need(await page.locator('#site-detail').isVisible(), '详情没打开');
    const dtxt = await page.locator('#site-detail').innerText();
    need(/登录/.test(dtxt) && /抓取/.test(dtxt), '抽屉概览没渲染：' + dtxt.slice(0, 80));
    await page.locator('#site-detail .tabbtn').filter({ hasText: '设置' }).click();
    await page.waitForTimeout(300);
    need(await page.locator('#site-detail textarea').count() === 1, '设置页 cookie 输入框缺失');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    need(await page.locator('#site-detail').count() === 0, 'Escape 没关闭抽屉');
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

  await check('待审核列表与详情', async () => {
    await page.evaluate(async () => {
      await fetch('/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Smoke Queue 2020 2160p', status: 'pending', site: 'demo-a.example', targetSite: 'target.example', downloadUrl: 'http://127.0.0.1:1/t.torrent', res: '2160p', size: '20 GB' })
      });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#queue'; });
    await page.waitForTimeout(800);
    need(await page.locator('.q-item').count() === 1, '队列条目数量不对');
    await page.locator('.q-item').first().click();
    await page.waitForTimeout(400);
    const txt = await page.locator('#queue-detail').innerText();
    need(/发布信息/.test(txt) && /截图/.test(txt), '详情没渲染：' + txt.slice(0, 80));
  });

  await check('数据清单渲染、筛选与标记', async () => {
    await page.evaluate(async () => {
      await fetch('/api/catalog', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [{ title: 'Smoke Catalog 2024 2160p UHD Blu-ray', site: 'demo-a.example', res: '2160p', size: '60 GB', cat: '401', detailsUrl: 'details.php?id=1' }] })
      });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#sources'; });
    await page.waitForTimeout(800);
    const rows = page.locator('.dl-row');
    need(await rows.count() === 1, '数据清单行数不对：' + await rows.count());
    const txt = await rows.first().innerText();
    need(/Smoke Catalog/.test(txt) && /2160p/.test(txt) && /待筛选/.test(txt), '清单字段不对：' + txt.slice(0, 80));
    await page.fill('#dl-q', '不存在的片名');
    await page.waitForTimeout(200);
    need(/没有匹配/.test(await page.locator('#dl-body').innerText()), '搜索没过滤');
    await page.fill('#dl-q', 'Smoke');
    await page.waitForTimeout(200);
    const mb = page.locator('.dl-row .mark-btn').first();
    const before = await mb.getAttribute('class');
    await mb.click();
    await page.waitForTimeout(500);
    const j = await page.evaluate(async () => (await fetch('/api/catalog?q=Smoke')).json());
    need(j.ok && j.data.items[0].marks && j.data.items[0].marks.noRedistribute, '标记没写进后端：' + JSON.stringify(j.data.items[0].marks || {}));
    need((await page.locator('.dl-row .mark-btn').first().getAttribute('class')).indexOf('on') >= 0, '标记按钮没变亮（之前 ' + before + '）');
  });

  await check('下载器抽屉', async () => {
    await page.evaluate(async () => {
      await fetch('/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Smoke qB', url: 'http://127.0.0.1:1', user: 'demo', pass: 'demo' })
      });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#crawl'; });
    await page.waitForTimeout(800);
    const card = page.locator('#nodes-grid .node-row');
    need(await card.count() === 1, '下载器卡片数量不对：' + await card.count());
    need(/Smoke qB/.test(await card.first().innerText()), '下载器名称没渲染');
    await card.first().locator('.nr-set').click();
    await page.waitForTimeout(350);
    need(await page.locator('#node-modal-vue').isVisible(), '下载器设置弹窗没打开');
    need(await page.locator('#node-modal-vue input[type=password]').count() === 1, '密码输入框缺失');
    await page.locator('#node-modal-vue .modal-foot button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(200);
    need(await page.locator('#node-modal-vue').count() === 0, '取消没关闭弹窗');
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

/* 低频前端交互回归：站点详情 Escape 不误关、直达设置页登录后数据能加载。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { loadPlaywright, launchChromium } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-fe-'));
const DATA = path.join(TMP, 'data');
fs.mkdirSync(DATA);
const PORT = Number(process.env.PTA_CHECK_PORT || 8104);
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'admin';
const PASS = 'demo-pass';
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

function seedDb() {
  const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
  db.exec("CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT); CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, level TEXT, src TEXT, msg TEXT);");
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)');
  ins.run('test-1.example', JSON.stringify({ url: 'https://test-1.example/index.php', arch: 'NP', title: '测试站点一' }), now);
  ins.run('test-2.example', JSON.stringify({ url: 'https://test-2.example/index.php', arch: 'NP', title: '测试站点二' }), now);
  db.close();
}

(async function () {
  seedDb();
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  let browser = null;
  try {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) { /* 等启动 */ }
      await new Promise(r => setTimeout(r, 120));
    }
    const { chromium } = loadPlaywright();
    browser = await launchChromium(chromium);

    await check('站点详情输入框按 Escape 不关闭面板', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      const lr = await page.evaluate(async function () {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
        return r.status;
      });
      need(lr === 200, '登录失败：' + lr);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sites'; });
      await page.waitForTimeout(700);
      const item = page.locator('[data-view="sites"] .site-item').first();
      need(await item.count() === 1, '站点列表没渲染');
      await item.click();
      await page.waitForTimeout(500);
      need(await page.locator('.sites-detail-pane').count() === 1, '站点详情没打开');
      const input = page.locator('[data-view="sites"] input.input').first();
      if (await input.count()) await input.focus();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      need(await page.locator('.sites-detail-pane').count() === 1, '输入框 Escape 误关了详情');
      /* CSS 断点：手机显示 dock 文字，桌面图标轨隐藏；验证删掉的冗余规则没有改变计算样式 */
      await page.setViewportSize({ width: 800, height: 900 });
      await page.waitForTimeout(200);
      const small = await page.evaluate(function () { return getComputedStyle(document.querySelector('.dock-item .dock-label')).display; });
      await page.setViewportSize({ width: 1200, height: 900 });
      await page.waitForTimeout(200);
      const mid = await page.evaluate(function () { return getComputedStyle(document.querySelector('.dock-item .dock-label')).display; });
      const pad = await page.evaluate(function () { return getComputedStyle(document.querySelector('.main')).paddingBottom; });
      need(small === 'block', '800px dock 文字应显示：' + small);
      need(mid === 'none', '1200px dock 文字应隐藏：' + mid);
      need(pad === '36px', '1200px main 底部间距不对：' + pad);
      await page.close();
    });

    await check('直达设置页登录后数据能加载', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE + '/#settings', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      need(await page.locator('#login-mask').count() === 1, '未登录没弹登录框');
      await page.fill('#login-user', USER);
      await page.fill('#login-pass', PASS);
      await page.click('#login-submit');
      await page.waitForTimeout(900);
      const text = await page.locator('#set-panel').innerText();
      need(text.indexOf('读取中…') < 0, '设置页仍停在读取中：' + text.slice(0, 80));
      need(text.indexOf(USER) >= 0 || text.indexOf('admin') >= 0, '登录用户名没加载：' + text.slice(0, 80));
      await page.close();
    });
  } catch (e) {
    console.error('前端回归启动失败：' + (e && e.message ? e.message : e) + '\n' + out.slice(-500));
    results.push([false, '启动', String(e && e.message || e)]);
  } finally {
    if (browser) await browser.close().catch(function () {});
    child.kill('SIGTERM');
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

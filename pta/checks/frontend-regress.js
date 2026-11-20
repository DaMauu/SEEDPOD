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
  db.exec("CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT); CREATE TABLE IF NOT EXISTS queue (id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT NOT NULL, created_at TEXT, updated_at TEXT); CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, level TEXT, src TEXT, msg TEXT);");
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)');
  ins.run('test-1.example', JSON.stringify({ url: 'https://test-1.example/index.php', arch: 'NP', title: '测试站点一' }), now);
  ins.run('test-2.example', JSON.stringify({ url: 'https://test-2.example/index.php', arch: 'NP', title: '测试站点二' }), now);
  const q = db.prepare('INSERT OR REPLACE INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)');
  q.run('q_0001', 'pending', 'Target Switch 2024', JSON.stringify({ id: 'q_0001', title: 'Target Switch 2024', status: 'pending', stage: 'draft', targetSite: 'test-a.example', targets: ['test-a.example'], sourceState: { ok: true, complete: true } }), now, now);
  q.run('q_0002', 'pending', 'Progress Poll 2024', JSON.stringify({ id: 'q_0002', title: 'Progress Poll 2024', status: 'pending', stage: 'draft', targetSite: 'test-p.example', targets: ['test-p.example'] }), now, now);
  q.run('q_0003', 'pending', 'Switch Target B 2024', JSON.stringify({ id: 'q_0003', title: 'Switch Target B 2024', status: 'pending', stage: 'draft', targetSite: 'test-c.example', targets: ['test-c.example'] }), now, now);
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

    await check('队列切目标站后提交到新站', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const uploads = [];
      await page.route('**/api/**', async function (route) {
        const u = new URL(route.request().url());
        const p = u.pathname;
        if (p === '/api/targets') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }, { host: 'test-b.example', hasCookie: true }] }) });
        if (p === '/api/queue/q_0001/publish-preview') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { ready: true } }) });
        if (p === '/api/queue/q_0001/action' || p === '/api/queue/q_0001/prepare') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { prepared: {} } }) });
        if (p === '/api/targets/test-b.example/upload') {
          uploads.push({ url: route.request().url(), body: route.request().postData() || '' });
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
        }
        return route.continue();
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(600);
      await page.locator('.q-item').filter({ hasText: 'Target Switch 2024' }).click();
      await page.waitForTimeout(400);
      const sel = page.locator('.qd-field').filter({ hasText: '目标站' }).locator('select');
      await sel.selectOption('test-b.example');
      await page.locator('button').filter({ hasText: '发布到目标站' }).click();
      await page.waitForTimeout(300);
      need(await page.locator('#confirm-yes').count() === 1, '提交确认框没出现');
      await page.click('#confirm-yes');
      await page.waitForTimeout(700);
      need(uploads.length === 1, '没有发出一次上传：' + uploads.length);
      need(uploads[0].url.indexOf('test-b.example') >= 0 && uploads[0].url.indexOf('test-a.example') < 0, '上传目标没切到 B：' + uploads[0].url);
      await page.close();
    });

    await check('下载轮询切条目后不覆盖新条目', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let pollStarted = null;
      const started = new Promise(function (resolve) { pollStarted = resolve; });
      let downloadCount = 0;
      await page.route('**/api/queue/q_0002/action', async function (route) {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.action !== 'download') return route.continue();
        downloadCount++;
        if (downloadCount === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { message: '已加入 qB', progress: 0.2, hash: 'p' } }) });
        pollStarted();
        await new Promise(function (r) { setTimeout(r, 1200); });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { complete: true, progress: 1, hash: 'p' } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(600);
      await page.locator('.q-item').filter({ hasText: 'Progress Poll 2024' }).click();
      await page.waitForTimeout(400);
      await page.locator('button').filter({ hasText: '下载种子' }).click();
      await Promise.race([started, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('轮询没启动')); }, 10000); })]);
      await page.locator('.q-item').filter({ hasText: 'Switch Target B 2024' }).click();
      await page.waitForTimeout(1600);
      need(await page.locator('.qd-download').count() === 0, '旧轮询把进度写到新条目：' + (await page.locator('.qd-download').innerText().catch(function () { return ''; })));
      await page.close();
    });

    await check('队列列表慢响应不覆盖新页签', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let firstStarted = null;
      const started = new Promise(function (resolve) { firstStarted = resolve; });
      await page.route('**/api/**', async function (route) {
        const u = new URL(route.request().url());
        if (u.pathname !== '/api/queue' || route.request().method() !== 'GET') return route.continue();
        const status = u.searchParams.get('status') || '';
        if (!status) {
          firstStarted();
          await new Promise(function (r) { setTimeout(r, 900); });
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [{ id: 'race-pending', title: 'Race Pending', status: 'pending' }], matched: 1, counts: {} } }) });
        }
        if (status.indexOf('approved') >= 0) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [{ id: 'race-approved', title: 'Race Approved', status: 'approved' }], matched: 1, counts: {} } }) });
        }
        return route.continue();
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await Promise.race([started, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('列表请求没启动')); }, 5000); })]);
      await page.locator('#queue-tabs button').filter({ hasText: '已通过' }).click();
      await page.waitForTimeout(1300);
      const text = await page.locator('.queue-items').innerText();
      need(text.indexOf('Race Approved') >= 0, '新页签没显示：' + text);
      need(text.indexOf('Race Pending') < 0, '旧响应覆盖了新页签：' + text);
      await page.close();
    });

    await check('Sources 登录后重载站点/目标列表', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let authed = false;
      await page.route('**/api/credentials', async function (route) {
        if (!authed) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'target-fixture.example', hasCookie: true }] }) });
      });
      await page.route('**/api/site-defs', async function (route) {
        if (!authed) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { 'target-fixture.example': { engine: 'nexusphp' } } }) });
      });
      await page.goto(BASE + '/#sources', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      authed = true;
      await page.fill('#login-user', USER);
      await page.fill('#login-pass', PASS);
      await page.click('#login-submit');
      await page.waitForTimeout(1000);
      const opts = await page.locator('#dl-target option').allTextContents();
      need(opts.some(function (x) { return x.indexOf('target-fixture.example') >= 0; }), '登录后目标列表没重载：' + JSON.stringify(opts));
      await page.close();
    });

    await check('SiteDetail 定义加载失败不覆盖保存', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let puts = 0;
      await page.route('**/api/site-def/**', async function (route) {
        if (route.request().method() === 'PUT') { puts++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture fail' } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sites'; });
      await page.waitForTimeout(700);
      await page.locator('[data-view="sites"] .site-item').first().click();
      await page.waitForTimeout(500);
      const detail = await page.locator('.sites-detail-pane').innerText();
      need(detail.indexOf('站点定义加载失败') >= 0, '没显示加载失败：' + detail.slice(0, 120));
      await page.locator('button').filter({ hasText: '保存定义' }).click();
      await page.waitForTimeout(300);
      need(puts === 0, '加载失败后仍然 PUT 覆盖：' + puts);
      await page.close();
    });

    await check('Nodes 改地址后测试用表单配置', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let probeBody = null, testHits = 0;
      await page.route('**/api/downloaders', async function (route) {
        if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ id: 'dl_001', name: 'old', kind: 'qb', url: 'http://old.example:8080', user: 'u', hasPass: true, passReadable: true }] }) });
        return route.continue();
      });
      await page.route('**/api/downloaders/dl_001/cats', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { cats: [] } }) });
      });
      await page.route('**/api/downloaders/dl_001/test', async function (route) { testHits++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { pass: true } }) }); });
      await page.route('**/api/downloaders/probe', async function (route) {
        probeBody = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { pass: false, steps: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#crawl'; });
      await page.waitForTimeout(900);
      await page.locator('.nr-set').first().click();
      await page.waitForTimeout(300);
      const urlInput = page.locator('.modal .field').filter({ hasText: 'Web 地址' }).locator('input');
      await urlInput.fill('http://new.example:8080');
      await page.locator('button').filter({ hasText: '测试连接' }).click();
      await page.waitForTimeout(500);
      need(testHits === 0, '改地址后仍测旧配置：' + testHits);
      need(probeBody && probeBody.url === 'http://new.example:8080', '探测没用新地址：' + JSON.stringify(probeBody));
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

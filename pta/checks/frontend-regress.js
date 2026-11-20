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

    await check('SiteDetail 保存成功后表单保留新值', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sites'; });
      await page.waitForTimeout(700);
      await page.locator('[data-view="sites"] .site-item').first().click();
      await page.waitForTimeout(500);
      const input = page.locator('.sites-detail-pane .set-field').filter({ hasText: '站点地址' }).locator('input');
      await input.fill('https://changed.example/index.php');
      await page.locator('button').filter({ hasText: '保存设置' }).click();
      await page.waitForTimeout(900);
      const val = await input.inputValue();
      need(val === 'https://changed.example/index.php', '保存后表单回退了：' + val);
      await page.close();
    });

    await check('Sources 外链只渲染安全协议', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('**/api/catalog?**', async function (route) {
        const items = [
          { id: 'cat_1', site: 'test-1.example', siteId: '1', title: 'Javascript Link', status: 'new', detailsUrl: 'javascript:alert(1)' },
          { id: 'cat_2', site: 'test-1.example', siteId: '2', title: 'Data Link', status: 'new', detailsUrl: 'data:text/html,<script>alert(1)</script>' }
        ];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 2, matched: 2, items: items, byStatus: { new: 2 } } }) });
      });
      await page.route('**/api/credentials', async function (route) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) }); });
      await page.route('**/api/site-defs', async function (route) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) }); });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(2000);
      const hrefs = await page.locator('.dl-title a').evaluateAll(function (as) { return as.map(function (a) { return a.getAttribute('href') || ''; }); });
      need(hrefs.length >= 2, '外链没渲染：' + hrefs.length);
      hrefs.forEach(function (h) { need(/^https?:\/\//i.test(h), '出现了非 http 外链：' + h); });
      await page.close();
    });

    await check('Queue 返回页面刷新当前详情', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let version = 1;
      const item = function (title) { return { id: 'q_0001', title: title, cn: title, status: 'pending', stage: 'draft', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item('Detail Version 1')], matched: 1, counts: {} } }) });
      });
      await page.route('**/api/queue/q_0001', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item(version === 1 ? 'Detail Version 1' : 'Detail Version 2') }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(700);
      need((await page.locator('.qd-title-row h2').innerText()) === 'Detail Version 1', '详情初始值不对');
      version = 2;
      await page.evaluate(function () { location.hash = '#dashboard'; });
      await page.waitForTimeout(250);
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(700);
      const title = await page.locator('.qd-title-row h2').innerText();
      need(title === 'Detail Version 2', '返回队列没刷新详情：' + title);
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

    await check('Dashboard 今日按 byDay 当天算，不混用发布总数', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let statHits = 0;
      await page.route(/\/api\/stats\/overview/, async function (route) {
        statHits++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          ok: true, data: {
            queue: { counts: { published: 5 } },
            catalog: { total: 11413 },
            published: { total: 99, last7d: 3, last30d: 12, byDay: [{ day: '2026-11-20', count: 7 }, { day: '2026-11-21', count: 0 }] }
          }
        }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2200);
      const today = (await page.locator('#hero-num').innerText()).trim();
      const month = (await page.locator('#stat-month').innerText()).trim();
      const total = (await page.locator('#stat-total').innerText()).trim();
      need(today === '0' && month === '12' && total === '99' && statHits >= 1, '统计不对：' + JSON.stringify({ today: today, month: month, total: total, hits: statHits }));
      await page.close();
    });

    await check('Sources 批量送审/归档失败后按钮恢复并可重试', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [{ id: 'c_1', site: 'site-a.example', title: 'Bulk Fail Row', status: 'new', cat: '', catName: '' }] } }) });
      });
      await page.route('**/api/catalog/screen', async function (route) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture screen fail' } }) });
      });
      await page.route('**/api/catalog/bulk', async function (route) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture archive fail' } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(1800);

      await page.click('#dl-screen');
      await page.click('#confirm-yes');
      await page.waitForTimeout(500);
      need((await page.locator('#toast').innerText()).indexOf('fixture screen fail') >= 0, '送审失败没提示：' + (await page.locator('#toast').innerText()));
      need(!(await page.locator('#dl-screen').isDisabled()), '送审失败后按钮没恢复');

      await page.click('#dl-archive');
      await page.click('#confirm-yes');
      await page.waitForTimeout(500);
      need((await page.locator('#toast').innerText()).indexOf('fixture archive fail') >= 0, '归档失败没提示：' + (await page.locator('#toast').innerText()));
      need(!(await page.locator('#dl-archive').isDisabled()), '归档失败后按钮没恢复');
      await page.close();
    });

    await check('Sources 翻页与筛选组合：回第一页、状态不显示旧数据', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const rows = [];
      for (let i = 0; i < 230; i++) {
        rows.push({ id: 'c_' + i, site: i % 2 ? 'site-b.example' : 'site-a.example', title: 'Row ' + String(i).padStart(3, '0'), status: 'new', cat: '', catName: '' });
      }
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        const status = new URL(route.request().url()).searchParams.get('status') || '';
        if (status === 'skipped') {
          await new Promise(function (r) { setTimeout(r, 500); });
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [{ id: 'sk', site: 'site-b.example', title: 'Skipped Row', status: 'skipped', cat: '', catName: '' }] } }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: rows.length, items: rows } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(1800);
      need((await page.locator('#dl-page').innerText()).indexOf('1 / 3') >= 0, '初始分页不对：' + (await page.locator('#dl-page').innerText()));
      need((await page.locator('#dl-body .dl-row').count()) === 100, '第一页不是 100 行');
      await page.click('#dl-next');
      await page.waitForTimeout(200);
      need((await page.locator('#dl-page').innerText()).indexOf('2 / 3') >= 0, '下一页没生效');
      need((await page.locator('#dl-body .dl-row').first().innerText()).indexOf('Row 100') >= 0, '第二页起点不对');

      await page.locator('#dl-site').selectOption('site-b.example');
      await page.waitForTimeout(250);
      need((await page.locator('#dl-page').innerText()).indexOf('1 / 2') >= 0, '筛选后没回第一页：' + (await page.locator('#dl-page').innerText()));
      need((await page.locator('#dl-body .dl-row').first().innerText()).indexOf('Row 001') >= 0, '筛选后起点不对');

      await page.locator('#dl-status').selectOption('skipped');
      await page.waitForTimeout(120);
      need((await page.locator('#dl-body .dl-row').count()) === 0, '切状态后仍显示旧状态数据');
      await page.waitForTimeout(700);
      need((await page.locator('#dl-body').innerText()).indexOf('Skipped Row') >= 0, '新状态数据没显示');
      need((await page.locator('#dl-page').innerText()).indexOf('1 / 1') >= 0, '状态分页不对');
      await page.close();
    });

    await check('Sources 快速切筛选只保留最后一次响应', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let firstStarted = null;
      const started = new Promise(function (resolve) { firstStarted = resolve; });
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        const status = new URL(route.request().url()).searchParams.get('status') || '';
        if (!status) {
          firstStarted();
          await new Promise(function (r) { setTimeout(r, 900); });
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [{ id: 'slow', site: 'test-1.example', title: 'Old Slow Row', status: 'new', cat: '', catName: '' }] } }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [{ id: 'fast', site: 'test-1.example', title: 'New Fast Row', status: 'skipped', cat: '', catName: '' }] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await Promise.race([started, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('列表请求没启动')); }, 5000); })]);
      await page.locator('#dl-status').selectOption('skipped');
      await page.waitForTimeout(1400);
      const text = await page.locator('#dl-body').innerText();
      need(text.indexOf('New Fast Row') >= 0, '新筛选没显示：' + text);
      need(text.indexOf('Old Slow Row') < 0, '旧响应覆盖了新筛选：' + text);
      await page.close();
    });

    await check('Logs SSE 连续失败会探会话，离开页面停止重连', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let sseHits = 0, sessionHits = 0;
      await page.route('**/api/session', async function (route) {
        sessionHits++;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } }) });
      });
      await page.route('**/api/logs/stream**', async function (route) {
        sseHits++;
        return route.fulfill({ status: 401, contentType: 'text/plain', body: 'unauthorized' });
      });
      await page.route('**/api/logs?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#logs'; });
      await page.waitForTimeout(8000);
      need(sessionHits >= 1, 'SSE 连续失败没探会话：' + sessionHits);
      const before = sseHits;
      await page.evaluate(function () { location.hash = '#dashboard'; });
      await page.waitForTimeout(4000);
      need(sseHits === before, '离开日志页后仍在重连：' + before + ' -> ' + sseHits);
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

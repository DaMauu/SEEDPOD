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

    await check('失败队列能读出示意中的 held 源种状态', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('**/api/failures?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {
          total: 1, counts: {}, byStage: { source: 1 }, retryMax: 2,
          items: [{ id: 'q_held_ui', title: 'Held UI Row', status: 'approved', stage: 'source', dead: false,
            failures: [{ kind: 'source', stage: 'source', code: 'SOURCE_INCOMPLETE', message: '源种未下完', attempts: 0, lastAttemptAt: new Date().toISOString() }] }]
        } }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(800);
      await page.locator('#queue-tabs button').filter({ hasText: '失败' }).click();
      await page.waitForTimeout(600);
      const sum = await page.locator('.qf-sum').first().innerText();
      need(sum.indexOf('源种') >= 0 && sum.indexOf('源种未下完') >= 0, 'held 没显示成中文：' + sum);
      need(sum.indexOf('SOURCE_INCOMPLETE') < 0 && sum.indexOf('source') < 0, 'held 还在显示原始码：' + sum);
      await page.close();
    });

    await check('批量发布被跳过时详情同步显示目标站错误', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let failed = false;
      const item = function () {
        return { id: 'q_bulk_skip', title: 'Bulk Skip Row', status: 'approved', stage: 'previewed', targetSite: 'test-a.example', targets: ['test-a.example'],
          targetResults: failed ? { 'test-a.example': { stage: 'failed', error: '目标站拒绝' } } : {} };
      };
      await page.route('**/api/queue/bulk', async function (route) {
        failed = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { changed: 0, skipped: 1, errors: [{ id: 'q_bulk_skip', code: 'UPLOAD_REJECTED', message: '目标站拒绝' }] } }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item()], matched: 1, counts: {} } }) });
      });
      await page.route('**/api/queue/q_bulk_skip', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.locator('.q-item').first().click();
      await page.waitForTimeout(450);
      need((await page.locator('.qd-target-result').count()) === 0, '初始不该有目标站结果');
      await page.click('#q-bulkpublish');
      await page.waitForTimeout(250);
      await page.click('#confirm-yes');
      await page.waitForTimeout(800);
      need((await page.locator('.qd-target-result .qd-stage-err').first().innerText()).indexOf('目标站拒绝') >= 0, '跳过后详情没刷新目标站错误');
      await page.close();
    });

    await check('批量发布后当前详情同步为已发布', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let published = false;
      const item = function () { return { id: 'q_bulk_pub', title: 'Bulk Publish Row', status: published ? 'published' : 'approved', stage: published ? 'injected' : 'previewed', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/queue/bulk', async function (route) {
        published = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { changed: 1, skipped: 0, errors: [] } }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item()], matched: 1, counts: {} } }) });
      });
      await page.route('**/api/queue/q_bulk_pub', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.locator('.q-item').first().click();
      await page.waitForTimeout(450);
      need((await page.locator('.qd-title-row .badge').innerText()).indexOf('已通过') >= 0, '初始状态不对');
      await page.click('#q-bulkpublish');
      await page.waitForTimeout(250);
      await page.click('#confirm-yes');
      await page.waitForTimeout(800);
      need((await page.locator('.qd-title-row .badge').innerText()).indexOf('已发布') >= 0, '批量发布后详情没刷新：' + (await page.locator('.qd-title-row .badge').innerText()));
      await page.close();
    });

    await check('批量批准后当前详情同步为已通过', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let approved = false;
      const item = function () { return { id: 'q_bulk_ok', title: 'Bulk Approve Row', status: approved ? 'approved' : 'pending', stage: 'draft', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/queue/bulk', async function (route) {
        approved = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { changed: 1, status: 'approved' } }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item()], matched: 1, counts: {} } }) });
      });
      await page.route('**/api/queue/q_bulk_ok', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.locator('.q-item').first().click();
      await page.waitForTimeout(450);
      need((await page.locator('.qd-title-row .badge').innerText()).indexOf('待确认') >= 0, '初始状态不对');
      await page.click('#q-bulkapprove');
      await page.waitForTimeout(800);
      need((await page.locator('.qd-title-row .badge').innerText()).indexOf('已通过') >= 0, '批量批准后详情没刷新：' + (await page.locator('.qd-title-row .badge').innerText()));
      await page.close();
    });

    await check('批量发布混合结果提示成功/跳过和首条错误', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('**/api/queue/bulk', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          ok: true, data: { changed: 2, skipped: 3, errors: [{ id: 'q_x', code: 'REVIEW_HOLD', message: '终审未通过：简介' }] }
        }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.click('#q-bulkpublish');
      await page.waitForTimeout(250);
      await page.click('#confirm-yes');
      await page.waitForTimeout(700);
      const t = await page.locator('#toast').innerText();
      need(t.indexOf('已发布 2 条') >= 0 && t.indexOf('跳过 3 条') >= 0, '成功/跳过提示不对：' + t);
      need(t.indexOf('终审未通过：简介') >= 0, '没带首条错误：' + t);
      need(!(await page.locator('#q-bulkpublish').isDisabled()), '批量发布按钮没恢复');
      await page.close();
    });

    await check('失败队列重放后详情自动回待确认', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let replayed = false;
      const item = function () { return { id: 'q_fail_replay', title: 'Replay Failure Row', status: replayed ? 'pending' : 'failed', stage: replayed ? 'prepared' : 'failed', stageLastError: replayed ? '' : '回查未找到', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/failures?**', async function (route) {
        const items = replayed ? [] : [{ id: 'q_fail_replay', title: 'Replay Failure Row', stage: 'failed', failures: [{ stage: 'previewed', code: 'VERIFY_FAILED', attempts: 1 }], dead: false }];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: items.length, items: items, counts: {}, byStage: {}, retryMax: 2 } }) });
      });
      await page.route('**/api/failures/q_fail_replay/replay', async function (route) {
        replayed = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'q_fail_replay', status: 'pending', stage: 'prepared' }) });
      });
      await page.route('**/api/queue/q_fail_replay', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(800);
      await page.locator('#queue-tabs button').filter({ hasText: '失败' }).click();
      await page.waitForTimeout(600);
      await page.locator('.qf-row').first().click();
      await page.waitForTimeout(500);
      need((await page.locator('.qd-title-row').innerText()).indexOf('Replay Failure Row') >= 0, '失败详情没打开');
      await page.locator('.qf-replay').first().click();
      await page.waitForTimeout(900);
      need(replayed === true, '没发 replay');
      need((await page.locator('.qd-title-row').innerText()).indexOf('Replay Failure Row') >= 0, '重放后详情丢了');
      const badge = await page.locator('.qd-title-row .badge').innerText();
      need(badge.indexOf('待确认') >= 0, '重放后详情状态没刷新：' + badge);
      await page.close();
    });

    await check('多目标回查展示不串站，缺 host 不借用旧结果', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const items = {
        q_verify_a: { id: 'q_verify_a', title: 'Verify A', status: 'pending', stage: 'draft', targetSite: 'a.example', targets: ['a.example', 'b.example'],
          targetUpload: { host: 'a.example', message: '已提交' },
          targetVerifyByHost: { 'a.example': { found: false }, 'b.example': { found: true } },
          targetVerify: { found: true } },
        q_verify_b: { id: 'q_verify_b', title: 'Verify B', status: 'pending', stage: 'draft', targetSite: 'a.example', targets: ['a.example', 'b.example'],
          targetUpload: { message: '已提交' },
          targetVerify: { found: true } }
      };
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [items.q_verify_a, items.q_verify_b], matched: 2, counts: {} } }) });
      });
      await page.route(/\/api\/queue\/(q_verify_[ab])$/, async function (route) {
        const id = route.request().url().split('/').pop();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: items[id] }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'a.example', hasCookie: true }, { host: 'b.example', hasCookie: true }] }) });
      });
      await page.route('**/api/sites', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { sites: [] } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.locator('.q-item').filter({ hasText: 'Verify A' }).click();
      await page.waitForTimeout(450);
      const aText = await page.locator('.qd-status').first().innerText();
      need(aText.indexOf('回查：未找到') >= 0, 'A 站回查没按 byHost 显示：' + aText);
      need(aText.indexOf('回查：已找到') < 0, 'A 站借用了 B 站结果：' + aText);
      await page.locator('.q-item').filter({ hasText: 'Verify B' }).click();
      await page.waitForTimeout(450);
      const bText = await page.locator('.qd-status').first().innerText();
      need(bText.indexOf('回查：') < 0, '缺 host 的多目标借用了旧回查：' + bText);
      await page.close();
    });

    await check('驳回条目可点重新送审回待确认', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let status = 'rejected';
      let retried = 0;
      const item = function () { return { id: 'q_rej', title: 'Rejected Row 2020', status: status, stage: 'draft', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item()], matched: 1, counts: {} } }) });
      });
      await page.route('**/api/queue/q_rej', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/queue/q_rej/action', async function (route) {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.action === 'retry') { retried++; status = 'pending'; }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'test-a.example', hasCookie: true }] }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(900);
      await page.locator('.q-item').first().click();
      await page.waitForTimeout(500);
      const retryBtn = page.locator('.qd-actions button').filter({ hasText: '重新送审' });
      need((await retryBtn.count()) === 1, '驳回条目没有重新送审按钮');
      need((await page.locator('.qd-actions button').filter({ hasText: '驳回' }).count()) === 0, '驳回状态仍显示驳回按钮');
      await retryBtn.click();
      await page.waitForTimeout(700);
      need(retried === 1, '没发 retry：' + retried);
      need((await page.locator('.qd-actions button').filter({ hasText: '重新送审' }).count()) === 0, '送回待审后按钮没消失');
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

    await require('./frontend-regress/sources')({ browser: browser, BASE: BASE, check: check, need: need, fs: fs });

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

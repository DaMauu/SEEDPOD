/* frontend-regress 分组：会话过期时 Dashboard/Logs 轮询暂停，登出后 Sites/Queue 停发请求。 */
module.exports = async function run(ctx) {
  const { browser, BASE, check, need } = ctx;
    await check('会话过期时 Dashboard 轮询暂停，重登后恢复', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.clock.install({ time: new Date() });
      let statsHits = 0;
      await page.route('**/api/stats/overview', async function (route) {
        statsHits++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { queue: { counts: {} }, catalog: { total: 0 }, published: { total: 0, byDay: [] }, failures: { items: 0, reasons: [] } } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await page.clock.fastForward(4000);
      await page.waitForTimeout(500);
      if (!statsHits) { await page.clock.fastForward(4000); await page.waitForTimeout(500); }
      need(statsHits > 0, '登录后 Dashboard 没拉统计');
      await page.evaluate(async function () {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        await fetch('/api/session', { credentials: 'same-origin' });
      });
      await page.clock.fastForward(1200);
      await page.waitForTimeout(300);
      need((await page.locator('#login-mask').count()) === 1, '过期后没弹登录');
      const paused = statsHits;
      await page.clock.fastForward(35000);
      await page.waitForTimeout(300);
      need(statsHits === paused, '过期后 Dashboard 还在轮询：' + paused + ' -> ' + statsHits);
      await page.fill('#login-user', 'admin');
      await page.fill('#login-pass', 'demo-pass');
      await page.click('#login-submit');
      await page.clock.fastForward(2000);
      await page.waitForTimeout(300);
      await page.clock.fastForward(35000);
      await page.waitForTimeout(300);
      need(statsHits > paused, '重登后 Dashboard 没恢复：' + paused + ' -> ' + statsHits);
      await page.close();
    });

    await check('切页后统计轮询不叠加失控，回总览继续刷新', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let statsHits = 0;
    await page.route('**/api/stats/overview', async function (route) {
      statsHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { queue: { counts: {} }, catalog: { total: 0 }, published: { total: 0, byDay: [] }, failures: { items: 0, reasons: [] } } }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    /* 先等 /api/session 落地，再推进假时钟；否则 1.5s 首次轮询可能早于登录态 */
    for (let i = 0; i < 30; i++) {
      if (await page.evaluate(function () { return window.__ptaAuthed === true; })) break;
      await page.waitForTimeout(100);
    }
    await page.clock.fastForward(2500);
    await page.waitForTimeout(400);
    if (!statsHits) { await page.clock.fastForward(2500); await page.waitForTimeout(400); }
    const onDash = statsHits;
    need(onDash > 0, '总览没拉统计');
    await page.locator('.dock-item[data-view="sites"]').click();
    await page.waitForTimeout(300);
    need((await page.evaluate(function () { return location.hash; })) === '#sites', '没切到 Sites');
    const vis = await page.evaluate(function () {
      const d = document.querySelector('[data-view="dashboard"]');
      const s = document.querySelector('[data-view="sites"]');
      return { dh: d && d.hidden, sh: s && s.hidden };
    });
    need(vis.dh === true && vis.sh === false, '切页后可见性不对：' + JSON.stringify(vis));
    await page.clock.fastForward(31000);
    await page.waitForTimeout(300);
    need(statsHits - onDash <= 1, '离开总览统计请求叠加：' + onDash + ' -> ' + statsHits);
    await page.locator('.dock-item[data-view="dashboard"]').click();
    await page.waitForTimeout(300);
    await page.clock.fastForward(600);
    await page.waitForTimeout(300);
    need(statsHits > onDash, '回总览没立即刷新');
    const back = statsHits;
    await page.clock.fastForward(31000);
    await page.waitForTimeout(300);
    need(statsHits > back, '总览 30 秒轮询没继续');
    await page.close();
  });

  await check('会话过期时 Logs 暂停，重登后恢复', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let sseHits = 0;
      await page.route('**/api/logs/stream**', async function (route) {
        sseHits++;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 1000\n\n' });
      });
      await page.route('**/api/logs?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.goto(BASE + '/#logs', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      need(sseHits === 0, '未登录就开了 SSE：' + sseHits);
      await page.fill('#login-user', 'admin');
      await page.fill('#login-pass', 'demo-pass');
      await page.click('#login-submit');
      await page.waitForTimeout(2500);
      const afterLogin = sseHits;
      need(afterLogin > 0, '登录后没开 SSE');
      await page.evaluate(async function () {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        await fetch('/api/session', { credentials: 'same-origin' });
      });
      await page.waitForTimeout(1600);
      need((await page.locator('#login-mask').count()) === 1, '过期后没弹登录');
      const paused = sseHits;
      await page.waitForTimeout(3500);
      need(sseHits === paused, '过期后 SSE 还在重连：' + paused + ' -> ' + sseHits);
      await page.fill('#login-user', 'admin');
      await page.fill('#login-pass', 'demo-pass');
      await page.click('#login-submit');
      await page.waitForTimeout(3000);
      need(sseHits > paused, '重登后 SSE 没恢复：' + paused + ' -> ' + sseHits);
      await page.close();
    });

    await check('Queue 下载进度轮询会话过期暂停，重登恢复', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let polls = 0;
    const item = { id: 'q_prog', title: 'Progress Poll Row', status: 'pending', stage: 'draft', targetSite: 'a.example', targets: ['a.example'],
      sourceState: { ok: true, hash: 'a'.repeat(40), progress: 0.2, complete: false, at: '2026-01-01T00:00:00.000Z' } };
    await page.route('**/api/queue?**', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [item], matched: 1, counts: {} } }) });
    });
    await page.route('**/api/queue/q_prog/publish-preview**', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { ready: true } }) });
    });
    await page.route('**/api/queue/q_prog/action', async function (route) {
      polls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { hash: 'a'.repeat(40), progress: 0.5, complete: false } }) });
    });
    await page.route('**/api/queue/q_prog', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item }) });
    });
    await page.route('**/api/targets', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [{ host: 'a.example', hasCookie: true }] }) });
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
    await page.clock.fastForward(1200);
    await page.waitForTimeout(400);
    await page.clock.fastForward(8300);
    await page.waitForTimeout(400);
    need(polls > 0, '选中条目后没启动进度轮询');
    await page.evaluate(async function () {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      await fetch('/api/session', { credentials: 'same-origin' });
    });
    await page.clock.fastForward(1200);
    await page.waitForTimeout(400);
    const paused = polls;
    await page.clock.fastForward(20000);
    await page.waitForTimeout(400);
    need(polls === paused, '过期后仍在轮询进度：' + paused + ' -> ' + polls);
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'demo-pass');
    await page.click('#login-submit');
    await page.clock.fastForward(2000);
    await page.waitForTimeout(400);
    const resumed = polls;
    await page.clock.fastForward(8300);
    await page.waitForTimeout(400);
    need(polls > resumed, '重登后进度轮询没恢复：' + resumed + ' -> ' + polls);
    await page.close();
  });

  await check('App 60 秒会话探测只探会话，不拉受保护数据', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let sessionHits = 0, protectedHits = 0, watching = false;
    page.on('request', function (req) {
      if (!watching) return;
      const u = req.url();
      if (/\/api\/session(\?|$)/.test(u)) sessionHits++;
      if (/\/api\/(queue|downloaders)(\?|$)/.test(u)) protectedHits++;
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    watching = true;
    await page.clock.fastForward(61000);
    await page.waitForTimeout(500);
    need(sessionHits >= 1, '60 秒没探会话');
    await page.evaluate(async function () {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      await fetch('/api/session', { credentials: 'same-origin' });
    });
    await page.clock.fastForward(1200);
    await page.waitForTimeout(300);
    sessionHits = 0; protectedHits = 0;
    await page.clock.fastForward(61000);
    await page.waitForTimeout(500);
    need(sessionHits >= 1, '过期后不再探会话');
    need(protectedHits === 0, '过期后会话探测仍拉受保护数据：' + protectedHits);
    await page.close();
  });

  await check('未登录不拉顶栏数据，Settings 隐藏时不轮询', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let appQueue = 0, appDl = 0, notifyHits = 0, devHits = 0;
    await page.route(/\/api\/queue\?/, async function (route) {
      const limit = new URL(route.request().url()).searchParams.get('limit');
      if (limit === '1') appQueue++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
    });
    await page.route('**/api/downloaders', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      appDl++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
    await page.route('**/api/dev', async function (route) {
      devHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { version: 'test', stack: {}, counts: {}, uptime: 1 } }) });
    });
    await page.route('**/api/notify', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      notifyHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { telegram: false, webhook: false, events: 'error' } }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.clock.fastForward(35000);
    await page.evaluate(function () { location.hash = '#logs'; });
    await page.waitForTimeout(300);
    await page.clock.fastForward(500);
    need(appQueue === 0 && appDl === 0, '未登录就拉顶栏数据：' + JSON.stringify({ q: appQueue, d: appDl }));

    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'demo-pass');
    await page.click('#login-submit');
    await page.clock.fastForward(2000);
    await page.waitForTimeout(300);
    need(appQueue > 0 && appDl > 0, '登录后顶栏没恢复');

    await page.evaluate(function () { location.hash = '#settings'; });
    await page.clock.fastForward(2000);
    await page.waitForTimeout(300);
    need(notifyHits > 0 && devHits > 0, '设置页没加载通知或版本');
    await page.evaluate(function () { location.hash = '#dashboard'; });
    await page.waitForTimeout(300);
    const n0 = notifyHits, v0 = devHits;
    await page.clock.fastForward(12000);
    await page.waitForTimeout(300);
    need(notifyHits === n0 && devHits === v0, '设置隐藏后仍在轮询：' + JSON.stringify({ n: [n0, notifyHits], v: [v0, devHits] }));
    await page.evaluate(function () { location.hash = '#settings'; });
    await page.clock.fastForward(3000);
    await page.waitForTimeout(300);
    need(notifyHits > n0 && devHits > v0, '回设置页没恢复');

    await page.evaluate(async function () {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      await fetch('/api/session', { credentials: 'same-origin' });
    });
    await page.clock.fastForward(1200);
    await page.waitForTimeout(300);
    const q0 = appQueue, d0 = appDl;
    await page.clock.fastForward(35000);
    await page.waitForTimeout(300);
    need(appQueue === q0 && appDl === d0, '过期后顶栏还在拉数据：' + JSON.stringify({ q: [q0, appQueue], d: [d0, appDl] }));
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'demo-pass');
    await page.click('#login-submit');
    await page.clock.fastForward(2000);
    await page.waitForTimeout(300);
    need(appQueue > q0 && appDl > d0, '重登后顶栏没恢复：' + JSON.stringify({ q: [q0, appQueue], d: [d0, appDl] }));
    await page.close();
  });

  await check('hashchange 只在本页触发 Sites/Queue，Nodes 只刷爬取页', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let sitesHits = 0, queueHits = 0, dlHits = 0;
    await page.route('**/api/sites', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      sitesHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { counts: {}, sites: [], status: {} } }) });
    });
    await page.route(/\/api\/queue\?/, async function (route) {
      const limit = new URL(route.request().url()).searchParams.get('limit');
      if (limit !== '50') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
      queueHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
    });
    await page.route('**/api/downloaders', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      dlHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.evaluate(function () { location.hash = '#dashboard'; });
    await page.waitForTimeout(200);
    await page.evaluate(function () { location.hash = '#logs'; });
    await page.waitForTimeout(500);
    const s0 = sitesHits, q0 = queueHits, d0 = dlHits;
    await page.clock.fastForward(10000);
    await page.waitForTimeout(300);
    need(sitesHits === s0 && queueHits === q0 && dlHits === d0, '非本页 hashchange 触发了请求：' + JSON.stringify({ s: [s0, sitesHits], q: [q0, queueHits], d: [d0, dlHits] }));

    await page.evaluate(function () { location.hash = '#sites'; });
    await page.waitForTimeout(300);
    await page.clock.fastForward(500);
    need(sitesHits > s0, 'Sites 页没加载站点');
    await page.evaluate(function () { location.hash = '#queue'; });
    await page.waitForTimeout(300);
    await page.clock.fastForward(500);
    need(queueHits > q0, 'Queue 页没加载队列');

    await page.evaluate(function () { location.hash = '#crawl'; });
    await page.clock.fastForward(1500);
    await page.waitForTimeout(300);
    const d1 = dlHits;
    need(d1 > d0, 'Crawl 页没加载下载器');
    await page.clock.fastForward(31000);
    await page.waitForTimeout(300);
    need(dlHits > d1, 'Crawl 页 30 秒没刷新下载器');
    await page.evaluate(function () { location.hash = '#dashboard'; });
    await page.waitForTimeout(300);
    const d2 = dlHits;
    await page.clock.fastForward(10000);
    await page.waitForTimeout(300);
    need(dlHits === d2, '离开 Crawl 仍刷新下载器：' + d2 + ' -> ' + dlHits);
    await page.close();
  });

  await check('登出后 Nodes/Settings 定时器不再发请求', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.clock.install({ time: new Date() });
    let dlHits = 0, notifyHits = 0;
    await page.route('**/api/downloaders', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      dlHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
    await page.route('**/api/notify', async function (route) {
      if (route.request().method() !== 'GET') return route.continue();
      notifyHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { telegram: false, webhook: false, events: 'error' } }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(function () { location.hash = '#crawl'; });
    await page.clock.fastForward(2600);
    await page.waitForTimeout(300);
    need(dlHits > 0, 'Crawl 页没加载下载器');
    await page.evaluate(function () { location.hash = '#settings'; });
    await page.clock.fastForward(2600);
    await page.waitForTimeout(300);
    need(notifyHits > 0, '设置页没加载通知配置');
    await page.evaluate(async function () {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      await fetch('/api/session', { credentials: 'same-origin' });
    });
    await page.clock.fastForward(1200);
    await page.waitForTimeout(300);
    const d0 = dlHits, n0 = notifyHits;
    await page.clock.fastForward(35000);
    await page.waitForTimeout(300);
    need(dlHits === d0 && notifyHits === n0, '登出后 Nodes/Settings 仍在请求：' + JSON.stringify({ d: [d0, dlHits], n: [n0, notifyHits] }));
    await page.close();
  });

  await check('登出后 Sites/Queue 定时器不再发请求', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let sitesHits = 0, queueHits = 0;
      await page.route('**/api/sites', async function (route) {
        if (route.request().method() !== 'GET') return route.continue();
        sitesHits++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { counts: {}, sites: [], status: {} } }) });
      });
      await page.route(/\/api\/queue\?/, async function (route) {
        queueHits++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [], matched: 0, counts: {} } }) });
      });
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/targets', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sites'; });
      await page.waitForTimeout(1900);
      need(sitesHits > 0, 'Sites 没加载数据');
      await page.evaluate(function () { location.hash = '#queue'; });
      await page.waitForTimeout(1900);
      need(queueHits > 0, 'Queue 没加载数据');
      await page.evaluate(async function () {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        await fetch('/api/session', { credentials: 'same-origin' });
      });
      await page.waitForTimeout(1800);
      const c0 = sitesHits, q0 = queueHits;
      await page.waitForTimeout(4000);
      need(sitesHits === c0 && queueHits === q0, '登出后仍在请求：' + JSON.stringify({ c: [c0, sitesHits], q: [q0, queueHits] }));
      await page.fill('#login-user', 'admin');
      await page.fill('#login-pass', 'demo-pass');
      await page.click('#login-submit');
      await page.waitForTimeout(2000);
      need(queueHits > q0, '重登后 Queue 没恢复');
      await page.close();
    });

};

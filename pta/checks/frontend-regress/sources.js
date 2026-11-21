/* frontend-regress 分组：Dashboard 统计与 Sources 翻页/筛选/行内操作/导出。 */
module.exports = async function run(ctx) {
  const { browser, BASE, check, need, fs } = ctx;
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

    await check('Sources 行内标记/状态失败后不改状态，恢复后可重试', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let markOk = false, statusOk = false, diy = false, archived = false;
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        const row = { id: 'row_1', site: 'site-a.example', title: 'Inline Row', status: archived ? 'archived' : 'new', cat: '', catName: '', marks: diy ? { diy: true } : {} };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [row] } }) });
      });
      await page.route('**/api/catalog/row_1/marks', async function (route) {
        if (!markOk) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture mark fail' } }) });
        diy = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 'row_1', marks: { diy: true } } }) });
      });
      await page.route('**/api/catalog/row_1/status', async function (route) {
        if (!statusOk) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture status fail' } }) });
        archived = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 'row_1', status: 'archived' } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(1800);
      const diyBtn = page.locator('.dl-row .mark-btn').filter({ hasText: 'DIY' });
      await diyBtn.click();
      await page.waitForTimeout(400);
      need((await page.locator('#toast').innerText()).indexOf('fixture mark fail') >= 0, '标记失败没提示：' + (await page.locator('#toast').innerText()));
      need((await page.locator('.dl-row .mark-btn.on').count()) === 0, '失败后标记被改');
      markOk = true;
      await diyBtn.click();
      await page.waitForTimeout(700);
      need((await page.locator('.dl-row .mark-btn.on').count()) === 1, '重试成功后标记没亮');

      await page.locator('.dl-ops button').filter({ hasText: '归档' }).click();
      await page.waitForTimeout(400);
      need((await page.locator('#toast').innerText()).indexOf('fixture status fail') >= 0, '状态失败没提示：' + (await page.locator('#toast').innerText()));
      need((await page.locator('.dl-row .badge').innerText()).indexOf('待筛选') >= 0, '失败后状态被改');
      statusOk = true;
      await page.locator('.dl-ops button').filter({ hasText: '归档' }).click();
      await page.waitForTimeout(700);
      need((await page.locator('.dl-row .badge').innerText()).indexOf('归档') >= 0, '重试后状态没变：' + (await page.locator('.dl-row .badge').innerText()));
      need((await page.locator('.dl-ops button').filter({ hasText: '恢复' }).count()) === 1, '归档后没有恢复按钮');
      await page.close();
    });

    await check('Sources 行内连点只发一次请求', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let markCalls = 0;
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [{ id: 'row_2', site: 'site-a.example', title: 'Busy Row', status: 'new', cat: '', catName: '', marks: {} }] } }) });
      });
      await page.route('**/api/catalog/row_2/marks', async function (route) {
        markCalls++;
        await new Promise(function (r) { setTimeout(r, 400); });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 'row_2', marks: { diy: true } } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(1800);
      const diyBtn = page.locator('.dl-row .mark-btn').filter({ hasText: 'DIY' });
      await diyBtn.click();
      await diyBtn.click();
      await page.waitForTimeout(700);
      need(markCalls === 1, '连点发了多次请求：' + markCalls);
      await page.close();
    });

    await check('401 重登后 Sources 搜索/筛选/分页保持', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const rows = [];
    for (let i = 0; i < 150; i++) rows.push({ id: 's_' + i, site: 'site-a.example', title: 'Source Row ' + i, status: 'new', cat: '', catName: '' });
    await page.route('**/api/site-defs', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
    });
    await page.route('**/api/credentials', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
    await page.route('**/api/catalog/check', async function (route) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '需要登录' } }) });
    });
    await page.route('**/api/catalog?**', async function (route) {
      const status = new URL(route.request().url()).searchParams.get('status') || '';
      const hit = status ? rows.filter(function (x) { return x.status === status; }) : rows;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: hit.length, items: hit } }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(function () { location.hash = '#sources'; });
    await page.waitForTimeout(1600);
    await page.fill('#dl-q', 'Source Row');
    await page.locator('#dl-site').selectOption('site-a.example');
    await page.locator('#dl-status').selectOption('new');
    await page.waitForTimeout(700);
    await page.click('#dl-next');
    await page.waitForTimeout(300);
    need((await page.locator('#dl-page').innerText()).indexOf('2 / 2') >= 0, '初始没到第二页');
    await page.click('#dl-check');
    await page.waitForTimeout(700);
    need((await page.locator('#login-mask').count()) === 1, '401 后没弹登录');
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'demo-pass');
    await page.click('#login-submit');
    await page.waitForTimeout(1300);
    need((await page.locator('#dl-q').inputValue()) === 'Source Row', '重登后搜索词丢了');
    need((await page.locator('#dl-site').inputValue()) === 'site-a.example', '重登后站点筛选丢了');
    need((await page.locator('#dl-status').inputValue()) === 'new', '重登后状态筛选丢了');
    need((await page.locator('#dl-page').innerText()).indexOf('2 / 2') >= 0, '重登后分页丢了：' + (await page.locator('#dl-page').innerText()));
    need((await page.locator('#dl-body .dl-row').count()) === 50, '重登后第二页行数不对');
    await page.close();
  });

  await check('Sources 删除后不再显示旧 dupe 结论', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let cleared = false;
    await page.route('**/api/site-defs', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
    });
    await page.route('**/api/credentials', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
    await page.route('**/api/catalog?**', async function (route) {
      const row = { id: 'cat_dupe_ui', site: 'site-a.example', title: 'Dupe UI Row', status: 'new', cat: '', catName: '' };
      if (!cleared) Object.assign(row, { dupe: 'dupe', dupeTitle: 'Old Dupe', dupeSizeGB: 20, dupeTarget: 'site-a.example' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: 1, items: [row] } }) });
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(function () { location.hash = '#sources'; });
    await page.waitForTimeout(1600);
    need((await page.locator('.dl-row').innerText()).indexOf('已有原盘') >= 0, '删除前没显示 dupe');
    const markOpts = await page.locator('#dl-mark option').evaluateAll(function (os) { return os.map(function (o) { return (o.value || '') + ':' + (o.textContent || ''); }); });
    need(!markOpts.some(function (x) { return /dupe|已有原盘/i.test(x); }), 'dupe 过滤下拉还暴露旧字段：' + JSON.stringify(markOpts));
    cleared = true;
    await page.evaluate(function () { location.hash = '#dashboard'; });
    await page.waitForTimeout(200);
    await page.evaluate(function () { location.hash = '#sources'; });
    await page.waitForTimeout(1600);
    need((await page.locator('.dl-row').innerText()).indexOf('已有原盘') < 0, '删除后还显示旧 dupe');
    await page.close();
  });

  await check('Sources 导出全部页，归档后分页回到 1/1', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
      const rows = [];
      for (let i = 0; i < 150; i++) {
        rows.push({ id: 'a_' + i, site: 'site-a.example', title: 'Archived Row ' + i, status: 'skipped', cat: '', catName: '' });
      }
      let archived = false;
      await page.route('**/api/site-defs', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
      });
      await page.route('**/api/credentials', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
      });
      await page.route('**/api/catalog/bulk', async function (route) {
        archived = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { changed: 150, status: 'archived' } }) });
      });
      await page.route('**/api/catalog?**', async function (route) {
        const items = archived ? [] : rows;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: items.length, items: items } }) });
      });
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async function () {
        await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(function () { location.hash = '#sources'; });
      await page.waitForTimeout(1800);
      await page.locator('#dl-status').selectOption('skipped');
      await page.waitForTimeout(600);
      await page.click('#dl-next');
      await page.waitForTimeout(200);
      need((await page.locator('#dl-body .dl-row').count()) === 50, '第二页不是 50 行');

      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dl-export')]);
      need(download.suggestedFilename() === 'pta-catalog.json', '导出文件名不对：' + download.suggestedFilename());
      const file = await download.path();
      const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
      need(Array.isArray(exported) && exported.length === 150, '导出不是全部页：' + exported.length);

      await page.click('#dl-archive');
      await page.click('#confirm-yes');
      await page.waitForTimeout(900);
      need((await page.locator('#dl-page').innerText()).indexOf('1 / 1') >= 0, '归档后分页没回 1/1：' + (await page.locator('#dl-page').innerText()));
      need((await page.locator('#dl-body').innerText()).indexOf('数据清单还是空的') >= 0, '归档后没显示空状态：' + (await page.locator('#dl-body').innerText()));
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

};

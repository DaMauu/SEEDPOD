/* frontend-regress 分组：删除确认/门禁、held 失败列表展示与分页选中。 */
module.exports = async function run(ctx) {
  const { browser, BASE, check, need } = ctx;
    await check('删除条目提示缓存清理失败，提交门禁错误可见', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let calls = 0, deleted = false;
      const item = function () { return { id: 'q_del', title: 'Delete Row', status: 'approved', stage: 'previewed', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
      await page.route('**/api/queue/q_del', async function (route) {
        if (route.request().method() !== 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
        calls++;
        if (calls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'fixture delete fail' } }) });
        if (calls === 2) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'TARGET_SUBMITTED', message: '目标站已提交/注入：a.example' } }) });
        deleted = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 'q_del', cleanedFiles: 0, cleanupErrors: [{ hash: 'a'.repeat(40), error: 'EACCES' }] } }) });
      });
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: deleted ? [] : [item()], matched: deleted ? 0 : 1, counts: {} } }) });
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
      const delBtn = function () { return page.locator('.qd-actions button').filter({ hasText: '删除' }); };
      await delBtn().click();
      await page.click('#confirm-yes');
      await page.waitForTimeout(500);
      need((await page.locator('#toast').innerText()).indexOf('fixture delete fail') >= 0, '500 错误没提示：' + (await page.locator('#toast').innerText()));
      need(!(await delBtn().isDisabled()), '500 后删除按钮没恢复');
      await delBtn().click();
      await page.click('#confirm-yes');
      await page.waitForTimeout(500);
      need((await page.locator('#toast').innerText()).indexOf('目标站已提交') >= 0, '提交门禁错误没提示：' + (await page.locator('#toast').innerText()));
      await delBtn().click();
      await page.click('#confirm-yes');
      await page.waitForTimeout(700);
      const t = await page.locator('#toast').innerText();
      need(t.indexOf('已删除') >= 0 && t.indexOf('缓存清理失败 1 个') >= 0 && t.indexOf('EACCES') >= 0, '清理失败没提示：' + t);
      need((await page.locator('.q-item').count()) === 0, '删除后列表没刷新');
      await page.close();
    });

    await check('多条缓存清理失败显示数量和首条错误', async function () {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let deleted = false;
    const item = function () { return { id: 'q_del_multi', title: 'Multi Cleanup Row', status: 'approved', stage: 'draft', targetSite: 'test-a.example', targets: ['test-a.example'] }; };
    await page.route('**/api/queue/q_del_multi', async function (route) {
      if (route.request().method() === 'DELETE') {
        deleted = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { id: 'q_del_multi', cleanedFiles: 0, cleanupErrors: [{ error: 'EACCES' }, { error: 'EPERM' }] } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: item() }) });
    });
    await page.route('**/api/queue?**', async function (route) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: deleted ? [] : [item()], matched: deleted ? 0 : 1, counts: {} } }) });
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
    await page.locator('.qd-actions button').filter({ hasText: '删除' }).click();
    await page.click('#confirm-yes');
    await page.waitForTimeout(700);
    const t = await page.locator('#toast').innerText();
    need(t.indexOf('缓存清理失败 2 个') >= 0 && t.indexOf('EACCES') >= 0, '多条清理失败提示不对：' + t);
    await page.close();
  });

  await check('删除按钮按状态提示，已提交目标禁用', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const items = {
        q_failed: { id: 'q_failed', title: 'Delete Failed Row', status: 'failed', stage: 'previewed', targetSite: 'a.example', targets: ['a.example'], targetResults: { 'a.example': { stage: 'failed', error: '目标站拒绝' } } },
        q_rejected: { id: 'q_rejected', title: 'Delete Rejected Row', status: 'rejected', stage: 'draft', targetSite: 'a.example', targets: ['a.example'], targetResults: {} },
        q_submitted: { id: 'q_submitted', title: 'Delete Submitted Row', status: 'approved', stage: 'submitted', targetSite: 'a.example', targets: ['a.example'], targetResults: { 'a.example': { stage: 'submitted' } } }
      };
      await page.route('**/api/queue?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: Object.keys(items).map(function (k) { return items[k]; }), matched: 3, counts: {} } }) });
      });
      await page.route(/\/api\/queue\/(q_failed|q_rejected|q_submitted)$/, async function (route) {
        const id = route.request().url().split('/').pop();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: items[id] }) });
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
      await page.waitForTimeout(900);
      const delBtn = function () { return page.locator('.qd-actions button').filter({ hasText: '删除' }); };

      await page.locator('.q-item').filter({ hasText: 'Delete Failed Row' }).click();
      await page.waitForTimeout(400);
      need(!(await delBtn().isDisabled()), '失败条目删除按钮被禁用');
      await delBtn().click();
      need((await page.locator('#confirm-text').innerText()).indexOf('失败条目') >= 0, '失败确认文案不对');
      await page.click('#confirm-no');

      await page.locator('.q-item').filter({ hasText: 'Delete Rejected Row' }).click();
      await page.waitForTimeout(400);
      need(!(await delBtn().isDisabled()), '驳回条目删除按钮被禁用');
      await delBtn().click();
      need((await page.locator('#confirm-text').innerText()).indexOf('已驳回条目') >= 0, '驳回确认文案不对');
      await page.click('#confirm-no');

      await page.locator('.q-item').filter({ hasText: 'Delete Submitted Row' }).click();
      await page.waitForTimeout(400);
      need(await delBtn().isDisabled(), '已提交条目删除按钮没禁用');
      need((await delBtn().getAttribute('title')).indexOf('目标站已提交') >= 0, '禁用原因没提示');
      await page.close();
    });

    await check('held 失败分页后选中状态与搜索高亮保持一致', async function () {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const items = [];
      for (let i = 0; i < 21; i++) {
        const id = 'q_held_' + String(i).padStart(2, '0');
        items.push({ id: id, title: 'Held Page Row ' + i, status: 'approved', stage: 'source', dead: false,
          failures: [{ kind: 'source', stage: 'source', code: 'SOURCE_INCOMPLETE', message: '源种未下完', attempts: 0, lastAttemptAt: new Date().toISOString() }] });
      }
      await page.route('**/api/failures?**', async function (route) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { total: items.length, counts: {}, byStage: { source: items.length }, retryMax: 2, items: items } }) });
      });
      await page.route(/\/api\/queue\/(q_held_\d+)$/, async function (route) {
        const id = route.request().url().split('/').pop();
        const hit = items.filter(function (x) { return x.id === id; })[0];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: Object.assign({}, hit, { targetSite: 'a.example', targets: ['a.example'] }) }) });
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
      await page.waitForTimeout(500);
      await page.locator('.qf-pager .pager-link').filter({ hasText: '下一页' }).click();
      await page.waitForTimeout(200);
      const row = page.locator('.qf-row').first();
      const title = await row.locator('.qf-title').innerText();
      await row.click();
      await page.waitForTimeout(500);
      need((await page.locator('.qf-row.on').count()) === 1, '第二页选中态不对');
      need((await page.locator('.qd-title-row').innerText()).indexOf(title) >= 0, '详情没切到第二页条目');
      await page.locator('.qf-pager .pager-link').filter({ hasText: '上一页' }).click();
      await page.waitForTimeout(200);
      need((await page.locator('.qf-row.on').count()) === 0, '第一页仍错误高亮第二页条目');
      need((await page.locator('.qd-title-row').innerText()).indexOf(title) >= 0, '翻页后详情丢了');
      await page.fill('#queue-q', title.split(' ').pop());
      await page.waitForTimeout(700);
      need((await page.locator('.qf-row').count()) === 1, '搜索没过滤到一条：' + (await page.locator('.qf-row').count()));
      need((await page.locator('.qf-row.on').count()) === 1, '搜索后选中项没高亮');
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

};

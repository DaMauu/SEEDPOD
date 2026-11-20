/* api-v2 尾段：站点定义/映射、站点包、覆盖、凭据、下载器、统计、外部触发、退出。 */
const fs = require('fs');
const path = require('path');

module.exports = async function run(ctx) {
  const { BASE, DATA, ROOT, fetchA, check, need } = ctx;
  await check('删除词条不删已发布历史，失败队列保留', async () => {
    const cid = 'cat_del_ref';
    const addC = await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ id: cid, title: 'Delete Ref', status: 'new' }] })
    });
    need(addC.status === 200, '建词条失败：' + addC.status);
    const addQ = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ref Queue 2020', site: 'demo-a.example', catalogId: cid, status: 'pending' })
    })).json();
    need(addQ.ok && addQ.data.id, '建引用队列失败：' + JSON.stringify(addQ));
    const failedQ = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Failed Ref 2020', site: 'demo-a.example', catalogId: cid, status: 'failed', stage: 'failed', stageLastError: 'fixture failed' })
    })).json();
    need(failedQ.ok && failedQ.data.id, '建失败引用失败：' + JSON.stringify(failedQ));
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      db.prepare('INSERT INTO published(id, data, created_at) VALUES(?, ?, ?)')
        .run('pub_ref_1', JSON.stringify({ id: 'pub_ref_1', title: 'Published Ref', catalogId: cid, publishedAt: new Date().toISOString() }), new Date().toISOString());
      db.close();
    }
    const del = await (await fetchA(BASE + '/api/catalog/' + cid, { method: 'DELETE' })).json();
    need(del.ok && del.data.detached === 2, '删除没摘引用：' + JSON.stringify(del));
    const q = await (await fetchA(BASE + '/api/queue/' + encodeURIComponent(addQ.data.id))).json();
    need(q.ok, '队列条目没了：' + JSON.stringify(q));
    need(q.data.catalogId === undefined, 'catalogId 还在：' + JSON.stringify(q.data.catalogId));
    need(typeof q.data.catalogDeletedAt === 'string', '没留删除时间');
    const fq = await (await fetchA(BASE + '/api/queue/' + encodeURIComponent(failedQ.data.id))).json();
    need(fq.ok && fq.data.stage === 'failed', '失败项阶段被改：' + JSON.stringify(fq.data && fq.data.stage));
    const fails = await (await fetchA(BASE + '/api/failures?limit=200')).json();
    need(fails.ok && (fails.data.items || []).some(function (x) { return x.id === failedQ.data.id; }), '删除词条把失败队列项弄丢');
    const pubs = await (await fetchA(BASE + '/api/published')).json();
    need(pubs.ok && (pubs.data.items || []).some(function (x) { return x.id === 'pub_ref_1'; }), '删除词条把已发布历史删了');
    const ov = await (await fetchA(BASE + '/api/stats/overview')).json();
    need(ov.ok && Number(ov.data.published.total) >= 1, '发布统计丢了历史');
    const list = await (await fetchA(BASE + '/api/catalog?limit=500')).json();
    need(list.ok && (list.data.items || []).every(function (x) { return x.id !== cid; }), '词条没删掉');
    const again = await fetchA(BASE + '/api/catalog/' + cid, { method: 'DELETE' });
    need(again.status === 404, '重复删除状态码不对：' + again.status);
    await fetchA(BASE + '/api/queue/' + failedQ.data.id, { method: 'DELETE' });
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      db.prepare("DELETE FROM published WHERE id = 'pub_ref_1'").run();
      db.close();
    }
  });

  await check('保存类型：变了清全量游标，没变不动', async () => {
    const host = 'types.example';
    const put0 = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', base: 'https://types.example', catMap: { '电影': '401', '音乐': '413' } })
    });
    need(put0.status === 200, '站点定义保存失败 ' + put0.status);
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      const row = db.prepare("SELECT v FROM meta WHERE k = 'crawl-state'").get();
      const st = row ? JSON.parse(row.v) : {};
      st[host] = { page: 3, catIdx: 1, fullDoneAt: '2026-01-01T00:00:00.000Z', lastAt: 1 };
      db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
      db.close();
    }

    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      const item = (id, reason) => ({ id: id, site: host, siteId: id, title: id, status: 'skipped', skipReason: reason, skippedAt: '2026-01-01T00:00:00.000Z' });
      db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('cat_type_1', host, 't1', '', 'type skip', 'skipped', JSON.stringify(item('cat_type_1', '类型不符 音乐')), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('cat_type_2', host, 't2', '', 'other skip', 'skipped', JSON.stringify(item('cat_type_2', '体积偏小')), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      db.close();
    }
    const put1 = await fetchA(BASE + '/api/crawl/types/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ types: ['电影'] })
    });
    const j1 = await put1.json();
    need(put1.status === 200 && j1.ok, '保存类型失败：' + put1.status);
    need(j1.data.fullReset === true, '首次保存没标全量：' + JSON.stringify(j1.data));
    need(j1.data.matched && j1.data.matched[0] === '电影', '类型没匹配：' + JSON.stringify(j1.data));
    need(j1.data.rechecked === 1, '类型不符词条没重置：' + JSON.stringify(j1.data));
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      const a = JSON.parse(db.prepare("SELECT data FROM catalog WHERE id = 'cat_type_1'").get().data);
      const b = JSON.parse(db.prepare("SELECT data FROM catalog WHERE id = 'cat_type_2'").get().data);
      db.close();
      need(a.status === 'new' && !a.skipReason && !a.skippedAt, '类型不符词条没回到待审：' + JSON.stringify({ status: a.status, reason: a.skipReason }));
      need(b.status === 'skipped' && b.skipReason === '体积偏小', '非类型跳过被误重置：' + JSON.stringify({ status: b.status, reason: b.skipReason }));
    }
    {
      const { DatabaseSync } = require('node:sqlite');
      const db2 = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      const st2 = JSON.parse((db2.prepare("SELECT v FROM meta WHERE k = 'crawl-state'").get() || {}).v || '{}');
      db2.close();
      need(!st2[host].fullDoneAt, '类型变了 fullDoneAt 没清：' + JSON.stringify(st2[host]));
      need(st2[host].page === 0 && st2[host].catIdx === 0, '类型变了游标没归零：' + JSON.stringify(st2[host]));
    }

    const put2 = await fetchA(BASE + '/api/crawl/types/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ types: ['电影'] })
    });
    const j2 = await put2.json();
    need(j2.ok && j2.data.fullReset === false, '类型没变却清了全量：' + JSON.stringify(j2.data));

    const put3 = await fetchA(BASE + '/api/crawl/types/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ types: ['音乐'] })
    });
    const j3 = await put3.json();
    need(j3.ok && j3.data.fullReset === true, '类型再变没标全量：' + JSON.stringify(j3.data));
    await fetchA(BASE + '/api/sites/' + host, { method: 'DELETE' });
  });

  await check('抓取状态可读', async () => {
    const host = 'cursor.example';
    const add = await fetchA(BASE + '/api/sites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://cursor.example/index.php', arch: 'NP', title: 'Cursor Site' })
    });
    need(add.status === 200, '添加站点失败 ' + add.status);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    const row = db.prepare("SELECT v FROM meta WHERE k = 'crawl-state'").get();
    const st = row ? JSON.parse(row.v) : {};
    st[host] = { page: 7, catIdx: 2, lastAt: Date.now(), dayCount: 5 };
    db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
    db.close();
    const s = await (await fetchA(BASE + '/api/crawl/status?host=' + host)).json();
    need(s.ok && s.data.page === 7 && s.data.catIdx === 2 && s.data.count === 5, '状态字段不对：' + JSON.stringify(s));
    await fetchA(BASE + '/api/sites/' + host, { method: 'DELETE' });
  });

  await check('站点定义 base 必须是本站域名', async () => {
    const host = 'badbase.example';
    const bad = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', base: 'https://evil.example' })
    });
    need(bad.status === 400, '外部 base 没拦住：' + bad.status);
    const bj = await bad.json();
    need(bj.error && bj.error.code === 'BAD_BASE', '错误码不对：' + JSON.stringify(bj.error));
    const okput = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', base: 'https://sub.' + host })
    });
    need(okput.status === 200, '同站子域 base 被拒：' + okput.status);
    await fetchA(BASE + '/api/sites/' + host, { method: 'DELETE' });
  });

  await check('站点定义 catMode 只接受已知值', async () => {
    const host = 'catmode.example';
    const bad = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', base: 'https://catmode.example', catMode: 'wild' })
    });
    need(bad.status === 400, '未知 catMode 没拦住：' + bad.status);
    const bj = await bad.json();
    need(bj.error && bj.error.code === 'BAD_CAT_MODE', '错误码不对：' + JSON.stringify(bj.error));
    const good = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', base: 'https://catmode.example', catMode: 'indexed' })
    });
    need(good.status === 200, '已知 catMode 被拒：' + good.status);
    await fetchA(BASE + '/api/sites/' + host, { method: 'DELETE' });
  });

  await check('站点分类映射数组/对象回读', async () => {
    const host = 'map.example';
    const arr = { engine: 'nexusphp', base: 'https://map.example', cats: { movie: ['401'], tv: ['402'] },
      catMap: [{ id: '401', label: 'Movies', purpose: 'movie' }, { id: '402', label: 'TV', purpose: 'tv' }] };
    const put = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(arr)
    });
    need(put.status === 200, '数组映射保存失败 ' + put.status);
    const got = await (await fetchA(BASE + '/api/site-def/' + host)).json();
    need(got.ok && Array.isArray(got.data.catMap) && got.data.catMap.length === 2, '数组映射没读回');
    need(got.data.catMap[0].purpose === 'movie' && got.data.catMap[1].id === '402', '数组映射内容不对');
    const list = await (await fetchA(BASE + '/api/site-defs')).json();
    need(list.ok && list.data[host] && list.data[host].groups === 2 && list.data[host].ids === 2, 'site-defs 分类统计不对：' + JSON.stringify(list.data[host]));
    const obj = { engine: 'nexusphp', base: 'https://map.example', catMap: { movie: '401', tv: '402' } };
    const put2 = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj)
    });
    need(put2.status === 200, '对象映射保存失败 ' + put2.status);
    const got2 = await (await fetchA(BASE + '/api/site-def/' + host)).json();
    need(got2.ok && got2.data.catMap && got2.data.catMap.movie === '401' && got2.data.catMap.tv === '402', '对象映射没读回');
  });

  await check('上传表单 HTML 识别接口', async () => {
    const html = fs.readFileSync(path.join(ROOT, 'fixtures', 'upload-form.html'), 'utf8');
    const r = await fetchA(BASE + '/api/form/parse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: html })
    });
    need(r.status === 200, '识别接口失败 ' + r.status);
    const j = await r.json();
    need(j.ok && j.data.path === '/takeupload.php' && j.data.fileField === 'torrent', '识别结果不对：' + JSON.stringify(j.data && { path: j.data.path, fileField: j.data.fileField }));
    need(j.data.forms && j.data.forms[0].fields.length === 6, '字段数量不对');
    const no = await fetchA(BASE + '/api/form/parse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: '<div>没有表单</div>' })
    });
    need(no.status === 422, '没有表单时应返回 422，实际 ' + no.status);
  });

  await check('站点包状态与例外门禁', async () => {
    const j = await (await fetchA(BASE + '/api/site-pack')).json();
    need(j.ok && j.data.available === false, '无密钥时应不可用：' + JSON.stringify(j.data && { available: j.data.available, reason: j.data.reason }));
    need(j.data.reason === 'NO_KEY', '缺密钥原因不对：' + j.data.reason);
    need(Array.isArray(j.data.purposes) && j.data.purposes.length > 0, '用途列表缺失');
    const bad = await fetchA(BASE + '/api/site-pack/exception', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: '../x', id: '1', purpose: 'movie' })
    });
    need(bad.status === 400, '坏 host 状态码是 ' + bad.status);
    const bj = await bad.json();
    need(bj.error && bj.error.code === 'BAD_HOST', '坏 host 错误码不对：' + JSON.stringify(bj));
  });

  await check('站点覆盖统计接口', async () => {
    const j = await (await fetchA(BASE + '/api/coverage')).json();
    need(j.ok && typeof j.data.total === 'number', '覆盖接口结构不对：' + JSON.stringify(j));
    need(typeof j.data.withCookie === 'number' && typeof j.data.ready === 'number', '覆盖计数缺失');
    need(typeof j.data.planOk === 'number' && typeof j.data.planFail === 'number', '计划计数缺失');
  });

  await check('凭据只回 hasCookie，不回明文', async () => {
    const put = await (await fetchA(BASE + '/api/credentials/demo-a.example', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'sid=secret-cookie' })
    })).json();
    need(put.ok && put.data.hasCookie === true, '保存失败');
    const list = await (await fetchA(BASE + '/api/credentials')).text();
    need(list.indexOf('secret-cookie') < 0, '响应里出现了 cookie 明文');
    const j = JSON.parse(list);
    need(Array.isArray(j.data) && j.data[0].hasCookie === true, '列表没有 hasCookie');
    need(j.data[0].cookie === undefined, '列表回了 cookie 字段');
    need(j.data[0].readable === true, 'cookie 可读状态不对：' + JSON.stringify(j.data[0]));
  });

  await check('下载器密码不回显', async () => {
    const add = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'fixture', url: 'http://127.0.0.1:9999', pass: 'secret-pass' })
    })).json();
    need(add.ok && add.data.hasPass === true, '新增失败');
    need(add.data.passReadable === true, '密码可读状态不对：' + JSON.stringify(add.data));
    const list = await (await fetchA(BASE + '/api/downloaders')).text();
    need(list.indexOf('secret-pass') < 0, '响应里出现了密码明文');
  });

  await check('API 404 是 JSON', async () => {
    const r = await fetchA(BASE + '/api/not-exist');
    need(r.status === 404, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.ok === false && j.error && j.error.code === 'NOT_FOUND', '不是标准错误体');
  });

  await check('统计总览有发布/失败/站点字段', async () => {
    const r = await fetchA(BASE + '/api/stats/overview');
    const j = await r.json();
    need(j.ok && j.data, '统计失败');
    const d = j.data;
    need(d.published && Array.isArray(d.published.bySite), '没有 bySite');
    need(d.published.byDay.length === 14, 'byDay 应为 14 天：' + d.published.byDay.length);
    need(d.failures && Array.isArray(d.failures.reasons), '没有失败原因');
    need(typeof d.sites.enabled === 'number' && typeof d.crawl.runsToday === 'number', '站点/抓取字段缺失');
    need(typeof d.published.last7d === 'number', '没有近 7 天发布数');
  });

  await check('外部触发无 token 被拒', async () => {
    const no = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    need(no.status === 401, '没 token 应 401：' + no.status);
    const bad = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-token': 'wrong' }, body: '{}' });
    need(bad.status === 401, '错 token 应 401：' + bad.status);
    const good = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-token': 'check-token' }, body: JSON.stringify({ steps: ['crawl'] }) });
    const gj = await good.json();
    need(good.status === 200 && gj.ok, '带 token 没跑起来：' + good.status + ' ' + JSON.stringify(gj));
    need(gj.data.steps.crawl && gj.data.steps.crawl.skipped === 'realCrawl off', '步骤过滤没生效：' + JSON.stringify(gj.data.steps.crawl));
    const logs = await (await fetchA(BASE + '/api/logs?limit=30')).json();
    need(logs.ok && logs.data.some(function (x) { return x.tag === '调度' && /开始一轮/.test(x.msg); }), '调度开始日志没写');
    need(logs.data.some(function (x) { return x.tag === '调度' && /(完成|部分失败)/.test(x.msg); }), '调度完成日志没写：' + JSON.stringify((logs.data || []).slice(-3)));
  });

  await check('退出登录后会话失效', async () => {
    const r = await fetchA(BASE + '/api/logout', { method: 'POST' });
    need(r.ok, '退出失败');
    const s = await fetchA(BASE + '/api/session');
    need(s.status === 401, '退出后还能读会话');
  });

};

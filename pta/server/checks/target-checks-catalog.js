/* target 分类/私有包/探针检查组。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

async function runCatalog(C) {
  const { check, need, json, BASE, DATA, mockPort } = C;
  await check('分类标签带空格也能匹配', async function () {
    const maps = require(path.join(ROOT, 'server', 'routes-maps.js'));
    const m = maps._test.matchCats([
      { value: '1', label: '电 影' },
      { value: '2', label: '综 艺' },
      { value: '3', label: '其 它' },
      { value: '4', label: 'BDMV' }
    ]);
    need(m['电影'] === '1', '「电 影」没匹配：' + JSON.stringify(m));
    need(m['综艺'] === '2', '「综 艺」没匹配');
    need(m['其他'] === '3', '「其 它」没匹配');
    need(m['原盘'] === '4', 'BDMV 没归原盘');
  });

  await check('私有包目标站列表与 cookie 就绪', async function () {
    const j = await json(BASE + '/api/targets');
    need(j.status === 200 && j.body.ok, '列表失败');
    const t = (j.body.data || []).filter(function (x) { return x.host === '127.0.0.1'; })[0];
    need(t && t.engine === 'nexusphp', '没读到私有包里的目标站');
    need(t.hasCookie === false && t.ready === false, '未导入 cookie 时应为未就绪');
    const put = await json(BASE + '/api/credentials/127.0.0.1', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'mock-cookie' })
    });
    need(put.status === 200 && put.body.ok, 'cookie 没存上');
    const j2 = await json(BASE + '/api/targets');
    const t2 = (j2.body.data || []).filter(function (x) { return x.host === '127.0.0.1'; })[0];
    need(t2 && t2.hasCookie === true && t2.ready === true, '导入 cookie 后没就绪');
    /* 有站点记录时也要能列出（防止 jparse 之类的运行时错误） */
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)')
      .run('127.0.0.1', JSON.stringify({ url: 'http://127.0.0.1:' + mockPort, enabled: true }), new Date().toISOString());
    db.close();
    const j3 = await json(BASE + '/api/targets');
    need(j3.status === 200 && j3.body.ok, '有站点记录后列表失败：' + j3.status);
    const t3 = (j3.body.data || []).filter(function (x) { return x.host === '127.0.0.1'; })[0];
    need(t3 && t3.enabled === true, '有站点记录时没列出或 enabled 不对');
  });

  await check('手动识别上传表单与冷却', async function () {
    const r = await json(BASE + '/api/targets/127.0.0.1/detect-form', { method: 'POST' });
    need(r.status === 200 && r.body.ok, '识别失败：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
    need(r.body.data.path === '/takeupload.php', '上传路径不对：' + r.body.data.path);
    need(r.body.data.formPath === '/upload-form', '识别页路径不对：' + r.body.data.formPath);
    need(r.body.data.fileField === 'torrent', '文件字段不对：' + r.body.data.fileField);
    need(r.body.data.fields.length === 6, '字段数量不对：' + r.body.data.fields.length);
    const again = await json(BASE + '/api/targets/127.0.0.1/detect-form', { method: 'POST' });
    need(again.status === 429 && again.body.error.code === 'TOO_SOON', '冷却没生效：' + again.status);
    const no = await json(BASE + '/api/targets/unit3d.example/detect-form', { method: 'POST' });
    need(no.status === 400 && no.body.error.code === 'NO_COOKIE', '没 cookie 不该请求：' + no.status + ' ' + JSON.stringify(no.body && no.body.error));
  });

  await check('announce 候选只回类型不回明文', async function () {
    const j = await json(BASE + '/api/targets/127.0.0.1/announce', { method: 'POST' });
    need(j.status === 200 && j.body.ok, 'announce 候选失败：' + j.status);
    const list = j.body.data.candidates || [];
    need(list.length > 0, '没有 announce 候选');
    need(list.some(function (c) { return c.source === 'upload-page' && c.kind === 'passkey' && c.hasPasskey === true; }), '上传页 passkey 候选没识别：' + JSON.stringify(list));
    need(list.every(function (c) { return c.announce === undefined; }), '接口回了 announce 明文');
  });

  await check('批量只读探测上传字段', async function () {
    const j = await json(BASE + '/api/probe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hosts: ['127.0.0.1'], limit: 1, delay: 0 })
    });
    need(j.status === 200 && j.body.ok, '探测失败：' + j.status + ' ' + JSON.stringify(j.body && j.body.error));
    const d = j.body.data;
    need(d.checked === 1 && d.sites.length === 1 && d.sites[0].host === '127.0.0.1', '探测结果不对：' + JSON.stringify(d));
    need(d.sites[0].fieldCount > 0 && Array.isArray(d.sites[0].fields), '没解析出上传字段');
    need(d.sites[0].status === 'ok' || d.sites[0].status === 'missing_fields', '探测状态不对：' + d.sites[0].status);
    need(d.sites[0].fileField === 'torrent', '探测到的文件字段不对：' + d.sites[0].fileField);
    need(d.sites[0].fileFieldMismatch === true && d.sites[0].fileFieldCurrent === 'file', '文件字段差异没报出来：' + JSON.stringify(d.sites[0]));
  });

}

module.exports = { runCatalog };

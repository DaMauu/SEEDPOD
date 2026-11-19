/* target 上传/计划检查组：干跑字段、分类/标签/BDInfo、门禁、提交与查重。 */
const fs = require('fs');
const path = require('path');
const { infoHash } = require('./target-mock');
async function runUpload(C) {
  const { check, need, json, BASE, DATA, torrent, hash, hits, state, mockPort, makeTorrent2 } = C;
  let qid = '';
  await check('队列条目与干跑表单映射', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Target Upload 2024 1080p Blu-ray', cn: '目标站测试', intro: '测试简介',
        site: 'source.example', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB', anonymous: false,
        shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
    });
    need(add.status === 200 && add.body.ok, '建队列失败');
    qid = add.body.data.id;
    const plan = await json(BASE + '/api/targets/127.0.0.1/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: qid })
    });
    need(plan.status === 200 && plan.body.ok, '计划失败：' + JSON.stringify(plan.body && plan.body.error));
    const d = plan.body.data;
    need(d.url.indexOf('/takeupload.php') >= 0, '上传地址不对：' + d.url);
    need(d.fileField === 'file', '文件字段不对');
    need(d.fields.name === 'Target Upload 2024 1080p Blu-ray', '标题映射不对：' + d.fields.name);
    need(d.fields.small_desc === '目标站测试', '副标题映射不对：' + d.fields.small_desc);
    need(d.fields.descr === '测试简介', '简介映射不对');
    need(d.fields.anon === '0', '匿名映射不对');
    need(d.verifyUrl.indexOf('/torrents.php?search=') >= 0, '回查地址不对');
    need(d.hasCookie === true && d.ready === true, '有 cookie 的站预检应就绪：' + JSON.stringify({ hasCookie: d.hasCookie, ready: d.ready }));
    need(!(d.warnings || []).includes('目标站没有 cookie'), '有 cookie 还报缺 cookie：' + JSON.stringify(d.warnings));
    const dry = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: true })
    });
    need(dry.status === 200 && dry.body.ok && dry.body.data.dryRun === true && dry.body.data.sent === false, '干跑不对');
    need(dry.body.data.torrent && dry.body.data.torrent.hash === hash, '种子哈希不对');
    need(hits.length === 0, '干跑不该发请求，实际发了 ' + hits.length + ' 次');
    const multi = await json(BASE + '/api/queue/' + encodeURIComponent(qid) + '/targets/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: ['127.0.0.1'], torrentBase64: torrent.toString('base64'), dryRun: true })
    });
    need(multi.status === 200 && multi.body.ok, '多目标接口失败：' + multi.status);
    need(Array.isArray(multi.body.data.targets) && multi.body.data.targets.length === 1 && multi.body.data.targets[0].ok, '多目标干跑结果不对');
    need(hits.length === 0, '多目标干跑发了请求：' + hits.length);
    const second = makeTorrent2();
    const multi2 = await json(BASE + '/api/queue/' + encodeURIComponent(qid) + '/targets/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: ['127.0.0.1'], torrentBase64: torrent.toString('base64'), targetTorrents: { '127.0.0.1': second.toString('base64') }, dryRun: true })
    });
    need(multi2.status === 200 && multi2.body.ok, '每站种子干跑失败：' + multi2.status);
    const m2 = multi2.body.data.targets[0] && multi2.body.data.targets[0].data && multi2.body.data.targets[0].data.torrent;
    need(m2 && m2.hash === infoHash(second), '多目标没用每站指定种子：' + JSON.stringify(m2));
    need(hits.length === 0, '每站种子干跑发了请求：' + hits.length);
    const multi3 = await json(BASE + '/api/queue/' + encodeURIComponent(qid) + '/targets/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: ['127.0.0.1'], torrentBase64: torrent.toString('base64'), targetAnnounces: { '127.0.0.1': 'https://target.example/announce.php?passkey=test' }, dryRun: true })
    });
    need(multi3.status === 200 && multi3.body.ok, '清洗干跑失败：' + multi3.status);
    need(multi3.body.data.targets[0].data.cleaned === true, '清洗标记没出来');
    need(multi3.body.data.targets[0].data.torrent.hash === hash, '清洗后 infohash 变了');
    need(hits.length === 0, '清洗干跑发了请求：' + hits.length);
  });

  await check('计划返回可读分类/制作组标签', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Label 2024 1080p Blu-ray', cn: '标签', intro: 'x', targetSite: 'labels.example', status: 'approved', cat: '电影', team: 'CMCT' })
    });
    need(add.status === 200 && add.body.ok, '建标签队列失败');
    const p = await json(BASE + '/api/targets/labels.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, '标签计划失败：' + JSON.stringify(p.body && p.body.error));
    need(p.body.data.labels && p.body.data.labels.type === '电影', '分类标签没回填：' + JSON.stringify(p.body.data.labels));
    need(p.body.data.labels.team_sel === 'CMCT', '制作组标签没回填：' + JSON.stringify(p.body.data.labels));
  });

  await check('发布前检查只读返回计划，不发目标站请求', async function () {
    const before = hits.length;
    const pv = await json(BASE + '/api/queue/' + encodeURIComponent(qid) + '/publish-preview?host=127.0.0.1');
    need(pv.status === 200 && pv.body.ok, '预览失败：' + pv.status + ' ' + JSON.stringify(pv.body && pv.body.error));
    const d = pv.body.data;
    need(d.host === '127.0.0.1' && d.ready === true, '预览计划没就绪：' + JSON.stringify(d));
    need(typeof d.trackerNote === 'string' && d.trackerNote.length > 0, '预览缺 tracker 说明');
    need(d.dupe && d.dupe.state === 'unchecked' && /发布时自动查/.test(d.dupe.label), '目标站查重默认状态不对：' + JSON.stringify(d.dupe));
    need(d.torrent && d.torrent.hash === '', '没有源种时不该编 hash：' + JSON.stringify(d.torrent));
    need(hits.length === before, '预览不该发目标站请求：' + (hits.length - before));
  });

  await check('发布前检查用缓存源种验证清洗不改 infohash', async function () {
    const dir = path.join(DATA, 'torrents');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'source-' + hash + '.torrent'), torrent, { mode: 0o600 });
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    const row = db.prepare('SELECT data FROM queue WHERE id = ?').get(qid);
    const it = JSON.parse(row.data);
    it.sourceState = { ok: true, at: new Date().toISOString(), hash: hash, name: 'Source.Torrent.2024', progress: 1, complete: true };
    db.prepare('UPDATE queue SET data = ? WHERE id = ?').run(JSON.stringify(it), qid);
    db.close();
    const pv = await json(BASE + '/api/queue/' + encodeURIComponent(qid) + '/publish-preview?host=127.0.0.1');
    need(pv.status === 200 && pv.body.ok, '预览失败：' + JSON.stringify(pv.body && pv.body.error));
    const d = pv.body.data;
    need(d.torrent && d.torrent.hash === hash, '预览没读到缓存源种：' + JSON.stringify(d.torrent));
    need(d.checked === true && d.hashUnchanged === true, '清洗校验没通过：' + JSON.stringify({ checked: d.checked, hashUnchanged: d.hashUnchanged }));
  });

  await check('目标站副标题优先用源副标题', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Source Sub 2024 1080p Blu-ray', subtitle: '源站副标题 / 别名 [国配中字]', cn: '源站副标题', intro: 'x',
        site: 'source.example', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '7.90 GB' })
    });
    need(add.status === 200 && add.body.ok, '建队列失败');
    const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, '计划失败');
    need(p.body.data.fields.small_desc === '源站副标题 / 别名 [国配中字]', '副标题没原样用源副标题：' + p.body.data.fields.small_desc);
  });

  await check('分类映射以中文为准', async function () {
    async function planOf(cat) {
      const add = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cat Map 2024 1080p', cn: '分类映射', intro: 'x', cat, targetSite: '127.0.0.1', status: 'approved', res: '1080p', size: '20 GB' })
      });
      need(add.status === 200 && add.body.ok, '建队列失败');
      const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
      });
      need(p.status === 200 && p.body.ok, '计划失败');
      return p.body.data;
    }
    need((await planOf('movie')).fields.type === '401', 'movie 没映射到 401');
    need((await planOf('电影')).fields.type === '401', '中文电影没映射到 401');
    need((await planOf('doc')).fields.type === '402', 'doc 没映射到纪录片 402');
  });

  await check('目标站没有专用字段时补 hide 块', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'No Info Field 2024 1080p Blu-ray', targetSite: 'noinfo.example', status: 'approved',
        cat: 'movie', res: '1080p', size: '20 GB',
        bdinfo: 'Disc Title: TEST', mediainfo: 'General\nComplete name: TEST.mkv',
        descrBb: '正文'
      })
    });
    need(add.status === 200 && add.body.ok, '建条目失败');
    const p = await json(BASE + '/api/targets/noinfo.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, '计划失败：' + JSON.stringify(p.body && p.body.error));
    const descr = p.body.data.fields.descr || '';
    need(/\[hide=bdinfo\]/.test(descr) && /Disc Title: TEST/.test(descr), 'BDInfo 没补进简介：' + descr);
    need(/\[hide=mediainfo\]/.test(descr) && /Complete name: TEST/.test(descr), 'MediaInfo 没补进简介：' + descr);
  });

  await check('BDInfo 填专用字段并从简介去重', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'BDInfo Field 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved',
        cat: 'movie', res: '1080p', size: '20 GB',
        bdinfo: 'Disc Title: TEST\nDisc Size: 20 GB',
        descrBb: '正文段落\n[hide=bdinfo]Disc Title: TEST\nDisc Size: 20 GB[/hide]\n结尾'
      })
    });
    need(add.status === 200 && add.body.ok, '建 BDInfo 条目失败');
    const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, 'BDInfo 计划失败：' + JSON.stringify(p.body && p.body.error));
    const f = p.body.data.fields;
    need(f.bdinfo === 'Disc Title: TEST\nDisc Size: 20 GB', 'BDInfo 没填专用字段：' + JSON.stringify(f.bdinfo));
    need(f.descr.indexOf('[hide=bdinfo]') < 0 && f.descr.indexOf('正文段落') >= 0 && f.descr.indexOf('结尾') >= 0, '简介里的 BDInfo 没去重：' + f.descr);
  });

  await check('站点映射总表覆盖分类和制作组', async function () {
    const put = await json(BASE + '/api/maps/127.0.0.1', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cat: { '电影': '999' }, team: { 'CMCT': '77' } })
    });
    need(put.status === 200 && put.body.ok, '映射保存失败');
    const maps = await json(BASE + '/api/maps');
    need(maps.status === 200 && maps.body.data.sites['127.0.0.1'].cat['电影'] === '999', '总表没存上');
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Site Map 2024 1080p', cn: '映射总表', intro: 'x', cat: 'movie', team: 'CMCT', targetSite: '127.0.0.1', status: 'approved', res: '1080p', size: '20 GB' })
    });
    const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, '计划失败');
    need(p.body.data.fields.type === '999', '总表分类没覆盖：' + p.body.data.fields.type);
    need(p.body.data.fields.team_sel === '77', '总表制作组没覆盖：' + p.body.data.fields.team_sel);
    need(!(p.body.data.warnings || []).some(function (x) { return /制作组.*没映射/.test(x); }), '有映射还报没映射');
  });

  await check('制作组只认数字或映射，没映射留空并提示', async function () {
    await json(BASE + '/api/maps/127.0.0.1', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cat: {}, team: {} }) });
    async function planOf(team) {
      const add = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Team Map 2024 1080p', cn: '组映射', intro: 'x', team, targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB' })
      });
      need(add.status === 200 && add.body.ok, '建队列失败');
      const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
      });
      need(p.status === 200 && p.body.ok, '计划失败');
      return p.body.data;
    }
    const mapped = await planOf('CMCT');
    need(mapped.fields.team_sel === '8', '映射没生效：' + mapped.fields.team_sel);
    const numeric = await planOf('12');
    need(numeric.fields.team_sel === '12', '数字 id 应直通：' + numeric.fields.team_sel);
    const unknown = await planOf('SomeGroup');
    need(unknown.fields.team_sel === undefined, '没映射不该硬塞：' + unknown.fields.team_sel);
    need((unknown.warnings || []).some(function (x) { return /没映射/.test(x); }), '没提示没映射：' + JSON.stringify(unknown.warnings));
    need(Array.isArray(unknown.autoActions) && unknown.autoActions.length === 3, '自动动作没列出');
    need(/换成目标站通用 announce/.test(unknown.autoActions[0]), '默认应清洗 tracker：' + unknown.autoActions[0]);
    const offFlow = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '上传前清洗 tracker', on: false }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(offFlow.status === 200 && offFlow.body.ok, '关清洗失败');
    const offPlan = await planOf('CMCT');
    need(/不清洗 tracker/.test(offPlan.autoActions[0]), '关掉后动作没变：' + offPlan.autoActions[0]);
    const onFlow = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '上传前清洗 tracker', on: true }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(onFlow.status === 200 && onFlow.body.ok, '恢复清洗失败');
  });

  await check('目标站标签按来源标签勾选，挡掉禁转/官方', async function () {
    async function planOf(payload) {
      const add = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ site: 'source.example', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB' }, payload))
      });
      need(add.status === 200 && add.body.ok, '建队列失败');
      const p = await json(BASE + '/api/targets/127.0.0.1/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
      });
      need(p.status === 200 && p.body.ok, '计划失败：' + JSON.stringify(p.body && p.body.error));
      return p.body.data;
    }
    const a = await planOf({ title: 'Tag Map 2024 1080p Blu-ray', cn: '标签测试', intro: 'x', tags: ['国语', '中字', '禁转', '官方'] });
    need(a.fields.guoyu === 'yes', '国语没勾：' + JSON.stringify(a.fields));
    need(a.fields.zhongzi === 'yes', '中字没勾：' + JSON.stringify(a.fields));
    need(a.fields.jinzhuan === undefined, '不该勾禁转');
    need(a.fields.guanfang === undefined, '不该勾官方');
    need(JSON.stringify(a.tags) === JSON.stringify(['国语', '中字']), '标签列表没过滤：' + JSON.stringify(a.tags));
    const b = await planOf({ title: 'Foo 2024 国配 中字 1080p Blu-ray', cn: '标题推断', intro: 'x' });
    need(b.fields.guoyu === 'yes' && b.fields.zhongzi === 'yes', '标题标签没推断出来：' + JSON.stringify({ tags: b.tags, fields: b.fields }));
    const c = await planOf({ title: 'Bar 2024 1080p Blu-ray', cn: '无标签', intro: 'x', tags: ['粤语'] });
    need(c.fields.yueyu === 'yes' && c.fields.guoyu === undefined, '粤语映射不对：' + JSON.stringify(c.fields));
  });

  await check('UNIT3D / Gazelle 默认映射', async function () {
    async function mk(title, targetSite) {
      const r = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, targetSite: targetSite, status: 'approved', cat: 'movie', res: '1080p', size: '20 GB' })
      });
      need(r.status === 200 && r.body.ok, '建队列失败：' + targetSite);
      return r.body.data.id;
    }
    const uid = await mk('UNIT3D Target 2024 1080p', 'unit3d.example');
    const gid = await mk('Gazelle Target 2024 1080p', 'gazelle.example');
    const up = await json(BASE + '/api/targets/unit3d.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: uid })
    });
    need(up.status === 200 && up.body.ok, 'UNIT3D 计划失败');
    need(up.body.data.fileField === 'torrent', 'UNIT3D 文件字段不对：' + up.body.data.fileField);
    need(up.body.data.url.indexOf('/torrents/create') >= 0, 'UNIT3D 上传路径不对');
    need(up.body.data.fields.name === 'UNIT3D Target 2024 1080p', 'UNIT3D 标题映射不对');
    need(up.body.data.hasCookie === false && up.body.data.ready === false, '无 cookie 的站预检不该就绪：' + JSON.stringify({ hasCookie: up.body.data.hasCookie, ready: up.body.data.ready }));
    need((up.body.data.warnings || []).includes('目标站没有 cookie'), '无 cookie 的站没提示：' + JSON.stringify(up.body.data.warnings));
    const gp = await json(BASE + '/api/targets/gazelle.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: gid })
    });
    need(gp.status === 200 && gp.body.ok, 'Gazelle 计划失败');
    need(gp.body.data.fileField === 'file_input', 'Gazelle 文件字段不对：' + gp.body.data.fileField);
    need(gp.body.data.url.indexOf('/upload.php') >= 0, 'Gazelle 上传路径不对');
    need(gp.body.data.fields.title === 'Gazelle Target 2024 1080p', 'Gazelle 标题映射不对');
    need((gp.body.data.warnings || []).includes('目标站没有 cookie'), 'Gazelle 无 cookie 没提示');
  });

  await check('UNIT3D 多种字段名识别 BDInfo/MediaInfo', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'UNIT3D Fields 2024 1080p', targetSite: 'unit3d-fields.example', status: 'approved',
        cat: 'movie', res: '1080p', size: '20 GB', bdinfo: 'BDINFO-CONTENT', mediainfo: 'MEDIAINFO-CONTENT' })
    });
    need(add.status === 200 && add.body.ok, '建字段测试队列失败');
    const p = await json(BASE + '/api/targets/unit3d-fields.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: add.body.data.id })
    });
    need(p.status === 200 && p.body.ok, '字段测试计划失败：' + JSON.stringify(p.body && p.body.error));
    const f = p.body.data.fields;
    need(f.disc_info === 'BDINFO-CONTENT', 'disc_info 没识别成 BDInfo：' + JSON.stringify(f));
    need(f.media_info === 'MEDIAINFO-CONTENT', 'media_info 没识别成 MediaInfo：' + JSON.stringify(f));
    need(!/BDINFO-CONTENT/.test(String(f.description || '')), '有专用字段时简介里不该重复 BDInfo');
    await json(BASE + '/api/queue/' + encodeURIComponent(add.body.data.id), { method: 'DELETE' });
  });

  await check('NexusPHP 默认字段与分类数组', async function () {
    async function mk(title, anonymous) {
      const r = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, targetSite: 'nexus-default.example', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB', anonymous: anonymous })
      });
      need(r.status === 200 && r.body.ok, '建队列失败');
      return r.body.data.id;
    }
    const id1 = await mk('Nexus Default 2024 1080p', true);
    const p1 = await json(BASE + '/api/targets/nexus-default.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: id1 })
    });
    need(p1.status === 200 && p1.body.ok, '默认计划失败：' + JSON.stringify(p1.body && p1.body.error));
    const f1 = p1.body.data.fields;
    need(f1.name === 'Nexus Default 2024 1080p', '标题默认映射不对');
    need(f1.small_descr === undefined, '没副标题/中文名时不该硬拼：' + f1.small_descr);
    need(f1.type === '401', '分类数组没转成目标分类：' + f1.type);
    need(f1.uplver === 'yes', '匿名默认值不对：' + f1.uplver);
    const id2 = await mk('Nexus Default 2024 1080p', false);
    const p2 = await json(BASE + '/api/targets/nexus-default.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: id2 })
    });
    need(p2.status === 200 && p2.body.ok, '非匿名计划失败');
    need(p2.body.data.fields.uplver === undefined, '非匿名不该带 uplver');
  });

  await check('真发布门禁', async function () {
    await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    const r = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(r.status === 409 && r.body && r.body.error && r.body.error.code === 'REAL_PUBLISH_DISABLED', '门禁不对：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
    need(hits.length === 0, '门禁不该发请求');
    const cfg = await json(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ realPublish: true })
    });
    need(cfg.status === 200 && cfg.body.ok, '打开 realPublish 失败');
  });

  await check('截图保留拦真发布', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '截图至少几张', on: true }, { t: 'BDInfo', on: false }]] } })
    });
    need(put.status === 200 && put.body.ok, '写截图门槛失败');
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'No Shots 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
        sourceImages: ['https://example.org/keep.jpg'], descrBb: '正文 [img]https://example.org/other.jpg[/img]' })
    });
    need(add.status === 200 && add.body.ok, '建无图队列失败');
    const id = add.body.data.id;
    const r = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(r.status === 400 && r.body && r.body.error && r.body.error.code === 'SHOTS_REQUIRED', '截图没拦住：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
    need(hits.length === 0, '截图不足不该发请求，实际发了 ' + hits.length);
    const off = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '截图至少几张', on: false }, { t: 'BDInfo', on: false }]] } })
    });
    need(off.status === 200 && off.body.ok, '恢复截图门槛失败');
    await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
  });

  await check('BDInfo 门槛拦真发布', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: 'BDInfo', on: true }, { t: '截图至少几张', on: false }]] } })
    });
    need(put.status === 200 && put.body.ok, '写 BDInfo 门槛失败');
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'No BDInfo 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
        shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
    });
    need(add.status === 200 && add.body.ok, '建无 BDInfo 队列失败');
    const before = hits.length;
    const r = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: add.body.data.id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(r.status === 400 && r.body && r.body.error && r.body.error.code === 'BDINFO_REQUIRED', 'BDInfo 门槛没拦住：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
    need(hits.length === before, 'BDInfo 不足不该发请求');
    const off = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(off.status === 200 && off.body.ok, '恢复 BDInfo 不要求失败');
    await json(BASE + '/api/queue/' + encodeURIComponent(add.body.data.id), { method: 'DELETE' });
  });

  await check('禁转源在发布阶段被拦住', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Restricted 2024 1080p Blu-ray 禁转', targetSite: '127.0.0.1', status: 'approved', size: '20 GB' })
    });
    need(add.status === 200 && add.body.ok, '建禁转条目失败');
    const before = hits.length;
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: add.body.data.id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(up.status === 409 && up.body.error && up.body.error.code === 'RESTRICTED_SOURCE', '禁转没拦住：' + JSON.stringify(up.body));
    need(hits.length === before, '禁转条目仍发了上传请求');
  });

  await check('真提交与目标站回查', async function () {
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: false, verify: true })
    });
    need(up.status === 200 && up.body.ok, '提交失败：' + up.status + ' ' + JSON.stringify(up.body && up.body.error));
    const d = up.body.data;
    need(d.sent === true && d.detailsUrl.indexOf('details.php?id=42') >= 0, '没拿到详情地址：' + d.detailsUrl);
    need(d.detailsUrl.indexOf('999') < 0 && /uploaded=1/.test(d.detailsUrl), '详情地址没优先取 uploaded=1：' + d.detailsUrl);
    need(d.cleaned === true, '目标站上传前没清洗种子');
    need(d.verify && d.verify.found === true, '提交后回查没找到');
    need(hits.length === 1, '应发 1 次上传，实际 ' + hits.length);
    need(hits[0].fields.name === 'Target Upload 2024 1080p Blu-ray', '目标站收到的标题不对');
    need(hits[0].fields.small_desc === '目标站测试', '目标站收到的副标题不对：' + hits[0].fields.small_desc);
    need(hits[0].file && hits[0].file.field === 'file' && hits[0].file.bytes > 0, '种子文件没到目标站');
    need(hits[0].cookie === 'mock-cookie', 'cookie 没带上');
    const g = await json(BASE + '/api/queue/' + encodeURIComponent(qid));
    need(g.body.data.targetUpload && g.body.data.targetUpload.host === '127.0.0.1', '队列没记 targetUpload');
    need(g.body.data.targetVerify && g.body.data.targetVerify.found === true, '队列没记 targetVerify');
    const tt = g.body.data.targetResults && g.body.data.targetResults['127.0.0.1'] && g.body.data.targetResults['127.0.0.1'].targetTorrent;
    need(tt && tt.infohash === hash && tt.sameInfohash === true, '没抓目标站生成的种子：' + JSON.stringify(tt));
    need(tt.path && fs.existsSync(tt.path), '目标站种子文件没落盘：' + (tt.path || ''));
    need(tt.source === 'published', '目标种不是发布后的权威种子：' + JSON.stringify({ source: tt.source }));
    need(state.downloadHits === 1, '默认应抓一次目标站发布种子，实际 ' + state.downloadHits + ' 次');
    need(g.body.data.targetUpload && g.body.data.targetUpload.targetTorrent && g.body.data.targetUpload.targetTorrent.sameInfohash === true, 'targetUpload 没记目标站种子');
    need(g.body.data.stage === 'submitted', '状态机不是 submitted：' + g.body.data.stage);
    need(g.body.data.stageEvidence && g.body.data.stageEvidence.infohash, '没有提交证据 infohash');
    const again = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: false, verify: false })
    });
    need(again.status === 409 && again.body.error && again.body.error.code === 'ALREADY_SUBMITTED', '重复提交没被拦住');
    need(hits.length === 1, '重复提交又发了请求：' + hits.length);
  });

  await check('上传前通用 announce 清洗', async function () {
    const j = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: true })
    });
    need(j.status === 200 && j.body.ok, '自动清洗干跑失败：' + j.status);
    need(j.body.data.cleaned === true, '缓存 announce 没触发自动清洗：' + JSON.stringify(j.body.data && { cleaned: j.body.data.cleaned }));
    need(j.body.data.torrent && j.body.data.torrent.hash === hash, '自动清洗后 infohash 变了');
    const off = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '上传前清洗 tracker', on: false }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(off.status === 200 && off.body.ok, '关清洗失败');
    const raw = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: true })
    });
    need(raw.status === 200 && raw.body.ok, '关清洗干跑失败');
    need(raw.body.data.cleaned === false, '关掉开关后仍清洗了');
    const on = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '上传前清洗 tracker', on: true }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(on.status === 200 && on.body.ok, '恢复清洗失败');
  });

  await check('上传前查重：已有资源跳过且不发请求', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Target Upload 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB', shots: ['a', 'b', 'c'] })
    });
    need(add.status === 200 && add.body.ok, '建重复队列失败');
    const id = add.body.data.id;
    const before = hits.length;
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(up.status === 200 && up.body && up.body.error && up.body.error.code === 'TARGET_EXISTS', '已有资源没跳过：' + up.status + ' ' + JSON.stringify(up.body && up.body.error));
    need(hits.length === before, '已有资源跳过后仍发了上传');
    await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
  });


  return qid;
}

module.exports = { runUpload };

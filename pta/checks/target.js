/* 目标站提交夹具：本地 mock 上传页 + 临时 v2 后端。不碰真实站点。
   覆盖：私有包列表、表单映射干跑、真发布门禁、真提交、发布后回查。 */
const { spawn } = require('child_process');
const { makeTorrent, makeTorrent2, infoHash, startMock } = require('./target-mock');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8098);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-target-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const results = [];
const hits = [];
let cookie = '';
let mockPort = 0;
const state = { published: false, mockDeleted: false, deletedId: '', deleteHits: 0, deleteBody: null, deleteBodyReasons: [], downloadHits: 0 };
let child = null;
let mock = null;

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function fetchA(url, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookie) o.headers.cookie = cookie;
  return fetch(url, o);
}
async function json(url, opts) {
  const r = await fetchA(url, opts);
  const body = await r.json().catch(function () { return null; });
  return { status: r.status, body: body };
}
async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return r;
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('v2 服务没起来');
}



async function main() {
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

  const torrent = makeTorrent();
  const hash = infoHash(torrent);
  state.mockDeleted = false; state.deletedId = ''; state.deleteHits = 0; state.deleteBody = null; state.deleteBodyReasons = []; state.downloadHits = 0; state.published = false;
  mock = await startMock(hash, torrent, state, hits, ROOT);
  mockPort = mock.address().port;
  const pack = {
    version: 1,
    sites: {
      '127.0.0.1': {
        engine: 'nexusphp',
        base: 'http://127.0.0.1:' + mockPort,
        upload: {
          path: '/takeupload.php',
          formPath: '/upload-form',
          fileField: 'file',
          fields: { name: '{title}', small_desc: '{subtitle}', descr: '{description}', bdinfo: '{bdinfo}', anon: '{anonymous}' }
        },
        verify: { path: '/torrents.php?search={title}' },
        catMap: { '电影': '401', '剧集': '404', '纪录片': '402' },
        tagMap: { '国语': 'guoyu', '国配': 'guoyu', '粤语': 'yueyu', '中字': 'zhongzi', 'DIY原盘': 'diy' },
        tagValue: 'yes',
        valueMaps: { team: { 'CMCT': '8' } }
      },
      'noinfo.example': { engine: 'nexusphp', base: 'http://127.0.0.1:' + mockPort,
        upload: { path: '/takeupload.php', formPath: '/upload-form', fileField: 'file', fields: { name: '{title}', descr: '{description}' } },
        verify: { path: '/torrents.php?search={title}' }, catMap: { '电影': '401' } },
      'unit3d.example': { engine: 'unit3d', base: 'http://127.0.0.1:' + mockPort },
      'unit3d-fields.example': { engine: 'unit3d', base: 'http://127.0.0.1:' + mockPort,
        upload: { path: '/torrents/create', fields: { name: '{title}', description: '{description}', disc_info: '', media_info: '' } },
        verify: { path: '/torrents?search={title}' }, catMap: { 'movie': '1' } },
      'gazelle.example': { engine: 'gazelle', base: 'http://127.0.0.1:' + mockPort },
      'nexus-default.example': { engine: 'nexusphp', base: 'http://127.0.0.1:' + mockPort,
        catMap: [{ id: '401', label: 'Movies', purpose: 'movie' }, { id: '402', label: 'TV', purpose: 'tv' }] }
    }
  };
  fs.writeFileSync(path.join(DATA, 'site-pack.json'), JSON.stringify(pack, null, 2), { mode: 0o600 });

  child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS
      ,PTA_REQ_SEARCH_GAP_MS: '0',PTA_REQ_WRITE_GAP_MS: '0'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    throw e;
  }
  const lr = await login();
  need(lr.status === 200 && cookie.indexOf('pta_sid=') === 0, '登录没拿到会话');

  let qid = '';

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

  await check('队列条目与干跑表单映射', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Target Upload Test 2024 1080p Blu-ray', cn: '目标站测试', intro: '测试简介',
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
    need(d.fields.name === 'Target Upload Test 2024 1080p Blu-ray', '标题映射不对：' + d.fields.name);
    need(d.fields.small_desc === '目标站测试', '副标题映射不对：' + d.fields.small_desc);
    need(d.fields.descr === '测试简介', '简介映射不对');
    need(d.fields.anon === '0', '匿名映射不对');
    need(d.verifyUrl.indexOf('/torrents.php?search=') >= 0, '回查地址不对');
    need(d.hasCookie === true && d.ready === true, '有 cookie 的站预检应就绪：' + JSON.stringify({ hasCookie: d.hasCookie, ready: d.ready }));
    need(!(d.warnings || []).includes('没有 cookie'), '有 cookie 还报缺 cookie：' + JSON.stringify(d.warnings));
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

  await check('目标站副标题优先用源副标题', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Source Sub Test 2024 1080p Blu-ray', subtitle: '源站副标题 / 别名 [国配中字]', cn: '源站副标题', intro: 'x',
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
        body: JSON.stringify({ title: 'Cat Map Test 2024 1080p', cn: '分类映射', intro: 'x', cat, targetSite: '127.0.0.1', status: 'approved', res: '1080p', size: '20 GB' })
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
        title: 'No Info Field Test 2024 1080p Blu-ray', targetSite: 'noinfo.example', status: 'approved',
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
        title: 'BDInfo Field Test 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved',
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
      body: JSON.stringify({ title: 'Site Map Test 2024 1080p', cn: '映射总表', intro: 'x', cat: 'movie', team: 'CMCT', targetSite: '127.0.0.1', status: 'approved', res: '1080p', size: '20 GB' })
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
        body: JSON.stringify({ title: 'Team Map Test 2024 1080p', cn: '组映射', intro: 'x', team, targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB' })
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
    const a = await planOf({ title: 'Tag Map Test 2024 1080p Blu-ray', cn: '标签测试', intro: 'x', tags: ['国语', '中字', '禁转', '官方'] });
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
    const uid = await mk('UNIT3D Target Test 2024 1080p', 'unit3d.example');
    const gid = await mk('Gazelle Target Test 2024 1080p', 'gazelle.example');
    const up = await json(BASE + '/api/targets/unit3d.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: uid })
    });
    need(up.status === 200 && up.body.ok, 'UNIT3D 计划失败');
    need(up.body.data.fileField === 'torrent', 'UNIT3D 文件字段不对：' + up.body.data.fileField);
    need(up.body.data.url.indexOf('/torrents/create') >= 0, 'UNIT3D 上传路径不对');
    need(up.body.data.fields.name === 'UNIT3D Target Test 2024 1080p', 'UNIT3D 标题映射不对');
    need(up.body.data.hasCookie === false && up.body.data.ready === false, '无 cookie 的站预检不该就绪：' + JSON.stringify({ hasCookie: up.body.data.hasCookie, ready: up.body.data.ready }));
    need((up.body.data.warnings || []).includes('没有 cookie'), '无 cookie 的站没提示：' + JSON.stringify(up.body.data.warnings));
    const gp = await json(BASE + '/api/targets/gazelle.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: gid })
    });
    need(gp.status === 200 && gp.body.ok, 'Gazelle 计划失败');
    need(gp.body.data.fileField === 'file_input', 'Gazelle 文件字段不对：' + gp.body.data.fileField);
    need(gp.body.data.url.indexOf('/upload.php') >= 0, 'Gazelle 上传路径不对');
    need(gp.body.data.fields.title === 'Gazelle Target Test 2024 1080p', 'Gazelle 标题映射不对');
    need((gp.body.data.warnings || []).includes('没有 cookie'), 'Gazelle 无 cookie 没提示');
  });

  await check('UNIT3D 多种字段名识别 BDInfo/MediaInfo', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'UNIT3D Fields Test 2024 1080p', targetSite: 'unit3d-fields.example', status: 'approved',
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
    const id1 = await mk('Nexus Default Test 2024 1080p', true);
    const p1 = await json(BASE + '/api/targets/nexus-default.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: id1 })
    });
    need(p1.status === 200 && p1.body.ok, '默认计划失败：' + JSON.stringify(p1.body && p1.body.error));
    const f1 = p1.body.data.fields;
    need(f1.name === 'Nexus Default Test 2024 1080p', '标题默认映射不对');
    need(f1.small_descr === undefined, '没副标题/中文名时不该硬拼：' + f1.small_descr);
    need(f1.type === '401', '分类数组没转成目标分类：' + f1.type);
    need(f1.uplver === 'yes', '匿名默认值不对：' + f1.uplver);
    const id2 = await mk('Nexus Default Test 2024 1080p', false);
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
      body: JSON.stringify({ title: 'No Shots Test 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
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
      body: JSON.stringify({ title: 'No BDInfo Test 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
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
      body: JSON.stringify({ title: 'Restricted Test 2024 1080p Blu-ray 禁转', targetSite: '127.0.0.1', status: 'approved', size: '20 GB' })
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
    need(hits[0].fields.name === 'Target Upload Test 2024 1080p Blu-ray', '目标站收到的标题不对');
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
      body: JSON.stringify({ title: 'Target Upload Test 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB', shots: ['a', 'b', 'c'] })
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

  await check('删除测试种：dry-run、真删与回查', async function () {
    const dry = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42' })
    });
    need(dry.status === 200 && dry.body.ok, '删除 dry-run 失败：' + dry.status);
    need(dry.body.data.reasonType === '0' && dry.body.data.reasonField === 'reason_input', '删除表单没解析对：' + JSON.stringify(dry.body.data));
    need(dry.body.data.sent === false && state.deleteHits === 0, 'dry-run 不该发删除请求');
    const real = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', dryRun: false, reason: '测试', reasonType: '其他' })
    });
    need(real.status === 200 && real.body.ok && real.body.data.deleted === true, '真删没确认：' + real.status + ' ' + JSON.stringify(real.body));
    need(state.deleteHits === 1 && state.deleteBody, '删除请求没发出');
    need(state.deleteBody.id === '42' && state.deleteBody.reason_type === '0' && state.deleteBody.reason_input === '测试' && state.deleteBody.type === 'torrent', '删除表单字段不对：' + JSON.stringify(state.deleteBody));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '删除状态回查不对：' + JSON.stringify(chk.body));
    state.mockDeleted = false; state.deleteHits = 0; state.deleteBody = null;
  });

  await check('删除表单兼容 reasontype + reason[]', async function () {
    const dry = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', reason: '测试', reasonType: '其他' })
    });
    need(dry.status === 200 && dry.body.ok, '第二种删除 dry-run 失败：' + dry.status);
    need(dry.body.data.reasonType === '5' && dry.body.data.reasonField === 'reason[]', '第二种删除表单没解析对：' + JSON.stringify(dry.body.data));
    const real = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', dryRun: false, reason: '测试', reasonType: '其他' })
    });
    need(real.status === 200 && real.body.ok && real.body.data.deleted === true, '第二种真删没确认：' + real.status + ' ' + JSON.stringify(real.body));
    need(JSON.stringify(state.deleteBodyReasons) === JSON.stringify(['', '', '', '测试']), 'reason[] 索引不对：' + JSON.stringify(state.deleteBodyReasons));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '没有该ID的种子应判为已删：' + JSON.stringify(chk.body));
    state.mockDeleted = false; state.deletedId = ''; state.deleteHits = 0; state.deleteBody = null; state.deleteBodyReasons = [];
  });

  await check('回收站同 infohash 不重复发布', async function () {
    state.mockDeleted = true; state.deletedId = '42';
    try {
      const add = await json(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Target Upload Test 2024 1080p Blu-ray', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
          shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
      });
      need(add.status === 200 && add.body.ok, '建回收站测试队列失败');
      const id = add.body.data.id;
      const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), url: 'http://127.0.0.1:' + mockPort + '/details.php?id=42' })
      });
      need(v.status === 200 && v.body.ok && v.body.data.deleted === true && v.body.data.found === false, '回收站详情没标记成已删除：' + JSON.stringify(v.body));
      const before = hits.length;
      const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false, verify: true })
      });
      need(up.status === 200 && up.body && up.body.error && up.body.error.code === 'TARGET_EXISTS', '回收站同 hash 没跳过：' + up.status + ' ' + JSON.stringify(up.body));
      need(hits.length === before + 1, '回收站检查应只发 1 次上传，实际 ' + (hits.length - before) + ' 次');
      await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
    } finally {
      state.mockDeleted = false; state.deletedId = '';
    }
  });

  await check('回查不把搜索框回显当命中', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Echo Only 2024 1080p', targetSite: '127.0.0.1', status: 'pending', cat: 'movie' })
    });
    need(add.status === 200 && add.body.ok, '创建回查条目失败');
    const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: add.body.data.id, torrentBase64: torrent.toString('base64') })
    });
    need(v.status === 200 && v.body.ok, '回查失败：' + v.status);
    need(v.body.data.found === false, '搜索框回显被误判为命中');
    need(v.body.data.rows === 0, '搜索结果行数不是 0');
  });

  await check('关闭发布后校验时跳过回查', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: false }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(put.status === 200 && put.body.ok, '关发布后校验失败');
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Verify Off Test 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB',
        shots: ['shot-1.jpg', 'shot-2.jpg', 'shot-3.jpg'] })
    });
    need(add.status === 200 && add.body.ok, '建回查关闭队列失败');
    const id = add.body.data.id;
    const before = hits.length;
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(up.status === 200 && up.body.ok, '关闭回查后提交失败：' + JSON.stringify(up.body && up.body.error));
    need(up.body.data.sent === true && up.body.data.verify === null, '关闭回查后还在回查');
    need(hits.length === before + 1, '关闭回查后上传次数不对');
    const on = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: true }, { t: 'BDInfo', on: false }, { t: '截图至少几张', on: false }]] } })
    });
    need(on.status === 200 && on.body.ok, '恢复发布后校验失败');
    const del = await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
    need(del.status === 200 && del.body.ok, '清理回查关闭队列失败');
  });

  await check('回查接口', async function () {
    const v = await json(BASE + '/api/targets/127.0.0.1/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), url: 'http://127.0.0.1:' + mockPort + '/details.php?id=42' })
    });
    need(v.status === 200 && v.body.ok && v.body.data.found === true, '回查失败：' + JSON.stringify(v.body));
  });
}

function finish(err) {
  if (child) { try { child.kill(); } catch (e) {} }
  if (mock) { try { mock.close(); } catch (e) {} }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(err || pass !== results.length ? 1 : 0);
}

main().then(function () { finish(0); }).catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  finish(1);
});

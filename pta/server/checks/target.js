/* 目标站提交夹具：本地 mock 上传页 + 临时 v2 后端。不碰真实站点。
   覆盖：私有包列表、表单映射干跑、真发布门禁、真提交、发布后回查。 */
const { spawn } = require('child_process');
const { makeTorrent, makeTorrent2, infoHash, startMock } = require('./target-mock');
const { runDeleteVerify } = require('./target-checks-verify');
const { runCatalog } = require('./target-checks-catalog');
const { runUpload } = require('./target-checks-upload');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
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
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* 忽略：失败不影响主流程 */ }
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('v2 服务没起来');
}



async function main() {
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
        catMap: [{ id: '401', label: 'Movies', purpose: 'movie' }, { id: '402', label: 'TV', purpose: 'tv' }] },
      'labels.example': { engine: 'nexusphp', base: 'http://127.0.0.1:' + mockPort,
        upload: { path: '/takeupload.php', formPath: '/upload-form', fileField: 'file', fields: { name: '{title}', type: '{catId}', team_sel: '{team}' } },
        verify: { path: '/torrents.php?search={title}' },
        catMap: { '电影': '401' },
        valueMaps: { team: { 'CMCT': '8' } },
        form: { selects: { type: [{ value: '401', label: '电影' }], team_sel: [{ value: '8', label: 'CMCT' }] } } }
    }
  };
  fs.writeFileSync(path.join(DATA, 'site-pack.json'), JSON.stringify(pack, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(DATA, 'site-maps.json'), JSON.stringify({
    version: 1,
    sites: { 'labels.example': { form: { selects: { type: [{ value: '401', label: '电影' }], team_sel: [{ value: '8', label: 'CMCT' }] } } } }
  }, null, 2), { mode: 0o600 });
  /* 夹具迁移到新 JSON：服务器只读 sites.json / site-urls.json */
  require('../src/features/sites/store')(DATA).migrateLegacy();

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
  const dl = await json(BASE + '/api/downloaders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'watch-check', kind: 'watch', watchPath: path.join(DATA, 'watch') })
  });
  need(dl.status === 200 && dl.body.ok, 'watch 下载器创建失败：' + JSON.stringify(dl.body && dl.body.error));

  let qid = '';

  await runCatalog({ check: check, need: need, json: json, BASE: BASE, DATA: DATA, mockPort: mockPort });
  qid = await runUpload({ check: check, need: need, json: json, BASE: BASE, DATA: DATA, torrent: torrent, hash: hash, hits: hits, state: state, mockPort: mockPort, makeTorrent2: makeTorrent2 });
  await runDeleteVerify({ check: check, need: need, json: json, BASE: BASE, DATA: DATA, torrent: torrent, hits: hits, state: state, mockPort: mockPort, qid: qid });
}

function finish(err) {
  if (child) { try { child.kill(); } catch (e) { /* 忽略：失败不影响主流程 */ } }
  if (mock) { try { mock.close(); } catch (e) { /* 忽略：失败不影响主流程 */ } }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略：失败不影响主流程 */ }
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

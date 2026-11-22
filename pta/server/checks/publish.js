/* 发布链路检查：本地 mock qB + mock 种子源，验证 torrents/add 与发布状态。
   用法：node pta/checks/publish.js  退出码 0/1/2 */
const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const { makeQb } = require(path.join(ROOT, 'server', 'src', 'features', 'downloaders', 'qb.js'));
const PORT = Number(process.env.PTA_CHECK_PORT || 8095);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-pub-'));
const qbMod = makeQb(DATA);
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const INFO = Buffer.from('d4:name4:test6:lengthi1ee');
const HASH = crypto.createHash('sha1').update(INFO).digest('hex');
const TORRENT = Buffer.concat([Buffer.from('d8:announce15:http://mock/ann4:info'), INFO, Buffer.from('e')]);

const results = [];
let cookie = '';
let addHits = 0, added = false, lastAddCookie = '', lastAddType = '', lastAddLen = 0;
let trackerAdds = 0, lastTrackerBody = '';
let resumeHits = 0, pauseHits = 0, deleteHits = 0, lastDeleteBody = '';
let lastAddBody = '';
let sourceHits = 0, lastSourceCookie = '';

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function fetchA(url, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookie) o.headers.cookie = cookie;
  return fetch(url, o);
}
function listen(handler) {
  return new Promise(function (resolve) {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', function () { resolve({ server: s, base: 'http://127.0.0.1:' + s.address().port }); });
  });
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* 忽略：失败不影响主流程 */ }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('临时后端没起来');
}

async function main() {
  const qb = await listen(function (req, res) {
    const url = req.url.split('?')[0];
    if (url === '/api/v2/auth/login') {
      res.setHeader('set-cookie', 'SID=test-sid; Path=/');
      res.writeHead(200); res.end('Ok.');
      return;
    }
    if (url === '/api/v2/torrents/addTrackers') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', function () {
        trackerAdds++;
        lastTrackerBody = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200); res.end('Ok.');
      });
      return;
    }
    if (url === '/api/v2/torrents/start') { res.writeHead(404); res.end('Not Found'); return; }
    if (url === '/api/v2/torrents/resume') { resumeHits++; res.writeHead(200); res.end('Ok.'); return; }
    if (url === '/api/v2/torrents/stop') { res.writeHead(404); res.end('Not Found'); return; }
    if (url === '/api/v2/torrents/pause') { pauseHits++; res.writeHead(200); res.end('Ok.'); return; }
    if (url === '/api/v2/torrents/delete') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', function () {
        deleteHits++;
        lastDeleteBody = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200); res.end('Ok.');
      });
      return;
    }
    if (url === '/api/v2/torrents/trackers') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ url: 'https://target.example/announce.php?passkey=x', status: 2, msg: 'Working', tier: 0, num_peers: 2, num_seeds: 1, num_leeches: 1 }]));
      return;
    }
    if (url === '/api/v2/torrents/add') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', function () {
        addHits++;
        added = true;
        lastAddCookie = req.headers.cookie || '';
        lastAddType = req.headers['content-type'] || '';
        const body = Buffer.concat(chunks);
        lastAddLen = body.length;
        lastAddBody = body.toString('utf8');
        res.writeHead(200); res.end('Ok.');
      });
      return;
    }
    if (url === '/api/v2/app/version') { res.writeHead(200); res.end('v5.0.0'); return; }
    if (url === '/api/v2/torrents/info') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(added ? [{ hash: HASH, name: 'test', state: 'downloading', progress: 0, save_path: '/downloads', content_path: '/downloads/test', category: 'test' }] : []));
      return;
    }
    res.writeHead(404); res.end('');
  });
  const src = await listen(function (req, res) {
    if (req.url.split('?')[0] === '/t.torrent') {
      sourceHits++;
      lastSourceCookie = req.headers.cookie || '';
      res.writeHead(200, { 'content-type': 'application/x-bittorrent' });
      res.end(TORRENT);
      return;
    }
    res.writeHead(404); res.end('');
  });

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'src', 'main.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS, PTA_ALLOW_REAL: '1'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill(); qb.server.close(); src.server.close(); process.exit(2);
  }

  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  need(login.ok, '登录失败 ' + login.status);

  const dl = await (await fetchA(BASE + '/api/downloaders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'mock-qb', url: qb.base, user: 'u', pass: 'p' })
  })).json();
  need(dl.ok && dl.data.id, '下载器创建失败：' + JSON.stringify(dl));

  await check('qB 追加目标 tracker 与状态查询', async function () {
    const dlObj = { url: qb.base, user: 'u', pass: 'p' };
    const add = await qbMod.addTrackers(dlObj, HASH, ['https://target.example/announce.php?passkey=x']);
    need(add.ok && add.count === 1, '追加 tracker 失败：' + JSON.stringify(add));
    need(trackerAdds === 1 && /hash=/.test(lastTrackerBody) && /target\.example/.test(lastTrackerBody), '追加 tracker 请求不对：' + lastTrackerBody.slice(0, 120));
    const st = await qbMod.trackerStatus(dlObj, HASH);
    need(st.ok && st.trackers.length === 1, 'tracker 状态失败：' + JSON.stringify(st));
    need(st.trackers[0].working === true && st.trackers[0].numPeers === 2, 'tracker 工作状态不对：' + JSON.stringify(st.trackers[0]));
  });

  const cred = await (await fetchA(BASE + '/api/credentials/127.0.0.1', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cookie: 'sid=source-cookie' })
  })).json();
  need(cred.ok, '来源 cookie 保存失败');

  const item = await (await fetchA(BASE + '/api/queue', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Fixture Publish 2020 2160p', site: '127.0.0.1', targetSite: 'target.example',
      downloadUrl: src.base + '/t.torrent', status: 'approved', size: '20 GB'
    })
  })).json();
  need(item.ok && item.data.id, '队列创建失败：' + JSON.stringify(item));

  await check('演练只校验，不发请求', async () => {
    const j = await (await fetchA(BASE + '/api/publish/' + item.data.id, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true })
    })).json();
    need(j.ok && j.data.dryRun === true, '演练失败：' + JSON.stringify(j));
    need(j.data.qb && j.data.qb.wouldAdd === true, '演练没有说明会加 qB');
    need(addHits === 0 && sourceHits === 0, '演练居然发了请求：qb=' + addHits + ' src=' + sourceHits);
  });

  await check('真发布把种子加进 qB', async () => {
    const j = await (await fetchA(BASE + '/api/publish/' + item.data.id, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: false })
    })).json();
    need(j.ok, '真发布失败：' + JSON.stringify(j));
    need(j.data.qb && j.data.qb.added === true, '响应没有 qb.added');
    need(sourceHits === 1, '种子源请求次数不对：' + sourceHits);
    need(lastSourceCookie.indexOf('sid=source-cookie') >= 0, '种子源没带 cookie：' + lastSourceCookie);
    need(addHits === 1, 'qB add 次数不对：' + addHits);
    need(/multipart\/form-data/i.test(lastAddType), 'qB 收到的不是 multipart：' + lastAddType);
    need(lastAddLen > 0, 'qB 收到的 body 为空');
    need(lastAddCookie.indexOf('SID=test-sid') >= 0, 'qB add 没带登录 cookie：' + lastAddCookie);
    need(j.data.qb && j.data.qb.verified === true, '响应没有 qb.verified');
    need(j.data.qb.hash === HASH, 'qb.hash 不对：' + j.data.qb.hash);
  });

  await check('发布后状态是 published 且带 qB 信息', async () => {
    const j = await (await fetchA(BASE + '/api/queue/' + item.data.id)).json();
    need(j.ok, '读队列失败');
    need(j.data.status === 'published', '状态不是 published：' + j.data.status);
    need(j.data.qb && j.data.qb.id, '没有记录 qB 下载器');
    need(/已加入 qB/.test(j.data.pubMsg || ''), 'pubMsg 不对：' + j.data.pubMsg);
    need(j.data.stage === 'injected', '状态机不是 injected：' + j.data.stage);
    need(j.data.stageEvidence && j.data.stageEvidence.client === 'qb', '没有注入证据');
  });

  await check('重复发布不重复注入', async () => {
    const r = await fetchA(BASE + '/api/publish/' + item.data.id, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: false })
    });
    const j = await r.json();
    need(r.status === 200 && j.ok && j.data.skipped === true, '重复发布没被跳过：' + r.status);
    need(addHits === 1, '重复发布又加了一次 qB：' + addHits);
  });

  await check('发布后校验到 qB 种子', async () => {
    const j = await (await fetchA(BASE + '/api/queue/' + item.data.id)).json();
    need(j.data.qb && j.data.qb.verified === true, 'qb.verified 不是 true');
    need(j.data.qb.hash === HASH, 'qb.hash 不对：' + j.data.qb.hash);
    need(j.data.qb.state === 'downloading', 'qb.state 不对：' + j.data.qb.state);
  });

  await check('qB 用 skip_checking 加权威种子', async function () {
    const dlObj = { url: qb.base, user: 'u', pass: 'p' };
    const found = await qbMod.findTorrent(dlObj, HASH);
    need(found.found && found.savePath === '/downloads', 'findTorrent 没回 savePath：' + JSON.stringify(found));
    const add = await qbMod.addTorrent(dlObj, TORRENT, { savePath: found.savePath, skipChecking: true });
    need(add.ok === true, '加权威种子失败：' + JSON.stringify(add));
    need(/skip_checking/.test(lastAddBody) && /true/.test(lastAddBody), '没有 skip_checking=true');
    need(/\/downloads/.test(lastAddBody), '没有使用源种 savePath');
    need(/name="autoTMM"[\s\S]{0,120}false/.test(lastAddBody), 'autoTMM 默认应为 false');
  });

  await check('转载流程：源种没下完会拦住发布', async function () {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    const jp = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
    const ctx = {
      db, DATA_DIR: DATA, allowReal: function () { return true; },
      one: (s2, ...a) => db.prepare(s2).get(...a),
      all: (s2, ...a) => db.prepare(s2).all(...a),
      jparse: jp
    };
    const pub = require(path.join(ROOT, 'server', 'src', 'features', 'publish', 'service.js')).makePublisher(ctx);
    const r = await pub.ensureSource(item.data.id, {});
    need(r.ok, '检查源种失败：' + JSON.stringify(r));
    need(r.complete === false, '进度 0 不该算源种完整：' + JSON.stringify(r));
    db.close();
  });

  await check('qB 启动/暂停/删除兼容不同版本', async function () {
    const dlObj = { url: qb.base, user: 'u', pass: 'p' };
    const r1 = await qbMod.resumeTorrent(dlObj, HASH);
    need(r1.ok === true, 'resume 失败：' + JSON.stringify(r1));
    need(resumeHits === 1, 'resume 没回退到 /resume：' + resumeHits);
    const r2 = await qbMod.stopTorrent(dlObj, HASH);
    need(r2.ok === true, 'stop 失败：' + JSON.stringify(r2));
    need(pauseHits === 1, 'stop 没回退到 /pause：' + pauseHits);
    const r3 = await qbMod.removeTorrent(dlObj, HASH, { deleteFiles: true });
    need(r3.ok === true, 'remove 失败：' + JSON.stringify(r3));
    need(deleteHits === 1, 'delete 次数不对：' + deleteHits);
    need(/deleteFiles=true/.test(lastDeleteBody), 'delete 没带 deleteFiles=true');
  });

  child.kill();
  qb.server.close();
  src.server.close();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

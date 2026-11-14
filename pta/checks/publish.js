/* 发布链路检查：本地 mock qB + mock 种子源，验证 torrents/add 与发布状态。
   用法：node pta/checks/publish.js  退出码 0/1/2 */
const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8095);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-pub-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const INFO = Buffer.from('d4:name4:test6:lengthi1ee');
const HASH = crypto.createHash('sha1').update(INFO).digest('hex');
const TORRENT = Buffer.concat([Buffer.from('d8:announce15:http://mock/ann4:info'), INFO, Buffer.from('e')]);

const results = [];
let cookie = '';
let addHits = 0, lastAddCookie = '', lastAddType = '', lastAddLen = 0;
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
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
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
    if (url === '/api/v2/torrents/add') {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', function () {
        addHits++;
        lastAddCookie = req.headers.cookie || '';
        lastAddType = req.headers['content-type'] || '';
        lastAddLen = Buffer.concat(chunks).length;
        res.writeHead(200); res.end('Ok.');
      });
      return;
    }
    if (url === '/api/v2/app/version') { res.writeHead(200); res.end('v5.0.0'); return; }
    if (url === '/api/v2/torrents/info') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ hash: HASH, name: 'test', state: 'downloading', progress: 0 }]));
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

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
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

  const cred = await (await fetchA(BASE + '/api/credentials/demo-a.example', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cookie: 'sid=source-cookie' })
  })).json();
  need(cred.ok, '来源 cookie 保存失败');

  const item = await (await fetchA(BASE + '/api/queue', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Fixture Publish 2020 2160p', site: 'demo-a.example', targetSite: 'target.example',
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

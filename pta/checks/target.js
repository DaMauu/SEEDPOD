/* 目标站提交夹具：本地 mock 上传页 + 临时 v2 后端。不碰真实站点。
   覆盖：私有包列表、表单映射干跑、真发布门禁、真提交、发布后回查。 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
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

function makeTorrent() {
  const announce = 'http://127.0.0.1:1/announce';
  const name = 'target-test';
  const info = Buffer.concat([
    Buffer.from('d6:lengthi1048576e4:name' + Buffer.byteLength(name) + ':'),
    Buffer.from(name),
    Buffer.from('6:pieces20:'),
    Buffer.from('a'.repeat(20)),
    Buffer.from('e')
  ]);
  return Buffer.concat([
    Buffer.from('d8:announce' + Buffer.byteLength(announce) + ':'),
    Buffer.from(announce),
    Buffer.from('4:info'),
    info,
    Buffer.from('e')
  ]);
}
function infoHash(buf) {
  const i = buf.indexOf(Buffer.from('4:info'));
  return crypto.createHash('sha1').update(buf.slice(i + 6, buf.length - 1)).digest('hex');
}

function startMock(hash) {
  const server = http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && u.pathname === '/takeupload.php') {
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const body = Buffer.concat(chunks);
        const ct = String(req.headers['content-type'] || '');
        const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
        const boundary = '--' + (bm ? (bm[1] || bm[2]) : '');
        const parts = body.toString('binary').split(boundary);
        const fields = {};
        let file = null;
        parts.forEach(function (part) {
          const nm = /name="([^"]+)"/.exec(part);
          if (!nm) return;
          const fn = /filename="([^"]*)"/.exec(part);
          const k = part.indexOf('\r\n\r\n');
          if (k < 0) return;
          let val = part.slice(k + 4);
          const e = val.lastIndexOf('\r\n');
          if (e >= 0) val = val.slice(0, e);
          const valBuf = Buffer.from(val, 'binary');
          if (fn) file = { field: nm[1], filename: fn[1], bytes: valBuf.length };
          else fields[nm[1]] = valBuf.toString('utf8');
        });
        hits.push({ fields: fields, file: file, cookie: req.headers.cookie || '' });
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body>上传成功 <a href="details.php?id=42">详情</a></body></html>');
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/upload-form') {
      const html = fs.readFileSync(path.join(ROOT, 'fixtures', 'upload-form.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && (u.pathname === '/torrents.php' || u.pathname === '/details.php')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><a href="details.php?id=42">Target Upload Test 2024 1080p Blu-ray</a><div>' + hash + '</div></body></html>');
      return;
    }
    res.writeHead(404); res.end('no');
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

async function main() {
  const torrent = makeTorrent();
  const hash = infoHash(torrent);
  mock = await startMock(hash);
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
          fields: { name: '{title}', small_desc: '{subtitle}', descr: '{description}', anon: '{anonymous}' }
        },
        verify: { path: '/torrents.php?search={title}' },
        catMap: { movie: '401' }
      },
      'unit3d.example': { engine: 'unit3d', base: 'http://127.0.0.1:' + mockPort },
      'gazelle.example': { engine: 'gazelle', base: 'http://127.0.0.1:' + mockPort }
    }
  };
  fs.writeFileSync(path.join(DATA, 'site-pack.json'), JSON.stringify(pack, null, 2), { mode: 0o600 });

  child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS
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
    need(d.fields.small_desc === '目标站测试', '副标题映射不对');
    need(d.fields.descr === '测试简介', '简介映射不对');
    need(d.fields.anon === '0', '匿名映射不对');
    need(d.verifyUrl.indexOf('/torrents.php?search=') >= 0, '回查地址不对');
    const dry = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: true })
    });
    need(dry.status === 200 && dry.body.ok && dry.body.data.dryRun === true && dry.body.data.sent === false, '干跑不对');
    need(dry.body.data.torrent && dry.body.data.torrent.hash === hash, '种子哈希不对');
    need(hits.length === 0, '干跑不该发请求，实际发了 ' + hits.length + ' 次');
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
    const gp = await json(BASE + '/api/targets/gazelle.example/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queueId: gid })
    });
    need(gp.status === 200 && gp.body.ok, 'Gazelle 计划失败');
    need(gp.body.data.fileField === 'file_input', 'Gazelle 文件字段不对：' + gp.body.data.fileField);
    need(gp.body.data.url.indexOf('/upload.php') >= 0, 'Gazelle 上传路径不对');
    need(gp.body.data.fields.title === 'Gazelle Target Test 2024 1080p', 'Gazelle 标题映射不对');
  });

  await check('真发布门禁', async function () {
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

  await check('截图不足拦真发布', async function () {
    const add = await json(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'No Shots Test 2024 1080p', targetSite: '127.0.0.1', status: 'approved', cat: 'movie', res: '1080p', size: '20 GB' })
    });
    need(add.status === 200 && add.body.ok, '建无图队列失败');
    const id = add.body.data.id;
    const r = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: id, torrentBase64: torrent.toString('base64'), dryRun: false })
    });
    need(r.status === 400 && r.body && r.body.error && r.body.error.code === 'SHOTS_REQUIRED', '截图门槛没拦住：' + r.status + ' ' + JSON.stringify(r.body && r.body.error));
    need(hits.length === 0, '截图不足不该发请求，实际发了 ' + hits.length);
    const del = await json(BASE + '/api/queue/' + encodeURIComponent(id), { method: 'DELETE' });
    need(del.status === 200 && del.body.ok, '清理无图队列失败');
  });

  await check('真提交与目标站回查', async function () {
    const up = await json(BASE + '/api/targets/127.0.0.1/upload', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: qid, torrentBase64: torrent.toString('base64'), dryRun: false, verify: true })
    });
    need(up.status === 200 && up.body.ok, '提交失败：' + up.status + ' ' + JSON.stringify(up.body && up.body.error));
    const d = up.body.data;
    need(d.sent === true && d.detailsUrl.indexOf('details.php?id=42') >= 0, '没拿到详情地址：' + d.detailsUrl);
    need(d.verify && d.verify.found === true, '提交后回查没找到');
    need(hits.length === 1, '应发 1 次上传，实际 ' + hits.length);
    need(hits[0].fields.name === 'Target Upload Test 2024 1080p Blu-ray', '目标站收到的标题不对');
    need(hits[0].fields.small_desc === '目标站测试', '目标站收到的副标题不对');
    need(hits[0].file && hits[0].file.field === 'file' && hits[0].file.bytes > 0, '种子文件没到目标站');
    need(hits[0].cookie === 'mock-cookie', 'cookie 没带上');
    const g = await json(BASE + '/api/queue/' + encodeURIComponent(qid));
    need(g.body.data.targetUpload && g.body.data.targetUpload.host === '127.0.0.1', '队列没记 targetUpload');
    need(g.body.data.targetVerify && g.body.data.targetVerify.found === true, '队列没记 targetVerify');
  });

  await check('关闭发布后校验时跳过回查', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: false }]] } })
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
      body: JSON.stringify({ sets: { pub: [[{ t: '发布后校验', on: true }]] } })
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

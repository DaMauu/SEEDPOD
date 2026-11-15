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
let mockDeleted = false;
let deletedId = '';
let deleteHits = 0;
let deleteBody = null;
let deleteBodyReasons = [];
let mockDeleted2 = false;
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
function makeTorrent2() {
  const announce = 'http://127.0.0.1:1/announce';
  const name = 'target-test-2';
  const info = Buffer.concat([
    Buffer.from('d6:lengthi1048576e4:name' + Buffer.byteLength(name) + ':'),
    Buffer.from(name),
    Buffer.from('6:pieces20:'),
    Buffer.from('b'.repeat(20)),
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

function startMock(hash, torrentBuf) {
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
    if (req.method === 'GET' && u.pathname === '/edit.php') {
      const id = u.searchParams.get('id') || '42';
      res.writeHead(200, { 'content-type': 'text/html' });
      if (id === '43') {
        res.end('<html><body><form action="delete.php" method="post">'
          + '<input type="hidden" name="id" value="43">'
          + '<input type="radio" name="reasontype" value="1">断种 '
          + '<input type="radio" name="reasontype" value="2">重复 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="3">劣质 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="4">违规 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="5" checked>其他 <input type="text" name="reason[]">'
          + '<input type="submit" value="删除"></form></body></html>');
      } else {
        res.end('<html><body><form action="delete.php" method="post">'
          + '<input type="hidden" name="id" value="42"><input type="hidden" name="force" value="0"><input type="hidden" name="type" value="torrent">'
          + '<input type="radio" name="reason_type" value="1">断种 '
          + '<input type="radio" name="reason_type" value="0">其他 具体原因 '
          + '<textarea name="reason_input"></textarea>'
          + '<input type="submit" id="delete-torrent" value="删除"></form></body></html>');
      }
      return;
    }
    if (req.method === 'POST' && u.pathname === '/delete.php') {
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const p = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        deleteBody = Object.fromEntries(p);
        deleteBodyReasons = p.getAll('reason[]');
        deleteHits++;
        deletedId = String(deleteBody.id || '42');
        mockDeleted = true;
        res.writeHead(302, { location: '/details.php?id=' + deletedId });
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/upload-form') {
      const html = fs.readFileSync(path.join(ROOT, 'fixtures', 'upload-form.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/download.php') {
      res.writeHead(200, { 'content-type': 'application/x-bittorrent' });
      res.end(torrentBuf);
      return;
    }
    if (req.method === 'GET' && (u.pathname === '/torrents.php' || u.pathname === '/details.php')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      if (mockDeleted && deletedId === '43') {
        res.end('<html><body>错误 没有该ID的种子</body></html>');
        return;
      }
      if (mockDeleted) {
        res.end('<html><body>该种子曾被 MOCK 删除 原因：Other: 测试 [回收站]</body></html>');
        return;
      }
      if (/echo[ +]only/i.test(decodeURIComponent(u.search || ''))) {
        res.end('<html><body><input name="search" value="Echo Only 2024 1080p"><div>没有找到结果</div></body></html>');
        return;
      }
      res.end('<html><body><a href="details.php?id=42">Target Upload Test 2024 1080p Blu-ray</a><div>' + hash + '</div><a href="download.php?id=42">下载</a></body></html>');
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
  mockDeleted = false; deletedId = ''; deleteHits = 0; deleteBody = null; deleteBodyReasons = [];
  mock = await startMock(hash, torrent);
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
    need(d.fields.small_desc === '目标站测试', '副标题映射不对');
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
    need(f1.small_descr === '1080p · 20 GB', '副标题默认映射不对：' + f1.small_descr);
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

  await check('BDInfo 门槛拦真发布', async function () {
    const put = await json(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: 'BDInfo', v: '必须存在且校验通过' }]] } })
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
      body: JSON.stringify({ sets: { pub: [[{ t: 'BDInfo', v: '不要求' }]] } })
    });
    need(off.status === 200 && off.body.ok, '恢复 BDInfo 不要求失败');
    await json(BASE + '/api/queue/' + encodeURIComponent(add.body.data.id), { method: 'DELETE' });
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
    const tt = g.body.data.targetResults && g.body.data.targetResults['127.0.0.1'] && g.body.data.targetResults['127.0.0.1'].targetTorrent;
    need(tt && tt.infohash === hash && tt.sameInfohash === true, '没抓目标站生成的种子：' + JSON.stringify(tt));
    need(tt.path && fs.existsSync(tt.path), '目标站种子文件没落盘：' + (tt.path || ''));
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

  await check('删除测试种：dry-run、真删与回查', async function () {
    const dry = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42' })
    });
    need(dry.status === 200 && dry.body.ok, '删除 dry-run 失败：' + dry.status);
    need(dry.body.data.reasonType === '0' && dry.body.data.reasonField === 'reason_input', '删除表单没解析对：' + JSON.stringify(dry.body.data));
    need(dry.body.data.sent === false && deleteHits === 0, 'dry-run 不该发删除请求');
    const real = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', dryRun: false, reason: '测试', reasonType: '其他' })
    });
    need(real.status === 200 && real.body.ok && real.body.data.deleted === true, '真删没确认：' + real.status + ' ' + JSON.stringify(real.body));
    need(deleteHits === 1 && deleteBody, '删除请求没发出');
    need(deleteBody.id === '42' && deleteBody.reason_type === '0' && deleteBody.reason_input === '测试' && deleteBody.type === 'torrent', '删除表单字段不对：' + JSON.stringify(deleteBody));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '42', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '删除状态回查不对：' + JSON.stringify(chk.body));
    mockDeleted = false; deleteHits = 0; deleteBody = null;
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
    need(JSON.stringify(deleteBodyReasons) === JSON.stringify(['', '', '', '测试']), 'reason[] 索引不对：' + JSON.stringify(deleteBodyReasons));
    const chk = await json(BASE + '/api/targets/127.0.0.1/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '43', check: true })
    });
    need(chk.status === 200 && chk.body.ok && chk.body.data.deleted === true, '没有该ID的种子应判为已删：' + JSON.stringify(chk.body));
    mockDeleted = false; deletedId = ''; deleteHits = 0; deleteBody = null; deleteBodyReasons = [];
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

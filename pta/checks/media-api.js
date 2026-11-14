/* 媒体 API 夹具：合成视频 + 临时 v2 后端。验证路径根限制、探测、截图、种子。不联网。 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8099);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-media-api-'));
const MEDIA = path.join(DATA, 'media');
const FILE = path.join(MEDIA, 'test.mp4');
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';
const results = [];
let cookie = '';

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
  return { status: r.status, body: await r.json().catch(function () { return null; }) };
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('v2 服务没起来');
}
async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return r;
}

async function main() {
  fs.mkdirSync(MEDIA, { recursive: true });
  try {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
      '-t', '2', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-b:a', '64k', FILE
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
  } catch (e) {
    console.error('生成测试视频失败：' + String(e && e.stderr || e && e.message || e).slice(0, 300));
    process.exit(2);
  }

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_MEDIA_ROOT: MEDIA, PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { out += d; });
  try { await waitUp(); } catch (e) { console.error(e.message + '\n' + out); child.kill(); process.exit(2); }
  const lr = await login();
  if (lr.status !== 200 || cookie.indexOf('pta_sid=') !== 0) {
    console.error('登录失败：' + lr.status);
    child.kill();
    process.exit(2);
  }

  await check('媒体根与配置', async function () {
    const j = await json(BASE + '/api/media/config');
    need(j.status === 200 && j.body.ok, '配置读取失败');
    need(path.resolve(j.body.data.root) === path.resolve(MEDIA), '媒体根不对：' + j.body.data.root);
    need(j.body.data.exists === true, '媒体根不存在');
  });

  await check('探测合成视频', async function () {
    const j = await json(BASE + '/api/media/probe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: 'test.mp4' })
    });
    need(j.status === 200 && j.body.ok, '探测失败：' + JSON.stringify(j.body && j.body.error));
    const d = j.body.data;
    need(d.video && d.video.width === 320 && d.video.height === 240, '宽高不对');
    need(d.duration > 1.5, '时长不对：' + d.duration);
    need(d.audios.length === 1 && d.audios[0].codec === 'aac', '音轨不对');
  });

  await check('路径越界被拦', async function () {
    const j = await json(BASE + '/api/media/probe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '../test.mp4' })
    });
    need(j.status === 400 && j.body && j.body.error && j.body.error.code === 'BAD_PATH', '越界没拦：' + j.status);
  });

  await check('截图返回 data URL', async function () {
    const j = await json(BASE + '/api/media/shots', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'test.mp4', count: 2, width: 320 })
    });
    need(j.status === 200 && j.body.ok, '截图失败：' + JSON.stringify(j.body && j.body.error));
    need(j.body.data.items.length === 2, '截图数量不对：' + j.body.data.items.length);
    j.body.data.items.forEach(function (it) {
      need(it.dataUrl.indexOf('data:image/jpeg;base64,') === 0, '不是 data URL');
      need(it.bytes > 0, '截图是空的');
    });
  });

  await check('生成种子并可解析', async function () {
    const j = await json(BASE + '/api/media/torrent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'test.mp4', announce: 'http://tracker.example/announce', pieceLength: 16384 })
    });
    need(j.status === 200 && j.body.ok, '种子失败：' + JSON.stringify(j.body && j.body.error));
    const d = j.body.data;
    need(/^[0-9a-f]{40}$/.test(d.infohash), 'infohash 不对：' + d.infohash);
    need(d.base64 && d.base64.length > 20, '种子 base64 为空');
    const { makeQb } = require(path.join(ROOT, 'server', 'qb.js'));
    const meta = makeQb(DATA).parseTorrent(Buffer.from(d.base64, 'base64'));
    need(meta.hash === d.infohash, 'qb 解析的 hash 不一致');
    need(meta.name === 'test.mp4', 'qb 解析的 name 不对：' + meta.name);
  });

  await check('坏 announce 被拒', async function () {
    const j = await json(BASE + '/api/media/torrent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'test.mp4', announce: 'ftp://nope' })
    });
    need(j.status === 400 && j.body && j.body.error && j.body.error.code === 'TORRENT_FAILED', '坏 announce 没拒：' + j.status);
  });

  child.kill();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e2) {}
  process.exit(1);
});

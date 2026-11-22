/* qB 会话夹具：4.x SID、5.x QBT_SID、401 后重登录、分类读取。纯本地 mock。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeQb } = require('../src/features/downloaders/qb');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-qbsess-'));
const qb = makeQb(DATA);
const results = [];
let sid = 'SID=good';
let v5 = false;
let expireOnce = false;
let logins = 0;
const server = http.createServer(function (req, res) {
  const cookie = String(req.headers.cookie || '');
  if (req.method === 'POST' && req.url === '/api/v2/auth/login') {
    logins++;
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', function () {
      if (!/username=u/.test(body) || !/password=p/.test(body)) { res.writeHead(403); res.end('Fails.'); return; }
      sid = v5 ? 'QBT_SID_9999=good' : 'SID=good';
      res.writeHead(v5 ? 204 : 200, { 'set-cookie': sid + '; Path=/' });
      res.end(v5 ? '' : 'Ok.');
    });
    return;
  }
  if (req.url.indexOf('/api/v2/') === 0) {
    if (expireOnce) { expireOnce = false; sid = 'SID=old'; }
    if (cookie.indexOf(sid.split('=')[1]) < 0) { res.writeHead(401); res.end('Forbidden'); return; }
    if (req.url === '/api/v2/app/version') { res.writeHead(200); res.end(v5 ? 'v5.0.0' : 'v4.6.0'); return; }
    if (req.url === '/api/v2/sync/maindata') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ server_state: { free_space_on_disk: 12345, save_path: '/dl' } })); return; }
    if (req.url === '/api/v2/torrents/categories') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ movie: { name: '电影', savePath: '/dl/movie' } })); return; }
    if (req.url.indexOf('/api/v2/torrents/info') === 0) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify([{ hash: 'a'.repeat(40), name: 'x', category: 'movie', progress: 1, state: 'uploading' }])); return; }
  }
  res.writeHead(404); res.end();
});
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
(async function () {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    await check('4.x SID 登录并探测通过', async function () {
      const r = await qb.probeDownloader({ url: base, user: 'u', pass: 'p' });
      need(r.pass === true && r.version === 'v4.6.0', '4.x 探测不对：' + JSON.stringify(r));
      need(logins >= 1, '没走登录');
    });
    await check('5.x QBT_SID 也能识别', async function () {
      v5 = true;
      const r = await qb.probeDownloader({ url: base, user: 'u', pass: 'p' });
      need(r.pass === true && r.version === 'v5.0.0', '5.x 探测不对：' + JSON.stringify(r));
      need(r.freeSpace === 12345, '5.x 磁盘余量不对：' + r.freeSpace);
    });
    await check('401 会话过期后自动重登录', async function () {
      expireOnce = true;
      const r = await qb.listTorrents({ url: base, user: 'u', pass: 'p' });
      need(r.ok === true && r.torrents.length === 1, '过期后列表失败：' + JSON.stringify(r));
      need(r.torrents[0].category === 'movie', '分类字段不对');
    });
    await check('分类读取带 cookie 并统计', async function () {
      const r = await qb.qbCategories({ url: base, user: 'u', pass: 'p' });
      need(r.pass === true && r.cats.length === 1 && r.cats[0].name === '电影', '分类不对：' + JSON.stringify(r));
    });
  } finally {
    server.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

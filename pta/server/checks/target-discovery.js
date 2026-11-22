/* 目标站 announce 发现：usercp 与上传页候选、cookie 只发目标站。本地 mock。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dns = require('dns');
const { makeDiscovery } = require('../target-discovery');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-disc-'));
const seen = [];
const server = http.createServer(function (req, res) {
  seen.push({ url: req.url, cookie: String(req.headers.cookie || '') });
  if (req.url === '/index.php') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<a href="userdetails.php?id=7">me</a>'); return; }
  if (req.url === '/usercp.php' || req.url === '/usercp.php?action=personal') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<a href="announce.php?passkey=abcdef1234567890">announce</a>');
    return;
  }
  if (req.url === '/upload.php') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<a href="/announce.php?passkey=uploadpass1234567890">announce</a><a href="http://evil.example/announce.php?passkey=evilpass1234567890">bad</a>');
    return;
  }
  res.writeHead(404); res.end();
});
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
(async function () {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const disc = makeDiscovery({
    resolve: function () { return { base: base, upload: { formPath: '/upload.php' } }; },
    cookieOf: function () { return { cookie: 'sid=target' }; },
    dataDir: DATA
  });
  try {
    await check('usercp 发现 passkey 且带 cookie', async function () {
      const r = await disc.discoverAnnounce('target.example');
      need(r.ok && /passkey=abcdef1234567890/.test(r.data.announce), '没发现 usercp passkey：' + JSON.stringify(r));
      const hit = seen.filter(x => x.url.indexOf('/usercp.php') === 0)[0];
      need(hit && hit.cookie === 'sid=target', '请求没带目标 cookie');
    });
    await check('上传页候选与 usercp 合并，passkey 可识别', async function () {
      const r = await disc.announceCandidates('target.example');
      need(r.ok && r.data.candidates.length >= 2, '候选没合并：' + JSON.stringify(r.data && r.data.candidates));
      need(r.data.candidates.some(function (x) { return x.kind === 'passkey' && /uploadpass/.test(x.announce); }), '上传页 passkey 没识别');
      need(!r.data.candidates.some(function (x) { return /evil\.example/.test(x.announce); }), '外部 announce 进了候选：' + JSON.stringify(r.data.candidates));
    });
    await check('目标站域名解析到内网时不发请求', async function () {
      const real = dns.promises.lookup;
      dns.promises.lookup = async function (h) {
        if (String(h || '').toLowerCase() === 'disc-rebind.example') return [{ address: '10.0.0.9', family: 4 }];
        return real(h);
      };
      const before = seen.length;
      try {
        const d2 = makeDiscovery({
          resolve: function () { return { base: 'http://disc-rebind.example', upload: { formPath: '/upload.php' } }; },
          cookieOf: function () { return { cookie: 'sid=target' }; },
          dataDir: DATA
        });
        const r = await d2.announceCandidates('disc-rebind.example');
        need(r.ok === false && r.code === 'NO_ANNOUNCE', '内网解析没拦住：' + JSON.stringify(r));
        need(seen.length === before, '拦住后仍发了请求：' + (seen.length - before));
      } finally { dns.promises.lookup = real; }
    });

    await check('没有 cookie 时明确报错', async function () {
      const d2 = makeDiscovery({ resolve: function () { return { base: base, upload: { formPath: '/upload.php' } }; }, cookieOf: function () { return { err: 'no cookie' }; }, dataDir: DATA });
      const r = await d2.announceCandidates('target.example');
      need(r.ok === false && r.code === 'NO_COOKIE', '没报 NO_COOKIE：' + JSON.stringify(r));
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

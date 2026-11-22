/* target-pages 会话失效：200 登录页、302 跳登录、删除后回查被跳登录。
   全部走本地 mock，不发真实站点请求。 */
const http = require('http');
const { makeTargetPages } = require('../src/features/publish/target-pages');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function html(res, body, status) { res.writeHead(status || 200, { 'content-type': 'text/html' }); res.end(body || ''); }

const server = http.createServer(function (req, res) {
  const url = req.url;
  if (url === '/details.php?id=1') return html(res, '<html><a href="takelogin.php">请先登录</a></html>');
  if (url === '/details.php?id=2') { res.writeHead(302, { location: '/takelogin.php' }); return res.end(); }
  if (url === '/details.php?id=9') { res.writeHead(302, { location: '/takelogin.php' }); return res.end(); }
  if (url === '/details.php?id=3') return html(res, '<html><h1>正常详情</h1><a href="download.php?id=3">下载</a></html>');
  if (url === '/edit.php?id=9') {
    return html(res, '<form action="/delete.php" method="post"><input type="hidden" name="id" value="9"><input type="radio" name="reason_type" value="1">其他<textarea name="reason"></textarea><input type="submit" name="submit" value="删除"></form>');
  }
  if (url === '/delete.php') { res.writeHead(302, { location: '/torrents.php' }); return res.end(); }
  res.writeHead(404); res.end('not found');
});

(async function () {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const target = makeTargetPages({
    resolve: function () { return { base: base, upload: { formPath: '/upload.php', path: '/takeupload.php' } }; },
    cookieOf: function () { return { cookie: 'sid=expired' }; },
    throttle: async function () { return { ok: true }; },
    ctx: { allowReal: function () { return true; } },
    qb: { parseTorrent: function () { return { hash: 'a'.repeat(40) }; } }
  });
  try {
    await check('详情页 200 但内容是登录页 → LOGIN_REQUIRED', async function () {
      const r = await target.fetchDetailsInfo('target.example', base + '/details.php?id=1');
      need(r.ok === false && r.code === 'LOGIN_REQUIRED' && r.http === 401, '没识别登录页：' + JSON.stringify(r));
    });
    await check('详情页 302 跳转 → LOGIN_REQUIRED', async function () {
      const r = await target.fetchDetailsInfo('target.example', base + '/details.php?id=2');
      need(r.ok === false && r.code === 'LOGIN_REQUIRED', '302 没拦住：' + JSON.stringify(r));
    });
    await check('详情页正常时不误报', async function () {
      const r = await target.fetchDetailsInfo('target.example', base + '/details.php?id=3');
      need(r.ok === true && r.data.url.indexOf('/details.php?id=3') >= 0, '正常详情被误拦：' + JSON.stringify(r));
    });
    await check('删除后回查被跳登录 → LOGIN_REQUIRED 且标记已发送', async function () {
      const r = await target.deleteTorrent('target.example', { id: '9' }, { dryRun: false, reason: '测试', reasonType: '其他' });
      need(r.ok === false && r.code === 'LOGIN_REQUIRED', '删除回查没识别登录：' + JSON.stringify(r));
      need(r.data && r.data.sent === true, '没标记已发送');
    });
  } finally {
    server.close();
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

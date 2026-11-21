/* target-submit 外联夹具：提交/回查的跳转、DNS 与 cookie 隔离。纯本地 mock，不联网。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { makeSubmit } = require('../server/target-submit');
const { makeTorrent } = require('./target-mock');

const detailHtml = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nexusphp-details.html'), 'utf8');
const title = 'Fixture Movie 2020 1080p Blu-ray AVC-GRP';
const torrent = makeTorrent();
const results = [];
const calls = [];

function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

let planUrl = '';
let verifyUrl = '';
const server = http.createServer(function (req, res) {
  calls.push({ url: req.url, cookie: String(req.headers.cookie || '') });
  if (req.url === '/takeupload') { res.writeHead(302, { location: '/details.php?id=1' }); res.end(); return; }
  if (req.url === '/takeupload-evil') { res.writeHead(302, { location: 'http://evil.example/details.php?id=1' }); res.end(); return; }
  if (req.url === '/details.php?id=1') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(detailHtml); return; }
  if (req.url === '/details-redirect') { res.writeHead(302, { location: 'http://evil.example/details.php?id=1' }); res.end(); return; }
  res.writeHead(404); res.end('missing');
});

function makeClient() {
  return makeSubmit({
    throttle: async function () { return { ok: true }; },
    resolve: function (host) { return { base: 'http://' + host, upload: { formPath: '/takeupload.php' } }; },
    plan: function () {
      return { ok: true, data: {
        url: planUrl, verifyUrl: verifyUrl,
        fields: { name: title, small_descr: 'sub' }, fileField: 'file', engine: 'nexusphp'
      } };
    },
    cookieOf: function () { return { cookie: 'sid=target' }; },
    one: function () { return { data: '{}' }; },
    ctx: { allowReal: function () { return true; } },
    torrentMeta: function () { return { hash: 'abc123', name: 'fixture' }; },
    textOf: function (html) { return String(html || '').replace(/<[^>]+>/g, ' '); },
    downloadLinksFromDetails: function () { return []; },
    isDeletedPageText: function () { return false; }
  });
}

(async function () {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port;
  planUrl = base + '/takeupload';
  verifyUrl = base + '/details.php?id=1';
  const submit = makeClient();
  const item = { title: title, site: 'source.example', cn: '' };

  try {
    await check('正常提交 302 到本站详情不算外部跳转', async function () {
      calls.length = 0;
      const r = await submit.submit('127.0.0.1', item, torrent, { dryRun: false });
      need(r.ok && r.data.sent === true, '提交失败：' + JSON.stringify(r));
      need(r.data.detailsUrl === base + '/details.php?id=1', '详情地址不对：' + r.data.detailsUrl);
      need(calls.length === 1 && calls[0].cookie === 'sid=target', 'cookie 没只发目标站：' + JSON.stringify(calls));
    });

    await check('提交跳到外部域名时拒绝', async function () {
      planUrl = base + '/takeupload-evil';
      calls.length = 0;
      const r = await submit.submit('127.0.0.1', item, torrent, { dryRun: false });
      need(r.ok === false && r.code === 'UPLOAD_REDIRECTED', '外部跳转没拦住：' + JSON.stringify(r));
      need(calls.length === 1, '外部跳转后还发了请求：' + calls.length);
    });

    await check('回查正常详情页并带目标站 cookie', async function () {
      planUrl = base + '/takeupload';
      verifyUrl = base + '/details.php?id=1';
      calls.length = 0;
      const r = await submit.verify('127.0.0.1', item, torrent, {});
      need(r.ok && r.data.found === true, '回查没找到：' + JSON.stringify(r));
      need(calls.length === 1 && calls[0].cookie === 'sid=target', '回查 cookie 不对：' + JSON.stringify(calls));
    });

    await check('回查跳到外部域名时拒绝', async function () {
      verifyUrl = base + '/details-redirect';
      calls.length = 0;
      const r = await submit.verify('127.0.0.1', item, torrent, {});
      need(r.ok === false && r.code === 'VERIFY_REDIRECTED', '外部回查跳转没拦住：' + JSON.stringify(r));
      need(calls.length === 1, '外部回查后还发了请求：' + calls.length);
    });

    await check('提交/回查域名解析到内网时不发 cookie', async function () {
      const real = dns.promises.lookup;
      dns.promises.lookup = async function (h) {
        if (String(h || '').toLowerCase() === 'target-rebind.example') return [{ address: '10.0.0.9', family: 4 }];
        return real(h);
      };
      planUrl = 'http://target-rebind.example/takeupload';
      verifyUrl = 'http://target-rebind.example/details.php?id=1';
      calls.length = 0;
      try {
        const s = await submit.submit('target-rebind.example', item, torrent, { dryRun: false });
        need(s.ok === false && s.code === 'DNS_BLOCKED', '提交内网没拦住：' + JSON.stringify(s));
        const v = await submit.verify('target-rebind.example', item, torrent, {});
        need(v.ok === false && v.code === 'DNS_BLOCKED', '回查内网没拦住：' + JSON.stringify(v));
        need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
      } finally { dns.promises.lookup = real; }
    });
  } finally {
    server.close();
  }

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

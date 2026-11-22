/* 站点类型补全夹具：本地 mock 分类页，不联网；验证离线补、探测、cookie 与限制。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sitetypes-'));
process.env.PTA_DATA = DATA;

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

const page = '<html><form action="/takeupload.php"><select name="type"><option value="0">请选择</option><option value="401">电影</option><option value="402">音乐</option></select></form></html>';
let hits = 0;
const server = http.createServer(function (req, res) {
  hits++;
  if (req.url === '/upload.php') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
  if (req.url === '/limited.php') { res.writeHead(403); res.end('no'); return; }
  if (req.url === '/login.php') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('请先登录'); return; }
  res.writeHead(404); res.end('x');
});

(async function () {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const b64 = function (s) { return 'b64:' + Buffer.from(s, 'utf8').toString('base64'); };
  fs.writeFileSync(path.join(DATA, 'sites.json'), JSON.stringify({ version: 1, sites: {
    'offline.example': { name: 'Offline', engine: 'nexusphp', urlRef: 'site-urls.json#offline.example',
      search: { path: '/torrents.php', cats: { '电影': ['1'], documentary: ['2'] } }, publish: { upload: { formPath: '/upload.php' }, catMap: {} }, settings: { enabled: true } },
    'probe.example': { name: 'Probe', engine: 'nexusphp', urlRef: 'site-urls.json#probe.example',
      search: { path: '/torrents.php', cats: {} }, publish: { upload: { formPath: '/upload.php' }, catMap: {} }, settings: { enabled: true } },
    'nocookie.example': { name: 'NoCookie', engine: 'nexusphp', urlRef: 'site-urls.json#nocookie.example',
      search: { path: '/torrents.php', cats: {} }, publish: { upload: { formPath: '/upload.php' }, catMap: {} }, settings: { enabled: true } }
  } }, null, 2));
  fs.writeFileSync(path.join(DATA, 'site-urls.json'), JSON.stringify({ version: 1, sites: {
    'offline.example': { base: b64(base), upload: b64('/upload.php') },
    'probe.example': { base: b64(base), upload: b64('/upload.php') },
    'nocookie.example': { base: b64(base), upload: b64('/upload.php') }
  } }, null, 2));
  const db = openDB(path.join(DATA, 'seedpod.db'));
  db.close();

  const makeSiteStore = require('../src/features/sites/store');
  const makeCookieStore = require('../src/features/sites/credentials');
  const { collectFromCategories, parseCategories, probeOne, applyTypes } = require('../scripts/site-types');
  const store = makeSiteStore(DATA);
  const cookies = makeCookieStore(DATA);

  try {
    await check('离线分类能推出主类型，没分类的留空', async function () {
      const r = collectFromCategories();
      const off = r.records.filter(function (x) { return x.host === 'offline.example'; })[0];
      need(off && off.status === 'ok' && off.proposedTypes[0] === '电影', '离线类型不对：' + JSON.stringify(off));
      need(JSON.stringify(Object.keys(off.bind).sort()) === JSON.stringify(['documentary', 'movie']), '离线绑定没归一：' + JSON.stringify(off.bind));
      const none = r.records.filter(function (x) { return x.host === 'nocookie.example'; })[0];
      need(none && none.status === 'no_categories', '无分类站不该硬猜：' + JSON.stringify(none));
    });

    await check('分类页 select 能解析出 id/label', async function () {
      const cats = parseCategories(page);
      need(cats.length === 1 && cats[0].field === 'type', '字段没认出来：' + JSON.stringify(cats));
      need(cats[0].options.length === 2 && cats[0].options[0].id === '401', '选项不对：' + JSON.stringify(cats[0].options));
    });

    await check('有 cookie 时只发 1 个请求并回填主类型', async function () {
      cookies.set('probe.example', 'sid=x');
      hits = 0;
      const r = await probeOne(db, null, 'probe.example');
      need(r.status === 'ok' && r.proposedTypes[0] === '电影' && r.requests === 1, '探测结果不对：' + JSON.stringify(r));
      need(r.bind.movie && r.bind.movie[0] === '401', '探测没给出分类绑定：' + JSON.stringify(r.bind));
      need(hits === 1, '请求次数不对：' + hits);
    });

    await check('没有 cookie 时不发请求', async function () {
      hits = 0;
      const r = await probeOne(db, null, 'nocookie.example');
      need(r.status === 'NO_COOKIE' && r.requests === 0, '无 cookie 结果不对：' + JSON.stringify(r));
      need(hits === 0, '无 cookie 仍发了请求');
    });

    await check('403 立即标记 RATE_LIMITED', async function () {
      store.save('limited.example', { name: 'Limited', engine: 'nexusphp', url: { base: base },
        search: { path: '/limited.php', cats: {} }, publish: { upload: { formPath: '/limited.php' }, catMap: {} }, settings: { enabled: true } });
      cookies.set('limited.example', 'sid=x');
      const r = await probeOne(db, null, 'limited.example');
      need(r.status === 'RATE_LIMITED' && r.requests === 1, '403 没停：' + JSON.stringify(r));
    });

    await check('回填写的是 cats key，不再存 types', async function () {
      const out = applyTypes([
        { host: 'probe.example', status: 'ok', proposedTypes: ['电影'], bind: { movie: ['401', '403'] } },
        { host: 'offline.example', status: 'no_categories', proposedTypes: [] }
      ]);
      need(out.changed === 1, '回填数量不对：' + JSON.stringify(out));
      const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'sites.json'), 'utf8'));
      const probe = raw.sites['probe.example'];
      need(JSON.stringify(probe.search.cats.movie) === JSON.stringify(['401', '403']), 'cats 没写：' + JSON.stringify(probe.search.cats));
      need(probe.search.types === undefined, '不该再存 types');
      need(store.get('offline.example').search.cats.movie[0] === '1', '失败项不该动 cats');
    });
  } finally {
    try { db.close(); } catch (e) { /* 已关 */ }
    server.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

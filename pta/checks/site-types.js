/* 站点类型补全夹具：本地 mock 分类页，不联网；验证离线补、探测、cookie 与限制。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sitetypes-'));
process.env.PTA_DATA = DATA;
process.env.PTA_DISABLE_SITE_PACK = '1';
const { openDB } = require('../server/db');
const secretbox = require('../server/secretbox');
const { collectFromCategories, parseCategories, probeOne, applyTypes } = require('../scripts/site-types');

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
  fs.mkdirSync(path.join(DATA, 'site-defs'), { recursive: true });
  fs.writeFileSync(path.join(DATA, 'site-defs', 'probe.example.json'), JSON.stringify({ engine: 'nexusphp', base: base, upload: { formPath: '/upload.php' } }));
  fs.writeFileSync(path.join(DATA, 'site-search.local.json'), JSON.stringify({ sites: {
    'offline.example': { cats: { '电影': ['1'], '纪录片': ['2'] } },
    'probe.example': {},
    'nocookie.example': {}
  } }, null, 2));
  const db = openDB(path.join(DATA, 'seedpod.db'));
  db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?,?,?)').run('probe.example', JSON.stringify({ enabled: true }), new Date().toISOString());
  db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?,?,?)').run('nocookie.example', JSON.stringify({ enabled: true }), new Date().toISOString());
  const key = secretbox.loadKey(DATA);
  db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?,?,?)').run('probe.example', secretbox.encrypt('sid=x', key.key), new Date().toISOString());
  fs.writeFileSync(path.join(DATA, 'site-defs', 'nocookie.example.json'), JSON.stringify({ engine: 'nexusphp', base: base, upload: { formPath: '/upload.php' } }));

  try {
    await check('离线分类能推出主类型，没分类的留空', async function () {
      const r = collectFromCategories();
      const off = r.records.filter(function (x) { return x.host === 'offline.example'; })[0];
      need(off && off.status === 'ok' && off.proposedTypes[0] === '电影', '离线类型不对：' + JSON.stringify(off));
      const none = r.records.filter(function (x) { return x.host === 'nocookie.example'; })[0];
      need(none && none.status === 'no_categories', '无分类站不该硬猜：' + JSON.stringify(none));
    });

    await check('分类页 select 能解析出 id/label', async function () {
      const cats = parseCategories(page);
      need(cats.length === 1 && cats[0].field === 'type', '字段没认出来：' + JSON.stringify(cats));
      need(cats[0].options.length === 2 && cats[0].options[0].id === '401', '选项不对：' + JSON.stringify(cats[0].options));
    });

    await check('有 cookie 时只发 1 个请求并回填主类型', async function () {
      hits = 0;
      const r = await probeOne(db, key, 'probe.example');
      need(r.status === 'ok' && r.proposedTypes[0] === '电影' && r.requests === 1, '探测结果不对：' + JSON.stringify(r));
      need(hits === 1, '请求次数不对：' + hits);
    });

    await check('没有 cookie 时不发请求', async function () {
      hits = 0;
      const r = await probeOne(db, key, 'nocookie.example');
      need(r.status === 'NO_COOKIE' && r.requests === 0, '无 cookie 结果不对：' + JSON.stringify(r));
      need(hits === 0, '无 cookie 仍发了请求');
    });

    await check('403 立即标记 RATE_LIMITED', async function () {
      fs.writeFileSync(path.join(DATA, 'site-defs', 'limited.example.json'), JSON.stringify({ engine: 'nexusphp', base: base, upload: { formPath: '/limited.php' } }));
      db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?,?,?)').run('limited.example', JSON.stringify({ enabled: true }), new Date().toISOString());
      db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?,?,?)').run('limited.example', secretbox.encrypt('sid=x', key.key), new Date().toISOString());
      const r = await probeOne(db, key, 'limited.example');
      need(r.status === 'RATE_LIMITED' && r.requests === 1, '403 没停：' + JSON.stringify(r));
    });

    await check('回填只改 types，不动 cats', async function () {
      const raw = { sites: { 'probe.example': { cats: { '电影': ['401'] } }, 'offline.example': { cats: { '音乐': ['5'] } } } };
      const out = applyTypes(raw, [{ host: 'probe.example', status: 'ok', proposedTypes: ['电影'] }, { host: 'offline.example', status: 'no_categories', proposedTypes: [] }]);
      need(out.changed === 1, '回填数量不对：' + out.changed);
      need(out.doc.sites['probe.example'].types[0] === '电影', 'types 没写');
      need(out.doc.sites['probe.example'].cats['电影'][0] === '401', 'cats 被改');
      need(!out.doc.sites['offline.example'].types, '失败项不该写 types');
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

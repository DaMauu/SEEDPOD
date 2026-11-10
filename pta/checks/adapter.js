/* 适配器检查：纯解析，不联网。用夹具验证 NexusPHP 的分类、列表、搜索 URL、登录表单。
   用法：node pta/checks/adapter.js，退出码 0 = 全绿。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const adapter = require(path.join(ROOT, 'server', 'adapters', 'nexusphp.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const html = fs.readFileSync(path.join(ROOT, 'pta', 'fixtures', 'nexusphp-browse.html'), 'utf8');

check('识别 NexusPHP 页面', () => {
  need(adapter.detect(html) === true, '没有识别出 NexusPHP');
  need(adapter.detect('<html><body>nothing</body></html>') === false, '把普通页面当成 NexusPHP');
});

check('解析分类（链接与图标两种写法）', () => {
  const cats = adapter.parseCategories(html);
  const ids = cats.map(c => c.id).sort();
  need(ids.join(',') === '401,402,404,405,406,407', '分类 id 不对：' + ids.join(','));
  const movie = cats.find(c => c.id === '401');
  need(movie && movie.label === '电 影', '分类标签没去掉 &nbsp;：' + JSON.stringify(movie));
  need(cats.some(c => c.label === '电影演唱会' || c.label === '音乐演唱会'), '组合 catNNN=1 的分类没解析出来');
});

check('解析列表', () => {
  const rows = adapter.parseList(html);
  need(rows.length === 3, '行数不对：' + rows.length);
  const r = rows[0];
  need(r.id === '1001', 'id 不对：' + r.id);
  need(r.title === 'Fixture Movie 2020 1080p Blu-ray AVC', '标题不对：' + r.title);
  need(r.size === '22.10 GB', '大小不对：' + r.size);
  need(r.catId === '401', '分类 id 不对：' + r.catId);
  need(/download\.php\?id=1001/.test(r.downloadUrl), '下载链接没取到：' + r.downloadUrl);
  need(/details\.php\?id=1001/.test(r.detailsUrl), '详情链接没取到：' + r.detailsUrl);
});

check('拼搜索 URL', () => {
  const def = { base: 'https://example.org/', searchPath: '/torrents.php', params: { search: '{q}', search_area: '0', search_mode: '0', cat: '{cats}' }, catMode: 'single' };
  const u1 = adapter.buildSearchUrl(def, '金瓶双艳', ['401']);
  need(u1.indexOf('https://example.org/torrents.php?') === 0, '基础地址不对：' + u1);
  need(/search=%E9%87%91%E7%93%B6/.test(u1), '搜索词没编码：' + u1);
  need(/cat=401/.test(u1), '分类没拼进去：' + u1);
  need(/search_area=0/.test(u1) && /search_mode=0/.test(u1), '固定参数没拼进去：' + u1);

  const multi = adapter.buildSearchUrl(Object.assign({}, def, { catMode: 'bracket' }), 'x', ['401', '402']);
  need(/cat%5B%5D=401/.test(multi) && /cat%5B%5D=402/.test(multi), '多分类 bracket 拼法不对：' + multi);

  const none = adapter.buildSearchUrl(def, 'x', []);
  need(none.indexOf('cat=') < 0, '没有分类时不该带 cat：' + none);
});

check('解析登录表单', () => {
  const loginHtml = '<html><body><form action="takelogin.php" method="post">' +
    '<input type="text" name="username"><input type="password" name="password">' +
    '<input type="hidden" name="trackerssl" value="1"><input type="submit" value="登录"></form></body></html>';
  const f = adapter.parseLoginForm(loginHtml);
  need(f && f.action === 'takelogin.php', '提交地址不对：' + JSON.stringify(f));
  const names = f.fields.map(x => x.name).sort().join(',');
  need(names === 'password,trackerssl,username', '字段不对：' + names);
  need(adapter.parseLoginForm('<html></html>') === null, '没有登录表单时应返回 null');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(r => !r[0]).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

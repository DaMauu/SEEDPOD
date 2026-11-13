/* 适配器检查：纯解析，不联网。用夹具验证 NexusPHP 的分类、列表、搜索 URL、登录表单。
   用法：node pta/checks/adapter.js，退出码 0 = 全绿。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const adapter = require(path.join(ROOT, 'server', 'adapters', 'nexusphp.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const html = fs.readFileSync(path.join(ROOT, 'fixtures', 'nexusphp-browse.html'), 'utf8');

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

const unit3d = require(path.join(ROOT, 'server', 'adapters', 'unit3d.js'));
const gazelle = require(path.join(ROOT, 'server', 'adapters', 'gazelle.js'));
const adapters = require(path.join(ROOT, 'server', 'adapters', 'index.js'));
const u3dHtml = fs.readFileSync(path.join(ROOT, 'fixtures', 'unit3d-browse.html'), 'utf8');
const gzHtml = fs.readFileSync(path.join(ROOT, 'fixtures', 'gazelle-browse.html'), 'utf8');

check('识别 UNIT3D 且不误判成别的引擎', () => {
  need(unit3d.detect(u3dHtml) === true, '没有识别出 UNIT3D');
  need(adapters.detectEngine(u3dHtml) === 'unit3d', '入口分发没选 unit3d：' + adapters.detectEngine(u3dHtml));
  need(adapter.detect(u3dHtml) === false, 'UNIT3D 页面被当成 NexusPHP');
  need(gazelle.detect(u3dHtml) === false, 'UNIT3D 页面被当成 Gazelle');
});

check('解析 UNIT3D 列表与分类', () => {
  const rows = unit3d.parseList(u3dHtml);
  need(rows.length === 2, '行数不对：' + rows.length);
  need(rows[0].id === '1234', 'id 不对：' + rows[0].id);
  need(rows[0].size === '12.34 GiB', '大小不对：' + rows[0].size);
  need(/\/torrents\/1234\/download/.test(rows[0].downloadUrl), '下载地址不对：' + rows[0].downloadUrl);
  const cats = unit3d.parseCategories(u3dHtml);
  need(cats.map(c => c.id).join(',') === '1,2,3', '分类 id 不对：' + cats.map(c => c.id).join(','));
  need(cats[0].label === 'Movies', '分类标签不对：' + cats[0].label);
});

check('拼 UNIT3D 搜索 URL', () => {
  const def = { base: 'https://example.org', engine: 'unit3d', searchPath: '/torrents' };
  const u = unit3d.buildSearchUrl(def, '金瓶双艳', ['1', '2']);
  need(u.indexOf('https://example.org/torrents?') === 0, '基础地址不对：' + u);
  need(/name=%E9%87%91%E7%93%B6/.test(u), '搜索词没编码：' + u);
  need((u.match(/categories%5B0%5D%5B%5D=/g) || []).length === 2, '多分类拼法不对：' + u);
});

check('识别并解析 Gazelle', () => {
  need(gazelle.detect(gzHtml) === true, '没有识别出 Gazelle');
  need(adapters.detectEngine(gzHtml) === 'gazelle', '入口分发没选 gazelle：' + adapters.detectEngine(gzHtml));
  const rows = gazelle.parseList(gzHtml);
  need(rows.length === 3, '行数不对：' + rows.length);
  need(rows[0].id === '5551' && rows[0].size === '333.33 MB', '第一行不对：' + JSON.stringify(rows[0]));
  need(rows[0].title === 'Fixture Album 2020 FLAC', '标题没取到组名：' + rows[0].title);
  const cats = gazelle.parseCategories(gzHtml);
  need(cats.map(c => c.id).join(',') === '1,2,3', '分类 id 不对：' + cats.map(c => c.id).join(','));
  /* 复选框写法（filter_cat[1] + label）也要认 */
  const boxHtml = '<input type="checkbox" name="filter_cat[1]" id="cat_1" value="1"><label for="cat_1">Music</label>';
  need(gazelle.parseCategories(boxHtml)[0].label === 'Music', '复选框分类没解析出来');
});

check('拼 Gazelle 搜索 URL', () => {
  const def = { base: 'https://example.org', engine: 'gazelle', searchPath: '/torrents.php', catSlot: 1 };
  const u = gazelle.buildSearchUrl(def, 'fixture', ['1']);
  need(/searchstr=fixture/.test(u), '搜索词没拼：' + u);
  need(/filter_cat%5B1%5D=1/.test(u), '分类槽位不对：' + u);
});

check('跨引擎登录态判定', () => {
  need(adapters.isLoggedIn(u3dHtml) === true, 'UNIT3D 已登录页面判成未登录');
  need(adapters.isLoggedIn(gzHtml) === true, 'Gazelle 已登录页面判成未登录');
  const npLogged = html.replace('</body>', '<a href="userdetails.php?id=42">me</a></body>');
  need(adapters.isLoggedIn(npLogged) === true, 'NexusPHP 已登录页面判成未登录');
  const wall = '<html><body><form action="takelogin.php" method="post"><input name="username"></form>请先登录</body></html>';
  need(adapters.isLoggedIn(wall) === false, '登录墙没判成未登录');
  need(adapters.isLoggedIn('<html><body>nothing</body></html>') === null, '空白页面应该判不出来');
});

check('反推搜索参数', () => {
  const np = adapters.detectSearchSpec(html);
  need(np.params && np.params.search === '{q}', 'NexusPHP 参数没反推出来：' + JSON.stringify(np.params));
  const u3 = adapters.detectSearchSpec(u3dHtml);
  need(u3.params && u3.params.name === '{q}', 'UNIT3D 参数没反推出来：' + JSON.stringify(u3.params));
  const gz = adapters.detectSearchSpec(gzHtml);
  need(gz.params && gz.params.searchstr === '{q}', 'Gazelle 参数没反推出来：' + JSON.stringify(gz.params));
  need(/filter_cat/.test(gz.catParam), 'Gazelle 分类参数名没取到：' + gz.catParam);
});

check('兜底适配：认不出的 tracker 也能列出条目', () => {
  const custom = require(path.join(ROOT, 'server', 'adapters', 'generic.js'));
  const gHtml = fs.readFileSync(path.join(ROOT, 'fixtures', 'custom-browse.html'), 'utf8');
  need(adapters.detectEngine(gHtml) === 'custom', '兜底引擎没接上：' + adapters.detectEngine(gHtml));
  const rows = custom.parseList(gHtml);
  need(rows.length === 3, '兜底行数不对：' + rows.length);
  need(rows[0].id === '1001' && rows[0].size === '8.88 GB', '兜底第一行不对：' + JSON.stringify(rows[0]));
  need(/dl\.php\?id=1001/.test(rows[0].downloadUrl), '兜底下载链接没取到：' + rows[0].downloadUrl);
  const cats = custom.parseCategories(gHtml);
  need(cats.map(c => c.id).join(',') === '1,2', '兜底下拉框分类没解析：' + JSON.stringify(cats));
  const u = custom.buildSearchUrl({ base: 'https://example.org', searchPath: '/search.php', params: { search: '{q}', cat: '{cats}' } }, 'x', ['1']);
  need(u === 'https://example.org/search.php?search=x&cat=1', '兜底搜索 URL 不对：' + u);
});

check('JS 空壳页也能认出引擎', () => {
  const u3Shell = fs.readFileSync(path.join(ROOT, 'fixtures', 'unit3d-shell.html'), 'utf8');
  const gzShell = fs.readFileSync(path.join(ROOT, 'fixtures', 'gazelle-shell.html'), 'utf8');
  need(adapters.detectEngine(u3Shell) === '', '空壳页不该被解析型适配器认出来：' + adapters.detectEngine(u3Shell));
  need(adapters.detectShellEngine(u3Shell) === 'unit3d', 'UNIT3D 空壳页没认出来：' + adapters.detectShellEngine(u3Shell));
  need(adapters.detectShellEngine(gzShell) === 'gazelle', 'Gazelle 空壳页没认出来：' + adapters.detectShellEngine(gzShell));
  need(adapters.detectShellEngine('<html><body>nothing</body></html>') === '', '普通页面被当成空壳 tracker');
});

check('从首页导航里找种子页路径', () => {
  const nav = require(path.join(ROOT, 'server', 'adapters', 'nav.js'));
  const home = fs.readFileSync(path.join(ROOT, 'fixtures', 'home-nav.html'), 'utf8');
  const cands = nav.findTorrentLinks(home);
  need(cands.length > 0, '首页导航里没找到候选');
  need(cands[0].path === '/torrents.php', '首选路径不对：' + cands[0].path);
  const paths = cands.map(c => c.path);
  need(paths.indexOf('/rules.php') < 0 && paths.indexOf('/forums.php') < 0, '把规则/论坛当成了种子页：' + paths.join(','));
  const pick = nav.pickBrowsePath(home, ['/torrents.php']);
  need(pick === null, '试过的路径应被排除，却给了 ' + (pick && pick.path));
  const unit3dHome = '<a href="/torrents">Torrents</a><a href="/login">Login</a><a href="/users/x">u</a>';
  need(nav.pickBrowsePath(unit3dHome, []).path === '/torrents', 'UNIT3D 的 /torrents 没认出来');
  need(nav.findTorrentLinks('<a href="/rules.php">规则</a>').length === 0, '只有规则链接时不该给候选');
});

check('解析种子文件：体积、名字、infohash', () => {
  const crypto = require('crypto');
  const torrent = require(path.join(ROOT, 'server', 'adapters', 'torrent.js'));
  const info = 'd6:lengthi1024e4:name8:test.iso12:piece lengthi16384ee';
  const buf = Buffer.from('d8:announce9:http://x/4:info' + info + 'e', 'binary');
  const r = torrent.torrentInfo(buf);
  need(r, '单文件种子没解析出来');
  need(r.size === 1024, '体积不对：' + r.size);
  need(r.name === 'test.iso', '名字不对：' + r.name);
  const expect = crypto.createHash('sha1').update(Buffer.from(info, 'binary')).digest('hex');
  need(r.infohash === expect, 'infohash 不对：' + r.infohash + ' ≠ ' + expect);

  const files = 'ld6:lengthi100e4:pathl1:aee' + 'd6:lengthi2048e4:pathl1:beee' + 'e';
  const multi = 'd5:files' + files + '4:name3:abc12:piece lengthi16384ee';
  const mbuf = Buffer.from('d4:info' + multi + 'e', 'binary');
  const m = torrent.torrentInfo(mbuf);
  need(m && m.size === 2148, '多文件体积不对：' + (m && m.size));
  need(m.files === 2, '文件数不对：' + (m && m.files));
  need(torrent.torrentInfo(Buffer.from('not a torrent')) === null, '坏数据应返回 null');
});

check('判同一个种子：标题/年份/分辨率/体积/infohash', () => {
  const match = require(path.join(ROOT, 'server', 'match.js'));
  const a = { title: 'Some Movie 2020 1080p BluRay AVC-GRP', year: 2020, res: '1080p', size: '22.10 GB' };
  need(match.compare(a, { title: 'Some Movie 2020 1080p Blu-ray x264-OTHER', year: 2020, res: '1080p', size: '22.05 GB' }).same === true, '同片不同发布组应判同');
  need(match.compare(a, { title: 'Some Movie 2020 2160p BluRay x265-GRP', year: 2020, res: '2160p', size: '22.05 GB' }).same === false, '分辨率不同应判不同');
  need(match.compare(a, { title: 'Some Movie 2020 1080p BluRay AVC-GRP', year: 2020, res: '1080p', size: '3.00 GB' }).same === false, '体积差太多应判不同');
  need(match.compare({ title: 'X 2020 1080p', infohash: 'a'.repeat(40) }, { title: '完全不同的标题', infohash: 'a'.repeat(40) }).same === true, 'infohash 相同应判同');
  need(match.compare({ title: 'X 2020 1080p', infohash: 'a'.repeat(40) }, { title: 'X 2020 1080p', infohash: 'b'.repeat(40) }).same === false, 'infohash 不同应判不同');
  need(match.normTitle('【某站】Some Movie 2020 1080p WEB-DL DDP5.1-GRP') === 'some movie 2020', '标题归一把站点前缀/编码/组名没清干净：' + match.normTitle('【某站】Some Movie 2020 1080p WEB-DL DDP5.1-GRP'));
});

check('解析详情页（大小/分类/媒介/标签/简介/海报/原盘）', () => {
  const adapters = require(path.join(ROOT, 'server', 'adapters'));
  const dhtml = fs.readFileSync(path.join(ROOT, 'fixtures', 'nexusphp-details.html'), 'utf8');
  const d = adapters.parseDetail(dhtml);
  need(d.sizeText === '22.10 GB', '大小文本不对：' + d.sizeText);
  need(Math.round(d.sizeBytes / 1024 / 1024 / 1024) === 22, '大小字节不对：' + d.sizeBytes);
  need(d.category === '电 影' || d.category === '电影', '分类不对：' + d.category);
  need(/Blu-ray/.test(d.medium), '媒介不对：' + d.medium);
  need(/DTS-HD/.test(d.tags), '标签不对：' + d.tags);
  need(d.subtitle === '中英字幕', '副标题不对：' + d.subtitle);
  need(d.infohash === 'abcdef0123456789abcdef0123456789abcdef01', 'infohash 没转小写：' + d.infohash);
  need(/夹具/.test(d.descr) && /DTS-HD/.test(d.descr), '简介不对：' + d.descr);
  need(/\/p\/1001\.jpg/.test(d.poster), '海报不对：' + d.poster);
  need(d.fullDisc === true, '原盘判定不对');
  need(/Fixture Movie/.test(d.pageTitle), '页面标题不对：' + d.pageTitle);
  const empty = adapters.parseDetail('<html><body><p>nothing</p></body></html>');
  need(empty.sizeBytes === undefined && empty.medium === undefined, '空页面不该编出字段：' + JSON.stringify(empty));
});

check('翻页地址拼接', () => {
  const adapters = require(path.join(ROOT, 'server', 'adapters'));
  const base = 'https://x.example/torrents.php?search=&cat=401';
  need(adapters.withPage(base, 1) === base, '第 1 页不该改地址');
  need(/[?&]page=2$/.test(adapters.withPage(base, 2)), '第 2 页没拼上 page=2：' + adapters.withPage(base, 2));
  need(adapters.withPage('https://x.example/torrents?name=a', 3).indexOf('page=3') > 0, '不带路面的地址也要能拼 page');
});

check('分类游标会轮转', () => {
  const { nextCursor } = require(path.join(ROOT, 'server', 'cursor'));
  let r = nextCursor({ catCount: 3, catIdx: 0, page: 2, rows: 50 });
  need(r.catIdx === 0 && r.page === 2 && !r.rotated, '有下一页时不该换分类：' + JSON.stringify(r));
  r = nextCursor({ catCount: 3, catIdx: 0, page: 5, rows: 0 });
  need(r.catIdx === 1 && r.page === 0 && r.rotated, '空页应换到下一类：' + JSON.stringify(r));
  r = nextCursor({ catCount: 3, catIdx: 2, page: 5, rows: 0 });
  need(r.catIdx === 0 && r.page === 0, '最后一类应回到第一类：' + JSON.stringify(r));
  r = nextCursor({ catCount: 3, catIdx: 1, page: 5, rows: 0, rotate: false });
  need(r.catIdx === 1 && r.page === 0 && !r.rotated, '抓这一类不该换分类：' + JSON.stringify(r));
  r = nextCursor({ catCount: 1, catIdx: 0, page: 5, rows: 0 });
  need(r.catIdx === 0 && r.page === 0, '只有一类时原地归零：' + JSON.stringify(r));
});

check('每日硬顶', () => {
  const limits = require(path.join(ROOT, 'server', 'limits'));
  const max = limits.dailyMax();
  need(max >= 1 && max <= 100, '每日上限范围不对：' + max);
  need(limits.dailyBlocked(max, max) === true, '到上限应拦');
  need(limits.dailyBlocked(max - 1, max) === false, '没到上限不该拦');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(r => !r[0]).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

/* 后端契约检查：起一个临时实例，按 docs/API.md 验字段与错误码。
   用法：node pta/checks/api.js（PTA_NODE 指向 node，环境里不需要额外依赖）
   退出码 0 = 全部符合契约，1 = 有不符合，2 = 起不来。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8099);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-api-'));
const BASE = 'http://127.0.0.1:' + PORT;

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e.message]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const AUTH = 'Basic ' + Buffer.from('check:check-pass').toString('base64');
function fetchA(url, opts) {
  return fetch(url, Object.assign({}, opts || {}, { headers: Object.assign({ authorization: AUTH }, (opts || {}).headers || {}) }));
}

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('服务 6 秒内没有起来');
}

async function waitTask(id, ms) {
  const end = Date.now() + (ms || 6000);
  while (Date.now() < end) {
    const j = await (await fetchA(BASE + '/api/tasks/' + id)).json();
    if (j.ok && ['done', 'failed', 'canceled'].indexOf(j.data.state) >= 0) return j.data;
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('任务没在 ' + ms + 'ms 内结束');
}

async function main() {
  const child = spawn(process.env.PTA_NODE || process.execPath, [path.join(ROOT, 'server', 'app.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web'),
      PTA_USER: 'check', PTA_PASS: 'check-pass', PTA_LOG_MAX: '1500'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });

  try {
    await waitUp();
  } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill();
    process.exit(2);
  }

  await check('health 结构', async () => {
    const j = await (await fetch(BASE + '/api/health')).json();
    need(j.ok === true, 'ok 不为 true');
    need(j.data && typeof j.data.version === 'string', '缺少 version');
    need(typeof j.data.uptime === 'number', '缺少 uptime');
  });

  await check('config 默认值与双模式区间', async () => {
    const j = await (await fetchA(BASE + '/api/config')).json();
    need(j.ok, 'ok 不为 true');
    need(j.data.user.runMode === 'test', '默认不是测试模式');
    need(j.data.user.interval === 60, '默认间隔应为 60');
    need(j.data.limits.test.interval[0] === 30, '测试模式下限应为 30');
    need(j.data.limits.prod.interval[0] === 8, '正式模式下限应为 8');
    need(j.data.sys.concurrency === 1, '并发应固定为 1');
  });

  await check('越界返回 400 OUT_OF_RANGE', async () => {
    const r = await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 3 })
    });
    need(r.status === 400, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.ok === false && j.error.code === 'OUT_OF_RANGE', '错误码不对：' + JSON.stringify(j));
  });

  await check('合法修改落盘', async () => {
    const r = await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: '45', dailySite: 15 })
    });
    need(r.ok, '修改失败');
    const j = await r.json();
    need(j.data.interval === 45, '间隔没转成数字：' + j.data.interval);
    const disk = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
    need(disk.interval === 45, '没有写进 config.json');
  });

  await check('切换正式模式后下限变 8', async () => {
    await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runMode: 'prod' })
    });
    const r = await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 10 })
    });
    need(r.ok, '正式模式 10 秒应被接受');
    const bad = await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ interval: 5 })
    });
    need(bad.status === 400, '正式模式 5 秒应被拒绝');
  });

  await check('静态页面与未知接口', async () => {
    const home = await fetchA(BASE + '/');
    need(home.ok && /SEEDPOD/.test(await home.text()), '首页不对');
    const spa = await fetchA(BASE + '/whatever/route');
    need(spa.ok, '未知路径没有回退到首页');
    const api = await fetchA(BASE + '/api/nope');
    need(api.status === 404, '未知接口状态码是 ' + api.status);
  });

  await check('站点清单结构', async () => {
    const j = await (await fetchA(BASE + '/api/sites')).json();
    need(j.ok, 'ok 不为 true');
    need(Array.isArray(j.data.sites), 'sites 不是数组');
    need(j.data.counts && j.data.counts.total === j.data.sites.length, 'counts.total 与列表长度不一致');
    j.data.sites.slice(0, 5).forEach(x => {
      need(typeof x.host === 'string' && x.host.indexOf('/') < 0, 'host 不合法：' + x.host);
      need(/^https?:\/\//.test(x.url), 'url 不合法：' + x.url);
      need(['NP', 'UNIT3D', 'GZ', 'OTHER', '?'].indexOf(x.arch) >= 0, 'arch 取值不对：' + x.arch);
    });
  });

  await check('站点配置读写与秘密不落盘', async () => {
    const host = 'demo.example';
    const empty = await (await fetchA(BASE + '/api/site-config')).json();
    need(empty.ok, '读站点配置失败');
    need(empty.data.sites && typeof empty.data.sites === 'object', 'sites 不是对象');
    need(Array.isArray(empty.data.hidden), 'hidden 不是数组');
    const w = await fetchA(BASE + '/api/site-config/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ interval: 45, pages: 3, concurrency: 2, note: 'check', password: 'x', cookie: 'y' })
    });
    const j = await w.json();
    need(w.ok, '写入失败 ' + JSON.stringify(j));
    need(j.data.config.interval === 45, 'interval 没写进去');
    need(j.data.dropped.indexOf('password') >= 0, '密码字段应当被拒绝落盘');
    need(j.data.config.password === undefined, '密码被存下来了');
    const back = await (await fetchA(BASE + '/api/site-config')).json();
    need(back.data.sites[host] && back.data.sites[host].password === undefined, 'GET 里出现了密码');
    const bad = await fetchA(BASE + '/api/site-config/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ interval: 9999 })
    });
    need(bad.status === 400, '越界 interval 没被拦截：' + bad.status);
    const del = await fetchA(BASE + '/api/site-config/' + host, { method: 'DELETE' });
    need(del.ok, '删除失败');
    const after = await (await fetchA(BASE + '/api/site-config')).json();
    need(!after.data.sites[host], '删除后仍存在');
  });

  await check('站点配置需要登录', async () => {
    const r = await fetch(BASE + '/api/site-config');
    need(r.status === 401, '未登录能读站点配置：' + r.status);
  });

  await check('站点搜索预设读写', async () => {
    const host = 'demo.example';
    const empty = await (await fetchA(BASE + '/api/sites/' + host + '/search')).json();
    need(empty.ok && empty.data.preset === null, '新站点预设应为 null：' + JSON.stringify(empty).slice(0, 120));
    const put = await fetchA(BASE + '/api/sites/' + host + '/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', searchPath: '/torrents.php', browsePath: '/torrents.php',
        params: { search: '{q}', cat: '{cats}' }, cats: { movie: ['401'], tv: ['402'] }, source: 'manual' })
    });
    const pj = await put.json();
    need(put.ok, '写入预设失败 ' + JSON.stringify(pj).slice(0, 160));
    need(pj.data.preset.engine === 'nexusphp', 'engine 没写进去');
    const back = await (await fetchA(BASE + '/api/sites/' + host + '/search')).json();
    need(back.data.preset && back.data.preset.cats.movie[0] === '401', '写进去的 cats 读不回来');

    /* 带 q 的读取要顺手给出真实搜索链接（见 on-site 核对用），但这里只拼字符串、不发请求 */
    const defDir0 = path.join(DATA, 'site-defs');
    fs.mkdirSync(defDir0, { recursive: true });
    fs.writeFileSync(path.join(defDir0, host + '.json'), JSON.stringify({
      host: host, base: 'https://' + host, engine: 'nexusphp', searchPath: '/torrents.php',
      params: { search: '{q}', cat: '{cats}' }, catMode: 'single', cats: { movie: ['401'] }
    }));
    const withUrls = await (await fetchA(BASE + '/api/sites/' + host + '/search?q=%E6%B5%8B%E8%AF%95')).json();
    need(Array.isArray(withUrls.data.urls) && withUrls.data.urls.length >= 2, '没有返回搜索链接预览：' + JSON.stringify(withUrls.data).slice(0, 160));
    const u0 = withUrls.data.urls[0].url;
    need(u0.indexOf('https://' + host + '/torrents.php?') === 0, '预览链接前缀不对：' + u0);
    need(/search=%E6%B5%8B%E8%AF%95/.test(u0), '预览链接没带搜索词：' + u0);
    need(/cat=401/.test(withUrls.data.urls.map(x => x.url).join(' ')), '预览链接没带分类：' + JSON.stringify(withUrls.data.urls).slice(0, 200));
    const bad = await fetchA(BASE + '/api/sites/' + host + '/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ engine: 'lol' })
    });
    need(bad.status === 400, '非法 engine 没被拦：' + bad.status);
    const del = await fetchA(BASE + '/api/sites/' + host + '/search', { method: 'DELETE' });
    need(del.ok, '删除预设失败');
    const after = await (await fetchA(BASE + '/api/sites/' + host + '/search')).json();
    need(after.data.preset === null, '删除后还能读到预设');
  });

  await check('下载器秘密不回显', async () => {
    const add = await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '本机检查用', url: 'http://127.0.0.1:1/', user: 'admin', pass: 'topsecret' })
    });
    const aj = await add.json();
    need(add.ok, '新增下载器失败 ' + JSON.stringify(aj).slice(0, 160));
    need(aj.data.hasPass === true, '没有标记 hasPass');
    need(aj.data.pass === undefined, '回包带出了密码');
    need(aj.data.url === 'http://127.0.0.1:1', 'url 没有去掉结尾斜杠：' + aj.data.url);
    const list = await (await fetchA(BASE + '/api/downloaders')).json();
    need(JSON.stringify(list).indexOf('topsecret') < 0, '列表里带出了密码');
    const bad = await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', url: 'ftp://nope' })
    });
    need(bad.status === 400, '非法地址没被拦：' + bad.status);
    const del = await fetchA(BASE + '/api/downloaders/' + aj.data.id, { method: 'DELETE' });
    need(del.ok, '删除下载器失败');
  });

  await check('下载器连通性探测（本地假 qB）', async () => {
    const http = require('http');
    const mock = http.createServer((rq, rs) => {
      if (rq.url === '/api/v2/app/version') { rs.writeHead(200, { 'content-type': 'text/plain' }); rs.end('v5.0.3'); return; }
      if (rq.url === '/api/v2/sync/maindata') {
        rs.writeHead(200, { 'content-type': 'application/json' });
        rs.end(JSON.stringify({ server_state: { free_space_on_disk: 123456789012, save_path: '/data' } }));
        return;
      }
      rs.writeHead(404); rs.end('nope');
    });
    await new Promise(r => mock.listen(0, '127.0.0.1', r));
    const port = mock.address().port;
    try {
      const add = await fetchA(BASE + '/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '假 qB', url: 'http://127.0.0.1:' + port })
      });
      const aj = await add.json();
      need(add.ok, '新增假 qB 失败');
      const t = await fetchA(BASE + '/api/downloaders/' + aj.data.id + '/test', { method: 'POST' });
      const tj = await t.json();
      need(t.ok, '探测接口失败 ' + JSON.stringify(tj).slice(0, 160));
      need(tj.data.pass === true, '探测没通过：' + JSON.stringify(tj.data).slice(0, 200));
      need(tj.data.version === 'v5.0.3', '版本号不对：' + tj.data.version);
      need(Array.isArray(tj.data.steps) && tj.data.steps[0].status === 200, 'steps 结构不对');
      need(tj.data.freeSpace === 123456789012, '磁盘余量没读到：' + tj.data.freeSpace);
      const ov = await (await fetchA(BASE + '/api/stats/overview')).json();
      need(ov.ok && ov.data.downloaders.online >= 1, '系统状态没统计到在线下载器');
      need(ov.data.downloaders.freeSpace === 123456789012, '系统状态里的磁盘余量不对：' + ov.data.downloaders.freeSpace);
      need(ov.data.downloaders.version === 'v5.0.3', '系统状态里没带版本：' + ov.data.downloaders.version);
      await fetchA(BASE + '/api/downloaders/' + aj.data.id, { method: 'DELETE' });
    } finally {
      mock.close();
    }
  });

  await check('下载器探测失败要给出原因', async () => {
    const add = await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '连不上', url: 'http://127.0.0.1:9' })
    });
    const id = (await add.json()).data.id;
    const t = await fetchA(BASE + '/api/downloaders/' + id + '/test', { method: 'POST' });
    const tj = await t.json();
    need(t.ok, '探测接口本身挂了');
    need(tj.data.pass === false, '连不上却报成功');
    need(tj.data.steps[0].error, '没有给出失败原因');
    await fetchA(BASE + '/api/downloaders/' + id, { method: 'DELETE' });
  });

  await check('流程规则存取', async () => {
    const empty = await (await fetchA(BASE + '/api/flow')).json();
    need(empty.ok && empty.data.sets === null, '初始应为空：' + JSON.stringify(empty).slice(0, 120));
    const sets = { fetch: [[{ v: '增量（只抓新页）', on: true, sel: ['电影', '剧集'] }]], pub: [[{ on: false }]] };
    const put = await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: sets }) });
    const pj = await put.json();
    need(put.ok, '保存失败 ' + JSON.stringify(pj).slice(0, 140));
    need(pj.data.sets.fetch[0][0].sel.length === 2, 'sel 没存下来');
    const back = await (await fetchA(BASE + '/api/flow')).json();
    need(back.data.sets && back.data.sets.fetch[0][0].v === '增量（只抓新页）', '读回来不对');
    need(back.data.sets.pub[0][0].on === false, '布尔值没存对');
    const badShape = await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: { fetch: 'nope' } }) });
    need(badShape.status === 400, '错误形状没被拦：' + badShape.status);
    const badRow = await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: { fetch: [[{ v: { a: 1 } }]] } }) });
    need(badRow.status === 400, '对象值没被拦：' + badRow.status);
    const anon = await fetch(BASE + '/api/flow');
    need(anon.status === 401, '未登录能读流程规则：' + anon.status);
  });

  await check('搜索预设汇总', async () => {
    await fetchA(BASE + '/api/sites/demo2.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'gazelle', cats: { movie: ['1', '2'] }, source: 'manual' })
    });
    const j = await (await fetchA(BASE + '/api/site-search')).json();
    need(j.ok && j.data && j.data['demo2.example'], '汇总里没有刚写的站点');
    need(j.data['demo2.example'].ids === 2, 'ids 统计不对：' + j.data['demo2.example'].ids);
    need(j.data['demo2.example'].groups === 1, 'groups 统计不对：' + j.data['demo2.example'].groups);
    need(j.data['demo2.example'].engine === 'gazelle', 'engine 没带出来');
    need(j.data['demo2.example'].confirmed === true, 'source=manual 的预设应算已确认');
    const withMode = await fetchA(BASE + '/api/sites/demo3.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'unit3d', catMode: 'multi', catSlot: 2, cats: { movie: ['1'] }, source: 'auto', confirmed: false })
    });
    const wj = await withMode.json();
    need(withMode.ok, '写 catMode 失败 ' + JSON.stringify(wj).slice(0, 140));
    need(wj.data.preset.catMode === 'multi' && wj.data.preset.catSlot === 2, 'catMode/catSlot 没存下来：' + JSON.stringify(wj.data.preset).slice(0, 160));
    need(wj.data.preset.source === 'auto' && wj.data.preset.confirmed === false, 'source/confirmed 没存下来');
    const sum2 = await (await fetchA(BASE + '/api/site-search')).json();
    need(sum2.data['demo3.example'].confirmed === false, 'source=auto 的预设不该算已确认');
    const badMode = await fetchA(BASE + '/api/sites/demo3.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catMode: 'weird' })
    });
    need(badMode.status === 400, '非法 catMode 没被拦：' + badMode.status);
    const badSlot = await fetchA(BASE + '/api/sites/demo3.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catSlot: 99 })
    });
    need(badSlot.status === 400, '非法 catSlot 没被拦：' + badSlot.status);
    const archSrc = await fetchA(BASE + '/api/sites/demo4.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ engine: 'nexusphp', source: 'arch' })
    });
    need(archSrc.ok, 'source=arch 被拒了：' + archSrc.status);
    const bogusSrc = await fetchA(BASE + '/api/sites/demo4.example/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'bogus' })
    });
    need(bogusSrc.status === 400, '非法 source 没被拦：' + bogusSrc.status);
    const anon = await fetch(BASE + '/api/site-search');
    need(anon.status === 401, '未登录能读汇总：' + anon.status);
  });

  await check('站点定义摘要与单站定义', async () => {
    const host = 'defs.example';
    const defDir = path.join(DATA, 'site-defs');
    fs.mkdirSync(defDir, { recursive: true });
    fs.writeFileSync(path.join(defDir, host + '.json'), JSON.stringify({
      host: host, base: 'https://' + host, engine: 'unit3d', searchPath: '/torrents',
      params: { name: '{q}', 'categories[0]': '{cats}' }, catMode: 'multi',
      cats: { movie: ['1'], tv: ['2', '3'] },
      source: { kind: 'sample', rows: 24, sizeRows: 23, cats: 3, analyzedAt: new Date().toISOString() }
    }));
    const list = await (await fetchA(BASE + '/api/site-defs')).json();
    need(list.ok && Array.isArray(list.data), '摘要接口形状不对');
    const row = list.data.find(d => d.host === host);
    need(row, '摘要里没有刚写的定义');
    need(row.engine === 'unit3d', 'engine 不对：' + row.engine);
    need(row.groups === 2 && row.ids === 3, '分类统计不对：' + row.groups + '/' + row.ids);
    need(row.rows === 24 && row.sizeRows === 23, '采样行数没带出来：' + row.rows + '/' + row.sizeRows);
    need(row.kind === 'sample', '定义来源 kind 没带出来：' + row.kind);
    need((list.engines || []).join(',') === 'unit3d,gazelle,nexusphp,custom', '引擎清单不对：' + (list.engines || []).join(','));
    const one = await (await fetchA(BASE + '/api/site-def/' + host)).json();
    need(one.ok && one.data.engine === 'unit3d' && one.data.catMode === 'multi', '单站定义内容不对');
    const miss = await fetchA(BASE + '/api/site-def/nope.example');
    need(miss.status === 404, '没有定义应回 404：' + miss.status);
    const anon = await fetch(BASE + '/api/site-defs');
    need(anon.status === 401, '未登录能读定义摘要：' + anon.status);
  });

  await check('待审核队列状态机', async () => {
    const add = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2020 1080p Blu-ray AVC', cn: '检查用', res: '1080p', size: '22.10 GB', site: 'source.example', targetSite: 'example.org' })
    });
    const aj = await add.json();
    need(add.ok, '新增条目失败 ' + JSON.stringify(aj).slice(0, 160));
    const id = aj.data.id;
    need(/^q_/.test(id) && aj.data.status === 'pending', '新增条目结构不对：' + JSON.stringify(aj.data).slice(0, 120));
    const list = await (await fetchA(BASE + '/api/queue?status=pending')).json();
    need(list.data.items.some(x => x.id === id), '列表里找不到新条目');
    need(list.data.counts && list.data.counts.pending >= 1, 'counts 不对');

    const early = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
    });
    need(early.status === 409, '未通过就发布居然成功：' + early.status);
    const ej = await early.json();
    need(ej.error && ej.error.code === 'BAD_STATE', '错误码不对：' + JSON.stringify(ej).slice(0, 120));

    const noReason = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject' })
    });
    need(noReason.status === 400, '驳回没写理由却通过了：' + noReason.status);

    const ok = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' })
    });
    const oj = await ok.json();
    need(ok.ok && oj.data.status === 'approved', '通过失败：' + JSON.stringify(oj).slice(0, 120));

    /* 已通过但缺下载器与预设时，发布要被拦住并说明缺什么 */
    const blocked = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
    });
    need(blocked.status === 409, '缺前置条件却能发布：' + blocked.status);
    const bj = await blocked.json();
    need(bj.error && bj.error.code === 'PUBLISH_BLOCKED', '错误码不对：' + JSON.stringify(bj).slice(0, 140));
    need(Array.isArray(bj.error.blockers) && bj.error.blockers.length >= 2, '没有列出缺什么：' + JSON.stringify(bj.error).slice(0, 160));

    /* 补上下载器和该站搜索预设，发布才通过 */
    const dlAdd = await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'publish-check', url: 'http://127.0.0.1:1' })
    });
    const dlId = (await dlAdd.json()).data.id;
    await fetchA(BASE + '/api/sites/example.org/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', cats: { movie: ['401'] } })
    });
    const pub = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
    });
    const pj2 = await pub.json();
    need(pub.ok && pj2.data.status === 'published', '发布失败：' + JSON.stringify(pj2).slice(0, 120));
    const twice = await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: '改主意' })
    });
    need(twice.status === 409, '已发布还能驳回到 ' + twice.status);

    await fetchA(BASE + '/api/downloaders/' + dlId, { method: 'DELETE' });
    await fetchA(BASE + '/api/sites/example.org/search', { method: 'DELETE' });
    const del = await fetchA(BASE + '/api/queue/' + id, { method: 'DELETE' });
    need(del.ok, '删除条目失败');
    const gone = await fetchA(BASE + '/api/queue/' + id);
    need(gone.status === 404, '删除后还能读到：' + gone.status);
  });

  await check('cookie 导入与会话自检', async () => {
    const http = require('http');
    const mock = http.createServer((rq, rs) => {
      if (rq.url === '/index.php') {
        /* 有一种站只给会员区链接，通用判定认不出来，要靠站点定义的 login.test 选择器 */
        if ((rq.headers.cookie || '').indexOf('member=') >= 0) {
          const ck2 = rq.headers.cookie || '';
          const okM = ck2.indexOf('member=1') >= 0;
          rs.writeHead(200, { 'content-type': 'text/html' });
          rs.end(okM ? '<html><body><a href="member-area.php">会员区</a></body></html>' : '<html><body>请登录</body></html>');
          return;
        }
        const cookie = rq.headers.cookie || '';
        const ok = cookie.indexOf('c_secure_uid=good') >= 0;
        rs.writeHead(ok ? 200 : 302, ok ? { 'content-type': 'text/html' } : { location: '/login.php' });
        rs.end(ok ? '<html>欢迎回来 <a href="userdetails.php?id=1">ok</a></html>' : '');
        return;
      }
      if (rq.url === '/') {
        const ck = rq.headers.cookie || '';
        const okU3d = ck.indexOf('session=u3d-good') >= 0;
        rs.writeHead(200, { 'content-type': 'text/html' });
        rs.end(okU3d
          ? '<html><body><a href="/logout">Logout</a><a href="/users/fixture">me</a><a href="/torrents/123/download">DL</a></body></html>'
          : '<html><body><a href="/login">Sign in</a></body></html>');
        return;
      }
      rs.writeHead(404); rs.end('x');
    });
    await new Promise(r => mock.listen(0, '127.0.0.1', r));
    const port = mock.address().port;
    const host = 'cookie.example';
    try {
      const defDir = path.join(DATA, 'site-defs');
      fs.mkdirSync(defDir, { recursive: true });
      fs.writeFileSync(path.join(defDir, host + '.json'), JSON.stringify({ host: host, base: 'http://127.0.0.1:' + port, engine: 'nexusphp' }));

      const save = await fetchA(BASE + '/api/credentials/' + host, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cookie: 'c_secure_uid=good; c_secure_pass=xyz' })
      });
      const sj = await save.json();
      need(save.ok, '保存 cookie 失败 ' + JSON.stringify(sj).slice(0, 140));
      need(sj.data.hasCookie === true, '没有标记 hasCookie');
      need(JSON.stringify(sj).indexOf('c_secure_pass=xyz') < 0, '回包里带出了 cookie 值');
      const raw = fs.readFileSync(path.join(DATA, 'credentials.json'), 'utf8');
      need(raw.indexOf('c_secure_pass=xyz') < 0, '磁盘上出现了明文 cookie');

      const ok = await (await fetchA(BASE + '/api/sites/' + host + '/session-test', { method: 'POST' })).json();
      need(ok.data.pass === true, '有效 cookie 却判失效：' + JSON.stringify(ok.data).slice(0, 180));
      need(ok.data.cookieNames.indexOf('c_secure_uid') >= 0, '没回 cookie 名');

      await fetchA(BASE + '/api/credentials/' + host, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'c_secure_uid=bad' })
      });
      const bad = await (await fetchA(BASE + '/api/sites/' + host + '/session-test', { method: 'POST' })).json();
      need(bad.data.pass === false, '失效 cookie 却判成功');

      await fetchA(BASE + '/api/credentials/' + host, { method: 'DELETE' });
      const none = await fetchA(BASE + '/api/sites/' + host + '/session-test', { method: 'POST' });
      need(none.status === 400, '没有 cookie 时应 400：' + none.status);

      /* 同一个自检要能认 UNIT3D 的登录态（探测路径是 /，页面靠退出链接判断） */
      const u3dHost = 'u3d.example';
      fs.writeFileSync(path.join(defDir, u3dHost + '.json'), JSON.stringify({ host: u3dHost, base: 'http://127.0.0.1:' + port, engine: 'unit3d' }));
      await fetchA(BASE + '/api/credentials/' + u3dHost, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'session=u3d-good' })
      });
      const u3 = await (await fetchA(BASE + '/api/sites/' + u3dHost + '/session-test', { method: 'POST' })).json();
      need(u3.data.pass === true, 'UNIT3D 有效 cookie 判失效：' + JSON.stringify(u3.data).slice(0, 180));
      need(u3.data.engine === 'unit3d' && u3.data.probe === '/', 'UNIT3D 探测路径不对：' + JSON.stringify(u3.data).slice(0, 140));
      await fetchA(BASE + '/api/credentials/' + u3dHost, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'session=nope' })
      });
      const u3bad = await (await fetchA(BASE + '/api/sites/' + u3dHost + '/session-test', { method: 'POST' })).json();
      need(u3bad.data.pass === false, 'UNIT3D 失效 cookie 判成功');
      await fetchA(BASE + '/api/credentials/' + u3dHost, { method: 'DELETE' });

      /* login.test 选择器：通用判定认不出的会员区链接，靠定义里的 test.selector 判活 */
      const mHost = 'member.example';
      fs.writeFileSync(path.join(defDir, mHost + '.json'), JSON.stringify({
        host: mHost, base: 'http://127.0.0.1:' + port, engine: 'nexusphp',
        login: { method: 'cookie', test: { path: '/index.php', selector: 'a[href*="member-area.php"]' } }
      }));
      await fetchA(BASE + '/api/credentials/' + mHost, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'member=1' })
      });
      const mOk = await (await fetchA(BASE + '/api/sites/' + mHost + '/session-test', { method: 'POST' })).json();
      need(mOk.data.pass === true, 'login.test 选择器没起作用：' + JSON.stringify(mOk.data).slice(0, 160));
    } finally {
      mock.close();
    }
  });

  await check('批量导入 cookie', async () => {
    const r = await fetchA(BASE + '/api/credentials/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookies: { 'bulk1.example': 'uid=a; pass=b', 'bulk2.example': 'uid=c', 'bad host!': 'x=1', 'bulk3.example': '' } })
    });
    const j = await r.json();
    need(r.ok, '批量导入失败 ' + JSON.stringify(j).slice(0, 140));
    need(j.data.saved === 2, '保存数量不对：' + j.data.saved);
    need(j.data.skipped === 2, '跳过数量不对：' + j.data.skipped);
    const raw = fs.readFileSync(path.join(DATA, 'credentials.json'), 'utf8');
    need(raw.indexOf('uid=a') < 0 && raw.indexOf('uid=c') < 0, '磁盘上出现明文 cookie');
    const list = await (await fetchA(BASE + '/api/credentials')).json();
    const hosts = (list.data || []).map(x => x.host);
    need(hosts.indexOf('bulk1.example') >= 0 && hosts.indexOf('bulk2.example') >= 0, '导入后列表里没有');
    const one = await (await fetchA(BASE + '/api/credentials')).json();
    const hit = (one.data || []).filter(x => x.host === 'bulk1.example')[0];
    need(hit && hit.hasCookie === true && JSON.stringify(hit).indexOf('uid=a') < 0, '回包里带出了 cookie 值');
    const empty = await fetchA(BASE + '/api/credentials/import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookies: {} })
    });
    need(empty.status === 400, '空导入应 400：' + empty.status);
    const anon = await fetch(BASE + '/api/credentials/import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookies: { 'x.example': 'a=1' } })
    });
    need(anon.status === 401, '未登录能批量导入：' + anon.status);
  });

  await check('本地查重（不联网）', async () => {
    const add = await fetchA(BASE + '/api/library', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2021 2160p UHD Blu-ray', year: 2021, res: '2160p', size: '44.10 GB', site: 'example.org' })
    });
    const lib = await add.json();
    need(add.ok, '本地库新增失败 ' + JSON.stringify(lib).slice(0, 140));

    const same = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2021 2160p UHD Blu-ray AVC', year: 2021, res: '2160p', size: '44.20 GB', site: 'example.org' })
    });
    const sid = (await same.json()).data.id;
    const dup = await fetchA(BASE + '/api/queue/' + sid + '/check', { method: 'POST' });
    const dj = await dup.json();
    need(dup.ok, '查重接口失败 ' + JSON.stringify(dj).slice(0, 140));
    need(dj.data.duplicate === true, '同名同分辨率没有判重');
    need(dj.data.matches.some(m => m.source === 'library'), '没匹配到本地库');
    need(/已有同片/.test(dj.data.item.check), '条目上的查重文案没更新：' + dj.data.item.check);
    need(dj.data.matches[0].reason && dj.data.matches[0].reason.length > 0, '没给出判定理由');

    /* 同名同分辨率但体积差太多：不是同一个版本，不能判重 */
    const bigDiff = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2021 2160p UHD Blu-ray', year: 2021, res: '2160p', size: '8.20 GB', site: 'example.org' })
    });
    const bdId = (await bigDiff.json()).data.id;
    const bd = await (await fetchA(BASE + '/api/queue/' + bdId + '/check', { method: 'POST' })).json();
    need(bd.data.duplicate === false, '体积差 80% 还判成重复');

    /* infohash 相同就是同一条，标题不一样也认 */
    await fetchA(BASE + '/api/library', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hash Fixture One 2020 1080p', infohash: 'a'.repeat(40), size: '10.00 GB' })
    });
    const hashItem = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hash Fixture Two 2020 1080p Something Else', infohash: 'a'.repeat(40), size: '10.00 GB' })
    });
    const hid = (await hashItem.json()).data.id;
    const hd = await (await fetchA(BASE + '/api/queue/' + hid + '/check', { method: 'POST' })).json();
    need(hd.data.duplicate === true, 'infohash 相同却没判重');
    need(hd.data.matches.some(m => /infohash/.test(m.reason || '')), 'infohash 判定没写进理由：' + JSON.stringify(hd.data.matches).slice(0, 160));

    const other = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Totally Different Film 1999 1080p Blu-ray', year: 1999, res: '1080p', size: '8.10 GB' })
    });
    const oid = (await other.json()).data.id;
    const clean = await (await fetchA(BASE + '/api/queue/' + oid + '/check', { method: 'POST' })).json();
    need(clean.data.duplicate === false, '不同片被误判为重复');
    need(clean.data.item.check === '无重复', '无重复文案不对：' + clean.data.item.check);

    const yearDiff = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2021 2160p UHD Blu-ray', year: 1990, res: '2160p' })
    });
    const yid = (await yearDiff.json()).data.id;
    const yd = await (await fetchA(BASE + '/api/queue/' + yid + '/check', { method: 'POST' })).json();
    need(yd.data.duplicate === false, '年份不同却判成重复');

    await fetchA(BASE + '/api/library/' + lib.data.id, { method: 'DELETE' });
    await fetchA(BASE + '/api/queue/' + sid, { method: 'DELETE' });
    await fetchA(BASE + '/api/queue/' + oid, { method: 'DELETE' });
    await fetchA(BASE + '/api/queue/' + yid, { method: 'DELETE' });
    const anon = await fetch(BASE + '/api/library');
    need(anon.status === 401, '未登录能读本地库：' + anon.status);
  });

  await check('抓取：一次 GET 入库，并守住 30 秒间隔', async () => {
    const http = require('http');
    const page = fs.readFileSync(path.join(ROOT, 'fixtures', 'nexusphp-browse.html'), 'utf8');
    let hits = 0;
    const mock = http.createServer((rq, rs) => {
      hits++;
      if ((rq.headers.cookie || '').indexOf('c_secure_uid=good') < 0) { rs.writeHead(302, { location: '/takelogin.php' }); rs.end(); return; }
      rs.writeHead(200, { 'content-type': 'text/html' });
      rs.end(page);
    });
    await new Promise(r => mock.listen(0, '127.0.0.1', r));
    const port = mock.address().port;
    const chost = 'crawl.example';
    const cdef = path.join(DATA, 'site-defs', chost + '.json');
    fs.writeFileSync(cdef, JSON.stringify({
      host: chost, base: 'http://127.0.0.1:' + port, engine: 'nexusphp', searchPath: '/torrents.php',
      params: { search: 'search' }, catMode: 'single', catSlot: 1,
      catMap: [{ id: '401', label: '电影', purpose: 'movie' }]
    }));
    try {
      await fetchA(BASE + '/api/credentials/' + chost, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'c_secure_uid=good' })
      });
      const plan = await (await fetchA(BASE + '/api/crawl/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost })
      })).json();
      need(plan.ok && /torrents\.php/.test(plan.data.url), '抓取计划没生成：' + JSON.stringify(plan).slice(0, 160));
      need(plan.data.minGapMs === 30000 && plan.data.dailyMax === 20, '抓取节奏约束不对：' + JSON.stringify({ gap: plan.data.minGapMs, max: plan.data.dailyMax }));

      /* 站点单独设置：间隔与每天次数按站点覆盖走，且被全局上限压住 */
      await fetchA(BASE + '/api/site-config/' + chost, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ override: true, ovDaily: 2, ovInterval: '1 分钟' })
      });
      const plan2 = await (await fetchA(BASE + '/api/crawl/plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost })
      })).json();
      need(plan2.data.minGapMs === 60000 && plan2.data.dailyMax === 2, '站点覆盖没生效：' + JSON.stringify(plan2.data).slice(0, 160));
      await fetchA(BASE + '/api/site-config/' + chost, { method: 'DELETE' });

      const run = await (await fetchA(BASE + '/api/crawl/run', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost })
      })).json();
      need(run.ok, '抓取失败：' + JSON.stringify(run).slice(0, 200));
      need(run.data.rows > 0 && run.data.added > 0, '抓回来没入库：' + JSON.stringify(run.data).slice(0, 160));
      need(hits === 1, '一次抓取只能发一次请求，实际 ' + hits + ' 次');

      const again = await fetchA(BASE + '/api/crawl/run', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost })
      });
      need(again.status === 429, '30 秒内第二次抓取没被拦住：' + again.status);
      const st = await (await fetchA(BASE + '/api/crawl/status?host=' + chost)).json();
      need(st.ok && st.data.count === 1 && st.data.page === 1, '抓取状态没记住：' + JSON.stringify(st.data).slice(0, 160));
      need(st.data.nextPage === undefined && st.data.waitMs > 0, '冷却剩余时间不对：' + JSON.stringify(st.data).slice(0, 120));
      need(st.data.catIdx === 0 && /401/.test(String(st.data.catId || '')), '类目索引没记住：' + JSON.stringify(st.data).slice(0, 120));
      const ov2 = await (await fetchA(BASE + '/api/stats/overview')).json();
      need(ov2.data.crawl && ov2.data.crawl.runsToday >= 1, '系统状态没统计今日抓取次数：' + JSON.stringify(ov2.data.crawl));

      /* 同一站并发抓取：第二个必须被拦（409 BUSY），不能绕过 30 秒间隔打两发 */
      const chost2 = 'crawlbusy.example';
      fs.writeFileSync(path.join(DATA, 'site-defs', chost2 + '.json'), JSON.stringify({
        host: chost2, base: 'http://127.0.0.1:' + port, engine: 'nexusphp', searchPath: '/torrents.php',
        params: { search: 'search' }, catMode: 'single', catSlot: 1, catMap: [{ id: '401', label: '电影', purpose: 'movie' }]
      }));
      await fetchA(BASE + '/api/credentials/' + chost2, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'c_secure_uid=good' })
      });
      const two = await Promise.all([
        fetchA(BASE + '/api/crawl/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost2 }) }),
        fetchA(BASE + '/api/crawl/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost2 }) })
      ]);
      const codes = two.map(r => r.status).sort();
      need(codes.indexOf(409) >= 0, '并发抓取没被拦住：' + codes.join('/'));
      try { fs.unlinkSync(path.join(DATA, 'site-defs', chost2 + '.json')); } catch (e) {}

      /* 登录失效也要记时间戳：立刻重试应该被 30 秒间隔挡住，而不是再打一次站点 */
      const chost3 = 'crawl401.example';
      fs.writeFileSync(path.join(DATA, 'site-defs', chost3 + '.json'), JSON.stringify({
        host: chost3, base: 'http://127.0.0.1:' + port, engine: 'nexusphp', searchPath: '/torrents.php',
        params: { search: 'search' }, catMode: 'single', catSlot: 1, catMap: [{ id: '401', label: '电影', purpose: 'movie' }]
      }));
      await fetchA(BASE + '/api/credentials/' + chost3, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'wrong=1' })
      });
      const r1 = await fetchA(BASE + '/api/crawl/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost3 }) });
      need(r1.status === 409, 'cookie 失效应返回 409，实际 ' + r1.status);
      const r2 = await fetchA(BASE + '/api/crawl/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: chost3 }) });
      need(r2.status === 429, '失败后立刻重试没被间隔挡住：' + r2.status);
      try { fs.unlinkSync(path.join(DATA, 'site-defs', chost3 + '.json')); } catch (e) {}
      const list = await (await fetchA(BASE + '/api/catalog?q=&limit=5')).json();
      need(list.data.total > 0, '词条库里没有抓回来的数据');
    } finally {
      try { fs.unlinkSync(cdef); } catch (e) {}
      mock.close();
    }
  });

  await check('发布草稿组装：标题/副标题/标签/缺项提醒', async () => {
    const add = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Draft Fixture 2020 1080p Blu-ray AVC DTS-HD MA 5.1-中字', res: '1080p', site: 'example.org', cn: '测试副标题' })
    });
    const qid = (await add.json()).data.id;
    const prev = await (await fetchA(BASE + '/api/publish/preview?id=' + qid)).json();
    need(prev.ok, '草稿接口失败：' + JSON.stringify(prev).slice(0, 160));
    const d = prev.data;
    need(/2020/.test(d.intro) && d.year === 2020, '简介里没带年份：' + JSON.stringify(d).slice(0, 160));
    need(d.subtitle === '测试副标题', '副标题没取到：' + d.subtitle);
    need(d.tags.codec === 'H.264', '编码标签不对：' + d.tags.codec);
    need(d.tags.medium === 'Blu-ray', '媒介标签不对：' + d.tags.medium);
    need(d.ready === false, '没给截图/简介时不该算齐全');
    need(d.warnings.some(w => /截图/.test(w)) && d.warnings.some(w => /简介/.test(w)), '截图/简介缺项没提醒：' + JSON.stringify(d.warnings));
    need(d.imageHost === '站内' && d.anonymous === false, '图床/匿名默认值不对：' + JSON.stringify({ imageHost: d.imageHost, anonymous: d.anonymous }));
    need(d.categoryHint && d.categoryHint.purpose === 'movie', '内容类型没猜出来：' + JSON.stringify(d.categoryHint));
    const missing = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Draft Fixture No Year No Res' })
    })).json();
    const p2 = await (await fetchA(BASE + '/api/publish/preview?id=' + missing.data.id)).json();
    need(p2.data.ready === false && p2.data.warnings.some(w => /副标题/.test(w)), '缺项没提醒：' + JSON.stringify(p2.data.warnings));

    /* 发布时把表单字段带上：匿名、图床、副标题、简介要能存进条目 */
    const st = await (await fetchA(BASE + '/api/queue/' + qid + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', anonymous: true, imageHost: 'Pixhost', cn: '改过的副标题', intro: '改过的简介' })
    })).json();
    need(st.ok, '批准失败：' + JSON.stringify(st).slice(0, 140));
    need(st.data && st.data.anonymous === true && st.data.imageHost === 'Pixhost', '表单字段没存进条目：' + JSON.stringify(st.data || {}).slice(0, 160));
  });

  await check('筛选：入选送待审核，已有与不符的跳过', async () => {
    /* 先放一条本地库已有的同片，筛选时应该被判「已有」 */
    await fetchA(BASE + '/api/library', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Screen Fixture A 2022 1080p BluRay', year: 2022, res: '1080p', size: '20.00 GB' })
    });
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'screen.example', siteId: '1', title: 'Screen Fixture A 2022 1080p BluRay x264-GRP', res: '1080p', sizeBytes: 21474836480 },
        { site: 'screen.example', siteId: '2', title: 'Screen Fixture B 2023 2160p WEB-DL', res: '2160p', sizeBytes: 64424509440 },
        { site: 'screen.example', siteId: '3', title: 'Screen Fixture C 2021 720p HDTV', res: '720p', sizeBytes: 1073741824 }
      ] })
    });
    const run = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'screen.example', limit: 10, rules: { res: ['1080p', '2160p'] } })
    })).json();
    need(run.ok, '筛选接口失败：' + JSON.stringify(run).slice(0, 160));
    need(run.data.checked === 3, '筛选条数不对：' + run.data.checked);
    need(run.data.selected === 1, '应只入选 1 条（1080p 那条已有、720p 不符），实际 ' + run.data.selected + '：' + JSON.stringify(run.data.byReason));
    need(run.data.skipped === 2, '跳过条数不对：' + run.data.skipped);
    const q = await (await fetchA(BASE + '/api/queue')).json();
    need(q.data.items.some(x => x.catalogId && x.note && /词条库/.test(x.note)), '入选的词条没进待审核');
    const cat = await (await fetchA(BASE + '/api/catalog?status=selected')).json();
    need(cat.data.items.some(x => x.site === 'screen.example'), '入选后词条状态没变成 selected');

    /* 按单条送审（数据清单行内「送审」用的就是 ids 过滤） */
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'screen.example', siteId: '9', title: 'Screen Fixture D 2024 1080p BluRay', res: '1080p', sizeBytes: 21474836480 }] })
    });
    const only = await (await fetchA(BASE + '/api/catalog?q=Screen Fixture D')).json();
    const did = (only.data.items[0] || {}).id;
    need(did, '按条送审的夹具没进库');
    const one = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [did], limit: 10, rules: { res: ['1080p', '2160p'] } })
    })).json();
    need(one.ok && one.data.checked === 1 && one.data.selected === 1, '按条送审没生效：' + JSON.stringify(one.data));

    /* 站点定义里带该站的词条统计 */
    fs.mkdirSync(path.join(DATA, 'site-defs'), { recursive: true });
    fs.writeFileSync(path.join(DATA, 'site-defs', 'screen.example.json'), JSON.stringify({
      host: 'screen.example', engine: 'nexusphp', base: 'https://screen.example'
    }));
    const sd = await (await fetchA(BASE + '/api/site-def/screen.example')).json();
    need(sd.ok && sd.data.catalog && sd.data.catalog.total >= 3, '站点定义没带词条统计：' + JSON.stringify(sd.data && sd.data.catalog));
  });

  await check('词条库导入、去重与状态流转', async () => {
    const add = await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'example.org', siteId: '101', title: 'Catalog Fixture 2023 1080p Blu-ray', size: '20.00 GB', sizeBytes: 21474836480, marks: { noRedistribute: true } },
        { site: 'example.org', siteId: '102', title: 'Catalog Fixture Two 2024 2160p', size: '60.00 GB' }
      ] })
    });
    const aj = await add.json();
    need(add.ok && aj.data.added === 2, '导入词条失败：' + JSON.stringify(aj).slice(0, 160));

    /* 同站同 id 再导一次＝更新，不新增 */
    const again = await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'example.org', siteId: '101', title: 'Catalog Fixture 2023 1080p Blu-ray REPACK', size: '20.10 GB' }] })
    })).json();
    need(again.data.added === 0 && again.data.updated === 1, '重复导入没按更新处理：' + JSON.stringify(again.data));

    const list = await (await fetchA(BASE + '/api/catalog?q=Catalog')).json();
    need(list.ok && list.data.total >= 2, '词条列表不对：' + JSON.stringify(list.data).slice(0, 160));
    need(list.data.byStatus.new >= 2, '新词条状态不对：' + JSON.stringify(list.data.byStatus));
    /* 列表要带 matched：分页与筛选后条数都靠它，不能只给总数 */
    need(list.data.matched === list.data.items.length && list.data.matched >= 2, '列表没给 matched 计数：' + JSON.stringify({ matched: list.data.matched, items: list.data.items.length }));
    const siteFiltered = await (await fetchA(BASE + '/api/catalog?site=example.org&limit=5')).json();
    need(siteFiltered.ok && siteFiltered.data.items.every(x => x.site === 'example.org'), '按站点过滤没生效：' + JSON.stringify(siteFiltered.data.items.map(x => x.site)));
    const id = list.data.items[0].id;
    need(!!id, '词条没有 id');

    const st = await (await fetchA(BASE + '/api/catalog/' + id + '/status', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'selected' })
    })).json();
    need(st.ok && st.data.status === 'selected', '状态没改过来：' + JSON.stringify(st).slice(0, 140));
    const bad = await fetchA(BASE + '/api/catalog/' + id + '/status', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'not-a-status' })
    });
    need(bad.status === 400, '非法状态没被拒：' + bad.status);

    const ov = await (await fetchA(BASE + '/api/stats/overview')).json();
    need(ov.data.catalog && ov.data.catalog.total >= 2, '系统状态里没有词条库统计：' + JSON.stringify(ov.data.catalog));

    const del = await fetchA(BASE + '/api/catalog/' + id, { method: 'DELETE' });
    need(del.ok, '删除词条失败');

    /* 手工改标记：解析没识别出来时人能补 */
    const mkItem = await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'mark.example', siteId: '7', title: 'Mark Fixture 2020 1080p', marks: {} }] })
    })).json();
    const mkList = await (await fetchA(BASE + '/api/catalog?q=Mark Fixture')).json();
    const mkId = mkList.data.items[0].id;
    const mk = await (await fetchA(BASE + '/api/catalog/' + mkId + '/marks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marks: { noRedistribute: true, diy: true, nonsense: true } })
    })).json();
    need(mk.ok && mk.data.marks.noRedistribute === true && mk.data.marks.diy === true, '标记没写上：' + JSON.stringify(mk).slice(0, 140));
    need(!mk.data.marks.nonsense, '不认识的标记不该写进去：' + JSON.stringify(mk.data.marks));

    /* 批量：把 skipped 的全部归档 */
    const bulk = await (await fetchA(BASE + '/api/catalog/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromStatus: 'new', status: 'archived' })
    })).json();
    need(bulk.ok && bulk.data.changed >= 1, '批量归档没生效：' + JSON.stringify(bulk).slice(0, 140));
    const after = await (await fetchA(BASE + '/api/catalog?status=archived')).json();
    need(after.data.total >= 1, '批量归档后查不到 archived：' + after.data.total);
  });

  await check('待审核队列校验与鉴权', async () => {    const empty = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cn: '只有中文名' })
    });
    need(empty.status === 400, '没有 title 却新增成功：' + empty.status);
    const bad = await fetchA(BASE + '/api/queue/q_9999/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' })
    });
    need(bad.status === 404, '不存在的条目返回 ' + bad.status);
    const anon = await fetch(BASE + '/api/queue');
    need(anon.status === 401, '未登录能读队列：' + anon.status);

    /* 批量批准：pending 一次过，不许跳过状态机 */
    const mk = async (t) => (await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: t })
    })).json()).data.id;
    const idA = await mk('Bulk Fixture A 2020 1080p');
    const idB = await mk('Bulk Fixture B 2021 1080p');
    const bulk = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', ids: [idA, idB] })
    })).json();
    need(bulk.ok && bulk.data.changed === 2, '批量批准没生效：' + JSON.stringify(bulk).slice(0, 140));
    const after = await (await fetchA(BASE + '/api/queue?status=approved')).json();
    need(after.data.items.filter(x => x.id === idA || x.id === idB).length === 2, '批量批准后状态不对');
    const noReason = await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', ids: [idA] })
    });
    need(noReason.status === 400, '批量驳回没写理由却通过：' + noReason.status);

    /* 批量发布：只处理 approved 的；发布闸门要求至少一个下载器，先临时建一个再删掉 */
    const dlTmp = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '批量发布用', url: 'http://127.0.0.1:9' })
    })).json();
    need(dlTmp.ok, '准备临时下载器失败：' + JSON.stringify(dlTmp).slice(0, 120));
    const pubBulk = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', ids: [idA, idB] })
    })).json();
    need(pubBulk.ok && pubBulk.data.changed === 2, '批量发布没生效：' + JSON.stringify(pubBulk).slice(0, 140));
    const pubList = await (await fetchA(BASE + '/api/queue?status=published')).json();
    need(pubList.data.items.filter(x => x.id === idA || x.id === idB).length === 2, '批量发布后状态不对');
    await fetchA(BASE + '/api/downloaders/' + dlTmp.data.id, { method: 'DELETE' });

    /* 跳过：要走服务端状态，刷新后不能又回到待确认 */
    const idSkip = await mk('Bulk Fixture Skip 2022 1080p');
    const sk = await (await fetchA(BASE + '/api/queue/' + idSkip + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'skip' })
    })).json();
    need(sk.ok && sk.data.status === 'skipped', '跳过没落到服务端：' + JSON.stringify(sk).slice(0, 140));
  });

  await check('演练任务能提交并跑完', async () => {
    const r = await fetchA(BASE + '/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'crawl', siteHost: 'task.example', dryRun: true })
    });
    const j = await r.json();
    need(r.ok, '提交失败 ' + JSON.stringify(j));
    need(/^t_/.test(j.data.id), '任务 id 不合法：' + j.data.id);
    need(j.data.dryRun === true, '任务没有被标成演练');
    need(Array.isArray(j.data.steps) && j.data.steps.length >= 3, 'steps 结构不对');
    const done = await waitTask(j.data.id, 6000);
    need(done.state === 'done', '任务最终状态是 ' + done.state);
    need(done.progress === 100, '完成时进度是 ' + done.progress);
    need(done.steps.every(s => s.state === 'done'), '还有没走完的步骤');
    need(done.result && done.result.dryRun === true, '没有标注演练结果');
    const list = await (await fetchA(BASE + '/api/tasks')).json();
    need(Array.isArray(list.data) && list.data.some(t => t.id === j.data.id), '任务列表里找不到刚提交的任务');
  });

  await check('演练计划随配置变化', async () => {
    const host = 'plan.example';
    /* 给这台临时实例塞一份站点定义，验证搜索 URL 是按定义拼出来的 */
    const defDir = path.join(DATA, 'site-defs');
    fs.mkdirSync(defDir, { recursive: true });
    fs.writeFileSync(path.join(defDir, host + '.json'), JSON.stringify({
      host: host, base: 'https://' + host, engine: 'nexusphp',
      searchPath: '/torrents.php',
      params: { search: '{q}', search_area: '0', search_mode: '0', cat: '{cats}' },
      catMode: 'single',
      cats: { movie: ['1', '2'], tv: ['3'] }
    }));
    await fetchA(BASE + '/api/site-config/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pages: 3, concurrency: 2, interval: 45, enabled: true })
    });
    await fetchA(BASE + '/api/sites/' + host + '/search', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engine: 'nexusphp', cats: { movie: ['1', '2'], tv: ['3'] } })
    });
    const r = await fetchA(BASE + '/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'crawl', siteHost: host, dryRun: true })
    });
    const j = await r.json();
    need(r.ok, '提交失败 ' + JSON.stringify(j).slice(0, 140));
    const plan = j.data.plan;
    need(plan, '任务没有带计划');
    need(plan.pages === 3 && plan.concurrency === 2, '计划没读到站点配置：' + JSON.stringify(plan).slice(0, 140));
    need(plan.catGroups === 2 && plan.catIds === 3, '计划里的分类统计不对：' + JSON.stringify(plan).slice(0, 160));
    need(plan.estimatedQueries === 9, '预估查询数不对（3 个分类 id × 3 页）：' + plan.estimatedQueries);
    need(plan.inList === false, '不存在的站点却标成在清单里');
    need(Array.isArray(plan.warnings) && plan.warnings.length > 0, '缺警告');
    need(Array.isArray(plan.searchUrls) && plan.searchUrls.length === 3, '搜索 URL 条数不对（每个分类 id 一条）：' + JSON.stringify(plan.searchUrls || []).slice(0, 160));
    const u = plan.searchUrls[0].url;
    need(u.indexOf('https://' + host + '/torrents.php?') === 0, '搜索 URL 前缀不对：' + u);
    need(/cat=1/.test(u) && /search=%7Bq%7D/.test(u), '搜索 URL 参数不对：' + u);
    const done = await waitTask(j.data.id, 6000);
    need(done.result && Array.isArray(done.result.warnings), '完成后没有带回警告');
    need(done.result.warnings.length === plan.warnings.length, '完成后警告数量变了');
  });

  await check('同站点并发任务返回 409', async () => {
    const body = JSON.stringify({ type: 'crawl', siteHost: 'busy.example', dryRun: true });
    const first = await fetchA(BASE + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    need(first.ok, '第一个任务就失败了 ' + first.status);
    const second = await fetchA(BASE + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    need(second.status === 409, '并发提交状态码是 ' + second.status);
    const j = await second.json();
    need(j.error && j.error.code === 'BUSY', '错误码不对：' + JSON.stringify(j));
    const id = (await first.json()).data.id;
    const cancel = await fetchA(BASE + '/api/tasks/' + id + '/cancel', { method: 'POST' });
    const cj = await cancel.json();
    need(cancel.ok && cj.data.state === 'canceled', '取消没有生效：' + JSON.stringify(cj));
  });

  await check('非演练任务被拒绝', async () => {
    const r = await fetchA(BASE + '/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'crawl', siteHost: 'real.example', dryRun: false })
    });
    need(r.status === 501, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.error && j.error.code === 'DRY_RUN_ONLY', '错误码不对：' + JSON.stringify(j));
    const bad = await fetchA(BASE + '/api/tasks/t_9999', { method: 'GET' });
    need(bad.status === 404, '不存在的任务返回 ' + bad.status);
  });

  await check('日志过滤', async () => {
    const all = await (await fetchA(BASE + '/api/logs?limit=100')).json();
    need(all.ok && Array.isArray(all.data), '日志结构不对');
    need(all.data.length > 0, '一条日志都没有');
    need(all.meta && all.meta.total >= all.data.length, 'meta 不对');
    const warns = await (await fetchA(BASE + '/api/logs?level=warn&limit=50')).json();
    need(warns.data.every(x => x.level === 'warn'), 'level 过滤没生效');
    const two = await (await fetchA(BASE + '/api/logs?limit=2')).json();
    need(two.data.length <= 2, 'limit 没生效：' + two.data.length);
    const lastId = two.data.length ? two.data[two.data.length - 1].id : 0;
    const newer = await (await fetchA(BASE + '/api/logs?since=' + lastId)).json();
    need(newer.data.every(x => x.id > lastId), 'since 过滤没生效');
    const bySrc = await (await fetchA(BASE + '/api/logs?src=服务&limit=10')).json();
    need(bySrc.data.every(x => String(x.src).indexOf('服务') >= 0), 'src 过滤没生效');
  });

  await check('日志文件会轮转', async () => {
    const rotatedFile = path.join(DATA, 'events.log.1');
    let rotated = fs.existsSync(rotatedFile);
    for (let i = 0; i < 150 && !rotated; i++) {
      await fetch(BASE + '/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'check', pass: 'wrong-' + i })
      });
      rotated = fs.existsSync(rotatedFile);
    }
    need(rotated, '日志超过上限却没有轮转');
    /* 轮转刚发生时主文件可能还没重建，按 0 计；主文件最多是上限再加一行 */
    const logPath = path.join(DATA, 'events.log');
    const now = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
    need(now <= 1500 + 300, '轮转后主文件仍然超过上限：' + now);
  });

  await check('登录失败返回 401', async () => {
    const r = await fetch(BASE + '/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'check', pass: 'wrong' })
    });
    need(r.status === 401, '错误密码状态码是 ' + r.status);
  });

  await check('登录成功发会话 cookie', async () => {
    const r = await fetch(BASE + '/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'check', pass: 'check-pass' })
    });
    need(r.ok, '登录失败 ' + r.status);
    const cookie = r.headers.get('set-cookie') || '';
    need(/pta_sid=/.test(cookie), '没有下发 pta_sid');
    need(/HttpOnly/i.test(cookie), 'cookie 没有 HttpOnly');
    const session = await fetch(BASE + '/api/session', { headers: { cookie: cookie.split(';')[0] } });
    need(session.ok, '带 cookie 读会话失败');
    const noCookie = await fetch(BASE + '/api/session');
    need(noCookie.status === 401, '不带会话居然能读');
  });

  await check('未登录访问接口返回 401', async () => {
    const r = await fetch(BASE + '/api/config');
    need(r.status === 401, '未登录状态码是 ' + r.status);
    const j = await r.json();
    need(j.error && j.error.code === 'UNAUTHORIZED', '错误码不对：' + JSON.stringify(j));
    const home = await fetch(BASE + '/');
    need(home.ok, '静态页面应保持可打开，由前端弹登录页');
  });

  await check('登录后可以打开面板', async () => {
    const r = await fetchA(BASE + '/');
    need(r.ok && /SEEDPOD/.test(await r.text()), '登录后拿不到首页');
    const bad = await fetch(BASE + '/api/config', { headers: { authorization: 'Basic ' + Buffer.from('check:wrong').toString('base64') } });
    need(bad.status === 401, '错误密码居然通过');
    const health = await fetch(BASE + '/api/health');
    need(health.ok, '健康检查不应要求登录');
  });

  await check('发布记账：词条标已发布并留记录', async () => {
    const catAdd = await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: '', siteId: 'pub1', title: 'Publish Fixture 2025 2160p 原盘 中字', res: '2160p', size: '60.00 GB' }] })
    })).json();
    need(catAdd.ok && catAdd.data.added === 1, '准备词条失败');
    const list = await (await fetchA(BASE + '/api/catalog?q=Publish Fixture')).json();
    const cid = list.data.items[0].id;

    const dl = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '记账用下载器', url: 'http://127.0.0.1:9' })
    })).json();
    need(dl.ok, '准备下载器失败：' + JSON.stringify(dl).slice(0, 120));

    const q = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Publish Fixture 2025 2160p 原盘 中字', res: '2160p', size: '60.00 GB', site: 'source.example', targetSite: '主站', catalogId: cid, anonymous: true, imageHost: 'Imgbox',
        shots: [{ name: 'a.jpg', url: 'data:image/jpeg;base64,AAAA' }, { name: 'b.jpg', url: 'data:image/jpeg;base64,BBBB' }, { name: 'c.jpg', url: 'data:image/jpeg;base64,CCCC' }] })
    })).json();
    const qid = q.data.id;
    const app = await fetchA(BASE + '/api/queue/' + qid + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' })
    });
    need(app.ok, '批准失败：' + JSON.stringify(await app.json()).slice(0, 140));
    const pub = await fetchA(BASE + '/api/queue/' + qid + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
    });
    const pj = await pub.json();
    need(pub.ok, '发布失败：' + JSON.stringify(pj).slice(0, 160));

    const rec = await (await fetchA(BASE + '/api/published')).json();
    need(rec.ok && rec.data.total >= 1, '没有发布记录');
    const hit = rec.data.items.filter(x => x.queueId === qid)[0];
    need(hit && hit.anonymous === true && hit.imageHost === 'Imgbox', '发布记录字段没带上：' + JSON.stringify(hit || {}).slice(0, 160));
    need(hit.site === '主站' && hit.sourceSite === 'source.example', '发布记录的站点应该是目标站：' + JSON.stringify({ site: hit.site, from: hit.sourceSite }));
    const qAfter = await (await fetchA(BASE + '/api/queue/' + qid)).json();
    const qHit = qAfter.data;
    need(qHit && Array.isArray(qHit.shots) && qHit.shots.length === 3 && qHit.shots[0].url, '截图没存进条目：' + JSON.stringify((qHit || {}).shots).slice(0, 160));

    const cat = await (await fetchA(BASE + '/api/catalog?status=published')).json();
    if (!cat.data.items.some(x => x.id === cid)) {
      const all = await (await fetchA(BASE + '/api/catalog?q=Publish Fixture')).json();
      need(false, '词条没标成已发布，状态：' + JSON.stringify((all.data.items[0] || {}).status) + ' / archived ' + (await (await fetchA(BASE + '/api/catalog?status=archived')).json()).data.total);
    }
    await fetchA(BASE + '/api/downloaders/' + dl.data.id, { method: 'DELETE' });
  });

  await check('筛选条件取自面板配置', async () => {
    const rows = [
      { v: '2160p 及以上', on: false, sel: [] },
      { v: '20 GB 起', on: false, sel: [] },
      { v: '不限', on: false, sel: [] },
      { v: '', on: false, sel: [] },
      { v: '', on: false, sel: [] },
      { v: '', on: true, sel: [] }
    ];
    const save = await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: { dedupe: [rows] } })
    });
    need(save.ok, '保存筛选条件失败');
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'flow.example', siteId: '1', title: 'Flow Fixture Low 2024 1080p', res: '1080p', sizeBytes: 32212254720 },
        { site: 'flow.example', siteId: '2', title: 'Flow Fixture NoZh 2024 2160p', res: '2160p', sizeBytes: 64424509440 },
        { site: 'flow.example', siteId: '3', title: 'Flow Fixture Good 2024 2160p 中字', res: '2160p', sizeBytes: 64424509440 }
      ] })
    });
    const run = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'flow.example', limit: 10 })
    })).json();
    need(run.ok, '按面板条件筛选失败：' + JSON.stringify(run).slice(0, 160));
    need(run.data.selected === 1, '面板条件没生效，入选 ' + run.data.selected + '：' + JSON.stringify(run.data.byReason));
    const reasons = JSON.stringify(run.data.byReason);
    need(/分辨率/.test(reasons) && /中字/.test(reasons), '跳过原因不对：' + reasons);
    await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: { dedupe: [[]] } }) });

    /* 已经送审过的同一条，从别的站再抓到时不该重复入选 */
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'other.example', siteId: '9', title: 'Flow Fixture Good 2024 2160p 中字', res: '2160p', sizeBytes: 64424509440 }] })
    });
    const run2 = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'other.example', limit: 10 })
    })).json();
    need(run2.ok && run2.data.selected === 0 && /已有/.test(JSON.stringify(run2.data.byReason)), '已送审的词条被重复入选：' + JSON.stringify(run2.data));
  });

  await check('查重接口把重复词条标成已有', async () => {
    const lib = await (await fetchA(BASE + '/api/library', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Dup Fixture 2023 1080p Blu-ray AVC DTS-HD MA 5.1-GRP', site: 'lib.example', size: '21.50 GB' })
    })).json();
    const libId = lib.data && lib.data.id;
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'dup.example', siteId: '11', title: 'Dup Fixture 2023 1080p Blu-ray AVC DTS-HD MA 5.1-GRP', res: '1080p', size: '21.50 GB' },
        { site: 'dup.example', siteId: '12', title: 'Dup Fixture Unique 2024 2160p WEB-DL HDR', res: '2160p', size: '18.00 GB' }
      ] })
    });
    const out = await (await fetchA(BASE + '/api/catalog/check', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'dup.example' })
    })).json();
    need(out.ok && out.data.checked === 2 && out.data.dup === 1, '查重结果不对：' + JSON.stringify(out).slice(0, 200));
    need(/Dup Fixture 2023/.test(out.data.items[0].hit.title), '查重没指到撞的那条：' + JSON.stringify(out.data.items[0]));
    const cat = await (await fetchA(BASE + '/api/catalog?site=dup.example')).json();
    const rows = cat.data.items;
    need(rows.some(x => x.siteId === '11' && x.marks && x.marks.existing === true), '重复词条没标已有');
    need(rows.some(x => x.siteId === '11' && /Dup Fixture 2023/.test(String(x.dupNote || ''))), '没记下撞到哪条');
    need(rows.some(x => x.siteId === '12' && !(x.marks && x.marks.existing)), '不重复的词条被标了已有');
    const bulk = await (await fetchA(BASE + '/api/catalog/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'archived', includeDup: true, host: 'dup.example' })
    })).json();
    need(bulk.ok && bulk.data.changed === 1, '批量归档已有项数量不对：' + JSON.stringify(bulk.data));
    const cat2 = await (await fetchA(BASE + '/api/catalog?site=dup.example')).json();
    need(cat2.data.items.some(x => x.siteId === '11' && x.status === 'archived'), '已有项没被归档');
    need(cat2.data.items.some(x => x.siteId === '12' && x.status === 'new'), '不重复的项被误归档');
    for (const r of rows) await fetchA(BASE + '/api/catalog/' + r.id, { method: 'DELETE' });
    if (libId) await fetchA(BASE + '/api/library/' + libId, { method: 'DELETE' });
  });

  await check('批量发布能带默认目标站', async () => {
    const dl = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '批量目标站用', url: 'http://127.0.0.1:9' })
    })).json();
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bulk Target Fixture 2023 1080p', site: 'bulk.example' })
    })).json();
    const qid = add.data.id;
    await fetchA(BASE + '/api/queue/' + qid + '/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
    const noTarget = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', ids: [qid] })
    })).json();
    need(noTarget.data.changed === 0 && noTarget.data.skipped === 1, '没选目标站却被发布：' + JSON.stringify(noTarget.data));
    const withTarget = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', ids: [qid], targetSite: '主站' })
    })).json();
    need(withTarget.data.changed === 1, '带目标站批量发布失败：' + JSON.stringify(withTarget.data));
    const item = await (await fetchA(BASE + '/api/queue/' + qid)).json();
    need(item.data.targetSite === '主站', '目标站没写进条目：' + JSON.stringify(item.data.targetSite));
    if (dl.data) await fetchA(BASE + '/api/downloaders/' + dl.data.id, { method: 'DELETE' });
    await fetchA(BASE + '/api/queue/' + qid, { method: 'DELETE' });
  });

  await check('排除/白名单正则真的参与筛选', async () => {
    await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: {}, rx: { deny: '枪版|CAM', allow: '' } })
    });
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [
        { site: 'rx.example', siteId: '1', title: 'Rx Fixture 2024 1080p BluRay 枪版', res: '1080p', sizeBytes: 21474836480 },
        { site: 'rx.example', siteId: '2', title: 'Rx Fixture 2024 1080p BluRay 中字', res: '1080p', sizeBytes: 21474836480 }
      ] })
    });
    const run = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'rx.example', limit: 10 })
    })).json();
    need(run.ok && /命中排除规则/.test(JSON.stringify(run.data.byReason)), '排除正则没生效：' + JSON.stringify(run.data).slice(0, 200));
    need(run.data.selected === 1, '排除正则组合后应该只剩一条：' + JSON.stringify(run.data));
    const flow = await (await fetchA(BASE + '/api/flow')).json();
    need(flow.data.rx && flow.data.rx.deny === '枪版|CAM', '正则没存进流程配置：' + JSON.stringify(flow.data.rx));
    await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sets: {}, rx: { deny: '', allow: '' } }) });
    const cat = await (await fetchA(BASE + '/api/catalog?site=rx.example')).json();
    for (const r of cat.data.items) await fetchA(BASE + '/api/catalog/' + r.id, { method: 'DELETE' });
  });

  await check('带大截图的请求不会把连接弄挂', async () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(450000);
    const add = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Big Shot Fixture 2024 2160p Blu-ray 中字', res: '2160p', size: '60.00 GB', site: 'src.example',
        shots: [{ name: 'a.jpg', url: big }, { name: 'b.jpg', url: big }, { name: 'c.jpg', url: big }] })
    });
    need(add.ok, '带截图的请求失败了：' + add.status);
    const j = await add.json();
    need(j.data && Array.isArray(j.data.shots) && j.data.shots.length === 3, '截图没存全：' + JSON.stringify((j.data || {}).shots && j.data.shots.length));
    const id = j.data && j.data.id;
    if (id) {
      const list = await (await fetchA(BASE + '/api/queue?limit=5')).json();
      const row = list.data.items.filter(x => x.id === id)[0];
      need(row && row.shots === undefined && row.shotsCount === 3, '列表把截图去掉了但数量不对：' + JSON.stringify(row && { has: !!row.shots, n: row.shotsCount }));
      const one = await (await fetchA(BASE + '/api/queue/' + id)).json();
      need(one.data && one.data.shots && one.data.shots.length === 3, '详情接口没给截图');
    }
    if (id) await fetchA(BASE + '/api/queue/' + id, { method: 'DELETE' });
  });

  child.kill();
  await new Promise(r => setTimeout(r, 200));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}

  for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
  const failed = results.filter(r => !r[0]).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('契约检查自身出错：' + e.message); process.exit(1); });

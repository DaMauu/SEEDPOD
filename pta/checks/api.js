/* 后端契约检查：起一个临时实例，按 docs/API.md 验字段与错误码。
   用法：node pta/checks/api.js（PTA_NODE 指向 node，环境里不需要额外依赖）
   退出码 0 = 全部符合契约，1 = 有不符合，2 = 起不来。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
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
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'pta', 'web'),
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
    const anon = await fetch(BASE + '/api/site-search');
    need(anon.status === 401, '未登录能读汇总：' + anon.status);
  });

  await check('待审核队列状态机', async () => {
    const add = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Check Fixture Movie 2020 1080p Blu-ray AVC', cn: '检查用', res: '1080p', size: '22.10 GB', site: 'example.org' })
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

  await check('凭据加密存储与登录自检', async () => {
    const http = require('http');
    const mock = http.createServer((rq, rs) => {
      if (rq.method === 'POST' && rq.url === '/takelogin.php') {
        let body = '';
        rq.on('data', c => { body += c; });
        rq.on('end', () => {
          const ok = /username=check-user/.test(body) && /password=check-pass/.test(body);
          if (ok) { rs.writeHead(302, { location: '/index.php', 'set-cookie': 'c_secure_uid=abc; Path=/; HttpOnly' }); rs.end(); }
          else { rs.writeHead(200, { 'content-type': 'text/html' }); rs.end('<html>takelogin.php 用户名或密码错误</html>'); }
        });
        return;
      }
      if (rq.url === '/index.php') {
        const cookie = rq.headers.cookie || '';
        rs.writeHead(200, { 'content-type': 'text/html' });
        rs.end(cookie.indexOf('c_secure_uid=abc') >= 0 ? '<html>欢迎回来 <a href="userdetails.php?id=1">ok</a></html>' : '<html>请登录</html>');
        return;
      }
      rs.writeHead(404); rs.end('x');
    });
    await new Promise(r => mock.listen(0, '127.0.0.1', r));
    const port = mock.address().port;
    const host = 'login.example';
    try {
      const defDir = path.join(DATA, 'site-defs');
      fs.mkdirSync(defDir, { recursive: true });
      fs.writeFileSync(path.join(defDir, host + '.json'), JSON.stringify({
        host: host, base: 'http://127.0.0.1:' + port, engine: 'nexusphp',
        login: { path: '/takelogin.php', method: 'POST', fields: { username: 'username', password: 'password' } },
        searchPath: '/torrents.php', params: { search: '{q}', cat: '{cats}' }, catMode: 'single', cats: {}
      }));

      const save = await fetchA(BASE + '/api/credentials/' + host, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'check-user', pass: 'check-pass' })
      });
      const sj = await save.json();
      need(save.ok, '保存凭据失败 ' + JSON.stringify(sj).slice(0, 140));
      need(sj.data.hasPass === true, '没有标记 hasPass');
      need(JSON.stringify(sj).indexOf('check-pass') < 0, '回包里带出了密码');
      const rawFile = fs.readFileSync(path.join(DATA, 'credentials.json'), 'utf8');
      need(rawFile.indexOf('check-pass') < 0, '磁盘上出现了明文密码');

      const list = await (await fetchA(BASE + '/api/credentials')).json();
      need(list.data.some(x => x.host === host && x.hasPass && x.hasTotp === false), '列表结构不对');

      const t = await fetchA(BASE + '/api/sites/' + host + '/login-test', { method: 'POST' });
      const tj = await t.json();
      need(t.ok, '登录自检接口失败 ' + JSON.stringify(tj).slice(0, 200));
      need(tj.data.pass === true, '自检没通过：' + JSON.stringify(tj.data).slice(0, 220));
      need(tj.data.steps.some(s => s.step === 'login' && s.status === 302), '没有登录步骤');
      need(tj.data.cookieNames.indexOf('c_secure_uid') >= 0, '没拿到登录 cookie 名');
      need(JSON.stringify(tj).indexOf('check-pass') < 0, '自检回包里带出了密码');

      const again = await fetchA(BASE + '/api/sites/' + host + '/login-test', { method: 'POST' });
      need(again.status === 429, '60 秒内第二次自检没被限流：' + again.status);

      const del = await fetchA(BASE + '/api/credentials/' + host, { method: 'DELETE' });
      need(del.ok, '删除凭据失败');
      const noCred = await fetchA(BASE + '/api/sites/' + host + '/login-test', { method: 'POST' });
      need(noCred.status === 400, '没有凭据时应该 400：' + noCred.status);
    } finally {
      mock.close();
    }
  });

  await check('cookie 导入与会话自检', async () => {
    const http = require('http');
    const mock = http.createServer((rq, rs) => {
      if (rq.url === '/index.php') {
        const cookie = rq.headers.cookie || '';
        const ok = cookie.indexOf('c_secure_uid=good') >= 0;
        rs.writeHead(ok ? 200 : 302, ok ? { 'content-type': 'text/html' } : { location: '/login.php' });
        rs.end(ok ? '<html>欢迎回来 <a href="userdetails.php?id=1">ok</a></html>' : '');
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
    } finally {
      mock.close();
    }
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

  await check('待审核队列校验与鉴权', async () => {
    const empty = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cn: '只有中文名' })
    });
    need(empty.status === 400, '没有 title 却新增成功：' + empty.status);
    const bad = await fetchA(BASE + '/api/queue/q_9999/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve' })
    });
    need(bad.status === 404, '不存在的条目返回 ' + bad.status);
    const anon = await fetch(BASE + '/api/queue');
    need(anon.status === 401, '未登录能读队列：' + anon.status);
  });

  await check('干跑任务能提交并跑完', async () => {
    const r = await fetchA(BASE + '/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'crawl', siteHost: 'task.example', dryRun: true })
    });
    const j = await r.json();
    need(r.ok, '提交失败 ' + JSON.stringify(j));
    need(/^t_/.test(j.data.id), '任务 id 不合法：' + j.data.id);
    need(j.data.dryRun === true, '任务没有被标成干跑');
    need(Array.isArray(j.data.steps) && j.data.steps.length >= 3, 'steps 结构不对');
    const done = await waitTask(j.data.id, 6000);
    need(done.state === 'done', '任务最终状态是 ' + done.state);
    need(done.progress === 100, '完成时进度是 ' + done.progress);
    need(done.steps.every(s => s.state === 'done'), '还有没走完的步骤');
    need(done.result && done.result.dryRun === true, '没有标注干跑结果');
    const list = await (await fetchA(BASE + '/api/tasks')).json();
    need(Array.isArray(list.data) && list.data.some(t => t.id === j.data.id), '任务列表里找不到刚提交的任务');
  });

  await check('干跑计划随配置变化', async () => {
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
    need(plan.estimatedQueries === 6, '预估查询数不对：' + plan.estimatedQueries);
    need(plan.inList === false, '不存在的站点却标成在清单里');
    need(Array.isArray(plan.warnings) && plan.warnings.length > 0, '缺警告');
    need(Array.isArray(plan.searchUrls) && plan.searchUrls.length === 2, '搜索 URL 条数不对：' + JSON.stringify(plan.searchUrls || []).slice(0, 120));
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

  await check('非干跑任务被拒绝', async () => {
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
    for (let i = 0; i < 40; i++) {
      await fetch(BASE + '/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'check', pass: 'wrong-' + i })
      });
    }
    const rotated = fs.existsSync(path.join(DATA, 'events.log.1'));
    need(rotated, '日志超过上限却没有轮转');
    const now = fs.statSync(path.join(DATA, 'events.log')).size;
    need(now < 1500, '轮转后主文件仍然超过上限：' + now);
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

  child.kill();
  await new Promise(r => setTimeout(r, 200));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}

  for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
  const failed = results.filter(r => !r[0]).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('契约检查自身出错：' + e.message); process.exit(1); });

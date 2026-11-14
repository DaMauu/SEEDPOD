/* SEEDPOD v2 契约检查：起一个临时 Fastify + SQLite 实例，按线上接口验字段与错误码。
   用法：node pta/checks/api-v2.js  退出码 0 全过 / 1 有失败 / 2 起不来 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8097);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-v2-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'check';
const PASS = 'check-pass';

const results = [];
let cookie = '';

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function fetchA(url, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookie) o.headers.cookie = cookie;
  return fetch(url, o);
}
async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, pass: PASS })
  });
  const sc = r.headers.get('set-cookie') || '';
  cookie = sc.split(';')[0];
  return r;
}
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('v2 服务没起来');
}

async function main() {
  const child = spawn(process.env.PTA_NODE || process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web'),
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });

  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill();
    process.exit(2);
  }

  await check('health 是 sqlite', async () => {
    const j = await (await fetch(BASE + '/api/health')).json();
    need(j.ok === true, 'ok 不为 true');
    need(typeof j.data.version === 'string', '缺少 version');
    need(j.data.db === 'sqlite', 'db 不是 sqlite：' + j.data.db);
    need(typeof j.data.counts === 'object', '缺少 counts');
  });

  await check('静态响应带安全头', async () => {
    const r = await fetch(BASE + '/');
    need(r.headers.get('x-content-type-options') === 'nosniff', '缺少 nosniff');
    need(r.headers.get('x-frame-options') === 'DENY', '缺少 X-Frame-Options');
    need(r.headers.get('referrer-policy') === 'no-referrer', '缺少 Referrer-Policy');
    const csp = r.headers.get('content-security-policy') || '';
    need(/frame-ancestors 'none'/.test(csp), '缺少 CSP frame-ancestors');
    const html = await r.text();
    need(/SEEDPOD/.test(html), '首页没有 SEEDPOD');
  });

  await check('未登录访问接口返回 401', async () => {
    const r = await fetch(BASE + '/api/config');
    need(r.status === 401, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.error && j.error.code === 'UNAUTHORIZED', '错误码不对');
  });

  await check('错误密码返回 401', async () => {
    const r = await fetch(BASE + '/api/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: USER, pass: 'wrong' })
    });
    need(r.status === 401, '状态码是 ' + r.status);
  });

  await check('连续失败会被限速', async () => {
    let last = null;
    for (let i = 0; i < 6; i++) {
      last = await fetch(BASE + '/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'nobody', pass: 'wrong' })
      });
    }
    need(last.status === 429, '第 6 次状态码是 ' + last.status);
  });

  await check('登录发 HttpOnly 会话 cookie', async () => {
    const r = await login();
    need(r.ok, '登录失败 ' + r.status);
    const sc = r.headers.get('set-cookie') || '';
    need(/pta_sid=/.test(sc), '没有 pta_sid');
    need(/HttpOnly/i.test(sc), 'cookie 没有 HttpOnly');
    const s = await fetchA(BASE + '/api/session');
    need(s.ok, '带 cookie 读会话失败');
  });

  await check('未带 cookie 读会话返回 401', async () => {
    const s = await fetch(BASE + '/api/session');
    need(s.status === 401, '状态码是 ' + s.status);
  });

  await check('dev 接口标明 v2 栈', async () => {
    const j = await (await fetchA(BASE + '/api/dev')).json();
    need(j.ok, 'ok 不为 true');
    need(j.data.version, '缺少 version');
    need(/Fastify/i.test(j.data.stack.back), '后端栈没写 Fastify：' + j.data.stack.back);
  });

  await check('config 有 sys/user/limits', async () => {
    const j = await (await fetchA(BASE + '/api/config')).json();
    need(j.ok && j.data.sys && j.data.user && j.data.limits, '结构不完整');
    need(j.data.sys.audit === true, 'sys.audit 不为 true');
  });

  await check('flow 能写能读', async () => {
    const body = { sets: { pub: [[{ t: '分辨率要求', v: '2160p 及以上' }]] }, rx: { deny: 'CAM' } };
    const put = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    })).json();
    need(put.ok, '写入失败');
    const get = await (await fetchA(BASE + '/api/flow')).json();
    need(get.ok && get.data.sets.pub[0][0].t === '分辨率要求', '读回不一致');
    need(get.data.rx.deny === 'CAM', 'rx.deny 没保存');
  });

  await check('词条写入与筛选条件生效', async () => {
    const items = [
      { site: 'demo-a.example', title: 'Fixture A 2020 1080p 中字', res: '1080p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture B 2020 2160p', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture C 2020 2160p 中字', res: '2160p', size: '5.00 GB', sizeBytes: 5 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture D 2020 2160p 中字', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture D 2020 2160p 中字', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture E 2020 2160p 中字 禁转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture F 2020 2160p 中字 限转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3, addedAt: new Date().toISOString() },
      { site: 'demo-a.example', title: 'Fixture G 2020 2160p 中字 限转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3, addedAt: new Date(Date.now() - 8 * 86400000).toISOString() }
    ];
    const add = await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items })
    })).json();
    need(add.ok && add.data.added === 8, '写入 8 条失败：' + JSON.stringify(add));

    const flow = { sets: { pub: [[
      { t: '分辨率要求', v: '2160p 及以上' },
      { t: '体积范围', v: '10 GB 起' },
      { t: '必须带中字', on: true }
    ]] }, rx: {} };
    await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(flow) });

    const j = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10 })
    })).json();
    need(j.ok, '筛选失败');
    need(j.data.checked === 8, 'checked 应为 8：' + j.data.checked);
    need(j.data.selected === 2, 'selected 应为 2：' + j.data.selected);
    need(j.data.skipped === 6, 'skipped 应为 6：' + j.data.skipped);
    need(/分辨率/.test(JSON.stringify(j.data.byReason)), '没有分辨率原因：' + JSON.stringify(j.data.byReason));
    need(/中字/.test(JSON.stringify(j.data.byReason)), '没有中字原因');
    need(/体积/.test(JSON.stringify(j.data.byReason)), '没有体积原因');
    need(/已有/.test(JSON.stringify(j.data.byReason)), '没有重复原因');
    need(/禁转/.test(JSON.stringify(j.data.byReason)), '没有禁转原因');
    need(/限转/.test(JSON.stringify(j.data.byReason)), '没有限转原因');
  });

  await check('队列里有 1 条待审核', async () => {
    const j = await (await fetchA(BASE + '/api/queue')).json();
    need(j.ok, '读取失败');
    need(Array.isArray(j.data.items) && j.data.items.length === 2, '队列条数不对：' + (j.data.items || []).length);
    need(j.data.counts.pending === 2, 'pending 计数不对');
    const one = await (await fetchA(BASE + '/api/queue/' + j.data.items[0].id)).json();
    need(one.ok && one.data.title, '按 id 读不到条目');
  });

  await check('队列筛选、分页与搜索', async () => {
    const make = async (title, status) => (await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, status, site: 'demo-a.example', targetSite: 'target.example', downloadUrl: 'http://127.0.0.1:1/t.torrent' })
    })).json());
    await make('Queue Alpha', 'approved');
    await make('Queue Beta', 'published');
    await make('Queue Gamma', 'pending');
    const j = await (await fetchA(BASE + '/api/queue?status=approved,published&limit=1&offset=1')).json();
    need(j.ok, '读取失败');
    need(j.data.matched >= 2, 'matched 不对：' + j.data.matched);
    need(j.data.items.length === 1, 'limit/offset 不对：' + j.data.items.length);
    const q = await (await fetchA(BASE + '/api/queue?q=Beta')).json();
    need(q.ok && q.data.matched === 1, '搜索不对：' + q.data.matched);
  });

  await check('队列单条查重', async () => {
    const make = async (title) => (await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, status: 'pending', site: 'demo-a.example' })
    })).json());
    await make('Dup Queue Title 2020');
    const b = await make('Dup Queue Title 2020');
    const j = await (await fetchA(BASE + '/api/queue/' + b.data.id + '/check', { method: 'POST' })).json();
    need(j.ok && j.data.duplicate === true, '没查出重复：' + JSON.stringify(j));
  });

  await check('队列编辑字段与发布语义', async () => {
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Edit Queue Title', status: 'pending', site: 'demo-a.example', targetSite: 'target.example', downloadUrl: 'http://127.0.0.1:1/t.torrent' })
    })).json();
    const j = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', title: 'Edit Queue Title Updated', cn: '甲' })
    })).json();
    need(j.ok && j.data.title === 'Edit Queue Title Updated', '标题没更新：' + JSON.stringify(j));
    const g = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(g.data.cn === '甲', '副标题没保存');
    await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'queue-test', url: 'http://127.0.0.1:9999' })
    });
    const p = await fetchA(BASE + '/api/queue/' + add.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' })
    });
    need(p.status === 409, '真发布关闭时状态码是 ' + p.status);
    const pj = await p.json();
    need(pj.error && pj.error.code === 'REAL_PUBLISH_DISABLED', '错误码不对：' + JSON.stringify(pj));
  });

  await check('队列批量按 fromStatus', async () => {
    await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bulk One', status: 'pending', site: 'demo-a.example' })
    });
    await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Bulk Two', status: 'pending', site: 'demo-a.example' })
    });
    const j = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromStatus: 'pending', action: 'approve' })
    })).json();
    need(j.ok && j.data.changed >= 2, '批量批准没生效：' + JSON.stringify(j));
    const g = await (await fetchA(BASE + '/api/queue?status=approved&q=Bulk')).json();
    need(g.ok && g.data.matched === 2, '批量后状态不对：' + g.data.matched);
  });

  await check('凭据只回 hasCookie，不回明文', async () => {
    const put = await (await fetchA(BASE + '/api/credentials/demo-a.example', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: 'sid=secret-cookie' })
    })).json();
    need(put.ok && put.data.hasCookie === true, '保存失败');
    const list = await (await fetchA(BASE + '/api/credentials')).text();
    need(list.indexOf('secret-cookie') < 0, '响应里出现了 cookie 明文');
    const j = JSON.parse(list);
    need(Array.isArray(j.data) && j.data[0].hasCookie === true, '列表没有 hasCookie');
    need(j.data[0].cookie === undefined, '列表回了 cookie 字段');
  });

  await check('下载器密码不回显', async () => {
    const add = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'fixture', url: 'http://127.0.0.1:9999', pass: 'secret-pass' })
    })).json();
    need(add.ok && add.data.hasPass === true, '新增失败');
    const list = await (await fetchA(BASE + '/api/downloaders')).text();
    need(list.indexOf('secret-pass') < 0, '响应里出现了密码明文');
  });

  await check('API 404 是 JSON', async () => {
    const r = await fetchA(BASE + '/api/not-exist');
    need(r.status === 404, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.ok === false && j.error && j.error.code === 'NOT_FOUND', '不是标准错误体');
  });

  await check('退出登录后会话失效', async () => {
    const r = await fetchA(BASE + '/api/logout', { method: 'POST' });
    need(r.ok, '退出失败');
    const s = await fetchA(BASE + '/api/session');
    need(s.status === 401, '退出后还能读会话');
  });

  child.kill();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

/* SEEDPOD v2 契约检查：起一个临时 Fastify + SQLite 实例，按线上接口验字段与错误码。
   用法：node pta/checks/api-v2.js  退出码 0 全过 / 1 有失败 / 2 起不来 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
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
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* 忽略：失败不影响主流程 */ }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('v2 服务没起来');
}

async function main() {
  let imageHits = 0;
  const imageServer = http.createServer(function (req, res) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      imageHits++;
      const body = Buffer.concat(chunks).toString('latin1');
      if (!/name="file"/.test(body)) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('no file');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { url: 'http://127.0.0.1:' + imageServer.address().port + '/img/1.jpg' } }));
    });
  });
  await new Promise(function (resolve) { imageServer.listen(0, '127.0.0.1', resolve); });
  const imagePort = imageServer.address().port;
  const child = spawn(process.env.PTA_NODE || process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS,
      PTA_SITE_PACK_KEY: '',
      PTA_IMAGE_HOST_URL: 'http://127.0.0.1:' + imagePort + '/upload',
      PTA_IMAGE_HOST_FIELD: 'file',
      PTA_HOOK_TOKEN: 'check-token'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  process.on('exit', function () {
    try { child.kill(); } catch (e) { /* 已退出 */ }
    try { imageServer.close(); } catch (e) { /* 已关闭 */ }
  });

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
    need(j.data.crypto && typeof j.data.crypto.ok === 'boolean', '缺少凭据密钥状态');
  });

  await check('失败队列 API', async () => {
    const j = await (await fetchA(BASE + '/api/failures?limit=1')).json();
    need(j.ok && j.data && typeof j.data.total === 'number' && Array.isArray(j.data.items), '失败队列结构不对：' + JSON.stringify(j));
    need(j.data.retention && j.data.retention.days === 30, '保留策略默认不对：' + JSON.stringify(j.data.retention));
    const j2 = await (await fetchA(BASE + '/api/failures?days=0&maxItems=5')).json();
    need(j2.ok && j2.data.retention.days === 0 && j2.data.retention.maxItems === 5, '保留参数没生效：' + JSON.stringify(j2.data.retention));
  });

  await check('错误统计 API', async () => {
    const j = await (await fetchA(BASE + '/api/errors?limit=1')).json();
    need(j.ok && j.data && typeof j.data.total === 'number' && Array.isArray(j.data.counts) && Array.isArray(j.data.items), '错误统计结构不对：' + JSON.stringify(j));
  });

  await check('config 有 sys/user/limits', async () => {
    const j = await (await fetchA(BASE + '/api/config')).json();
    need(j.ok && j.data.sys && j.data.user && j.data.limits, '结构不完整');
    need(j.data.sys.audit === true, 'sys.audit 不为 true');
    const schema = require('../server/config-schema');
    Object.keys(schema.DEFAULTS).forEach(function (k) {
      need(j.data.user[k] === schema.DEFAULTS[k], '默认值漂移：' + k + '=' + JSON.stringify(j.data.user[k]));
    });
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

  await check('查重始终搜索，旧目标站搜索开关不再生效', async () => {
    const off = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { dedupe: [[{ t: '目标站搜索', on: false }]] } })
    })).json();
    need(off.ok, '写旧开关失败');
    const r = await fetchA(BASE + '/api/dupe/check', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'target.example' })
    });
    const j = await r.json();
    need(!(j.error && j.error.code === 'DUPE_DISABLED'), '旧开关仍在拦查重：' + JSON.stringify(j));
    need(j.error && /NO_COOKIE|NO_DEF/.test(j.error.code), '应继续走到 cookie/站点定义检查：' + JSON.stringify(j));
  });

  await check('词条写入与筛选条件生效', async () => {
    const items = [
      { site: 'demo-a.example', title: 'Fixture A 2020 1080p 中字', res: '1080p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture B 2020 2160p', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3, tags: '英字' },
      { site: 'demo-a.example', title: 'Fixture C 2020 2160p 中字', res: '2160p', size: '5.00 GB', sizeBytes: 5 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture D 2020 2160p 中字', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture D 2020 2160p 中字', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture E 2020 2160p 中字 禁转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 },
      { site: 'demo-a.example', title: 'Fixture F 2020 2160p 中字 限转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3, addedAt: new Date().toISOString() },
      { site: 'demo-a.example', title: 'Fixture G 2020 2160p 中字 限转', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3, addedAt: new Date(Date.now() - 8 * 86400000).toISOString() },
      { site: 'demo-a.example', title: 'Fixture H 2020 2160p', res: '2160p', size: '20.00 GB', sizeBytes: 20 * 1024 ** 3 }
    ];
    const add = await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items })
    })).json();
    need(add.ok && add.data.added === 9, '写入 9 条失败：' + JSON.stringify(add));

    const flow = { sets: { fetch: [[], [
      { t: '分辨率要求', v: '2160p 及以上' },
      { t: '体积范围', v: '10 GB 起' },
      { t: '必须带中字', on: true }
    ]] }, rx: {} };
    await fetchA(BASE + '/api/flow', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(flow) });

    const j = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10 })
    })).json();
    need(j.ok, '筛选失败');
    need(j.data.checked === 9, 'checked 应为 9：' + j.data.checked);
    need(j.data.selected === 2, 'selected 应为 2：' + j.data.selected);
    need(j.data.skipped === 7, 'skipped 应为 7：' + j.data.skipped);
    need(/分辨率/.test(JSON.stringify(j.data.byReason)), '没有分辨率原因：' + JSON.stringify(j.data.byReason));
    need(/没有中字/.test(JSON.stringify(j.data.byReason)), '无详情的中字规则没生效：' + JSON.stringify(j.data.byReason));
    need(/中字/.test(JSON.stringify(j.data.byReason)), '没有中字原因');
    need(/体积/.test(JSON.stringify(j.data.byReason)), '没有体积原因');
    need(/已有/.test(JSON.stringify(j.data.byReason)), '没有重复原因');
    need(/禁转/.test(JSON.stringify(j.data.byReason)), '没有禁转原因');
    need(/限转/.test(JSON.stringify(j.data.byReason)), '没有限转原因');
  });

  await check('必须有简介不拦送审（只在终审检查）', async () => {
    await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'demo-a.example', title: 'No Intro 2024 2160p 中字', res: '2160p', size: '20 GB', sizeBytes: 20 * 1024 ** 3 }] })
    })).json();
    const flow = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '必须有简介', on: true }]] } })
    })).json();
    need(flow.ok, '写必须有简介失败');
    const j = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10 })
    })).json();
    need(j.ok && j.data.selected === 1 && !/缺简介/.test(JSON.stringify(j.data.byReason)), '送审不该因缺简介被拦：' + JSON.stringify(j.data));
    const q = await (await fetchA(BASE + '/api/queue?q=No%20Intro')).json();
    for (const it of (q.data && q.data.items) || []) {
      await fetchA(BASE + '/api/queue/' + encodeURIComponent(it.id), { method: 'DELETE' });
    }
    /* 删队列会把来源词条回到 new；这条夹具也要清掉，避免下一轮又被送审 */
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      db.prepare("DELETE FROM catalog WHERE title LIKE 'No Intro%'").run();
      db.close();
    }
  });

  await check('排除正则命中即拒绝，旧白名单不再生效', async () => {
    const put = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[]] }, rx: { deny: 'CAM', allow: 'NEVERMATCH' } })
    })).json();
    need(put.ok, '写排除正则失败');
    const got = await (await fetchA(BASE + '/api/flow')).json();
    need(got.ok && got.data.rx.deny === 'CAM', 'rx.deny 没保存');
    need(got.data.rx.allow === undefined, 'rx.allow 没清掉：' + JSON.stringify(got.data.rx));
    await (await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ site: 'demo-a.example', title: 'Deny CAM Test 2024 2160p 中字', res: '2160p', size: '20 GB', sizeBytes: 20 * 1024 ** 3 }] })
    })).json();
    const j = await (await fetchA(BASE + '/api/catalog/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 10 })
    })).json();
    need(j.ok, '筛选失败');
    need(j.data.skipped >= 1 && /命中排除规则/.test(JSON.stringify(j.data.byReason)), '排除正则没拦住：' + JSON.stringify(j.data));
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

  await check('队列保存字段不改变状态', async () => {
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Save Queue Title', status: 'pending', site: 'demo-a.example' })
    })).json();
    {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
      const row = db.prepare('SELECT data FROM queue WHERE id = ?').get(add.data.id);
      const d = JSON.parse(row.data);
      d.dupePassedAt = '2026-01-01T00:00:00.000Z';
      d.dupeResults = { 'demo-a.example': { found: false, skip: false, at: '2026-01-01T00:00:00.000Z' } };
      d.dupeSkipped = true;
      db.prepare('UPDATE queue SET data = ? WHERE id = ?').run(JSON.stringify(d), add.data.id);
      db.close();
    }
    const j = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'save', title: 'Save Queue Title Updated', cn: '保存副标题', intro: '保存简介', targetSite: 'demo-a.example' })
    })).json();
    need(j.ok && j.data.title === 'Save Queue Title Updated', '保存标题失败：' + JSON.stringify(j));
    const g = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(g.data.title === 'Save Queue Title Updated' && g.data.cn === '保存副标题' && g.data.intro === '保存简介', '保存字段没落库：' + JSON.stringify({ title: g.data.title, cn: g.data.cn, intro: g.data.intro }));
    need(g.data.status === 'pending', '保存不该改状态：' + g.data.status);
    need(!g.data.dupePassedAt && !g.data.dupeResults && !g.data.dupeSkipped, '改标题/目标站后旧查重缓存没清：' + JSON.stringify({ passed: g.data.dupePassedAt, results: g.data.dupeResults, skipped: g.data.dupeSkipped }));
  });

  await check('失败条目重新排队会清失败阶段', async () => {
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Retry Stage 2024 1080p', status: 'failed', stage: 'failed', stageFailedFrom: 'prepared', stageLastError: 'TARGET_UNREACHABLE', stageAttempts: 3 })
    })).json();
    need(add.ok && add.data.id, '建失败条目失败');
    const r = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'retry' })
    })).json();
    need(r.ok && r.data.status === 'pending', '重新排队状态不对：' + JSON.stringify(r));
    need(r.data.stage === 'prepared' && !r.data.stageLastError && Number(r.data.stageAttempts) === 0, '失败阶段没清：' + JSON.stringify({ stage: r.data.stage, err: r.data.stageLastError, attempts: r.data.stageAttempts }));
  });

  await check('回查失败重试：到点回准备，未到点继续等', async () => {
    const mk = async function (title, nextAt) {
      const r = await (await fetchA(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, status: 'approved', stage: 'failed', stageFailedFrom: 'previewed',
          stageLastError: '提交返回 200，但回查未找到', stageNextRetryAt: nextAt, stageAttempts: 2, targetSite: 'demo-a.example' })
      })).json();
      need(r.ok && r.data.id, '建回查失败条目失败：' + JSON.stringify(r));
      return r.data.id;
    };
    const past = await mk('Verify Retry Past 2024', new Date(Date.now() - 1000).toISOString());
    const adv = await (await fetchA(BASE + '/api/queue/' + past + '/advance', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    })).json();
    need(adv.ok, 'advance 失败：' + JSON.stringify(adv));
    const got = await (await fetchA(BASE + '/api/queue/' + past)).json();
    need(got.data.stage === 'prepared', '到点没回准备：' + got.data.stage);
    need(!got.data.stageLastError && !got.data.stageNextRetryAt, '失败字段没清：' + JSON.stringify({ e: got.data.stageLastError, n: got.data.stageNextRetryAt }));
    const future = await mk('Verify Retry Future 2024', new Date(Date.now() + 3600000).toISOString());
    const wait = await (await fetchA(BASE + '/api/queue/' + future + '/advance', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    })).json();
    need(wait.ok && wait.data.next === 'wait' && wait.data.stage === 'failed', '未到点没等待：' + JSON.stringify(wait));
    const stayed = await (await fetchA(BASE + '/api/queue/' + future)).json();
    need(stayed.data.stage === 'failed' && stayed.data.stageNextRetryAt, '未到点阶段被改：' + JSON.stringify(stayed.data.stage));
  });

  await check('MediaInfo/BDInfo 准备与解析', async () => {
    const bd = 'Disc Title: Media.Info.Test.2024.2160p\nDisc Label: Media Info Test\nDisc Size: 1,000,000,000 bytes\nSize: 900,000,000 bytes\nLength: 1:30:00.000\nVideo: MPEG-H HEVC Video / 2160p / 23.976 fps / 10 bits / HDR10\nAudio: Chinese / DTS-HD Master Audio / 5.1\nSubtitle: Chinese / 20 kbps';
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Media Info Test 2024 2160p', status: 'pending', site: 'demo-a.example' })
    })).json();
    const prep = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mediaInfo: bd })
    })).json();
    need(prep.ok, 'prepare 失败：' + JSON.stringify(prep));
    const p = prep.data.prepared;
    need(p.media && p.media.kind === 'bdinfo', 'media kind 不对：' + JSON.stringify(p.media));
    need(/2160p/.test(p.media.summary) && /HEVC/.test(p.media.summary), 'summary 不对：' + p.media.summary);
    need(/【BDInfo】/.test(p.description) && /\[quote\]/.test(p.description), '简介没拼 BDInfo');
    const got = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(got.ok && String(got.data.mediaInfo || '').indexOf('Disc Title') === 0, 'mediaInfo 没存进队列');
    need(String(got.data.bdinfo || '').indexOf('Disc Title') === 0, 'bdinfo 没写回队列');
    const parsed = await (await fetchA(BASE + '/api/meta/mediainfo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: bd })
    })).json();
    need(parsed.ok && parsed.data.kind === 'bdinfo', '解析接口不对：' + JSON.stringify(parsed));
    const no = await fetchA(BASE + '/api/meta/mediainfo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'nope' })
    });
    need(no.status === 422, '无法识别时应 422，实际 ' + no.status);
  });

  await check('图床演练与真上传门禁', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const add = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Image Host Test 2024 2160p', status: 'pending', site: 'demo-a.example', imageHost: '本地图床' })
    })).json();
    const addShot = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/shots', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shots: [{ name: 'shot1.png', url: png }] })
    })).json();
    need(addShot.ok && addShot.data.count === 1, '截图没存进队列');
    const dry = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageHost: '本地图床', dryRun: true })
    })).json();
    need(dry.ok && dry.data.dryRun === true && dry.data.total === 1 && dry.data.code === 'IMAGE_DRY_RUN', '图床演练结果不对：' + JSON.stringify(dry));
    const got = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(got.ok && got.data.imagePlan && got.data.imagePlan.dryRun === true, '图床演练没落库');
    const real = await fetchA(BASE + '/api/queue/' + add.data.id + '/images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageHost: '本地图床', dryRun: false })
    });
    need(real.status === 409, '真上传关闭时状态码是 ' + real.status);
    const rj = await real.json();
    need(rj.error && rj.error.code === 'REAL_IMAGES_DISABLED', '真上传错误码不对：' + JSON.stringify(rj));
    const cfg = await (await fetchA(BASE + '/api/config/user', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ realImages: true })
    })).json();
    need(cfg.ok && cfg.data.realImages === true, 'realImages 没打开：' + JSON.stringify(cfg));
    const up = await (await fetchA(BASE + '/api/queue/' + add.data.id + '/images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageHost: '本地图床', dryRun: false, retries: 0 })
    })).json();
    need(up.ok && up.data.uploaded === 1 && up.data.failed === 0, '真上传结果不对：' + JSON.stringify(up));
    need(imageHits === 1, '图床请求数不对：' + imageHits);
    const got2 = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(got2.ok && got2.data.imageLinks && got2.data.imageLinks.length === 1, 'imageLinks 没落库');
    need(/\/img\/1\.jpg/.test(got2.data.imageLinks[0].url), 'imageLinks 地址不对：' + JSON.stringify(got2.data.imageLinks));
    need(got2.data.prepared && /\[img\]http:\/\/127\.0\.0\.1:/.test(got2.data.prepared.description), '简介没替换图床链接：' + ((got2.data.prepared && got2.data.prepared.description) || '').slice(-200));
    need(got2.data.prepared.description.indexOf('data:image') < 0, '简介里还留着 data URL');
    const flowOff = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '简介图片', on: false }]] } })
    })).json();
    need(flowOff.ok, '写简介图片规则失败');
    await fetchA(BASE + '/api/queue/' + add.data.id + '/prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    const noImg = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(noImg.data.prepared.description.indexOf('[img]http://127.0.0.1:') < 0, '关闭图床后仍替换了图床链接：' + noImg.data.prepared.description.slice(-160));
    const flowOn = await (await fetchA(BASE + '/api/flow', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sets: { pub: [[{ t: '简介图片', on: true }]] } })
    })).json();
    need(flowOn.ok, '恢复简介图片规则失败');
    await fetchA(BASE + '/api/queue/' + add.data.id + '/prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    const withImg = await (await fetchA(BASE + '/api/queue/' + add.data.id)).json();
    need(withImg.data.prepared.description.indexOf('[img]http://127.0.0.1:') >= 0, '转存模式没写回图床链接');
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

  await check('队列状态同步回词条，已发布不可回滚/删除', async () => {
    const cid = 'cat_sync_1';
    await fetchA(BASE + '/api/catalog', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ id: cid, title: 'Sync Row', status: 'new' }] })
    });
    const q = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Sync Queue 2020', status: 'pending', site: 'demo-a.example', catalogId: cid })
    })).json();
    need(q.ok && q.data.id, '建同步条目失败：' + JSON.stringify(q));
    const cat = async function () {
      const j = await (await fetchA(BASE + '/api/catalog?limit=500')).json();
      return (j.data.items || []).filter(function (x) { return x.id === cid; })[0] || {};
    };
    await fetchA(BASE + '/api/queue/' + q.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: '不同步会错' })
    });
    let c = await cat();
    need(c.status === 'skipped' && c.skipReason === '不同步会错', '驳回没同步词条：' + JSON.stringify({ status: c.status, reason: c.skipReason }));
    await fetchA(BASE + '/api/queue/' + q.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'retry' })
    });
    c = await cat();
    need(c.status === 'selected' && c.skipReason === undefined, '重新送审没同步回已送审：' + JSON.stringify({ status: c.status, reason: c.skipReason }));
    await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'skip', ids: [q.data.id] })
    });
    c = await cat();
    need(c.status === 'skipped' && c.skipReason === '已跳过', '批量跳过没同步词条：' + JSON.stringify({ status: c.status, reason: c.skipReason }));
    const del = await (await fetchA(BASE + '/api/queue/' + q.data.id, { method: 'DELETE' })).json();
    need(del.ok && del.data.catalogReset === true, '删除队列没回词条：' + JSON.stringify(del));
    c = await cat();
    need(c.status === 'new', '删除后词条没回待筛选：' + c.status);

    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
      .run('q_pub_lock', 'published', 'Published Lock', JSON.stringify({ id: 'q_pub_lock', status: 'published', title: 'Published Lock' }), '2026-01-01', '2026-01-01');
    db.close();
    const retry = await fetchA(BASE + '/api/queue/q_pub_lock/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'retry' })
    });
    need(retry.status === 409, '已发布还能回滚：' + retry.status);
    const rj = await retry.json();
    need(rj.error && rj.error.code === 'PUBLISHED_LOCKED', '回滚错误码不对：' + JSON.stringify(rj.error));
    const delPub = await fetchA(BASE + '/api/queue/q_pub_lock', { method: 'DELETE' });
    need(delPub.status === 409, '已发布还能删除：' + delPub.status);
    const bulk = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'skip', ids: ['q_pub_lock'] })
    })).json();
    need(bulk.ok && bulk.data.changed === 0 && bulk.data.locked === 1, '批量改已发布没锁：' + JSON.stringify(bulk));
    const db2 = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    db2.prepare("DELETE FROM queue WHERE id = 'q_pub_lock'").run();
    db2.close();
  });

  await check('驳回后可重新送审：清理由、回待审、不进失败统计', async () => {
    const q = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Reject Retry 2020', status: 'approved', site: 'demo-a.example' })
    })).json();
    need(q.ok && q.data.id, '建条目失败：' + JSON.stringify(q));
    const id = q.data.id;
    await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: '先驳回' })
    });
    const retry = await (await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'retry' })
    })).json();
    need(retry.ok && retry.data.status === 'pending', '重新送审没回待审：' + JSON.stringify(retry));
    need(retry.data.reason === undefined && retry.data.rejectedAt === undefined, '旧驳回理由没清：' + JSON.stringify({ reason: retry.data.reason, at: retry.data.rejectedAt }));
    need(retry.data.stage === 'draft', '重新送审阶段不对：' + retry.data.stage);
    const fails = await (await fetchA(BASE + '/api/failures?limit=200')).json();
    need(fails.ok && (fails.data.items || []).every(function (x) { return x.id !== id; }), '驳回项混进了失败列表');
    const ov = await (await fetchA(BASE + '/api/stats/overview')).json();
    need(ov.ok && typeof ov.data.failures.items === 'number', '统计失败字段不对：' + JSON.stringify(ov.data && ov.data.failures));
    await fetchA(BASE + '/api/queue/' + id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: '再驳一次' })
    });
    const bulk = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', ids: [id] })
    })).json();
    need(bulk.ok && bulk.data.changed === 1, '批量重新批准失败：' + JSON.stringify(bulk));
    const after = await (await fetchA(BASE + '/api/queue/' + id)).json();
    need(after.data.status === 'approved' && after.data.reason === undefined, '批准后旧理由还在：' + JSON.stringify({ status: after.data.status, reason: after.data.reason }));
  });

  await check('驳回状态只进全部列表，计数和统计一致', async () => {
    const q = await (await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Reject Me 2020', status: 'approved', site: 'demo-a.example' })
    })).json();
    need(q.ok && q.data.id, '建条目失败：' + JSON.stringify(q));
    const noReason = await fetchA(BASE + '/api/queue/' + q.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject' })
    });
    need(noReason.status === 400, '驳回不写理由没拦：' + noReason.status);
    const rej = await (await fetchA(BASE + '/api/queue/' + q.data.id + '/action', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: 'fixture reject' })
    })).json();
    need(rej.ok && rej.data.status === 'rejected' && rej.data.reason === 'fixture reject', '驳回没落库：' + JSON.stringify(rej));
    const detail = await (await fetchA(BASE + '/api/queue/' + q.data.id)).json();
    need(detail.data.status === 'rejected' && typeof detail.data.actionAt === 'string', '详情状态不对：' + JSON.stringify(detail.data.status));
    const approved = await (await fetchA(BASE + '/api/queue?status=approved&q=Reject Me')).json();
    need(approved.ok && approved.data.matched === 0, '已通过列表还有驳回项：' + approved.data.matched);
    const pending = await (await fetchA(BASE + '/api/queue?status=pending&q=Reject Me')).json();
    need(pending.ok && pending.data.matched === 0, '待确认列表还有驳回项：' + pending.data.matched);
    const allList = await (await fetchA(BASE + '/api/queue?limit=500')).json();
    need(allList.ok && allList.data.items.some(function (x) { return x.id === q.data.id; }), '全部列表看不到驳回项');
    need(Number(allList.data.counts.rejected) >= 1, '驳回计数缺失：' + JSON.stringify(allList.data.counts));
    const ov = await (await fetchA(BASE + '/api/stats/overview')).json();
    need(ov.ok && Number(ov.data.queue.counts.rejected) === Number(allList.data.counts.rejected), '统计与列表口径不一致：' + JSON.stringify({ list: allList.data.counts.rejected, ov: ov.data.queue.counts.rejected }));
  });

  await check('队列批量发布全部失败：错误限量、状态不变', async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const r = await (await fetchA(BASE + '/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Bulk Pub ' + i, status: 'approved', site: 'demo-a.example' })
      })).json();
      need(r.ok && r.data.id, '建发布条目失败：' + JSON.stringify(r));
      ids.push(r.data.id);
    }
    const j = await (await fetchA(BASE + '/api/queue/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'publish', ids: ids })
    })).json();
    need(j.ok && j.data.changed === 0 && j.data.skipped === 5, '失败统计不对：' + JSON.stringify(j));
    need(Array.isArray(j.data.errors) && j.data.errors.length >= 1 && j.data.errors.length <= 3, '错误没限量：' + JSON.stringify(j.data.errors));
    need(j.data.errors[0].code === 'REAL_PUBLISH_DISABLED', '错误码不对：' + JSON.stringify(j.data.errors[0]));
    const g = await (await fetchA(BASE + '/api/queue?status=approved&q=Bulk Pub')).json();
    need(g.ok && g.data.matched === 5, '失败后状态被改：' + g.data.matched);
  });

  await check('面板添加站点与上传定义', async () => {
    const add = await fetchA(BASE + '/api/sites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://added.example/index.php', arch: 'NP', title: 'Added Site' })
    });
    need(add.status === 200, '添加站点失败 ' + add.status);
    const aj = await add.json();
    need(aj.ok && aj.data.host === 'added.example', '返回 host 不对：' + JSON.stringify(aj));
    const list = await (await fetchA(BASE + '/api/sites')).json();
    const hit = (list.data.sites || []).filter(x => x.host === 'added.example')[0];
    need(hit && hit.added === true, '列表没出现面板添加的站点');
    const def = { engine: 'nexusphp', base: 'https://added.example',
      uploadMap: { path: '/takeupload.php', fileField: 'file', fields: { name: '{title}' } },
      verify: { path: '/torrents.php?search={title}' } };
    const put = await fetchA(BASE + '/api/site-def/added.example', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    });
    need(put.status === 200, '保存站点定义失败 ' + put.status);
    const got = await (await fetchA(BASE + '/api/site-def/added.example')).json();
    need(got.ok && got.data.engine === 'nexusphp', '站点定义没读到');
    const del = await fetchA(BASE + '/api/sites/added.example', { method: 'DELETE' });
    need(del.status === 200, '移除站点失败 ' + del.status);
    const list2 = await (await fetchA(BASE + '/api/sites')).json();
    need(!(list2.data.sites || []).some(x => x.host === 'added.example'), '移除后列表还在');
  });

  await check('队列表/详情/词条/下载器返回稳定形状', async () => {
    const add = await fetchA(BASE + '/api/queue', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Shape Check 2024 1080p', status: 'pending' })
    });
    const aj = await add.json();
    need(aj.ok && aj.data && typeof aj.data.id === 'string', '建队列形状不对：' + JSON.stringify(aj));
    const list = await (await fetchA(BASE + '/api/queue?limit=5')).json();
    need(list.ok && Array.isArray(list.data.items) && typeof list.data.matched === 'number' && typeof list.data.counts === 'object', '队列表形状不对：' + JSON.stringify(list.data));
    need(list.data.items.every(function (x) { return typeof x.id === 'string' && typeof x.title === 'string' && typeof x.status === 'string'; }), '队列条目字段不全');
    const one = await (await fetchA(BASE + '/api/queue/' + encodeURIComponent(aj.data.id))).json();
    need(one.ok && one.data.id === aj.data.id, '队列详情形状不对');
    const cat = await (await fetchA(BASE + '/api/catalog?limit=1')).json();
    need(cat.ok && typeof cat.data.total === 'number' && typeof cat.data.matched === 'number' && cat.data.byStatus && Array.isArray(cat.data.items), '词条形状不对');
    const dls = await (await fetchA(BASE + '/api/downloaders')).json();
    need(dls.ok && Array.isArray(dls.data), '下载器形状不对');
    const bad = await (await fetchA(BASE + '/api/queue/no-such-id')).json();
    need(bad.error && bad.error.code === 'NOT_FOUND', '错误形状不对');
  });

  await require('./api-v2/site-ops')({ BASE: BASE, DATA: DATA, ROOT: ROOT, fetchA: fetchA, check: check, need: need });

  child.kill();
  imageServer.close();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

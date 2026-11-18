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

  await check('必须有简介规则拦送审', async () => {
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
    need(j.ok && j.data.skipped === 1 && /缺简介/.test(JSON.stringify(j.data.byReason)), '缺简介没被拦：' + JSON.stringify(j.data));
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

  await check('抓取状态可读', async () => {
    const host = 'cursor.example';
    const add = await fetchA(BASE + '/api/sites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://cursor.example/index.php', arch: 'NP', title: 'Cursor Site' })
    });
    need(add.status === 200, '添加站点失败 ' + add.status);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
    const row = db.prepare("SELECT v FROM meta WHERE k = 'crawl-state'").get();
    const st = row ? JSON.parse(row.v) : {};
    st[host] = { page: 7, catIdx: 2, lastAt: Date.now(), dayCount: 5 };
    db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
    db.close();
    const s = await (await fetchA(BASE + '/api/crawl/status?host=' + host)).json();
    need(s.ok && s.data.page === 7 && s.data.catIdx === 2 && s.data.count === 5, '状态字段不对：' + JSON.stringify(s));
    need(typeof s.data.dailyMax === 'number' && typeof s.data.waitMs === 'number', '状态缺额度字段：' + JSON.stringify(s.data));
    await fetchA(BASE + '/api/sites/' + host, { method: 'DELETE' });
  });

  await check('站点分类映射数组/对象回读', async () => {
    const host = 'map.example';
    const arr = { engine: 'nexusphp', base: 'https://map.example', cats: { movie: ['401'], tv: ['402'] },
      catMap: [{ id: '401', label: 'Movies', purpose: 'movie' }, { id: '402', label: 'TV', purpose: 'tv' }] };
    const put = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(arr)
    });
    need(put.status === 200, '数组映射保存失败 ' + put.status);
    const got = await (await fetchA(BASE + '/api/site-def/' + host)).json();
    need(got.ok && Array.isArray(got.data.catMap) && got.data.catMap.length === 2, '数组映射没读回');
    need(got.data.catMap[0].purpose === 'movie' && got.data.catMap[1].id === '402', '数组映射内容不对');
    const list = await (await fetchA(BASE + '/api/site-defs')).json();
    need(list.ok && list.data[host] && list.data[host].groups === 2 && list.data[host].ids === 2, 'site-defs 分类统计不对：' + JSON.stringify(list.data[host]));
    const obj = { engine: 'nexusphp', base: 'https://map.example', catMap: { movie: '401', tv: '402' } };
    const put2 = await fetchA(BASE + '/api/site-def/' + host, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj)
    });
    need(put2.status === 200, '对象映射保存失败 ' + put2.status);
    const got2 = await (await fetchA(BASE + '/api/site-def/' + host)).json();
    need(got2.ok && got2.data.catMap && got2.data.catMap.movie === '401' && got2.data.catMap.tv === '402', '对象映射没读回');
  });

  await check('上传表单 HTML 识别接口', async () => {
    const html = fs.readFileSync(path.join(ROOT, 'fixtures', 'upload-form.html'), 'utf8');
    const r = await fetchA(BASE + '/api/form/parse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: html })
    });
    need(r.status === 200, '识别接口失败 ' + r.status);
    const j = await r.json();
    need(j.ok && j.data.path === '/takeupload.php' && j.data.fileField === 'torrent', '识别结果不对：' + JSON.stringify(j.data && { path: j.data.path, fileField: j.data.fileField }));
    need(j.data.forms && j.data.forms[0].fields.length === 6, '字段数量不对');
    const no = await fetchA(BASE + '/api/form/parse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ html: '<div>没有表单</div>' })
    });
    need(no.status === 422, '没有表单时应返回 422，实际 ' + no.status);
  });

  await check('站点包状态与例外门禁', async () => {
    const j = await (await fetchA(BASE + '/api/site-pack')).json();
    need(j.ok && j.data.available === false, '无密钥时应不可用：' + JSON.stringify(j.data && { available: j.data.available, reason: j.data.reason }));
    need(j.data.reason === 'NO_KEY', '缺密钥原因不对：' + j.data.reason);
    need(Array.isArray(j.data.purposes) && j.data.purposes.length > 0, '用途列表缺失');
    const bad = await fetchA(BASE + '/api/site-pack/exception', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: '../x', id: '1', purpose: 'movie' })
    });
    need(bad.status === 400, '坏 host 状态码是 ' + bad.status);
    const bj = await bad.json();
    need(bj.error && bj.error.code === 'BAD_HOST', '坏 host 错误码不对：' + JSON.stringify(bj));
  });

  await check('站点覆盖统计接口', async () => {
    const j = await (await fetchA(BASE + '/api/coverage')).json();
    need(j.ok && typeof j.data.total === 'number', '覆盖接口结构不对：' + JSON.stringify(j));
    need(typeof j.data.withCookie === 'number' && typeof j.data.ready === 'number', '覆盖计数缺失');
    need(typeof j.data.planOk === 'number' && typeof j.data.planFail === 'number', '计划计数缺失');
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
    need(j.data[0].readable === true, 'cookie 可读状态不对：' + JSON.stringify(j.data[0]));
  });

  await check('下载器密码不回显', async () => {
    const add = await (await fetchA(BASE + '/api/downloaders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'fixture', url: 'http://127.0.0.1:9999', pass: 'secret-pass' })
    })).json();
    need(add.ok && add.data.hasPass === true, '新增失败');
    need(add.data.passReadable === true, '密码可读状态不对：' + JSON.stringify(add.data));
    const list = await (await fetchA(BASE + '/api/downloaders')).text();
    need(list.indexOf('secret-pass') < 0, '响应里出现了密码明文');
  });

  await check('API 404 是 JSON', async () => {
    const r = await fetchA(BASE + '/api/not-exist');
    need(r.status === 404, '状态码是 ' + r.status);
    const j = await r.json();
    need(j.ok === false && j.error && j.error.code === 'NOT_FOUND', '不是标准错误体');
  });

  await check('统计总览有发布/失败/站点字段', async () => {
    const r = await fetchA(BASE + '/api/stats/overview');
    const j = await r.json();
    need(j.ok && j.data, '统计失败');
    const d = j.data;
    need(d.published && Array.isArray(d.published.bySite), '没有 bySite');
    need(d.published.byDay.length === 14, 'byDay 应为 14 天：' + d.published.byDay.length);
    need(d.failures && Array.isArray(d.failures.reasons), '没有失败原因');
    need(typeof d.sites.enabled === 'number' && typeof d.crawl.runsToday === 'number', '站点/抓取字段缺失');
    need(typeof d.published.last7d === 'number', '没有近 7 天发布数');
  });

  await check('外部触发无 token 被拒', async () => {
    const no = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    need(no.status === 401, '没 token 应 401：' + no.status);
    const bad = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-token': 'wrong' }, body: '{}' });
    need(bad.status === 401, '错 token 应 401：' + bad.status);
    const good = await fetch(BASE + '/api/hooks/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hook-token': 'check-token' }, body: JSON.stringify({ steps: ['crawl'] }) });
    const gj = await good.json();
    need(good.status === 200 && gj.ok, '带 token 没跑起来：' + good.status + ' ' + JSON.stringify(gj));
    need(gj.data.steps.crawl && gj.data.steps.crawl.skipped === 'realCrawl off', '步骤过滤没生效：' + JSON.stringify(gj.data.steps.crawl));
  });

  await check('退出登录后会话失效', async () => {
    const r = await fetchA(BASE + '/api/logout', { method: 'POST' });
    need(r.ok, '退出失败');
    const s = await fetchA(BASE + '/api/session');
    need(s.status === 401, '退出后还能读会话');
  });

  child.kill();
  imageServer.close();
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

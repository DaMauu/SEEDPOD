/* qBittorrent 适配：探测、登录（4.x SID / 5.x QBT_SID_端口）、分类读取。从旧服务搬过来复用。 */
const secretbox = require('./secretbox');
const path = require('path');
function makeQb(DATA_DIR) {
const KEYRING = secretbox.loadKey(DATA_DIR);
const DL_TIMEOUT = 8000;

function readDl() {
  try {
    const raw = JSON.parse(fs.readFileSync(DL_FILE, 'utf8'));
    return { seq: Number(raw && raw.seq) || 0, items: Array.isArray(raw && raw.items) ? raw.items : [] };
  } catch (e) {
    return { seq: 0, items: [] };
  }
}
function writeDl(d) {
  try {
    fs.writeFileSync(DL_FILE, JSON.stringify({ seq: d.seq, items: d.items }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入下载器失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function publicDl(d) {
  return { id: d.id, name: d.name || '', url: d.url, user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth,
    lastProbe: d.lastProbe || null };
}
function normDlUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  /* 只填 host:port 也认，统一补成 http:// */
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  s = s.replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/@]+/i.test(s)) return null;
  if (/\s/.test(s) || s.indexOf('@') >= 0) return null;
  return s;
}
function sanitizeDl(body, prev) {
  const out = Object.assign({}, prev || {});
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n.length > 60) return { err: { code: 'BAD_REQUEST', message: 'name 最多 60 字' } };
    out.name = n;
  }
  if (body.url !== undefined) {
    const u = normDlUrl(body.url);
    if (!u) return { err: { code: 'BAD_URL', message: '地址必须是 http/https 开头' } };
    out.url = u;
  }
  if (body.user !== undefined) out.user = String(body.user).slice(0, 100);
  if (body.pass !== undefined) {
    /* 密码只存密文，和站点 cookie 用同一套 AES-256-GCM；空串表示清掉 */
    out.pass = body.pass ? secretbox.encrypt(String(body.pass).slice(0, 200), KEYRING.key) : '';
  }
  if (body.disableAuth !== undefined) out.disableAuth = !!body.disableAuth;
  return { dl: out };
}

/* 老数据里可能是明文密码，读到明文就原样用，下次保存自然换成密文 */
function dlPass(d) {
  const v = String((d && d.pass) || '');
  if (!v) return '';
  if (v.slice(0, 3) === 'v1:') {
    try { return secretbox.decrypt(v, KEYRING.key); } catch (e) { return ''; }
  }
  return v;
}

async function probeDownloader(d) {
  const steps = [];
  const base = d.url;
  const cookie = { value: '' };
  function ms(t0) { return Date.now() - t0; }
  async function hit(path, opts) {
    const t0 = Date.now();
    const h = Object.assign({}, (opts && opts.headers) || {});
    if (cookie.value) h.cookie = cookie.value;
    const res = await fetch(base + path, Object.assign({}, opts || {}, {
      headers: h, redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT)
    }));
    return { res: res, ms: ms(t0) };
  }
  try {
    let r = await hit('/api/v2/app/version');
    steps.push({ step: 'version', status: r.res.status, ms: r.ms });
    if ((r.res.status === 401 || r.res.status === 403) && (d.user || d.pass)) {
      const t0 = Date.now();
      const login = await fetch(base + '/api/v2/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', referer: base, origin: base },
        body: 'username=' + encodeURIComponent(d.user || '') + '&password=' + encodeURIComponent(dlPass(d)),
        redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT)
      });
      const setCookie = login.headers.get('set-cookie') || '';
      /* qBittorrent 4.x 用 SID，5.x 改成 QBT_SID_<端口>，而且 5.x 成功时返回 204 无正文 */
      const m = /((?:QBT_)?SID[^=;\s]*)=([^;]+)/i.exec(setCookie);
      if (m) cookie.value = m[1] + '=' + m[2];
      const text = await login.text().catch(function () { return ''; });
      const okLogin = !!m && (login.status === 200 || login.status === 204 || login.status === 303) && !/fails/i.test(text);
      steps.push({ step: 'login', status: login.status, ms: ms(t0), ok: okLogin });
      r = await hit('/api/v2/app/version');
      steps.push({ step: 'version', status: r.res.status, ms: r.ms });
    }
    const version = (await r.res.text().catch(function () { return ''; })).trim().slice(0, 40);
    const pass = r.res.status === 200 && !!version;
    /* 顺手问一下磁盘余量：qBittorrent 在 sync/maindata 的 server_state 里给 */
    let freeSpace = 0, savePath = '', totalSpace = 0;
    if (pass) {
      try {
        const t1 = Date.now();
        const main = await hit('/api/v2/sync/maindata');
        const data = await main.res.json().catch(function () { return null; });
        const st = (data && data.server_state) || {};
        freeSpace = Number(st.free_space_on_disk) || 0;
        savePath = String(st.save_path || '');
        steps.push({ step: 'space', status: main.res.status, ms: ms(t1), ok: freeSpace > 0 });
      } catch (e) {
        steps.push({ step: 'space', status: 0, ms: 0, error: '拿不到磁盘余量：' + String(e && e.message || e).slice(0, 80) });
      }
      /* qB 只给剩余空间，不给总量；远端下载器更没法知道它的盘有多大。
         所以只回 qB 上报的真实剩余，总量留空，页面不画百分比进度条，也不拿本机盘去顶。 */
    }
    return { pass: pass, version: pass ? version : '', freeSpace: freeSpace, totalSpace: totalSpace, savePath: savePath, steps: steps };
  } catch (e) {
    steps.push({ step: 'connect', status: 0, ms: 0, error: e && e.name === 'TimeoutError' ? '连接超时' : String(e && e.message || e).slice(0, 160) });
    return { pass: false, version: '', freeSpace: 0, totalSpace: 0, steps: steps };
  }
}

async function qbLoginCookie(d) {
  try {
    const res = await fetch(d.url + '/api/v2/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer: d.url, origin: d.url },
      body: 'username=' + encodeURIComponent(d.user || '') + '&password=' + encodeURIComponent(dlPass(d)),
      redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT)
    });
    const sc = res.headers.get('set-cookie') || '';
    const m = /((?:QBT_)?SID[^=;\s]*)=([^;]+)/i.exec(sc);
    const txt = await res.text().catch(function () { return ''; });
    if (/fails/i.test(txt)) return '';
    /* 4.x 回 200 "Ok."，5.x 回 204 且正文为空，认 cookie 更稳 */
    return m && (res.status === 200 || res.status === 204 || res.status === 303) ? m[1] + '=' + m[2] : '';
  } catch (e) {
    return '';
  }
}
async function qbGet(d, path, cookie) {
  const opt = { redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT), headers: cookie ? { cookie: cookie } : {} };
  let res = await fetch(d.url + path, opt);
  let ck = cookie;
  if (res.status === 401 || res.status === 403) {
    const got = await qbLoginCookie(d);
    if (got) {
      ck = got;
      res = await fetch(d.url + path, { redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT), headers: { cookie: ck } });
    }
  }
  return { res: res, cookie: ck };
}

/* 分类只认下载器里真实存在的那些，数量按种子归到分类上 */
async function qbCategories(d) {
  try {
    const c = await qbGet(d, '/api/v2/torrents/categories', '');
    if (c.res.status !== 200) {
      return { pass: false, error: c.res.status === 403 ? 'qB 拒绝访问（IP 可能没在白名单或账号不对）' : 'qB 返回 ' + c.res.status };
    }
    const obj = await c.res.json().catch(function () { return null; });
    const counts = {};
    const info = await qbGet(d, '/api/v2/torrents/info', c.cookie);
    if (info.res.status === 200) {
      const list = await info.res.json().catch(function () { return []; });
      (Array.isArray(list) ? list : []).forEach(function (t) {
        const k = String((t && t.category) || '');
        counts[k] = (counts[k] || 0) + 1;
      });
    }
    const cats = Object.keys(obj || {}).map(function (k) {
      const v = obj[k] || {};
      return { name: String(v.name || k).slice(0, 60), savePath: String(v.savePath || '').slice(0, 200), count: counts[k] || 0 };
    });
    return { pass: true, cats: cats };
  } catch (e) {
    return { pass: false, error: e && e.name === 'TimeoutError' ? '连接超时' : String(e && e.message || e).slice(0, 160) };
  }
}

/* 把 .torrent 加进 qB。cookie 失效会重登一次；成功返回 Ok. */
async function addTorrent(d, buf, opts) {
  const o = opts || {};
  if (!d || !d.url) return { ok: false, error: 'NO_DOWNLOADER', message: '没有可用的下载器' };
  if (!buf || !buf.length) return { ok: false, error: 'EMPTY_TORRENT', message: '种子是空文件' };
  const base = d.url;
  function form() {
    const f = new FormData();
    f.append('torrents', new Blob([buf], { type: 'application/x-bittorrent' }), String(o.filename || 'upload.torrent'));
    if (o.savePath) f.append('savepath', String(o.savePath));
    if (o.category) f.append('category', String(o.category));
    if (o.tags) f.append('tags', String(o.tags));
    f.append('paused', o.paused ? 'true' : 'false');
    f.append('autoTMM', 'false');
    return f;
  }
  async function post(cookie) {
    const headers = { referer: base, origin: base };
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + '/api/v2/torrents/add', {
      method: 'POST', headers: headers, body: form(), redirect: 'manual', signal: AbortSignal.timeout(20000)
    });
    const text = (await res.text().catch(function () { return ''; })).trim();
    return { res: res, text: text };
  }
  try {
    let cookie = await qbLoginCookie(d);
    let r = await post(cookie);
    if ((r.res.status === 401 || r.res.status === 403) && cookie) {
      cookie = await qbLoginCookie(d);
      if (cookie) r = await post(cookie);
    }
    const okAdd = r.res.status === 200 && /^ok\.?$/i.test(r.text);
    if (!okAdd) return { ok: false, error: 'QB_ADD_FAILED', status: r.res.status, message: r.text.slice(0, 200) || ('HTTP ' + r.res.status) };
    return { ok: true, status: r.res.status, message: 'Ok.', authed: !!cookie };
  } catch (e) {
    return { ok: false, error: e && e.name === 'TimeoutError' ? 'TIMEOUT' : 'QB_ADD_FAILED', message: e && e.name === 'TimeoutError' ? '连接 qB 超时' : String(e && e.message || e).slice(0, 160) };
  }
}

return { probeDownloader, qbCategories, addTorrent, dlPass, publicDl, normDlUrl, sanitizeDl };
}
module.exports = { makeQb };

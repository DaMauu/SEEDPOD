/* 图床管道：把队列里的 data URL 截图上传到配置的图床，返回可写进简介的链接。
   默认只演练；真上传由调用方显式 allowReal，并且只接受已验证的 custom/local 接口。
   Pixhost / Imgbox 暂只做计划，不拿未验证的接口去真传。 */
const path = require('path');
const { openDB } = require('./db');
const secretbox = require('./secretbox');
const MAX_BYTES = 8 * 1024 * 1024;

function providerKey(name) {
  const s = String(name == null ? '' : name).trim().toLowerCase();
  if (!s || s === '站内' || s === 'none' || s === 'site') return 'none';
  if (s === 'pixhost') return 'pixhost';
  if (s === 'imgbox') return 'imgbox';
  if (s === '本地图床' || s === 'local') return 'local';
  if (s === 'chevereto' || s === 'pterclub' || s === 's3') return 'chevereto';
  return 'custom';
}
function envHeaders() {
  const raw = String(require('./env').read('IMAGE_HOST_HEADERS','PTA_IMAGE_HOST_HEADERS') || '').trim();
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}
function defaultProvider() {
  const explicit = require('./env').read('IMAGE_HOST_PROVIDER', 'PTA_IMAGE_HOST_PROVIDER');
  if (explicit) return providerKey(explicit);
  const url = String(require('./env').read('IMAGE_HOST_URL', 'PTA_IMAGE_HOST_URL') || '');
  if (/\/api\/1\/upload/i.test(url)) return 'chevereto';
  if (require('./env').read('IMAGE_HOST_USER', 'PTA_IMAGE_HOST_USER')) return 'chevereto';
  return 'custom';
}
function configFor(provider) {
  if (provider === 'chevereto') {
    const raw = String(require('./env').read('IMAGE_HOST_URL', 'PTA_IMAGE_HOST_URL') || 'https://s3.pterclub.net').trim();
    const url = /\/api\/1\/upload/i.test(raw) ? raw : raw.replace(/\/+$/, '') + '/api/1/upload';
    return {
      endpoint: url,
      field: 'source',
      token: String(require('./env').read('IMAGE_HOST_TOKEN', 'PTA_IMAGE_HOST_TOKEN') || require('./env').read('IMAGE_HOST_KEY', 'PTA_IMAGE_HOST_KEY') || '').trim(),
      headers: envHeaders(),
      verified: true,
      auth: 'chevereto',
      user: String(require('./env').read('IMAGE_HOST_USER', 'PTA_IMAGE_HOST_USER') || '').trim(),
      pass: String(require('./env').read('IMAGE_HOST_PASS', 'PTA_IMAGE_HOST_PASS') || ''),
      ssoHost: String(require('./env').read('IMAGE_HOST_SSO_HOST', 'PTA_IMAGE_HOST_SSO_HOST') || 'pterclub.net').trim()
    };
  }
  if (provider === 'custom' || provider === 'local') {
    return {
      endpoint: String(require('./env').read('IMAGE_HOST_URL','PTA_IMAGE_HOST_URL') || '').trim(),
      field: String(require('./env').read('IMAGE_HOST_FIELD','PTA_IMAGE_HOST_FIELD') || 'file').trim() || 'file',
      token: String(require('./env').read('IMAGE_HOST_TOKEN','PTA_IMAGE_HOST_TOKEN') || '').trim(),
      headers: envHeaders(),
      verified: true
    };
  }
  if (provider === 'pixhost') {
    return { endpoint: 'https://api.pixhost.to/images', field: 'img', token: '', headers: {}, verified: false };
  }
  if (provider === 'imgbox') {
    return { endpoint: 'https://imgbox.com/upload', field: 'file', token: '', headers: {}, verified: false };
  }
  return { endpoint: '', field: 'file', token: '', headers: {}, verified: false };
}
function dataUrlOf(s) {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(s || '').trim());
  if (!m) return null;
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { mime: m[1].toLowerCase(), buf: buf };
}
function findUrl(value, depth) {
  if (depth > 6 || value == null) return '';
  if (typeof value === 'string') return /^https?:\/\//i.test(value.trim()) ? value.trim() : '';
  if (Array.isArray(value)) {
    for (const v of value) { const u = findUrl(v, depth + 1); if (u) return u; }
    return '';
  }
  if (typeof value === 'object') {
    const keys = ['direct_url', 'display_url', 'url', 'show_url', 'th_url', 'link', 'src'];
    for (const k of keys) if (value[k]) { const u = findUrl(value[k], depth + 1); if (u) return u; }
    for (const k of Object.keys(value)) { const u = findUrl(value[k], depth + 1); if (u) return u; }
  }
  return '';
}
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
}
/* Chevereto 网页会话：账号密码登录 → auth_token + cookie → /json 上传。
   不依赖 API key；会话缓存在进程内，失效自动重登一次。 */
let CHEV_SESSION = null;

function cookieJarFrom(res, jar) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const fallback = res.headers.get('set-cookie');
  if (!list.length && fallback) list.push(fallback);
  list.forEach(function (raw) {
    const pair = String(raw || '').split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  });
}
function cookieHeader(jar) {
  return Object.keys(jar).map(function (k) { return k + '=' + jar[k]; }).join('; ');
}
function tokenFromHtml(html) {
  const m = /auth_token\s*=\s*["']([a-f0-9]{16,})["']/i.exec(String(html || ''));
  return m ? m[1] : '';
}
function chevBase(cfg) {
  return String(cfg.endpoint || '').replace(/\/api\/1\/upload\/?$/i, '').replace(/\/+$/, '');
}
let SSO_COOKIE_CACHE = { host: '', value: '', at: 0 };
function siteCookie(host) {
  const h = String(host || '').toLowerCase();
  if (SSO_COOKIE_CACHE.host === h && Date.now() - SSO_COOKIE_CACHE.at < 60000) return SSO_COOKIE_CACHE.value;
  const dir = path.resolve(require('./env').read('DATA_DIR', 'PTA_DATA') || path.join(__dirname, '..', '..', 'data'));
  let cookie = '';
  try {
    const db = openDB(path.join(dir, 'seedpod.db'));
    const row = db.prepare('SELECT cookie FROM credentials WHERE host = ?').get(h);
    db.close();
    if (row && row.cookie) cookie = secretbox.decrypt(row.cookie, secretbox.loadKey(dir).key);
  } catch (e) { cookie = ''; }
  SSO_COOKIE_CACHE = { host: h, value: cookie, at: Date.now() };
  return cookie;
}
async function cheveretoSsoLogin(cfg) {
  const base = chevBase(cfg);
  if (!base) throw new Error('没有配置图床地址');
  const host = String(cfg.ssoHost || require('./env').read('IMAGE_HOST_SSO_HOST', 'PTA_IMAGE_HOST_SSO_HOST') || 'pterclub.net').toLowerCase();
  const ptcookie = String(cfg.ssoCookie || siteCookie(host) || '');
  if (!ptcookie) throw new Error('猫站 cookie 不可用，先做一次会话自检');
  const jar = {};
  const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
  let r = await fetch(base + '/connect/goauth', { headers: ua, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(r, jar);
  let url = String(r.headers.get('location') || '');
  if (!url) throw new Error('图床 SSO 没有跳转地址');
  r = await fetch(url, { headers: Object.assign({}, ua, { cookie: ptcookie }), redirect: 'manual', signal: AbortSignal.timeout(25000) });
  url = String(r.headers.get('location') || '');
  if (!url) throw new Error('猫站 OAuth 没有回调地址，cookie 可能失效');
  for (let i = 0; i < 4 && url; i++) {
    const next = new URL(url, base + '/').toString();
    if (next.indexOf(base) !== 0) throw new Error('图床 SSO 跳转到外部域名：' + next.slice(0, 80));
    r = await fetch(next, { headers: Object.assign({}, ua, { cookie: cookieHeader(jar) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
    cookieJarFrom(r, jar);
    url = String(r.headers.get('location') || '');
    if (r.status === 200) break;
  }
  const home = await fetch(base + '/', { headers: Object.assign({}, ua, { cookie: cookieHeader(jar) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(home, jar);
  if (home.status >= 300 && home.status < 400 && /\/login/i.test(String(home.headers.get('location') || ''))) {
    throw new Error('图床 SSO 登录没成功，猫站 cookie 可能失效');
  }
  const html = await home.text().catch(function () { return ''; });
  const token = tokenFromHtml(html);
  if (!token) throw new Error('图床登录后没有 auth_token');
  CHEV_SESSION = { base: base, cookie: cookieHeader(jar), token: token, at: Date.now() };
  return CHEV_SESSION;
}
async function cheveretoLogin(cfg) {
  const base = chevBase(cfg);
  if (!base) throw new Error('没有配置图床地址');
  const user = String(cfg.user || '').trim();
  const pass = String(cfg.pass || '');
  if (!user || !pass) return cheveretoSsoLogin(cfg);
  const jar = {};
  const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
  const page = await fetch(base + '/login', { headers: ua, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(page, jar);
  const html = await page.text().catch(function () { return ''; });
  const token = tokenFromHtml(html);
  if (!token) throw new Error('图床登录页没有 auth_token');
  const body = new URLSearchParams();
  body.set('login-subject', user);
  body.set('password', pass);
  body.set('auth_token', token);
  const login = await fetch(base + '/login', {
    method: 'POST',
    headers: Object.assign({}, ua, {
      'content-type': 'application/x-www-form-urlencoded',
      referer: base + '/login', origin: base,
      cookie: cookieHeader(jar)
    }),
    body: body.toString(), redirect: 'manual', signal: AbortSignal.timeout(20000)
  });
  cookieJarFrom(login, jar);
  const location = String(login.headers.get('location') || '');
  if (login.status >= 400) throw new Error('图床登录失败：HTTP ' + login.status);
  /* 登录后回首页确认会话，并取新的 auth_token */
  const home = await fetch(base + '/', { headers: Object.assign({}, ua, { cookie: cookieHeader(jar) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(home, jar);
  if (home.status >= 300 && home.status < 400 && /\/login/i.test(String(home.headers.get('location') || ''))) {
    throw new Error('图床登录没成功，账号或密码不对');
  }
  const homeHtml = await home.text().catch(function () { return ''; });
  const fresh = tokenFromHtml(homeHtml) || token;
  CHEV_SESSION = { base: base, cookie: cookieHeader(jar), token: fresh, at: Date.now() };
  return CHEV_SESSION;
}
async function cheveretoWebUpload(buf, mime, name, cfg) {
  const base = chevBase(cfg);
  for (let attempt = 0; attempt < 2; attempt++) {
    const sess = (CHEV_SESSION && CHEV_SESSION.base === base && attempt === 0) ? CHEV_SESSION : await cheveretoLogin(cfg);
    const form = new FormData();
    form.append('action', 'upload');
    form.append('type', 'file');
    form.append('auth_token', sess.token);
    form.append('source', new Blob([buf], { type: mime }), String(name || 'image.jpg'));
    const res = await fetch(base + '/json', {
      method: 'POST',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', cookie: sess.cookie, referer: base + '/', origin: base },
      body: form, signal: AbortSignal.timeout(30000)
    });
    const text = await res.text().catch(function () { return ''; });
    let j = null;
    try { j = JSON.parse(text); } catch (e) { j = null; }
    if (res.status === 401 || res.status === 403 || (j && /denied|login/i.test(JSON.stringify(j.error || '')))) {
      CHEV_SESSION = null;
      continue;
    }
    if (!res.ok || !j) throw new Error('图床上传返回 HTTP ' + res.status + (text ? '：' + text.slice(0, 80) : ''));
    const img = (j.image && (j.image.url || j.image.display_url)) || (j.success && j.success.image && j.success.image.url) || '';
    if (!img) throw new Error('图床没有返回图片地址');
    return {
      url: img, attempts: attempt + 1,
      urlViewer: (j.image && (j.image.url_viewer || j.image.display_url)) || '',
      idEncoded: (j.image && j.image.id_encoded) || '',
      deleteUrl: (j.image && (j.image.delete_url || j.image.delete_url_encoded)) || ''
    };
  }
  throw new Error('图床会话失效，重新登录后仍被拒绝');
}

async function uploadOne(shot, cfg, opts) {
  const raw = String((shot && shot.url) || shot || '');
  if (/^https?:\/\//i.test(raw)) return { ok: true, url: raw, skipped: true, attempts: 0 };
  const data = dataUrlOf(raw);
  if (!data) return { ok: false, error: '不是 png/jpeg/webp 的 data URL', attempts: 0 };
  const total = Math.max(1, Math.min(5, Number(opts.retries) + 1 || 3));
  let last = '';
  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      if (cfg.auth === 'chevereto' && !cfg.token && (cfg.user && cfg.pass || cfg.ssoHost)) {
        const w = await cheveretoWebUpload(data.buf, data.mime, String((shot && shot.name) || ('shot' + attempt + '.jpg')).slice(0, 80), cfg);
        return { ok: true, url: w.url, attempts: attempt + 1, urlViewer: w.urlViewer || '', idEncoded: w.idEncoded || '', deleteUrl: w.deleteUrl || '' };
      }
      const form = new FormData();
      form.append(cfg.field, new Blob([data.buf], { type: data.mime }), String((shot && shot.name) || ('shot' + attempt + '.jpg')).slice(0, 80));
      const headers = Object.assign({}, cfg.headers || {});
      if (cfg.auth === 'chevereto') {
        if (!cfg.token) throw new Error('缺 Chevereto API key（IMAGE_HOST_TOKEN）');
        form.append('key', cfg.token);
        form.append('format', 'json');
      } else if (cfg.token) headers.authorization = 'Bearer ' + cfg.token;
      const res = await fetch(cfg.endpoint, {
        method: 'POST', headers: headers, body: form,
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error('图床返回 HTTP ' + res.status);
      const text = await res.text();
      let url = '';
      try { url = findUrl(JSON.parse(text), 0); } catch (e) { /* 不是 JSON，继续按文本找 */ }
      if (!url) {
        const m = /https?:\/\/[^\s"'<>]+/i.exec(text);
        if (m) url = m[0];
      }
      if (!url) throw new Error('图床没有返回图片地址');
      return { ok: true, url: url, attempts: attempt };
    } catch (e) {
      last = String(e && e.message || e).slice(0, 200);
      if (attempt < total) await sleep(opts.delayMs == null ? 250 : opts.delayMs);
    }
  }
  return { ok: false, error: last || '上传失败', attempts: total };
}
async function processShots(providerName, shots, opts) {
  const o = opts || {};
  const provider = providerKey(providerName);
  const list = Array.isArray(shots) ? shots : [];
  const total = list.length;
  const dryRun = o.dryRun !== false;
  const retries = Math.max(0, Math.min(4, Number(o.retries) || 0));
  if (!total) return { ok: false, code: 'NO_SHOTS', message: '还没有截图', provider: provider, dryRun: dryRun, total: 0, uploaded: 0, failed: 0, items: [] };
  if (provider === 'none') {
    return { ok: true, code: 'IMAGE_HOST_MANUAL', message: '站内图床还没接；截图保留在队列里', provider: provider, dryRun: dryRun, total: total, uploaded: 0, failed: 0, items: list.map(function (s, i) { return { index: i, name: String((s && s.name) || ('shot' + (i + 1))), status: 'skipped' }; }) };
  }
  const cfg = configFor(provider);
  if (dryRun) {
    return { ok: true, code: 'IMAGE_DRY_RUN', message: '演练：没有上传图片', provider: provider, dryRun: true, total: total, uploaded: 0, failed: 0, endpoint: cfg.endpoint, field: cfg.field, verified: cfg.verified, items: list.map(function (s, i) { return { index: i, name: String((s && s.name) || ('shot' + (i + 1))), status: 'planned', bytes: dataUrlOf(s && s.url) ? dataUrlOf(s.url).buf.length : 0 }; }) };
  }
  if (!o.allowReal) {
    return { ok: false, code: 'REAL_IMAGES_DISABLED', message: '图床真上传没打开：把配置 realImages 设为 true（或设 ALLOW_REAL=1）再试', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  if (!cfg.verified) {
    return { ok: false, code: 'IMAGE_HOST_UNVERIFIED', message: '这个图床还没验证真实上传接口；先用本地图床或自定义图床地址', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  if (!/^https?:\/\//i.test(cfg.endpoint)) {
    return { ok: false, code: 'IMAGE_HOST_NOT_CONFIGURED', message: '没有配置图床地址：设 IMAGE_HOST_URL（可选 IMAGE_HOST_FIELD / IMAGE_HOST_TOKEN）', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  const items = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const r = await uploadOne(s, cfg, { retries: retries, delayMs: o.delayMs });
    items.push(Object.assign({ index: i, name: String((s && s.name) || ('shot' + (i + 1))) }, r));
  }
  const uploaded = items.filter(function (x) { return x.ok; }).length;
  const failed = items.length - uploaded;
  return {
    ok: failed === 0,
    code: failed === 0 ? 'IMAGE_UPLOADED' : (uploaded ? 'IMAGE_UPLOAD_PARTIAL' : 'IMAGE_UPLOAD_FAILED'),
    message: failed === 0 ? '图片已上传' : ('图床上传失败 ' + failed + ' 张'),
    provider: provider, dryRun: false, total: total, uploaded: uploaded, failed: failed,
    endpoint: cfg.endpoint, field: cfg.field, items: items
  };
}
/* 源站 BBCode 里的远程图片：下载后转存图床，替换成图床链接。
   只处理 [img]http(s)://...[/img]；失败保留外链，不阻断发布。 */
const MIRROR_MAX = 8;
const MIRROR_MAX_BYTES = 8 * 1024 * 1024;
const MIRROR_TOTAL_BYTES = 40 * 1024 * 1024;

function isPrivateUrl(raw, allowPrivate) {
  if (allowPrivate) return false;
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return true; }
  if (!/^https?:$/.test(u.protocol)) return true;
  const h = u.hostname.toLowerCase();
  if (!h || h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  const m = /^172\.(\d+)\./.exec(h);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (h.indexOf(':') >= 0) return true;
  return false;
}
function extractImages(description) {
  const out = [];
  const seen = new Set();
  const re = /\[img\](\s*https?:\/\/[^\s\[\]]+)\s*\[\/img\]/gi;
  let m;
  while ((m = re.exec(String(description || '')))) {
    const url = m[1].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
async function mirrorDescription(description, opts) {
  const o = opts || {};
  const mode = String(o.mode || '转存到图床');
  const urls = extractImages(description);
  if (!urls.length) return { ok: true, code: 'NO_REMOTE_IMAGES', total: 0, uploaded: 0, failed: 0, description: String(description || '') };
  if (mode !== '转存到图床') return { ok: true, code: 'IMAGE_MODE_KEEP', total: urls.length, uploaded: 0, failed: 0, description: String(description || '') };
  if (o.dryRun !== false) return { ok: true, code: 'IMAGE_DRY_RUN', dryRun: true, total: urls.length, uploaded: 0, failed: 0, description: String(description || '') };
  if (!o.allowReal) return { ok: false, code: 'REAL_IMAGES_DISABLED', total: urls.length, uploaded: 0, failed: 0, description: String(description || '') };
  const provider = providerKey(o.provider || '');
  const cfg = configFor(provider);
  if (!cfg.verified) return { ok: false, code: 'IMAGE_HOST_UNVERIFIED', total: urls.length, uploaded: 0, failed: 0, description: String(description || '') };
  if (!/^https?:\/\//i.test(cfg.endpoint)) return { ok: false, code: 'IMAGE_HOST_NOT_CONFIGURED', total: urls.length, uploaded: 0, failed: 0, description: String(description || '') };
  const map = Object.assign({}, o.known || {});
  const list = urls.filter(function (u) { return !map[u]; }).slice(0, MIRROR_MAX);
  let uploaded = 0, failed = 0, bytes = 0, lastError = '';
  for (let i = 0; i < list.length; i++) {
    const url = list[i];
    if (isPrivateUrl(url, o.allowPrivate === true)) { failed++; lastError = '内网地址不抓'; continue; }
    if (i > 0) await sleep(o.delayMs == null ? 800 : o.delayMs);
    try {
      const res = await fetch(url, {
        headers: Object.assign({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          o.referer ? { referer: String(o.referer) } : {}),
        redirect: 'follow', signal: AbortSignal.timeout(o.timeoutMs || 20000)
      });
      if (!res.ok) throw new Error('图片返回 HTTP ' + res.status);
      if (isPrivateUrl(res.url, o.allowPrivate === true)) throw new Error('图片跳转到内网地址');
      const type = String(res.headers.get('content-type') || '').toLowerCase();
      if (type && type.indexOf('image/') !== 0) throw new Error('不是图片：' + type.slice(0, 40));
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('图片是空文件');
      if (buf.length > MIRROR_MAX_BYTES) throw new Error('图片超过 8MB');
      if (bytes + buf.length > MIRROR_TOTAL_BYTES) { failed++; lastError = '图片总量超过 40MB'; break; }
      bytes += buf.length;
      const mime = type || 'image/jpeg';
      const ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('webp') >= 0 ? 'webp' : (mime.indexOf('gif') >= 0 ? 'gif' : 'jpg'));
      const up = await uploadOne({ name: 'mirror-' + (i + 1) + '.' + ext, url: 'data:' + mime + ';base64,' + buf.toString('base64') }, cfg, { retries: o.retries == null ? 1 : o.retries, delayMs: 300 });
      if (!up.ok) throw new Error(up.error || '图床上传失败');
      map[url] = up.url;
      uploaded++;
    } catch (e) {
      failed++;
      lastError = String(e && e.message || e).slice(0, 120);
    }
  }
  let out = String(description || '');
  Object.keys(map).forEach(function (u) {
    out = out.split('[img]' + u + '[/img]').join('[img]' + map[u] + '[/img]');
  });
  return {
    ok: uploaded > 0 || failed === 0,
    code: failed === 0 ? 'IMAGES_MIRRORED' : (uploaded ? 'IMAGES_MIRRORED_PARTIAL' : 'IMAGES_MIRROR_FAILED'),
    total: urls.length, tried: list.length, uploaded: uploaded, failed: failed,
    message: lastError, description: out, map: map
  };
}

function replaceDescription(description, links) {
  let out = String(description == null ? '' : description);
  const list = Array.isArray(links) ? links.filter(function (x) { return x && x.url; }) : [];
  if (!list.length) return out.slice(0, 60000);
  out = out.replace(/\[img\]data:image\/[^\[\]]+\[\/img\]/gi, '').trim();
  const block = list.map(function (x) { return '[img]' + x.url + '[/img]'; }).join('\n');
  if (block && out.indexOf(block) < 0) out = out ? out + '\n\n' + block : block;
  return out.slice(0, 60000);
}

module.exports = { process: processShots, replaceDescription: replaceDescription, mirrorDescription: mirrorDescription, extractImages: extractImages, isPrivateUrl: isPrivateUrl, providerKey: providerKey, defaultProvider: defaultProvider, configFor: configFor, dataUrlOf: dataUrlOf };

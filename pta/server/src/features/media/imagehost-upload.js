/* 图床上传引擎：Chevereto 会话登录/网页上传 + 通用上传 + 批量 process。 */
const path = require('path');
const { providerKey, configFor, dataUrlOf } = require('./imagehost-config');

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
let SSO_PENDING = null;

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
const urlGuard = require('../../infra/url-guard');
function siteCookie(host) {
  const h = String(host || '').toLowerCase();
  if (SSO_COOKIE_CACHE.host === h && Date.now() - SSO_COOKIE_CACHE.at < 60000) return SSO_COOKIE_CACHE.value;
  const dir = path.resolve(require('../../infra/env').read('DATA_DIR', 'PTA_DATA') || path.join(__dirname, '..', '..', 'data'));
  let cookie = '';
  try {
    const c = require('../sites/credentials')(dir).get(h);
    cookie = c.cookie || '';
  } catch (e) { cookie = ''; }
  SSO_COOKIE_CACHE = { host: h, value: cookie, at: Date.now() };
  return cookie;
}
async function cheveretoSsoLoginInner(cfg) {
  const base = chevBase(cfg);
  if (!base) throw new Error('没有配置图床地址');
  const baseGate = await urlGuard.assertNoRebind(base);
  if (!baseGate.ok) throw new Error(baseGate.err);
  const host = String(cfg.ssoHost || require('../../infra/env').read('IMAGE_HOST_SSO_HOST', 'PTA_IMAGE_HOST_SSO_HOST') || '').toLowerCase();
  if (!host) throw new Error('没有配置图床 SSO 站点（IMAGE_HOST_SSO_HOST）');
  const ptcookie = String(cfg.ssoCookie || siteCookie(host) || '');
  if (!ptcookie) throw new Error('SSO 站点 cookie 不可用，先做一次会话自检');
  const jar = {};
  const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
  let r = await fetch(base + '/connect/goauth', { headers: ua, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(r, jar);
  let url = String(r.headers.get('location') || '');
  if (!url) throw new Error('图床 SSO 没有跳转地址');
  {
    const first = new URL(url, base + '/');
    if (!urlGuard.matches(host, first.hostname)) throw new Error('图床 SSO 跳转到非授权站点，拒绝发送来源站 cookie');
    url = first.toString();
    const sourceGate = await urlGuard.assertNoRebind(url);
    if (!sourceGate.ok) throw new Error(sourceGate.err);
  }
  r = await fetch(url, { headers: Object.assign({}, ua, { cookie: ptcookie }), redirect: 'manual', signal: AbortSignal.timeout(25000) });
  url = String(r.headers.get('location') || '');
  if (!url) throw new Error('SSO OAuth 没有回调地址，cookie 可能失效');
  for (let i = 0; i < 4 && url; i++) {
    const nextUrl = new URL(url, base + '/');
    if (!/^https?:$/.test(nextUrl.protocol) || !urlGuard.matches(new URL(base).hostname, nextUrl.hostname)) {
      throw new Error('图床 SSO 跳转到外部域名：' + nextUrl.toString().slice(0, 80));
    }
    const next = nextUrl.toString();
    r = await fetch(next, { headers: Object.assign({}, ua, { cookie: cookieHeader(jar) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
    cookieJarFrom(r, jar);
    url = String(r.headers.get('location') || '');
    if (r.status === 200) break;
  }
  const home = await fetch(base + '/', { headers: Object.assign({}, ua, { cookie: cookieHeader(jar) }), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  cookieJarFrom(home, jar);
  if (home.status >= 300 && home.status < 400 && /\/login/i.test(String(home.headers.get('location') || ''))) {
    throw new Error('图床 SSO 登录没成功，来源站 cookie 可能失效');
  }
  const html = await home.text().catch(function () { return ''; });
  const token = tokenFromHtml(html);
  if (!token) throw new Error('图床登录后没有 auth_token');
  CHEV_SESSION = { base: base, cookie: cookieHeader(jar), token: token, at: Date.now() };
  return CHEV_SESSION;
}
function cheveretoSsoLogin(cfg) {
  /* 并发上传共用同一次 SSO 登录，避免同时打两次授权页 */
  if (SSO_PENDING) return SSO_PENDING;
  SSO_PENDING = cheveretoSsoLoginInner(cfg).finally(function () { SSO_PENDING = null; });
  return SSO_PENDING;
}

async function cheveretoLogin(cfg) {
  const base = chevBase(cfg);
  if (!base) throw new Error('没有配置图床地址');
  const baseGate = await urlGuard.assertNoRebind(base);
  if (!baseGate.ok) throw new Error(baseGate.err);
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
      body: form, redirect: 'manual', signal: AbortSignal.timeout(30000)
    });
    if (res.status >= 300 && res.status < 400) throw new Error('图床跳转了，停止');
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
      const dg = await urlGuard.assertNoRebind(cfg.endpoint);
      if (!dg.ok) throw new Error(dg.err);
      const res = await fetch(cfg.endpoint, {
        method: 'POST', headers: headers, body: form, redirect: 'manual',
        signal: AbortSignal.timeout(30000)
      });
      if (res.status >= 300 && res.status < 400) throw new Error('图床跳转了，停止');
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

module.exports = { processShots, uploadOne, sleep, _ssoLogin: cheveretoSsoLogin, _webUpload: cheveretoWebUpload };

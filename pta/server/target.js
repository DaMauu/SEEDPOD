/* 目标站提交与回查：引擎是代码，站点是数据。
   表单映射优先读 data/site-pack.json 的 upload，其次 data/site-defs/<host>.json 的 uploadMap；
   没有映射就停下，不猜。真提交必须显式打开 realPublish。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const form = require('./form');
const sitePack = require('./site-pack');
const { makeQb } = require('./qb');

const ENGINES = {
  nexusphp: {
    uploadPath: '/takeupload.php',
    formPath: '/upload.php',
    fileField: 'file',
    verifyPath: '/torrents.php?search={title}',
    fields: {
      name: '{title}', small_descr: '{subtitle}', descr: '{description}', type: '{catId}',
      source_sel: '{source}', codec_sel: '{codec}', standard_sel: '{resolution}',
      audiocodec_sel: '{audio}', team_sel: '{team}', uplver: '{anonymousYes}'
    }
  },
  unit3d: {
    uploadPath: '/torrents/create',
    formPath: '/torrents/create',
    fileField: 'torrent',
    verifyPath: '/torrents?search={title}',
    fields: {
      name: '{title}', description: '{description}', category_id: '{catId}',
      type_id: '{typeId}', resolution_id: '{resolutionId}', anonymous: '{anonymous}'
    }
  },
  gazelle: {
    uploadPath: '/upload.php',
    formPath: '/upload.php',
    fileField: 'file_input',
    verifyPath: '/torrents.php?searchstr={title}',
    fields: {
      title: '{title}', group_description: '{description}', release_desc: '{description}',
      category: '{catId}', media: '{source}', format: '{codec}', bitrate: '{bitrate}',
      release_type: '{releaseType}'
    }
  }
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function safeHost(host) { return /^[a-z0-9][a-z0-9.-]*$/i.test(String(host || '')); }
function catMapOf(p, def, built) {
  const out = {};
  const b = built && built.catMap;
  if (b && !Array.isArray(b) && typeof b === 'object') Object.assign(out, b);
  const raw = (p && p.catMap) || (def && def.catMap);
  if (Array.isArray(raw)) {
    raw.forEach(function (x) {
      if (x && x.id != null && x.purpose) out[x.purpose] = String(x.id);
    });
  } else if (raw && typeof raw === 'object') {
    Object.assign(out, raw);
  }
  return out;
}

function makeTarget(ctx) {
  const { DATA_DIR, one } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const qb = makeQb(DATA_DIR);
  const packPath = path.join(DATA_DIR, 'site-pack.json');
  const defDir = path.join(DATA_DIR, 'site-defs');

  function readPack() {
    const p = readJson(packPath);
    return p && p.sites && typeof p.sites === 'object' ? p : { version: 1, sites: {} };
  }
  function readDef(host) { return readJson(path.join(defDir, host + '.json')); }

  function cookieOf(host) {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', host);
    if (!r || !r.cookie) return { err: '这个站还没有 cookie，先在站点页导入' };
    try { return { cookie: secretbox.decrypt(r.cookie, KEYRING.key) }; }
    catch (e) { return { err: 'cookie 解不开，请重新导入' }; }
  }

  function resolve(host) {
    if (!safeHost(host)) return null;
    const pack = readPack();
    const p = (pack.sites || {})[host] || {};
    const def = readDef(host) || {};
    const built = sitePack.siteOf(host) || {};
    const engine = String(p.engine || def.engine || built.engine || '').toLowerCase();
    const base = String(p.base || def.base || built.base || '').replace(/\/+$/, '');
    const e = ENGINES[engine];
    if (!engine || !base || !e) return null;
    const pm = p.upload || def.uploadMap || built.upload || {};
    const upload = {
      path: String(pm.path || e.uploadPath),
      formPath: String(pm.formPath || e.formPath || pm.path || e.uploadPath),
      fileField: String(pm.fileField || e.fileField),
      fields: Object.assign({}, e.fields, (built.upload && built.upload.fields) || {}, pm.fields || {})
    };
    const verify = Object.assign({ path: e.verifyPath }, built.verify || {}, p.verify || def.verify || {});
    return { host: host, engine: engine, base: base, upload: upload, verify: verify,
      catMap: catMapOf(p, def, built) };
  }

  function list() {
    const pack = readPack();
    const hosts = new Set(Object.keys(pack.sites || {}));
    try {
      fs.readdirSync(defDir).forEach(function (f) {
        if (/\.json$/.test(f)) hosts.add(f.replace(/\.json$/, ''));
      });
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    const bundled = sitePack.load();
    if (bundled.ok) Object.keys(bundled.pack.sites || {}).forEach(function (h) { hosts.add(h); });
    const out = [];
    hosts.forEach(function (host) {
      const t = resolve(host);
      if (!t) return;
      const c = one('SELECT cookie FROM credentials WHERE host = ?', host);
      const hasCookie = !!(c && c.cookie);
      out.push({ host: host, engine: t.engine, base: t.base, hasCookie: hasCookie,
        ready: !!(hasCookie && t.upload.path && t.upload.fields && Object.keys(t.upload.fields).length),
        uploadPath: t.upload.path, verifyPath: t.verify.path });
    });
    return out.sort(function (a, b) { return a.host.localeCompare(b.host); });
  }

  function vars(item) {
    const res = String(item.res || '');
    const size = String(item.size || '');
    return {
      title: String(item.title || '').replace(/\s+/g, ' ').trim(),
      subtitle: String(item.cn || [res, size].filter(Boolean).join(' · ')),
      description: String(item.intro || [item.title, res ? res + ' 原盘' : '', item.site ? '来源 ' + item.site : ''].filter(Boolean).join('，') + '。'),
      catId: String(item.catId || ''),
      category: String(item.cat || item.catId || ''),
      source: String(item.source || ''),
      codec: String(item.codec || ''),
      resolution: res,
      audio: String(item.audio || ''),
      team: String(item.team || item.group || ''),
      anonymous: item.anonymous ? '1' : '0',
      anonymousYes: item.anonymous ? 'yes' : '',
      typeId: String(item.typeId || ''),
      resolutionId: String(item.resolutionId || ''),
      year: String(item.year || ''),
      imdb: String(item.imdb || ''),
      shots: String((item.shots || []).length),
      bitrate: String(item.bitrate || ''),
      releaseType: String(item.releaseType || '')
    };
  }
  function expand(s, v) {
    return String(s == null ? '' : s).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
      return v[k] != null ? String(v[k]) : '';
    }).slice(0, 20000);
  }

  function plan(host, item) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包，提交不了', http: 400 };
    const v = vars(item);
    if (!v.catId) {
      const mapped = t.catMap[item.cat] != null ? t.catMap[item.cat] : t.catMap[String(item.cat || '')];
      if (mapped != null) v.catId = String(mapped);
      else if (/^\d+$/.test(String(item.cat || ''))) v.catId = String(item.cat);
    }
    const fields = {};
    Object.keys(t.upload.fields || {}).forEach(function (k) {
      const val = expand(t.upload.fields[k], v);
      if (val !== '') fields[k] = val;
    });
    const uv = Object.assign({}, v, { title: encodeURIComponent(v.title) });
    return { ok: true, data: {
      host: t.host, engine: t.engine, url: t.base + t.upload.path, method: 'POST',
      fileField: t.upload.fileField, fields: fields,
      verifyUrl: t.base + expand(t.verify.path || '', uv)
    } };
  }

  function torrentMeta(buf) { return qb.parseTorrent(buf); }

  async function fetchSourceTorrent(item) {
    if (!/^https?:\/\//i.test(String(item.downloadUrl || ''))) return { err: '条目没有下载地址' };
    const c = cookieOf(item.site);
    if (c.err) return { err: '来源站没有 cookie，取不到种子' };
    let res;
    try {
      res = await fetch(item.downloadUrl, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { err: '下载种子失败：' + String(e && e.message || e).slice(0, 120) };
    }
    if (res.status !== 200) return { err: '下载种子返回 ' + res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { err: '种子是空文件' };
    if (buf.length > 10 * 1024 * 1024) return { err: '种子超过 10MB' };
    if (buf[0] !== 0x64) return { err: '下载到的是网页，不是种子' };
    return { buf: buf };
  }

  function detailsFrom(text, base) {
    const m = /(?:href|location)["']?\s*[:=]\s*["']([^"']*(?:details\.php\?id=\d+|\/torrents?\/\d+)[^"']*)["']/i.exec(text) ||
      /(details\.php\?id=\d+|\/torrents?\/\d+)/i.exec(text);
    if (!m) return '';
    const u = m[1];
    if (/^https?:\/\//i.test(u)) return u;
    try { return new URL(u, base + '/').toString(); } catch (e) { return ''; }
  }

  async function submit(host, item, buf, opts) {
    const p = plan(host, item);
    if (!p.ok) return p;
    const meta = torrentMeta(buf);
    if (!meta.hash) return { ok: false, code: 'BAD_TORRENT', message: '种子解析不出 infohash', http: 400 };
    if (opts && opts.dryRun !== false) {
      return { ok: true, data: Object.assign({}, p.data, { dryRun: true, sent: false, torrent: meta }) };
    }
    if (!ctx.allowReal('realPublish')) {
      return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true 再试', http: 409 };
    }
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };

    const form = new FormData();
    Object.keys(p.data.fields).forEach(function (k) { form.append(k, p.data.fields[k]); });
    form.append(p.data.fileField, new Blob([buf], { type: 'application/x-bittorrent' }), String(item.title || 'upload').slice(0, 60) + '.torrent');

    let res;
    try {
      res = await fetch(p.data.url, {
        method: 'POST',
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        body: form, redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上：' + String(e && e.message || e).slice(0, 120), http: 502 };
    }
    const text = await res.text().catch(function () { return ''; });
    const location = res.headers.get('location') || '';
    const origin = (function () { try { return new URL(p.data.url).origin; } catch (e) { return p.data.url; } })();
    const whereRaw = location || detailsFrom(text, origin) || '';
    const where = /^https?:\/\//i.test(whereRaw) ? whereRaw
      : (function () { try { return new URL(whereRaw, origin + '/').toString(); } catch (e) { return ''; } })();
    const loginHit = /takelogin\.php|name=["']?username|请先登录|not\s+authorized|login/i.test(text) && !/logout|上传成功|success/i.test(text);
    if (res.status >= 400 || loginHit) {
      return { ok: false, code: loginHit ? 'LOGIN_REQUIRED' : 'UPLOAD_REJECTED',
        message: loginHit ? '目标站要重新登录，cookie 可能失效'
          : ('目标站返回 ' + res.status + (text ? '：' + text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '')),
        http: 502, data: { status: res.status } };
    }
    return { ok: true, data: {
      dryRun: false, sent: true, status: res.status, url: p.data.url, detailsUrl: where,
      infohash: meta.hash, torrent: meta, fields: Object.keys(p.data.fields), message: '已提交到目标站'
    } };
  }

  async function verify(host, item, buf, opts) {
    const p = plan(host, item);
    if (!p.ok) return p;
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const meta = buf ? torrentMeta(buf) : { hash: '', name: '' };
    const url = (opts && opts.url) || p.data.verifyUrl;
    let res;
    try {
      res = await fetch(url, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上', http: 502 };
    }
    const text = await res.text().catch(function () { return ''; });
    const norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    const title = norm(item.title);
    const found = res.status === 200 && (
      (title && norm(text).indexOf(title) >= 0) ||
      (meta.hash && text.toLowerCase().indexOf(meta.hash) >= 0) ||
      /details\.php\?id=\d+/.test(text)
    );
    return { ok: true, data: {
      found: found, url: url, status: res.status, title: found ? item.title : '',
      infohash: meta.hash, message: found ? '目标站已能看到这个种子' : '目标站页面里没找到这个种子'
    } };
  }

  /* 手动识别目标站上传页：只发一次 GET，不提交、不重试；必须已有 cookie。 */
  async function detectUploadForm(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有上传页配置', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 400 };
    let baseHost = '';
    try { baseHost = new URL(t.base).hostname.toLowerCase(); } catch (e) { return { ok: false, code: 'BAD_BASE', message: '站点 base 不是合法地址', http: 400 }; }
    const wantHost = String(host || '').toLowerCase();
    if (baseHost !== wantHost && !baseHost.endsWith('.' + wantHost)) {
      return { ok: false, code: 'BAD_BASE', message: '上传页域名和站点域名不一致，为免 cookie 外泄先停下', http: 400 };
    }
    if (!/^https?:/i.test(t.base)) return { ok: false, code: 'BAD_BASE', message: '站点 base 必须是 http/https', http: 400 };
    const formPath = t.upload.formPath || t.upload.path;
    const url = t.base + formPath;
    let res;
    try {
      res = await fetch(url, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { ok: false, code: 'DETECT_FAILED', message: e && e.name === 'TimeoutError' ? '上传页请求超时' : '上传页请求失败', http: 502 };
    }
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, code: 'LOGIN_REQUIRED', message: '上传页跳转了，cookie 可能已失效', http: 401 };
    }
    if (res.status !== 200) return { ok: false, code: 'HTTP_' + res.status, message: '上传页返回 ' + res.status, http: 502 };
    const html = await res.text().catch(function () { return ''; });
    if (!html) return { ok: false, code: 'EMPTY_PAGE', message: '上传页是空的', http: 502 };
    if (html.length > 2 * 1024 * 1024) return { ok: false, code: 'TOO_LARGE', message: '上传页超过 2MB，先截取表单部分', http: 413 };
    if (/takelogin\.php|login\.php|请先登录|sign in/i.test(html)) {
      return { ok: false, code: 'LOGIN_REQUIRED', message: '上传页看起来是登录页，cookie 可能已失效', http: 401 };
    }
    const forms = form.parse(html);
    if (!forms.length) return { ok: false, code: 'NO_FORM', message: '没识别到上传表单，可以继续手工编辑字段表', http: 422 };
    const f = forms[0];
    return { ok: true, data: { url: url, path: t.upload.path, formPath: formPath, fileField: f.fileField || '', fields: f.fields, forms: forms } };
  }

  return { list: list, resolve: resolve, plan: plan, submit: submit, verify: verify, detectUploadForm: detectUploadForm,
    fetchSourceTorrent: fetchSourceTorrent, torrentMeta: torrentMeta, cookieOf: cookieOf };
}

module.exports = { makeTarget, ENGINES };

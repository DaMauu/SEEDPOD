/* 目标站提交与回查：引擎是代码，站点是数据。
   表单映射优先读 data/site-pack.json 的 upload，其次 data/site-defs/<host>.json 的 uploadMap；
   没有映射就停下，不猜。真提交必须显式打开 realPublish。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const form = require('./form');
const adapters = require('./adapters');
const sitePack = require('./site-pack');
const siteMaps = require('./site-maps');
const meta = require('./meta');
const { makeQb } = require('./qb');
const torrentClean = require('./torrent-clean');
const match = require('./match');
const targetDefaults = require('./target-defaults');
const flowConfig = require('./flow-config');
const { makeDiscovery } = require('./target-discovery');
const { makePlan } = require('./target-plan');
const { makeSubmit } = require('./target-submit');
const { makeRequestQueue } = require('./request-queue');
const { catMapOf, composeSubtitle, expand, hideContent, stripHide, infoFieldKey, descrFieldKey,
  attrsOf, textOf, isDeletedPageText, parseDeleteForm, downloadLinksFromDetails } = require('./target-html');

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

function makeTarget(ctx) {
  const { DATA_DIR, one, db } = ctx;
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
    const maps = siteMaps.getHost(DATA_DIR, host);
    const valueMaps = Object.assign({}, (built.valueMaps || {}), (p.valueMaps || def.valueMaps || {}));
    valueMaps.team = Object.assign({}, valueMaps.team || {}, maps.team);
    return { host: host, engine: engine, base: base, upload: upload, verify: verify,
      catMap: Object.assign({}, catMapOf(p, def, built), maps.cat),
      tagMap: Object.assign({}, built.tagMap || {}, (p.tagMap || def.tagMap || {})),
      tagValue: String(p.tagValue || def.tagValue || built.tagValue || 'yes'),
      form: maps.form || null,
      valueMaps: valueMaps };
  }

  const { discoverAnnounce, announceCandidates } = makeDiscovery({ resolve: resolve, cookieOf: cookieOf, dataDir: DATA_DIR });
  const { plan } = makePlan({ resolve: resolve, ctx: ctx, one: one });
  const { submit, verify, fetchSourceTorrent } = makeSubmit({ throttle: throttle, resolve: resolve, plan: plan, cookieOf: cookieOf, one: one, ctx: ctx, torrentMeta: torrentMeta, textOf: textOf, downloadLinksFromDetails: downloadLinksFromDetails, isDeletedPageText: isDeletedPageText });

  /* 目标站请求队列：所有站共用一个队列，一次只发一个请求，默认间隔 8 秒（±20% 抖动）。
     查重、详情、上传、回查、权威种、删除都走这里，不设次数上限。 */
  const requestQueue = makeRequestQueue(ctx);
  async function throttle(host, kind) {
    if (!host) return { ok: false, code: 'NO_HOST', message: '没有目标站', http: 400 };
    await requestQueue.wait(kind === 'search' ? 'search' : 'write');
    return { ok: true };
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
      const srow = one('SELECT data FROM sites WHERE host = ?', host);
      let sd = null;
      if (srow) { try { sd = JSON.parse(srow.data) || {}; } catch (e) { sd = {}; } }
      out.push({ host: host, engine: t.engine, base: t.base, hasCookie: hasCookie,
        enabled: !sd || sd.enabled !== false,
        ready: !!(hasCookie && t.upload.path && t.upload.fields && Object.keys(t.upload.fields).length),
        uploadPath: t.upload.path, verifyPath: t.verify.path });
    });
    return out.sort(function (a, b) { return a.host.localeCompare(b.host); });
  }

  /* 来源站标签：优先用条目里的 tags；没有就从标题推（国配/粤语/中字/DIY 这类）。
     禁转/限转只表示来源站限制，不往目标站勾，避免把自己锁死。 */
  /* 副标题：只用源副标题或中文名，不拼分辨率和体积 */


  /* Unit3D 各站字段名不统一：bdinfo / bd_info / disc_info / video_info / media_info / mi_info
     都认；站点包直接把 {bdinfo}/{mediainfo} 塞进别的字段时，也按模板内容认。 */


  function torrentMeta(buf) { return qb.parseTorrent(buf); }





  /* 手动识别目标站上传页：只发一次 GET，不提交、不重试；必须已有 cookie。 */
  async function checkDeletedOnSite(t, id, headers) {
    let deleted = false, checkStatus = 0, hint = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chk = await fetch(t.base + '/details.php?id=' + encodeURIComponent(id), { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
        checkStatus = chk.status;
        const text = await chk.text().catch(function () { return ''; });
        hint = textOf(text).slice(0, 200);
        deleted = chk.status === 404 || /该种子曾被[\s\S]{0,120}删除|种子已被删除|该种子已删除|无效的种子|种子不存在|没有该ID的种子|not\s+found|没有找到/i.test(text);
      } catch (e) { checkStatus = 0; }
      if (deleted || attempt === 1) break;
      await new Promise(function (r) { setTimeout(r, 1200); });
    }
    return { deleted: deleted, checkStatus: checkStatus, hint: hint };
  }
  async function deleteTorrent(host, spec, opts) {

    const gate = await throttle(host, 'write');
    if (!gate.ok) return gate;
    const o = opts || {};
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const raw = String((spec && (spec.id || spec.url)) || spec || '').trim();
    let id = /^\d+$/.test(raw) ? raw : '';
    if (!id) {
      const mm = /(?:details\.php\?id=|\/torrents?\/)(\d+)/i.exec(raw);
      if (mm) id = mm[1];
    }
    if (!id) return { ok: false, code: 'BAD_TORRENT_ID', message: '需要种子 id 或 details.php?id=... 详情链接', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (o.check) {
      const chkRes = await checkDeletedOnSite(t, id, headers);
      return { ok: true, data: Object.assign({ dryRun: true, check: true, sent: false, id: id, reason: String(o.reason || '测试').slice(0, 500), reasonType: String(o.reasonType || '其他') }, chkRes) };
    }
    let edit;
    try {
      edit = await fetch(t.base + '/edit.php?id=' + encodeURIComponent(id), { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上', http: 502 };
    }
    if (edit.status >= 300 && edit.status < 400) return { ok: false, code: 'LOGIN_REQUIRED', message: '编辑页跳转了，cookie 可能已失效', http: 401 };
    if (edit.status !== 200) return { ok: false, code: 'HTTP_' + edit.status, message: '编辑页返回 ' + edit.status, http: 502 };
    const html = await edit.text().catch(function () { return ''; });
    const form = parseDeleteForm(html);
    if (!form) return { ok: false, code: 'NO_DELETE_FORM', message: '编辑页没找到删除表单', http: 422 };
    const wantLabel = String(o.reasonType || '其他');
    let radio = form.radios.filter(function (r) { return r.label.indexOf(wantLabel) >= 0 || (wantLabel === '其他' && /其他|other/i.test(r.label)); })[0] || null;
    if (!radio && /^\d+$/.test(wantLabel)) radio = form.radios.filter(function (r) { return r.value === wantLabel; })[0] || null;
    const reason = String(o.reason || '测试').slice(0, 500);
    if (!form.reasonField && !radio) return { ok: false, code: 'NO_DELETE_REASON', message: '删除表单没有原因字段，先人工确认', http: 422 };
    const plan = {
      id: id, action: form.action, reasonType: radio ? radio.value : '', reasonTypeLabel: radio ? radio.label.replace(/\s+/g, ' ').slice(0, 40) : '',
      reasonField: form.reasonField, reason: reason, fields: Object.keys(form.hidden)
    };
    if (o.dryRun !== false) return { ok: true, data: Object.assign({ dryRun: true, sent: false }, plan) };
    if (!ctx.allowReal('realPublish')) return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true 再试', http: 409 };
    const body = new URLSearchParams();
    Object.keys(form.hidden).forEach(function (k) { body.set(k, form.hidden[k]); });
    if (radio) body.set(form.radioName, radio.value);
    const selectedIdx = radio && radio.reasonIdx && radio.reasonIdx.length ? radio.reasonIdx : [0];
    form.reasonFields.forEach(function (n, i) { body.append(n, selectedIdx.indexOf(i) >= 0 ? reason : ''); });
    form.submit.forEach(function (b) { if (b.name) body.set(b.name, b.value); });
    let res;
    try {
      res = await fetch(new URL(form.action, t.base + '/').toString(), {
        method: 'POST', headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded' }, headers),
        body: body.toString(), redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
    } catch (e) {
      return { ok: false, code: 'DELETE_UNREACHABLE', message: '删除请求发不出去', http: 502 };
    }
    if (res.status >= 400) return { ok: false, code: 'DELETE_REJECTED', message: '删除请求返回 ' + res.status, http: 502 };
    const chkRes = await checkDeletedOnSite(t, id, headers);
    const deleted = chkRes.deleted;
    const data = Object.assign({ dryRun: false, sent: true, status: res.status, location: !!res.headers.get('location'), deleted: deleted, checkStatus: chkRes.checkStatus }, plan);
    if (!deleted) return { ok: false, code: 'DELETE_UNCONFIRMED', message: '删除请求已提交，但详情页仍能打开，请人工确认', http: 502, data: data };
    return { ok: true, data: data };
  }




  /* 读目标站详情页的媒介/副标题/简介/标签，用于查重时判断原盘/DIY/限转 */
  async function fetchDetailsInfo(host, detailsUrl) {

    const gate = await throttle(host, 'search');
    if (!gate.ok) return gate;
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有站点定义' };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err };
    let pageUrl;
    try { pageUrl = new URL(detailsUrl, t.base + '/').toString(); } catch (e) { return { ok: false, code: 'BAD_DETAILS_URL', message: '详情地址不合法' }; }
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const pageHost = (function () { try { return new URL(pageUrl).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost || (pageHost !== baseHost && !pageHost.endsWith('.' + baseHost))) return { ok: false, code: 'BAD_DETAILS_HOST', message: '详情页域名不一致' };
    let page;
    try { page = await fetch(pageUrl, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
    catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上' }; }
    if (page.status !== 200) return { ok: false, code: 'DETAILS_HTTP_' + page.status, message: '详情页返回 ' + page.status };
    const html = await page.text().catch(function () { return ''; });
    const d = adapters.parseDetail(html);
    return { ok: true, data: {
      url: pageUrl, subtitle: d.subtitle || '', descr: d.descr || '', descrBb: d.descrBb || '',
      tags: d.tags || '', medium: d.medium || '', category: d.category || '',
      region: d.region || '', language: d.language || '', poster: d.poster || '',
      bdinfo: d.bdinfo || '', mediainfo: d.mediainfo || '',
      sizeText: d.sizeText || '', sizeBytes: d.sizeBytes || 0, pageTitle: d.pageTitle || ''
    } };
  }

  async function fetchDetailsTorrent(host, detailsUrl) {

    const gate = await throttle(host, 'write');
    if (!gate.ok) return gate;
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    let pageUrl;
    try { pageUrl = new URL(detailsUrl, t.base + '/').toString(); } catch (e) { return { ok: false, code: 'BAD_DETAILS_URL', message: '详情地址不合法', http: 400 }; }
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const pageHost = (function () { try { return new URL(pageUrl).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost || (pageHost !== baseHost && !pageHost.endsWith('.' + baseHost))) return { ok: false, code: 'BAD_DETAILS_HOST', message: '详情页域名和站点不一致，为免 cookie 外泄先停下', http: 400 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    let page;
    try { page = await fetch(pageUrl, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
    catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上', http: 502 }; }
    if (page.status !== 200) return { ok: false, code: 'DETAILS_HTTP_' + page.status, message: '详情页返回 ' + page.status, http: 502 };
    const html = await page.text().catch(function () { return ''; });
    if (/takelogin\.php|login\.php|请先登录/i.test(html)) return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页要重新登录，cookie 可能失效', http: 401 };
    const links = downloadLinksFromDetails(html, t.base);
    if (!links.length) return { ok: false, code: 'NO_DOWNLOAD_LINK', message: '详情页没找到下载种子链接', http: 422 };
    /* 详情页一个间隔，下载种子再一个间隔 */
    const gate2 = await throttle(host, 'write');
    if (!gate2.ok) return gate2;
    let last = '';
    for (const link of links.slice(0, 8)) {
      const dlHost = (function () { try { return new URL(link).hostname.toLowerCase(); } catch (e) { return ''; } })();
      if (dlHost !== baseHost && !dlHost.endsWith('.' + baseHost)) { last = 'BAD_DOWNLOAD_HOST'; continue; }
      let res;
      try { res = await fetch(link, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(30000) }); }
      catch (e) { last = 'DOWNLOAD_UNREACHABLE'; continue; }
      if (res.status !== 200) { last = 'DOWNLOAD_HTTP_' + res.status; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 10 * 1024 * 1024) { last = buf.length ? 'TORRENT_TOO_LARGE' : 'EMPTY_TORRENT'; continue; }
      if (buf[0] !== 0x64) { last = 'NOT_TORRENT'; continue; }
      const meta = torrentMeta(buf);
      if (!meta.hash) { last = 'BAD_TORRENT'; continue; }
      return { ok: true, data: { buf: buf, meta: meta, downloadUrl: link, pageUrl: pageUrl } };
    }
    return { ok: false, code: last || 'NO_TORRENT', message: '详情页下载链接里没有可用种子', http: 502 };
  }

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
    const withFile = forms.filter(function (x) { return !!x.fileField; })
      .sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; });
    const f = withFile[0] || forms.slice().sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; })[0];
    return { ok: true, data: { url: url, path: t.upload.path, formPath: formPath, formCount: forms.length, fileField: f.fileField || '', fields: f.fields, forms: forms } };
  }

  return { list: list, resolve: resolve, plan: plan, submit: submit, verify: verify, detectUploadForm: detectUploadForm,
    deleteTorrent: deleteTorrent, fetchDetailsInfo: fetchDetailsInfo, discoverAnnounce: discoverAnnounce, announceCandidates: announceCandidates, fetchDetailsTorrent: fetchDetailsTorrent, fetchSourceTorrent: fetchSourceTorrent, torrentMeta: torrentMeta, cookieOf: cookieOf };
}

module.exports = { makeTarget, ENGINES };

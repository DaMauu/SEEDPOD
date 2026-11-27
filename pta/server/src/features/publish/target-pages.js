/* 目标站页面类操作：删除、详情/种子、上传页探测、种子元数据。 */
const adapters = require('../../infra/adapters/index');
const form = require('../../infra/form');
const { textOf, parseDeleteForm, downloadLinksFromDetails } = require('./target-html');
const urlGuard = require('../../infra/url-guard');
const { uploadFormPaths } = require('../sites/defaults');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }
/* 表单 action 可能是 takeupload.php 这种相对路径；统一成带前导 / 的站点路径 */
function formActionPath(action, base, formPath) {
  const a = String(action || '').trim();
  if (!a) return formPath;
  try {
    const u = new URL(a, String(base || '').replace(/\/+$/, '') + '/' + String(formPath || '').replace(/^\/+/, ''));
    return u.pathname + (u.search || '');
  } catch (e) {
    return a.charAt(0) === '/' ? a : '/' + a;
  }
}

function makeTargetPages(deps) {
  const resolve = deps.resolve;
  const cookieOf = deps.cookieOf;
  const throttle = deps.throttle;
  const ctx = deps.ctx;
  const qb = deps.qb;

  function torrentMeta(buf) { return qb.parseTorrent(buf); }
  /* 所有目标站外联先用统一 DNS 复检；字面内网地址按显式配置放行。 */
  async function dnsErr(url) {
    const g = await urlGuard.assertNoRebind(url);
    return g.ok ? '' : (g.err || '域名解析到内网地址，拒绝连接');
  }

  async function checkDeletedOnSite(t, id, headers) {
    let deleted = false, checkStatus = 0, hint = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const checkUrl = t.base + '/details.php?id=' + encodeURIComponent(id);
        const dg = await dnsErr(checkUrl);
        if (dg) return { deleted: false, checkStatus: 0, hint: dg };
        const chk = await fetch(checkUrl, { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
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
      const editUrl = t.base + '/edit.php?id=' + encodeURIComponent(id);
      const dg = await dnsErr(editUrl);
      if (dg) return { ok: false, code: 'DNS_BLOCKED', message: dg, http: 422 };
      edit = await fetch(editUrl, { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
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
    let actionUrl;
    try { actionUrl = new URL(form.action, t.base + '/'); } catch (e) { return { ok: false, code: 'BAD_DELETE_ACTION', message: '删除表单地址不合法', http: 422 }; }
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const actHost = String(actionUrl.hostname || '').toLowerCase();
    if (!baseHost || (actHost !== baseHost && !actHost.endsWith('.' + baseHost))) {
      return { ok: false, code: 'BAD_DELETE_ACTION', message: '删除表单指向了外部域名，为免 cookie 外泄先停下', http: 422 };
    }
    const body = new URLSearchParams();
    Object.keys(form.hidden).forEach(function (k) { body.set(k, form.hidden[k]); });
    if (radio) body.set(form.radioName, radio.value);
    const selectedIdx = radio && radio.reasonIdx && radio.reasonIdx.length ? radio.reasonIdx : [0];
    form.reasonFields.forEach(function (n, i) { body.append(n, selectedIdx.indexOf(i) >= 0 ? reason : ''); });
    form.submit.forEach(function (b) { if (b.name) body.set(b.name, b.value); });
    let res;
    try {
      const dg = await dnsErr(actionUrl.toString());
      if (dg) return { ok: false, code: 'DNS_BLOCKED', message: dg, http: 422 };
      res = await fetch(actionUrl.toString(), {
        method: 'POST', headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded' }, headers),
        body: body.toString(), redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
    } catch (e) {
      return { ok: false, code: 'DELETE_UNREACHABLE', message: '删除请求发不出去', http: 502 };
    }
    if (res.status >= 400) return { ok: false, code: 'DELETE_REJECTED', message: '删除请求返回 ' + res.status, http: 502 };
    const chkRes = await checkDeletedOnSite(t, id, headers);
    /* 详情页 3xx 基本是登录页跳转：cookie 失效要单独报，不混成“没删掉” */
    if (!chkRes.deleted && chkRes.checkStatus >= 300 && chkRes.checkStatus < 400) {
      return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页跳转了，cookie 可能已失效', http: 401, data: { id: id, sent: true, checkStatus: chkRes.checkStatus } };
    }
    const deleted = chkRes.deleted;
    const data = Object.assign({ dryRun: false, sent: true, status: res.status, location: !!res.headers.get('location'), deleted: deleted, checkStatus: chkRes.checkStatus }, plan);
    if (!deleted) return { ok: false, code: 'DELETE_UNCONFIRMED', message: '删除请求已提交，但详情页仍能打开，请人工确认', http: 502, data: data };
    return { ok: true, data: data };
  }

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
    try {
      const dg = await dnsErr(pageUrl);
      if (dg) return { ok: false, code: 'DNS_BLOCKED', message: dg, http: 422 };
      page = await fetch(pageUrl, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    } catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上' }; }
    if (page.status >= 300 && page.status < 400) return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页跳转了，cookie 可能已失效', http: 401 };
    if (page.status !== 200) return { ok: false, code: 'DETAILS_HTTP_' + page.status, message: '详情页返回 ' + page.status };
    if ((Number(page.headers.get('content-length')) || 0) > 2 * 1024 * 1024) return { ok: false, code: 'DETAILS_TOO_LARGE', message: '详情页超过 2MB' };
    const html = await page.text().catch(function () { return ''; });
    /* 200 也可能是登录页：不能把空详情当成成功 */
    if (/takelogin\.php|login\.php|请先登录|not\s+authorized/i.test(html)) return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页要重新登录，cookie 可能失效', http: 401 };
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
    try {
      const dg = await dnsErr(pageUrl);
      if (dg) return { ok: false, code: 'DNS_BLOCKED', message: dg, http: 422 };
      page = await fetch(pageUrl, { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    }
    catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上', http: 502 }; }
    if (page.status >= 300 && page.status < 400) return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页跳转了，cookie 可能已失效', http: 401 };
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
      try {
        const dg = await dnsErr(link);
        if (dg) { last = 'DNS_BLOCKED'; continue; }
        res = await fetch(link, { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
      }
      catch (e) { last = 'DOWNLOAD_UNREACHABLE'; continue; }
      if (res.status !== 200) { last = 'DOWNLOAD_HTTP_' + res.status; continue; }
      if ((Number(res.headers.get('content-length')) || 0) > 10 * 1024 * 1024) { last = 'TORRENT_TOO_LARGE'; continue; }
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
    const firstPath = t.upload.formPath || t.upload.path;
    const paths = uploadFormPaths(t.engine, firstPath).slice(0, 4);
    for (let i = 0; i < paths.length; i++) {
      const formPath = paths[i];
      const url = t.base + formPath;
      if (i > 0) await sleep(800);
      let res;
      try {
        const dg = await dnsErr(url);
        if (dg) return { ok: false, code: 'DNS_BLOCKED', message: dg, http: 422 };
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
      if (res.status === 429 || res.status === 403 || res.status === 503) {
        return { ok: false, code: 'RATE_LIMITED', message: '上传页返回 ' + res.status + '，先停下', http: 429 };
      }
      if (res.status === 404 || res.status === 405) continue;
      if (res.status !== 200) return { ok: false, code: 'HTTP_' + res.status, message: '上传页返回 ' + res.status, http: 502 };
      const html = await res.text().catch(function () { return ''; });
      if (!html) return { ok: false, code: 'EMPTY_PAGE', message: '上传页是空的', http: 502 };
      if (html.length > 2 * 1024 * 1024) return { ok: false, code: 'TOO_LARGE', message: '上传页超过 2MB，先截取表单部分', http: 413 };
      if (/takelogin\.php|login\.php|请先登录|sign in/i.test(html)) {
        return { ok: false, code: 'LOGIN_REQUIRED', message: '上传页看起来是登录页，cookie 可能已失效', http: 401 };
      }
      const forms = form.parse(html);
      if (!forms.length) {
        return { ok: false, code: 'NO_FORM', message: '上传页正常返回但没有表单：账号可能没有上传权限，或站点暂未开放上传；引擎默认字段仍可用', http: 422 };
      }
      const withFile = forms.filter(function (x) { return !!x.fileField; })
        .sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; });
      const f = withFile[0] || forms.slice().sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; })[0];
      return { ok: true, data: { url: url, path: formActionPath(f.action, t.base, formPath), formPath: formPath, formCount: forms.length, fileField: f.fileField || '', fields: f.fields, forms: forms } };
    }
    return { ok: false, code: 'NO_FORM', message: '默认和备用上传页路径都没找到表单；先确认站点上传页路径', http: 422 };
  }

  return { torrentMeta, deleteTorrent, fetchDetailsInfo, fetchDetailsTorrent, detectUploadForm };
}

module.exports = { makeTargetPages };

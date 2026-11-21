/* 上传提交与回查：取种、提交、发布后校验。 */
const adapters = require('./adapters');
const match = require('./match');
const urlGuard = require('./url-guard');

/* 来源种子下载地址必须落在来源站（含子域）或其 base 域，避免把 cookie 带到外部 host */
function sameSiteUrl(site, base, raw) {
  let u;
  try { u = new URL(String(raw || ''), base ? String(base).replace(/\/+$/, '') + '/' : undefined); }
  catch (e) { return false; }
  const hosts = [];
  const siteHost = String(site || '').toLowerCase().trim();
  if (siteHost) hosts.push(siteHost);
  try { const b = new URL(String(base || '')); if (b.hostname) hosts.push(b.hostname.toLowerCase()); } catch (e) { /* 忽略 */ }
  if (!hosts.length) return false;
  const h = u.hostname.toLowerCase();
  return hosts.some(function (x) { return h === x || h.endsWith('.' + x); });
}

function makeSubmit(deps) {
  const throttle = deps.throttle;
  const resolve = deps.resolve;
  const plan = deps.plan;
  const cookieOf = deps.cookieOf;
  const one = deps.one;
  const ctx = deps.ctx;
  const torrentMeta = deps.torrentMeta;
  const textOf = deps.textOf;
  const downloadLinksFromDetails = deps.downloadLinksFromDetails;
  const isDeletedPageText = deps.isDeletedPageText;

  async function fetchSourceTorrent(item) {
    const gate = await throttle(item && item.site, 'write');
    if (!gate.ok) return { err: gate.message || gate.code || '来源站请求受限' };
    /* 列表页给的下载地址常是 download.php?id=…，按来源站 base 补成绝对地址 */
    let dlUrl = String(item.downloadUrl || '');
    if (dlUrl && !/^https?:\/\//i.test(dlUrl)) {
      const def = resolve(item.site);
      if (def && def.base) {
        try { dlUrl = new URL(dlUrl, def.base + '/').toString(); } catch (e) { /* 留原样 */ }
      }
    }
    if (!/^https?:\/\//i.test(dlUrl)) return { err: '条目没有下载地址' };
    const srcDef = resolve(item.site);
    if (!sameSiteUrl(item.site, srcDef && srcDef.base, dlUrl)) {
      return { err: '下载地址不是来源站域名，拒绝发送 cookie' };
    }
    /* 来源站停用就不抓，避免对停用站发真实请求 */
    if (item.site) {
      const row = one('SELECT data FROM sites WHERE host = ?', String(item.site).toLowerCase());
      let sd = null;
      if (row) { try { sd = JSON.parse(row.data) || {}; } catch (e) { sd = {}; } }
      if (sd && sd.enabled === false) return { err: '来源站已停用：' + item.site };
    }
    const dnsGate = await urlGuard.assertNoRebind(dlUrl);
    if (!dnsGate.ok) return { err: dnsGate.err };
    const c = cookieOf(item.site);
    if (c.err) return { err: '来源站没有 cookie，取不到种子' };
    let res;
    try {
      res = await fetch(dlUrl, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { err: '下载种子失败：' + String(e && e.message || e).slice(0, 120) };
    }
    if (res.status !== 200 && res.status >= 300 && res.status < 400) {
      return { err: '下载地址跳转了，为避免 cookie 外泄停止' };
    }
    if (res.status !== 200) {
      /* Unit3D 下载路由有 /torrents/download/ID 和 /torrents/ID/download 两种；
         404 时回详情页找真实下载链接再试一次 */
      const t = resolve(item.site);
      if (item.detailsUrl && t && t.base && urlGuard.sameSite(item.site, t.base, item.detailsUrl)) {
        try {
          const pageUrl = new URL(item.detailsUrl, t.base + '/').toString();
          const gate2 = await throttle(item.site, 'write');
          if (gate2.ok) {
            const page = await fetch(pageUrl, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
            const html = (page.status >= 200 && page.status < 300) ? await page.text().catch(function () { return ''; }) : '';
            const links = downloadLinksFromDetails(html, t.base).filter(function (x) { return urlGuard.sameSite(item.site, t.base, x); });
            for (const link of links.slice(0, 4)) {
              const r2 = await fetch(link, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
              if (r2.status !== 200) continue;
              if ((Number(r2.headers.get('content-length')) || 0) > 10 * 1024 * 1024) continue;
              const b2 = Buffer.from(await r2.arrayBuffer());
              if (b2.length && b2.length <= 10 * 1024 * 1024 && b2[0] === 0x64) return { buf: b2 };
            }
          }
        } catch (e) { /* 回退失败，按原错误返回 */ }
      }
      return { err: '下载种子返回 ' + res.status };
    }
    const clen = Number(res.headers.get('content-length')) || 0;
    if (clen > 10 * 1024 * 1024) { try { res.body && res.body.cancel(); } catch (e) { /* 取消失败不挡错误返回 */ } return { err: '种子超过 10MB' }; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { err: '种子是空文件' };
    if (buf.length > 10 * 1024 * 1024) return { err: '种子超过 10MB' };
    if (buf[0] !== 0x64) return { err: '下载到的是网页，不是种子' };
    return { buf: buf };
  }

  function detailsFrom(text, base) {
    /* 上传响应里优先取带 uploaded=1 的详情链接，避免抓到侧栏的其它种子 */
    const up = /(?:href|location)["']?\s*[:=]\s*["']([^"']*details\.php\?id=\d+[^"']*uploaded=1[^"']*)["']/i.exec(text) ||
      /(details\.php\?id=\d+[^"'\s<>]*uploaded=1[^"'\s<>]*)/i.exec(text);
    const m = up || /(?:href|location)["']?\s*[:=]\s*["']([^"']*(?:details\.php\?id=\d+|\/torrents?\/\d+)[^"']*)["']/i.exec(text) ||
      /(details\.php\?id=\d+|\/torrents?\/\d+)/i.exec(text);
    if (!m) return '';
    const u = String(m[1]).replace(/&amp;/g, '&');
    if (/^https?:\/\//i.test(u)) return u;
    try { return new URL(u, base + '/').toString(); } catch (e) { return ''; }
  }

  async function submit(host, item, buf, opts) {

    const gate = await throttle(host, 'write');
    if (!gate.ok) return gate;
    const p = opts && opts.plan ? { ok: true, data: opts.plan } : plan(host, item);
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
    const successText = /上传成功|发布成功|种子已|success|torrent.{0,20}(uploaded|created)/i.test(text);
    const whereRaw = location || (successText ? detailsFrom(text, origin) : '') || '';
    const where = /^https?:\/\//i.test(whereRaw) ? whereRaw
      : (function () { try { return new URL(whereRaw, origin + '/').toString(); } catch (e) { return ''; } })();
    const loginHit = /takelogin\.php|name=["']?username|请先登录|not\s+authorized|login/i.test(text) && !/logout|上传成功|success/i.test(text);
    if (res.status >= 400 || loginHit) {
      return { ok: false, code: loginHit ? 'LOGIN_REQUIRED' : 'UPLOAD_REJECTED',
        message: loginHit ? '目标站要重新登录，cookie 可能失效'
          : ('目标站返回 ' + res.status + (text ? '：' + text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '')),
        http: 502, data: { status: res.status } };
    }
    const uncertain = !where && !successText;
    const hintText = textOf(text);
    const hi = hintText.search(/上传失败|上传成功|发布成功|错误|Error/i);
    const responseHint = (hi >= 0 ? hintText.slice(hi) : hintText).slice(0, 300);
    return { ok: true, data: {
      dryRun: false, sent: true, status: res.status, url: p.data.url, detailsUrl: where,
      infohash: meta.hash, torrent: meta, fields: Object.keys(p.data.fields), uncertain: uncertain,
      responseHint: responseHint,
      message: uncertain ? '提交返回 200，但没拿到详情页/成功提示，需人工确认' : '已提交到目标站'
    } };
  }

  async function verify(host, item, buf, opts) {

    const gate = await throttle(host, 'search');
    if (!gate.ok) return gate;
    const p = plan(host, item);
    if (!p.ok) return p;
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const meta = buf ? torrentMeta(buf) : { hash: '', name: '' };
    const url = (opts && opts.url) || p.data.verifyUrl;
    /* 手工回查地址必须落在目标站，否则会把 cookie 带到外部 host */
    try {
      const base = new URL(p.data.url);
      const u = new URL(url, p.data.url);
      const bh = base.hostname.toLowerCase();
      const uh = u.hostname.toLowerCase();
      if (uh !== bh && !uh.endsWith('.' + bh)) return { ok: false, code: 'BAD_VERIFY_URL', message: '回查地址不是目标站域名', http: 400 };
    } catch (e) { return { ok: false, code: 'BAD_VERIFY_URL', message: '回查地址不合法', http: 400 }; }
    let res;
    try {
      res = await fetch(url, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上', http: 502 };
    }
    const text = await res.text().catch(function () { return ''; });
    const norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    const title = norm(item.title);
    const hash = String((opts && opts.hash) || meta.hash || '').toLowerCase();
    const isDetails = /details\.php\?id=\d+|\/torrents?\/\d+/i.test(url);
    /* 同 infohash 被删进回收站时，上传会 302 回旧 ID；详情页仍能打开但带回收站标记，
       不能当成“刚发布成功”，否则会拿旧种子去辅种。 */
    if (res.status === 200 && isDetails && isDeletedPageText(text)) {
      return { ok: true, data: {
        found: false, deleted: true, url: url, status: res.status, title: '', detailsUrl: '',
        infohash: meta.hash, rows: 0, mode: 'details',
        message: '目标站同 infohash 的种子已在回收站'
      } };
    }
    let found = false;
    let matchedTitle = '';
    let matchedUrl = '';
    let rows = 0;
    if (res.status === 200 && isDetails) {
      /* 详情页用解析后的标题/副标题比对，别拿整页 HTML 硬找 */
      const page = adapters.parseDetail(text);
      const pageText = norm([page.pageTitle, page.subtitle, page.descr].filter(Boolean).join(' '));
      found = !!(title && pageText.indexOf(title) >= 0) || !!(hash && String(page.infohash || '').toLowerCase().indexOf(hash) >= 0);
      if (!found && page.subtitle) {
        const cn = norm(item.cn || '');
        const sub = norm(page.subtitle);
        if (cn && sub && (sub.indexOf(cn) >= 0 || cn.indexOf(sub) >= 0)) found = true;
        if (!found) {
          try { const cmp = match.compare(item, { title: page.subtitle, infohash: page.infohash || '' }); found = cmp.same && cmp.score >= 50; } catch (e) { /* ignore */ }
        }
      }
      if (!found) found = !!(title && norm(text).indexOf(title) >= 0) || !!(hash && text.toLowerCase().indexOf(hash) >= 0);
      if (found) { matchedUrl = url; matchedTitle = String(page.subtitle || page.pageTitle || item.title || '').slice(0, 200); }
    } else if (res.status === 200) {
      const list = adapters.parseList(text, p.data.engine);
      rows = list.length;
      const hit = list.filter(function (r) {
        const d = norm(r.detailsUrl + ' ' + r.downloadUrl);
        if (hash && d.indexOf(hash) >= 0) return true;
        if (title && norm(r.title).indexOf(title) >= 0) return true;
        try {
          const cmp = match.compare(item, { title: r.title, size: r.size || '', res: r.res || '', year: r.year || 0, infohash: r.infohash || '' });
          return cmp.same && cmp.score >= 50;
        } catch (e) { return false; }
      })[0];
      found = !!hit;
      matchedTitle = hit ? String(hit.title || '').slice(0, 200) : '';
      matchedUrl = hit && hit.detailsUrl ? String(hit.detailsUrl) : '';
    }
    return { ok: true, data: {
      found: found, url: url, status: res.status, title: found ? (matchedTitle || item.title) : '', detailsUrl: matchedUrl,
      infohash: meta.hash, rows: rows, mode: isDetails ? 'details' : 'search',
      message: found ? '目标站列表里找到这个种子' : '目标站列表里没找到这个种子'
    } };
  }

  return { submit: submit, verify: verify, fetchSourceTorrent: fetchSourceTorrent };
}

module.exports = { makeSubmit, sameSiteUrl };

/* 目标站 announce/passkey 发现：候选地址、缓存种子、上传页扫描。 */
const fs = require('fs');
const path = require('path');
const torrentClean = require('./torrent-clean');
const urlGuard = require('../../infra/url-guard');

function makeDiscovery(deps) {
  const resolve = deps.resolve;
  const cookieOf = deps.cookieOf;
  const dataDir = deps.dataDir;

  /* 所有目标站页面请求先做 DNS 复检；手动跟随关闭，失败返回 null 由调用方跳过 */
  async function safeFetch(url, opts) {
    const g = await urlGuard.assertNoRebind(url);
    if (!g.ok) return null;
    try { return await fetch(url, Object.assign({ redirect: 'manual' }, opts || {})); }
    catch (e) { return null; }
  }

  async function discoverAnnounce(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost) return { ok: false, code: 'BAD_BASE', message: '站点 base 不合法', http: 400 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    const pages = ['/usercp.php', '/usercp.php?action=personal'];
    let uid = '';
    const idx = await safeFetch(t.base + '/index.php', { headers: headers, signal: AbortSignal.timeout(15000) });
    if (idx && idx.status === 200) {
      const html = await idx.text().catch(function () { return ''; });
      const m = /userdetails\.php\?id=(\d+)/i.exec(html);
      if (m) uid = m[1];
    }
    if (uid) pages.push('/userdetails.php?id=' + uid);
    for (const p of pages) {
      const res = await safeFetch(t.base + p, { headers: headers, signal: AbortSignal.timeout(15000) });
      if (!res || res.status !== 200) continue;
      const html = await res.text().catch(function () { return ''; });
      if (/takelogin\.php|login\.php|请先登录/i.test(html)) continue;
      const safe = html.replace(/&amp;/g, '&');
      const m = /(https?:\/\/[^\s"'<>]+\/announce\.php\?[^\s"'<>]*passkey=[A-Za-z0-9]+|announce\.php\?[^\s"'<>]*passkey=[A-Za-z0-9]+)/i.exec(safe);
      if (m) {
        const raw = m[1];
        try {
          const u = new URL(raw, t.base + '/');
          if (u.hostname.toLowerCase() !== baseHost && !u.hostname.toLowerCase().endsWith('.' + baseHost)) continue;
          return { ok: true, data: { announce: u.toString(), source: p } };
        } catch (e) { /* 忽略：失败不影响主流程 */ }
      }
      const pk = /passkey=([A-Za-z0-9]{16,64})/i.exec(safe);
      if (pk) return { ok: true, data: { announce: t.base + '/announce.php?passkey=' + pk[1], source: p } };
    }
    return { ok: false, code: 'NO_ANNOUNCE', message: '没找到目标站 announce/passkey；可用 --announce 显式指定', http: 409 };
  }

  function candidateKind(url) {
    return /[?&]passkey=/i.test(String(url || '')) ? 'passkey' : 'generic';
  }
  function cachedTargetCandidates(host, base) {
    const dir = path.join(dataDir, 'torrents');
    let baseHost = '';
    try { baseHost = new URL(String(base || '')).hostname.toLowerCase(); } catch (e) { baseHost = ''; }
    let files;
    try { files = fs.readdirSync(dir); } catch (e) { return []; }
    const prefix = String(host).replace(/[^a-z0-9.-]/gi, '_') + '-';
    const out = [];
    files.filter(function (f) { return f.indexOf(prefix) === 0 && /\.torrent$/i.test(f); })
      .map(function (f) { try { return { f: f, m: fs.statSync(path.join(dir, f)).mtimeMs }; } catch (e) { return null; } })
      .filter(Boolean).sort(function (a, b) { return b.m - a.m; })
      .forEach(function (x) {
        try {
          const a = torrentClean.announceOf(fs.readFileSync(path.join(dir, x.f)));
          if (!a) return;
          if (baseHost) {
            const ah = new URL(a).hostname.toLowerCase();
            if (ah !== baseHost && !ah.endsWith('.' + baseHost)) return;
          }
          out.push({ source: 'cached-target-torrent', kind: candidateKind(a), hasPasskey: candidateKind(a) === 'passkey', announce: a });
        } catch (e) { /* 忽略：失败不影响主流程 */ }
      });
    return out;
  }
  function uploadPageCandidates(html, base) {
    const safe = String(html || '').replace(/&amp;/g, '&');
    let baseHost = '';
    try { baseHost = new URL(String(base || '')).hostname.toLowerCase(); } catch (e) { baseHost = ''; }
    const raw = [];
    const patterns = [
      /(?:href|src)=["']([^"']*announce[^"']*)["']/gi,
      /(https?:\/\/[^\s"'<>]+\/announce[^\s"'<>]*)/gi,
      /(announce\.php\?[^\s"'<>]*)/gi
    ];
    patterns.forEach(function (re) {
      let m;
      while ((m = re.exec(safe))) if (m[1]) raw.push(m[1]);
    });
    const seen = {};
    const out = [];
    raw.forEach(function (x) {
      try {
        const u = new URL(x, base + '/');
        if (!/^https?:$/i.test(u.protocol)) return;
        /* 上传页里的 announce 只能是本站/子域，避免把 passkey 带到外部 */
        if (baseHost && u.hostname.toLowerCase() !== baseHost && !u.hostname.toLowerCase().endsWith('.' + baseHost)) return;
        const key = u.toString();
        if (seen[key]) return;
        seen[key] = true;
        out.push({ source: 'upload-page', kind: candidateKind(key), hasPasskey: candidateKind(key) === 'passkey', announce: key });
      } catch (e) { /* 忽略：失败不影响主流程 */ }
    });
    return out;
  }

  async function announceCandidates(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    const all = cachedTargetCandidates(host, t.base);
    const formPath = t.upload.formPath || t.upload.path;
    try {
      const res = await safeFetch(t.base + formPath, { headers: headers, signal: AbortSignal.timeout(20000) });
      if (res && res.status === 200) {
        const html = await res.text().catch(function () { return ''; });
        if (!/takelogin\.php|login\.php|请先登录/i.test(html)) {
          uploadPageCandidates(html, t.base).forEach(function (x) {
            if (!all.some(function (y) { return y.announce === x.announce; })) all.push(x);
          });
        }
      }
    } catch (e) { /* 忽略：失败不影响主流程 */ }
    const u = await discoverAnnounce(host);
    if (u.ok) {
      const kind = candidateKind(u.data.announce);
      if (!all.some(function (y) { return y.announce === u.data.announce; })) {
        all.push({ source: 'usercp', kind: kind, hasPasskey: kind === 'passkey', announce: u.data.announce });
      }
    }
    if (!all.length) return { ok: false, code: 'NO_ANNOUNCE', message: '没找到目标站 announce/passkey；可用 --announce 显式指定', http: 409 };
    return { ok: true, data: { host: host, baseHost: baseHost, candidates: all } };
  }

  return { discoverAnnounce, announceCandidates };
}

module.exports = { makeDiscovery };

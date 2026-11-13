/* 真实抓取：从站点列表页取条目写进 SQLite。
   默认关闭，由 config.realCrawl 或环境变量 PTA_ALLOW_REAL=1 打开；
   每次抓取受站点间隔与每日上限约束，失败也记时间戳，避免连续重试。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const adapters = require('./adapters');
const marksMod = require('./marks');
const cursor = require('./cursor');
const limits = require('./limits');

const BUSY = new Set();

function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }

function makeCrawl(ctx) {
  const { db, DATA_DIR, one, all, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const DEF_DIR = path.join(DATA_DIR, 'site-defs');
  const readDef = (host) => { try { return JSON.parse(fs.readFileSync(path.join(DEF_DIR, host + '.json'), 'utf8')); } catch (e) { return null; } };
  const cfg = () => { const r = one("SELECT v FROM meta WHERE k = 'config'"); return JSON.parse(r ? r.v : 'null') || {}; };
  const readState = () => { const r = one("SELECT v FROM meta WHERE k = 'crawl-state'"); return JSON.parse(r ? r.v : 'null') || {}; };
  const saveState = (st) => { db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st)); };
  const cookieOf = (host) => {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', host);
    if (!r || !r.cookie) return '';
    try { return secretbox.decrypt(r.cookie, KEYRING.key); } catch (e) { return ''; }
  };

  function limitsOf(host) {
    const siteCfg = one('SELECT data FROM sites WHERE host = ?', host);
    const s = siteCfg ? (jparse(siteCfg.data) || {}) : {};
    const C = cfg();
    const OV = { '1 分钟': 60000, '5 分钟': 300000, '15 分钟': 900000, '1 小时': 3600000 };
    const baseGap = Math.max(8, Math.min(Number(C.interval) || 60, 600)) * 1000;
    const winMin = Math.max(1, Math.min(Number(C.windowMinutes) || 60, 1440));
    const maxWin = Math.max(1, Math.min(Number(C.maxPerWindow) || 20, 1000));
    if (!s.override) return { minGapMs: baseGap, windowMs: winMin * 60000, maxPerWindow: maxWin, dailyMax: limits.dailyMax() };
    const gap = Math.max(baseGap, OV[String(s.ovInterval || '')] || 0);
    const maxW = Math.max(1, Math.min(maxWin, Number(s.ovDaily) || maxWin));
    return { minGapMs: gap, windowMs: winMin * 60000, maxPerWindow: maxW, dailyMax: limits.dailyMax() };
  }

  function upsertCatalog(items) {
    let added = 0, updated = 0, skipped = 0;
    let maxRow = one("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS m FROM catalog WHERE id LIKE 'cat_%'") || { m: 0 };
    let seq = Number(maxRow.m) || 0;
    for (const it of items) {
      const ex = one('SELECT id FROM catalog WHERE site = ? AND site_id = ?', it.site, String(it.siteId));
      if (ex) {
        const row = one('SELECT data FROM catalog WHERE id = ?', ex.id);
        const prev = jparse(row && row.data) || {};
        const next = Object.assign({}, prev, it, { id: ex.id, _key: prev._key || ('s:' + it.site + ':' + it.siteId), updatedAt: nowISO() });
        db.prepare('UPDATE catalog SET data = ?, title = ?, infohash = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(next), it.title, it.infohash || prev.infohash || '', nowISO(), ex.id);
        updated++;
      } else {
        const id = 'cat_' + String(++seq).padStart(6, '0');
        const item = Object.assign({}, it, { id: id, _key: 's:' + it.site + ':' + it.siteId, status: 'new', createdAt: nowISO(), updatedAt: nowISO() });
        db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.site, String(item.siteId), item.infohash || '', item.title, 'new', JSON.stringify(item), item.createdAt, item.updatedAt);
        added++;
      }
    }
    return { added: added, updated: updated, skipped: skipped };
  }

  async function crawlOnce(host, opts) {
    if (BUSY.has(host)) return { err: { code: 'BUSY', message: '这个站正在抓，等这次结束' } };
    BUSY.add(host);
    try { return await inner(host, opts || {}); } finally { BUSY.delete(host); }
  }

  async function inner(host, opts) {
    const def = readDef(host);
    if (!def) return { err: { code: 'NO_DEF', message: '这个站还没有站点定义' } };
    if (!def.engine) return { err: { code: 'NO_ENGINE', message: '这个站还没识别出引擎' } };
    const cookie = cookieOf(host);
    if (!cookie) return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie' } };
    const catMap = Array.isArray(def.catMap) ? def.catMap : [];
    const catIdxRaw = Number(opts.catIdx >= 0 ? opts.catIdx : 0);
    const st0 = readState();
    const rec0 = st0[host] || {};
    const catIdx = opts.catIdx >= 0 && opts.catIdx !== '' ? catIdxRaw : Number(rec0.catIdx || 0);
    const ids = catMap.length ? [catMap[Math.max(0, Math.min(catMap.length - 1, catIdx))].id] : [];
    const url0 = adapters.buildSearchUrl(def, '', ids);
    const lim = limitsOf(host);
    const state = readState();
    const today = new Date().toISOString().slice(0, 10);
    const rec = state[host] || { lastAt: 0, day: today, count: 0, page: 0 };
    if (rec.day !== today) { rec.day = today; rec.count = 0; rec.page = 0; rec.dayCount = 0; }
    rec.dayCount = Number(rec.dayCount) || 0;
    const nowMs = Date.now();
    const times = Array.isArray(rec.times) ? rec.times.filter(function (t) { return t > nowMs - lim.windowMs; }) : [];
    rec.times = times;
    if (limits.dailyBlocked(rec.dayCount, lim.dailyMax)) {
      return { err: { code: 'DAILY_LIMIT', message: '今天这个站已经抓了 ' + rec.dayCount + ' 次，服务端硬顶 ' + lim.dailyMax + ' 次/天', extra: { count: rec.dayCount, max: lim.dailyMax } } };
    }
    if (nowMs - (rec.lastAt || 0) < lim.minGapMs) {
      return { err: { code: 'TOO_SOON', message: '距上次抓取不到 ' + Math.round(lim.minGapMs / 1000) + ' 秒，等一下再抓', extra: { waitMs: lim.minGapMs - (nowMs - (rec.lastAt || 0)) } } };
    }
    if (times.length >= lim.maxPerWindow) {
      return { err: { code: 'WINDOW_LIMIT', message: '最近 ' + Math.round(lim.windowMs / 60000) + ' 分钟已经发了 ' + times.length + ' 次，超过上限 ' + lim.maxPerWindow + ' 次', extra: { count: times.length, max: lim.maxPerWindow } } };
    }
    const page = Math.max(1, Math.min(50, Number(opts.page) || 0 || ((rec.page || 0) + 1)));
    const url = adapters.withPage(url0, page);
    const t0 = Date.now();
    let html = '', status = 0;
    try {
      const res = await fetch(url, {
        headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual', signal: AbortSignal.timeout(20000)
      });
      status = res.status;
      html = await res.text().catch(function () { return ''; });
    } catch (e) {
      rec.dayCount += 1; rec.lastAt = nowMs; rec.lastError = 'CRAWL_FAILED'; state[host] = rec; saveState(state);
      return { err: { code: 'CRAWL_FAILED', message: e && e.name === 'TimeoutError' ? '请求超时' : String(e && e.message || e).slice(0, 160) } };
    }
    const loggedOut = status === 302 || /takelogin\.php|请先登录/i.test(html);
    function mark(code) { rec.dayCount = (Number(rec.dayCount) || 0) + 1; rec.lastAt = nowMs; rec.lastError = code; state[host] = rec; saveState(state); }
    if (loggedOut) { mark('LOGIN_REQUIRED'); return { err: { code: 'LOGIN_REQUIRED', message: 'cookie 已失效，先做一次会话自检' } }; }
    if (status !== 200) { mark('CRAWL_HTTP_' + status); return { err: { code: 'CRAWL_HTTP_' + status, message: '站点返回 ' + status } }; }
    let rows = [];
    try { rows = adapters.parseList(html, def.engine) || []; } catch (e) { rows = []; }
    const limit = Math.max(1, Math.min(200, Number(opts.limit) || 100));
    const items = rows.slice(0, limit).map(function (r) {
      return {
        site: host, siteId: String(r.id || ''), title: r.title || '', size: r.size || '',
        sizeBytes: Number(r.sizeBytes) || 0, cat: String(r.catId || ''), catName: r.catName || '',
        detailsUrl: r.detailsUrl || '', downloadUrl: r.downloadUrl || '', infohash: r.infohash || '',
        seeders: Number(r.seeders) || 0, marks: marksMod.marksOf(r.title), addedAt: r.addedAt || ''
      };
    }).filter(function (x) { return x.title && x.siteId; });
    /* 站上发布时间不满 7 天的限转，按目标站规矩拦在送审前 */
    items.forEach(function (it) {
      const d = marksMod.limitedDaysOf(it, nowMs);
      if (d) { it.marks = it.marks || {}; it.marks.limitedDays = d; }
    });
    /* 抓详情页：受开关与窗口预算双重约束，最多 10 条，每条都算一次请求 */
    let detail = { want: false, tried: 0, ok: 0, failed: 0, stopped: '' };
    let lastReqAt = nowMs;
    if (items.length) {
      const siteRow = one('SELECT data FROM sites WHERE host = ?', host);
      const site = siteRow ? (jparse(siteRow.data) || {}) : {};
      let want = !!(cfg() && cfg().detail);
      if (opts.detail === true) want = true;
      else if (opts.detail === false) want = false;
      if (site.override) want = !!site.ovDetail;
      detail.want = want;
      if (want) {
        const cap = Math.max(1, Math.min(10, Number(opts.detailLimit) || 10));
        const budget = Math.max(0, lim.maxPerWindow - rec.times.length - 1);
        const dailyLeft = Math.max(0, lim.dailyMax - rec.dayCount - 1);
        const picks = items.filter(function (x) { return x.detailsUrl; }).slice(0, Math.min(cap, budget, dailyLeft));
        if (!picks.length) detail.stopped = dailyLeft <= 0 ? 'DAILY_LIMIT' : 'WINDOW_LIMIT';
        for (const it of picks) {
          const elapsed = Date.now() - (rec.lastAt || 0);
          if (rec.lastAt && elapsed < lim.minGapMs) await sleep(lim.minGapMs - elapsed);
          if (rec.times.length >= lim.maxPerWindow - 1) { detail.stopped = 'WINDOW_LIMIT'; break; }
          if (rec.dayCount + 1 >= lim.dailyMax) { detail.stopped = 'DAILY_LIMIT'; break; }
          detail.tried++;
          try {
            const res2 = await fetch(it.detailsUrl, {
              headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              redirect: 'manual', signal: AbortSignal.timeout(15000)
            });
            rec.lastAt = Date.now(); lastReqAt = rec.lastAt;
            rec.times.push(rec.lastAt);
            rec.dayCount += 1;
            if (res2.status !== 200) { detail.failed++; it.detailNote = 'HTTP ' + res2.status; continue; }
            const dh = await res2.text().catch(function () { return ''; });
            const d = adapters.parseDetail(dh);
            if (d.sizeBytes) { it.sizeBytes = d.sizeBytes; it.size = d.sizeText || it.size; }
            if (d.category && !it.catName) it.catName = d.category;
            if (d.medium) it.medium = d.medium;
            if (d.subtitle) it.subtitle = d.subtitle;
            if (d.infohash && !it.infohash) it.infohash = d.infohash;
            if (d.descr) it.descr = d.descr;
            if (d.poster) it.poster = d.poster;
            if (typeof d.fullDisc === 'boolean') it.fullDisc = d.fullDisc;
            it.detailAt = nowISO();
            detail.ok++;
          } catch (e) {
            detail.failed++;
            it.detailNote = '详情请求失败';
            rec.lastAt = Date.now(); lastReqAt = rec.lastAt;
            rec.dayCount += 1;
          }
        }
      }
    }
    const out = items.length ? upsertCatalog(items) : { added: 0, updated: 0, skipped: 0 };
    rec.lastAt = lastReqAt;
    rec.times = (rec.times || []).filter(function (t) { return t > nowMs - lim.windowMs; });
    rec.times.push(nowMs);
    rec.dayCount += 1;
    rec.count = rec.times.length;
    const nc = cursor.nextCursor({ catCount: catMap.length, catIdx: catIdx, page: page, rows: rows.length, rotate: opts.rotate !== false });
    rec.page = nc.page;
    rec.lastRows = rows.length;
    rec.catIdx = nc.catIdx;
    rec.catId = ids[0] || '';
    state[host] = rec;
    saveState(state);
    return { host: host, url: url, page: page, status: status, ms: Date.now() - t0, rows: rows.length, limit: limit,
      categoryId: ids[0] || '', categories: catMap.length, added: out.added, updated: out.updated, skipped: out.skipped,
      nextPage: nc.page + 1, daily: { day: rec.day, count: rec.dayCount, max: lim.dailyMax }, nextCategoryId: catMap.length ? catMap[Math.min(catMap.length - 1, nc.catIdx)].id : '', rotated: nc.rotated, window: { minutes: Math.round(lim.windowMs / 60000), count: rec.count, max: lim.maxPerWindow }, nextAllowedMs: lim.minGapMs, detail: detail };
  }

  return { crawlOnce: crawlOnce };
}

module.exports = { makeCrawl };

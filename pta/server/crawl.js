/* 真实抓取：从站点列表页取条目写进 SQLite。
   默认关闭，由 config.realCrawl 或环境变量 ALLOW_REAL=1 打开；
   每次抓取受站点间隔与每日上限约束，失败也记时间戳，避免连续重试。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const adapters = require('./adapters');
const marksMod = require('./marks');
const sitePack = require('./site-pack');
const siteMaps = require('./site-maps');
const flowConfig = require('./flow-config');
const { typeOf } = require('./category-policy');
const { makeMetaFill } = require('./meta-fill');

const BUSY = new Set();

function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }

function catListFromCats(cats) {
  if (!cats || typeof cats !== 'object') return [];
  const out = [];
  Object.keys(cats).forEach(function (p) {
    (Array.isArray(cats[p]) ? cats[p] : []).forEach(function (id) { out.push({ id: String(id), label: p, purpose: p }); });
  });
  return out;
}

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

  const metaFill = makeMetaFill(ctx);

  function limitsOf(host) {
    const siteCfg = one('SELECT data FROM sites WHERE host = ?', host);
    const s = siteCfg ? (jparse(siteCfg.data) || {}) : {};
    const C = cfg();
    const OV = { '1 分钟': 60000, '5 分钟': 300000, '15 分钟': 900000, '1 小时': 3600000 };
    const listGap = Math.max(6, Math.min(Number(C.listInterval) || 10, 60)) * 1000;
    const detailGap = Math.max(8, Math.min(Number(C.interval) || 600, 600)) * 1000;
    const winMin = Math.max(1, Math.min(Number(C.windowMinutes) || 60, 1440));
    const maxWin = Math.max(1, Math.min(Number(C.maxPerWindow) || 20, 1000));
    if (!s.override) return { listGapMs: listGap, detailGapMs: detailGap, windowMs: winMin * 60000, maxPerWindow: maxWin };
    const gap = Math.max(listGap, OV[String(s.ovInterval || '')] || 0);
    return { listGapMs: gap, detailGapMs: Math.max(detailGap, gap), windowMs: winMin * 60000, maxPerWindow: maxWin };
  }

  function upsertCatalog(items) {
    let added = 0, updated = 0, skipped = 0;
    const ids = {};
    const rows = {};
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
        ids[String(it.siteId)] = ex.id;
        rows[String(it.siteId)] = next;
        updated++;
      } else {
        const id = 'cat_' + String(++seq).padStart(6, '0');
        const item = Object.assign({}, it, { id: id, _key: 's:' + it.site + ':' + it.siteId, status: 'new', createdAt: nowISO(), updatedAt: nowISO() });
        db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, item.site, String(item.siteId), item.infohash || '', item.title, 'new', JSON.stringify(item), item.createdAt, item.updatedAt);
        ids[String(it.siteId)] = id;
        rows[String(it.siteId)] = item;
        added++;
      }
    }
    return { added: added, updated: updated, skipped: skipped, ids: ids, rows: rows };
  }

  async function crawlOnce(host, opts) {
    if (BUSY.has(host)) return { err: { code: 'BUSY', message: '这个站正在抓，等这次结束' } };
    BUSY.add(host);
    try { return await inner(host, opts || {}); } finally { BUSY.delete(host); }
  }

  async function inner(host, opts) {
    const def0 = readDef(host);
    const built = sitePack.siteOf(host) || null;
    if (!def0 && !built) return { err: { code: 'NO_DEF', message: '这个站还没有站点定义' } };
    const def = Object.assign({}, built || {}, def0 || {});
    if (!def.engine) return { err: { code: 'NO_ENGINE', message: '这个站还没识别出引擎' } };
    const cookie = cookieOf(host);
    if (!cookie) return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie' } };
    let catMap = Array.isArray(def.catList) ? def.catList
      : (Array.isArray(def.catMap) ? def.catMap
        : (def.catMap && typeof def.catMap === 'object'
          ? Object.keys(def.catMap).map(function (k) { return { id: def.catMap[k], label: k }; })
          : catListFromCats(def.cats)));
    /* 站点映射总表也补进 catMap，保证只有 site-maps 标签的站也能做类型过滤 */
    try {
      const maps = siteMaps.getHost(DATA_DIR, host).cat || {};
      Object.keys(maps).forEach(function (k) { catMap.push({ id: String(maps[k]), label: k, purpose: k }); });
    } catch (e) { /* 忽略 */ }
    const seenCat = {};
    catMap = catMap.filter(function (x) { if (!x || x.id == null) return false; const k = String(x.id); if (seenCat[k]) return false; seenCat[k] = true; return true; });
    /* 流程页勾选的分类：只抓选中的 id；没选过就全抓 */
    let siteTypes = [];
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-search.local.json'), 'utf8')) || {};
      const sites = raw.sites || raw;
      const entry = sites[host] || {};
      const cats = entry.cats || {};
      const sel = [];
      Object.keys(cats).forEach(function (k) { (cats[k] || []).forEach(function (id) { sel.push(String(id)); }); });
      if (sel.length) catMap = catMap.filter(function (x) { return sel.indexOf(String(x.id)) >= 0; });
      siteTypes = Array.isArray(entry.types) ? entry.types.map(String).filter(Boolean) : [];
    } catch (e) { /* 没预设就全抓 */ }
    /* 类型是硬闸门：没保存类型就停，保存过类型就只抓对应分类 */
    if (!siteTypes.length) {
      return { err: { code: 'NO_CATEGORY_TYPES', message: '这个站还没保存抓取类型；先在流程页选来源站和类型并保存' } };
    }
    {
      const filtered = catMap.filter(function (x) { return siteTypes.indexOf(typeOf(x.label)) >= 0 || siteTypes.indexOf(String(x.label)) >= 0; });
      if (!filtered.length) {
        return { err: { code: 'NO_CATEGORY_MATCH', message: '流程页选的类型在站点分类里没匹配到：' + siteTypes.join('/') } };
      }
      catMap = filtered;
      if (ctx.logEvent) ctx.logEvent('info', '抓取', host + ' · 类型 ' + siteTypes.join('/') + ' · ' + catMap.length + ' 个分类');
    }
    const catLabelById = {};
    catMap.forEach(function (x) { catLabelById[String(x.id)] = String(x.label || x.purpose || ''); });
    const hasCat = opts.catIdx !== undefined && opts.catIdx !== '' && Number(opts.catIdx) >= 0;
    const catIdx = hasCat ? Math.max(0, Number(opts.catIdx) || 0) : 0;
    const ids = catMap.length ? (hasCat ? [catMap[Math.max(0, Math.min(catMap.length - 1, catIdx))].id] : catMap.map(function (x) { return x.id; })) : [];
    let url0 = adapters.buildSearchUrl(def, '', ids);
    try {
      const flt = siteMaps.getHost(DATA_DIR, host).filters;
      const sv = (flt && flt.selectedValues) || {};
      if (Object.keys(sv).length) {
        const u = new URL(url0);
        ['medium', 'standard', 'spstate'].forEach(function (k) {
          (sv[k] || []).forEach(function (v) { u.searchParams.append(k, String(v)); });
        });
        url0 = u.toString();
      }
    } catch (e) { /* 过滤参数拼不上就按原地址抓 */ }
    const lim = limitsOf(host);
    const state = readState();
    const today = new Date().toISOString().slice(0, 10);
    const rec = state[host] || { lastAt: 0, day: today, count: 0, page: 0 };
    if (rec.day !== today) { rec.day = today; rec.count = 0; rec.page = 0; rec.dayCount = 0; }
    rec.dayCount = Number(rec.dayCount) || 0;
    const nowMs = Date.now();
    const times = Array.isArray(rec.times) ? rec.times.filter(function (t) { return t > nowMs - lim.windowMs; }) : [];
    rec.times = times;
    const lastList = Number(rec.lastListAt || rec.lastAt) || 0;
    if (nowMs - lastList < lim.listGapMs) {
      return { err: { code: 'TOO_SOON', message: '距上次列表页不到 ' + Math.round(lim.listGapMs / 1000) + ' 秒，等一下再抓', extra: { waitMs: lim.listGapMs - (nowMs - lastList) } } };
    }
    if (times.length >= lim.maxPerWindow) {
      return { err: { code: 'WINDOW_LIMIT', message: '最近 ' + Math.round(lim.windowMs / 60000) + ' 分钟已经发了 ' + times.length + ' 次，超过上限 ' + lim.maxPerWindow + ' 次', extra: { count: times.length, max: lim.maxPerWindow } } };
    }
    const page = Math.max(1, Math.min(10000, Number(opts.page) || 0 || ((rec.page || 0) + 1)));
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
      rec.dayCount += 1; rec.lastAt = nowMs; rec.lastListAt = nowMs; rec.lastError = 'CRAWL_FAILED'; state[host] = rec; saveState(state);
      if (ctx.logEvent) ctx.logEvent('warn', '抓取', host + ' · CRAWL_FAILED · ' + (e && e.name === 'TimeoutError' ? '请求超时' : String(e && e.message || e).slice(0, 120)));
      return { err: { code: 'CRAWL_FAILED', message: e && e.name === 'TimeoutError' ? '请求超时' : String(e && e.message || e).slice(0, 160) } };
    }
    const loggedOut = status === 302 || /takelogin\.php|请先登录/i.test(html);
    function mark(code) {
      rec.dayCount = (Number(rec.dayCount) || 0) + 1; rec.lastAt = nowMs; rec.lastListAt = nowMs; rec.lastError = code; state[host] = rec; saveState(state);
      if (ctx.logEvent) ctx.logEvent('warn', '抓取', host + ' · ' + code);
    }
    if (loggedOut) { mark('LOGIN_REQUIRED'); return { err: { code: 'LOGIN_REQUIRED', message: 'cookie 已失效，先做一次会话自检' } }; }
    if (status !== 200) { mark('CRAWL_HTTP_' + status); return { err: { code: 'CRAWL_HTTP_' + status, message: '站点返回 ' + status } }; }
    rec.lastListAt = Date.now();
    let rows = [];
    try { rows = adapters.parseList(html, def.engine) || []; } catch (e) { rows = []; }
    const limit = Math.max(1, Math.min(200, Number(opts.limit) || 100));
    const absUrl = function (u) {
      const str = String(u || '');
      if (!str || /^https?:\/\//i.test(str)) return str;
      try { return new URL(str, def.base + '/').toString(); } catch (e) { return str; }
    };
    const items = rows.slice(0, limit).map(function (r) {
      const rawCatName = String(r.catName || '');
      const catId = String(r.catId || (/^\d+$/.test(rawCatName) ? rawCatName : ''));
      const catLabel = catLabelById[catId] || (rawCatName && !/^\d+$/.test(rawCatName) ? rawCatName : '');
      const item = {
        site: host, siteId: String(r.id || ''), title: r.title || '', size: r.size || '',
        sizeBytes: Number(r.sizeBytes) || 0, cat: catId, catName: catLabel,
        detailsUrl: absUrl(r.detailsUrl), downloadUrl: absUrl(r.downloadUrl), infohash: r.infohash || '',
        seeders: Number(r.seeders) || 0, addedAt: r.addedAt || '',
        tags: Array.isArray(r.tags) ? r.tags.join(',') : String(r.tags || '')
      };
      item.marks = marksMod.marksOf(item);
      return item;
    }).filter(function (x) { return x.title && x.siteId; });
    /* 站上发布时间不满 7 天的限转，按目标站规矩拦在送审前 */
    items.forEach(function (it) {
      const d = marksMod.limitedDaysOf(it, nowMs);
      if (d) { it.marks = it.marks || {}; it.marks.limitedDays = d; }
    });
    let detail = { want: false, tried: 0, ok: 0, failed: 0, stopped: '', filtered: 0, restricted: 0, backlog: 0 };
    let lastReqAt = rec.lastListAt || nowMs;

    /* 媒介/分辨率：站点搜索页不支持参数时，抓完按标题本地过滤 */
    try {
      const flt = siteMaps.getHost(DATA_DIR, host).filters;
      const labels = (flt && flt.selectedLabels) || {};
      const MEDIA = {
        '原盘': /full\s*disc|bdmv|blu-?ray\s*iso|\biso\b|原盘/i,
        'UHD 原盘': /uhd.*(disc|iso)|2160p.*(disc|iso)|4k.*(disc|iso)/i,
        '3D 原盘': /3d.*(disc|iso|blu-?ray)/i,
        'Remux': /remux/i,
        'Encode': /encode|x264|x265|h\.?26[45]/i,
        'Blu-ray': /blu-?ray/i,
        'HDDVD': /hddvd/i,
        'DVD': /\bdvd/i,
        'HDTV': /hdtv/i,
        'WEB-DL': /web-?dl/i,
        'WEBRip': /web-?rip/i,
        'TVRip': /tvrip/i,
        'VHS': /vhs/i
      };
      const medSel = (labels.medium || []).map(function (x) { return MEDIA[x]; }).filter(Boolean);
      const resSel = (labels.standard || []).map(function (x) { return String(x).toLowerCase(); });
      if (medSel.length || resSel.length) {
        const keep = items.filter(function (it) {
          const t = String(it.title || '');
          const res = String(it.res || '');
          const okRes = !resSel.length || resSel.some(function (x) { return (res || t).toLowerCase().indexOf(x) >= 0; });
          const okMed = !medSel.length || medSel.some(function (re) { return re.test(t); });
          return okRes && okMed;
        });
        if (keep.length !== items.length) {
          detail.filtered = items.length - keep.length;
          items.length = 0;
          keep.forEach(function (x) { items.push(x); });
        }
      }
    } catch (e) { /* 过滤失败按原结果 */ }

    /* 限制行：选中即排除（禁转/限转/HR/独占/DIY），列表标签先拦一遍 */
    let limitSel = [];
    try {
      const flow = flowConfig.read(ctx);
      const row = flow['限制'];
      limitSel = Array.isArray(row && row.sel) ? row.sel.map(String) : [];
      if (limitSel.length && items.length) {
        const keep = items.filter(function (it) { return !marksMod.matchesLimit(it, limitSel, Date.now()); });
        if (keep.length !== items.length) {
          detail.restricted = items.length - keep.length;
          items.length = 0;
          keep.forEach(function (x) { items.push(x); });
        }
      }
    } catch (e) { /* 规则读不到就不筛 */ }

    /* 先入库：列表字段已经够进初筛；详情单独补，不阻塞翻页 */
    const out = items.length ? upsertCatalog(items) : { added: 0, updated: 0, skipped: 0, ids: {} };

    /* 详情：当前页优先，其余预算补 catalog 里最久缺详情的，保证每条最终都能轮到 */
    const siteRow = one('SELECT data FROM sites WHERE host = ?', host);
    const site = siteRow ? (jparse(siteRow.data) || {}) : {};
    let wantDetail = !!(cfg() && cfg().detail);
    if (opts.detail === true) wantDetail = true;
    else if (opts.detail === false) wantDetail = false;
    if (site.override) wantDetail = !!site.ovDetail;
    detail.want = wantDetail;
    if (wantDetail) {
      const cap = Math.max(1, Math.min(10, Number(opts.detailLimit) || 10));
      const budget = Math.max(0, lim.maxPerWindow - rec.times.length - 1);
      const seen = {};
      const fresh = [];
      const cooling = function (d) { return Date.parse((d && d.detailNextRetryAt) || '') > Date.now(); };
      items.forEach(function (it) {
        const key = String(it.siteId);
        const id = out.ids && out.ids[key];
        const d = (out.rows && out.rows[key]) || it;
        if (!id || !d.detailsUrl || d.detailAt || cooling(d) || seen[key]) return;
        seen[key] = 1;
        fresh.push({ id: id, data: d });
      });
      const back = all("SELECT id, data FROM catalog WHERE site = ? AND status = 'new' AND data LIKE '%\"detailsUrl\"%' AND data NOT LIKE '%\"detailAt\"%' ORDER BY created_at ASC LIMIT 200", host);
      const older = [];
      back.forEach(function (r) {
        const d = jparse(r.data) || {};
        if (!d.detailsUrl || d.detailAt || cooling(d) || seen[String(d.siteId)]) return;
        seen[String(d.siteId)] = 1;
        older.push({ id: r.id, data: d });
      });
      const half = Math.max(1, Math.floor(cap / 2));
      const picks = fresh.slice(0, Math.min(half, budget));
      let freshUsed = picks.length;
      const rest = Math.max(0, Math.min(cap, budget) - picks.length);
      older.slice(0, rest).forEach(function (x) { picks.push(x); });
      const fill = Math.max(0, Math.min(cap, budget) - picks.length);
      fresh.slice(freshUsed, freshUsed + fill).forEach(function (x) { picks.push(x); });
      detail.backlog = Math.max(0, fresh.length + older.length - picks.length);
      if (budget <= 0) detail.stopped = 'WINDOW_LIMIT';
      const detailGap = lim.detailGapMs;
      for (const pick of picks) {
        const it = pick.data;
        const lastDetail = Number(rec.lastDetailAt) || 0;
        if (lastDetail) {
          const elapsed = Date.now() - lastDetail;
          if (elapsed < detailGap) await sleep(detailGap - elapsed);
        }
        if (rec.times.length >= lim.maxPerWindow - 1) { detail.stopped = 'WINDOW_LIMIT'; break; }
        detail.tried++;
        try {
          const res2 = await fetch(it.detailsUrl, {
            headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            redirect: 'manual', signal: AbortSignal.timeout(15000)
          });
          rec.lastDetailAt = Date.now(); rec.lastAt = rec.lastDetailAt; lastReqAt = rec.lastAt;
          rec.times.push(rec.lastAt);
          rec.dayCount += 1;
          if (res2.status !== 200) {
            detail.failed++;
            it.detailNote = 'HTTP ' + res2.status;
            it.detailAttempts = (Number(it.detailAttempts) || 0) + 1;
            it.detailFailedAt = nowISO();
            it.detailNextRetryAt = new Date(Date.now() + Math.min(24 * 3600000, 15 * 60000 * it.detailAttempts)).toISOString();
          } else {
            const dh = await res2.text().catch(function () { return ''; });
            const d = adapters.parseDetail(dh);
            if (d.sizeBytes) { it.sizeBytes = d.sizeBytes; it.size = d.sizeText || it.size; }
            if (d.category && !it.catName) it.catName = d.category;
            if (d.medium) it.medium = d.medium;
            if (d.subtitle) it.subtitle = d.subtitle;
            if (d.region) it.region = d.region;
            if (d.language) it.language = d.language;
            if (d.bdinfo) it.bdinfo = d.bdinfo;
            if (d.mediainfo) it.mediainfo = d.mediainfo;
            if (d.infohash && !it.infohash) it.infohash = d.infohash;
            if (d.descr) it.descr = d.descr;
            if (d.descrBb) it.descrBb = d.descrBb;
            if (d.tags) {
              const merged = String(it.tags || '').split(',').concat(String(d.tags).split(/[,，;；、\s]+/))
                .map(function (x) { return String(x || '').trim(); }).filter(Boolean);
              it.tags = merged.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(',');
              it.marks = marksMod.marksOf(it);
            }
            if (!it.descr && !it.descrBb) await metaFill.fillIntro(it);
            if (d.poster) it.poster = d.poster;
            if (typeof d.fullDisc === 'boolean') it.fullDisc = d.fullDisc;
            it.detailAt = nowISO();
            delete it.detailAttempts;
            delete it.detailFailedAt;
            delete it.detailNextRetryAt;
            detail.ok++;
          }
        } catch (e) {
          detail.failed++;
          it.detailNote = '详情请求失败';
          it.detailAttempts = (Number(it.detailAttempts) || 0) + 1;
          it.detailFailedAt = nowISO();
          it.detailNextRetryAt = new Date(Date.now() + Math.min(24 * 3600000, 15 * 60000 * it.detailAttempts)).toISOString();
          rec.lastDetailAt = Date.now(); rec.lastAt = rec.lastDetailAt; lastReqAt = rec.lastAt;
          rec.times.push(rec.lastAt);
          rec.dayCount += 1;
        }
        /* 写回 catalog；详情里新发现的限制命中就归档，不再进初筛 */
        const row = one('SELECT status FROM catalog WHERE id = ?', pick.id);
        let status = (row && row.status) || 'new';
        if (limitSel.length && marksMod.matchesLimit(it, limitSel, Date.now())) {
          status = 'archived';
          it.skipReason = '限制：' + (marksMod.complianceReason(it, Date.now()) || '命中限制');
          detail.restricted = (Number(detail.restricted) || 0) + 1;
        }
        db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(it), status, nowISO(), pick.id);
      }
      if (!picks.length && !detail.stopped) detail.stopped = 'NO_BACKLOG';
    }

    rec.lastAt = lastReqAt;
    rec.times = (rec.times || []).filter(function (t) { return t > nowMs - lim.windowMs; });
    rec.times.push(nowMs);
    rec.dayCount += 1;
    rec.count = rec.times.length;
    /* 合并搜索：不轮分类，翻到最后一页（0 条）或第 50 页就从第 1 页重开 */
    rec.page = rows.length > 0 ? page : 0;
    rec.lastRows = rows.length;
    rec.catIdx = 0;
    rec.catId = ids[0] || '';
    state[host] = rec;
    saveState(state);
    if (ctx.logEvent) {
      const bits = [host, '第 ' + page + ' 页', rows.length + ' 条', '新增 ' + out.added];
      if (detail.want) bits.push('详情 ' + detail.ok + '/' + detail.tried + (detail.stopped ? '（停了：' + detail.stopped + '）' : ''));
      ctx.logEvent('info', '抓取', bits.join(' · '));
    }
    return { host: host, url: url, page: page, status: status, ms: Date.now() - t0, rows: rows.length, limit: limit,
      categoryId: ids[0] || '', categories: catMap.length, added: out.added, updated: out.updated, skipped: out.skipped,
      pageKey: rows.length ? (String(rows[0].id || '') + '|' + String(rows[rows.length - 1].id || '') + '|' + rows.length) : '', nextPage: rec.page + 1, daily: { day: rec.day, count: rec.dayCount }, rotated: false, window: { minutes: Math.round(lim.windowMs / 60000), count: rec.count, max: lim.maxPerWindow }, nextAllowedMs: lim.listGapMs, detail: detail };
  }

  return { crawlOnce: crawlOnce };
}

module.exports = { makeCrawl };

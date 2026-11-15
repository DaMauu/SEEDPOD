/* CLI 本地核心：不启 HTTP，直接复用 server 的抓取/查重/准备/发布模块。
   Fastify 路由仍走同一批模块；后续把剩余路由逐步改为直接调 core。 */
const fs = require('fs');
const path = require('path');
const { openDB } = require('../server/db');
const { makeCrawl } = require('../server/crawl');
const { makeTarget } = require('../server/target');
const { makePublisher } = require('../server/publish');
const { makeRelease } = require('../server/release');
const { makeQb } = require('../server/qb');
const watchClient = require('../server/clients/watch');
const { makeTargetService } = require('../server/target-service');
const imagehost = require('../server/imagehost');
const flowConfig = require('../server/flow-config');
const screen = require('../server/screen');
const adapters = require('../server/adapters');
const secretbox = require('../server/secretbox');
const limits = require('../server/limits');
const PKG = require('../../package.json');

function unwrap(r) {
  if (!r || !r.ok) {
    const e = new Error((r && r.message) || (r && r.code) || '操作失败');
    e.code = (r && r.code) || 'FAILED';
    e.http = (r && r.http) || 400;
    throw e;
  }
  return r.data;
}

function createCore(opts) {
  const o = opts || {};
  const DATA_DIR = path.resolve(o.dataDir || process.env.PTA_DATA || path.join(__dirname, '..', '..', 'data'));
  const db = openDB(path.join(DATA_DIR, 'seedpod.db'));
  try { db.exec('PRAGMA busy_timeout = 3000'); } catch (e) { console.warn('[seedpod] busy_timeout:', e && e.message ? e.message : e) }
  const one = (sql, ...args) => { try { return db.prepare(sql).get(...args); } catch (e) { return null; } };
  const all = (sql, ...args) => { try { return db.prepare(sql).all(...args); } catch (e) { return []; } };
  const jparse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const now = () => new Date().toISOString();
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const qb = makeQb(DATA_DIR);

  const ctx = {
    db, DATA_DIR, one, all, jparse,
    allowReal: function (key) {
      if (String(process.env.PTA_ALLOW_REAL || '') === '1') return true;
      const r = one("SELECT v FROM meta WHERE k = 'config'");
      const cfg = JSON.parse(r ? r.v : 'null') || {};
      return cfg[key] === true;
    }
  };
  ctx.crawl = makeCrawl(ctx);
  ctx.target = makeTarget(ctx);
  ctx.publisher = makePublisher(ctx);
  ctx.release = makeRelease(ctx);
  ctx.targetService = makeTargetService(ctx, ctx.target);

  function counts() {
    const n = t => { const r = one('SELECT COUNT(*) AS n FROM ' + t); return r ? r.n : 0; };
    return { catalog: n('catalog'), queue: n('queue'), sites: n('sites'), downloaders: n('downloaders'), credentials: n('credentials') };
  }
  function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  }
  function readDef(host) { return readJson(path.join(DATA_DIR, 'site-defs', host + '.json')); }
  function readPresets() {
    const raw = readJson(path.join(DATA_DIR, 'site-search.local.json')) || {};
    return raw.sites || raw;
  }
  function cfg() {
    const r = one("SELECT v FROM meta WHERE k = 'config'");
    return JSON.parse(r ? r.v : 'null') || {};
  }

  function crawlPlan(host) {
    const def = readDef(host);
    const c = cfg();
    const preset = readPresets()[host] || null;
    const cats = (preset && preset.cats) || (def && def.cats) || {};
    const groups = Object.keys(cats);
    let ids = 0;
    groups.forEach(k => { ids += (cats[k] || []).length });
    const warnings = [];
    if (!preset) warnings.push('还没有搜索预设，分类 id 未知');
    if (!def) warnings.push('没有站点定义，拼不出搜索 URL');
    const urls = [];
    if (def && def.base) {
      groups.forEach(k => (cats[k] || []).forEach(id => {
        if (urls.length < 10) urls.push({ cat: k, catId: id, url: adapters.buildSearchUrl(def, '{q}', [id]) });
      }));
    }
    return {
      siteHost: host, dryRun: true, runMode: c.runMode || 'test', interval: c.interval || 60,
      dailyMax: limits.dailyMax(), catGroups: groups.length, catIds: ids,
      estimatedQueries: (ids || groups.length) * 1, searchUrls: urls, warnings,
      engine: (preset && preset.engine) || (def && def.engine) || '',
      steps: ['读取站点定义', '读取搜索预设', '生成搜索 URL']
    };
  }

  async function crawl(input) {
    const b = input || {};
    const host = String(b.host || '').trim().toLowerCase();
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) throw new Error('站点域名不合法');
    if (b.dryRun !== false) return crawlPlan(host);
    const r = await ctx.crawl.crawlOnce(host, { limit: Math.max(1, Math.min(1000, Number(b.limit) || 100)) });
    if (r && r.err) {
      const e = new Error(r.err.message || r.err.code || '抓取失败');
      e.code = r.err.code || 'CRAWL_FAILED';
      throw e;
    }
    return r;
  }

  function queue(input) {
    const b = input || {};
    const status = String(b.status || '');
    const q = String(b.q || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, Number(b.limit) || 50));
    const where = [], args = [];
    if (status) { where.push('status = ?'); args.push(status); }
    if (q) { where.push('LOWER(title) LIKE ?'); args.push('%' + q + '%'); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = all('SELECT data FROM queue' + w + ' ORDER BY created_at ASC LIMIT ?', ...args, limit);
    const matched = (one('SELECT COUNT(*) AS n FROM queue' + w, ...args) || { n: 0 }).n;
    const byStatus = {};
    all('SELECT status, COUNT(*) AS n FROM queue GROUP BY status').forEach(r => { byStatus[r.status] = r.n });
    return { items: rows.map(r => jparse(r.data)).filter(Boolean), matched, counts: byStatus };
  }

  function status() {
    const srow = one("SELECT v FROM meta WHERE k = 'scheduler'");
    const s = JSON.parse(srow ? srow.v : 'null') || {};
    return {
      version: PKG.version, db: 'sqlite', counts: counts(),
      scheduler: { on: !!s.on, everyMinutes: Number(s.everyMinutes) || 60, lastRunAt: Number(s.lastRunAt) || 0 }
    };
  }

  async function targetUpload(input) {
    const b = input || {};
    if (!b.host) throw new Error('target-upload 需要 --host <target>');
    return unwrap(await ctx.targetService.upload(String(b.host), {
      queueId: b.queueId, torrentBase64: b.torrentBase64,
      dryRun: b.dryRun !== false, verify: b.verify,
      cleanAnnounce: b.cleanAnnounce, autoClean: b.autoClean,
      fetchPublishedTorrent: b.fetchPublishedTorrent
    }));
  }

  async function crossseed(input) {
    const b = input || {};
    if (!b.queueId) throw new Error('crossseed 需要 queueId');
    const host = String(b.host || '').toLowerCase();
    if (!host) throw new Error('crossseed 需要 --host <target>');
    const item = ctx.targetService.loadQueue(b.queueId);
    if (!item) throw new Error('队列条目不存在');
    const results = item.data.targetResults || {};
    const tr = results[host] || {};
    const pub = tr.publishedTorrent || tr.targetTorrent;
    if (!pub || !pub.path || !fs.existsSync(pub.path)) throw new Error('没有发布后的权威种子，先完成目标站发布');
    const sourceHash = (tr.sourceTorrent && tr.sourceTorrent.infohash) || item.data.infohash || '';
    if (!sourceHash) throw new Error('没有源种 infohash');
    const rows = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data); }).filter(function (x) { return x && (x.kind || 'qb') === 'qb'; });
    const dl = rows.filter(function (x) { return !b.downloader || String(x.id) === String(b.downloader); })[0];
    if (!dl) throw new Error('没有匹配的 qB 下载器');
    const found = await qb.findTorrent(dl, sourceHash);
    if (!found.found) throw new Error('源种不在 qB 里，先添加源种');
    if (Number(found.progress) < 0.999) throw new Error('源种还没下载完成：' + Math.round((Number(found.progress) || 0) * 100) + '%');
    const buf = fs.readFileSync(pub.path);
    const meta = qb.parseTorrent(buf);
    if (!meta.hash) throw new Error('权威种子解析不出 infohash');
    if (meta.hash === sourceHash) throw new Error('权威种子和源种同 infohash，qB 不能加第二份');
    const skip = flowConfig.on(flowConfig.read(ctx), '辅种跳过校验', true);
    const plan = { queueId: item.id, host: host, downloader: dl.id, sourceHash: sourceHash, targetHash: meta.hash, savePath: found.savePath || '', skipChecking: skip, dryRun: b.dryRun !== false };
    if (b.dryRun !== false) return plan;
    const r = await qb.addTorrent(dl, buf, { savePath: found.savePath || '', skipChecking: skip, paused: false, category: found.category || '' });
    if (!r.ok) throw new Error(r.message || r.error || 'qB 加权威种子失败');
    tr.crossseed = { at: now(), targetHash: meta.hash, savePath: found.savePath || '', ok: true };
    results[host] = tr;
    item.data.targetResults = results;
    ctx.targetService.saveQueue(item.data);
    return Object.assign(plan, { ok: true });
  }

  async function targetDelete(input) {
    const b = input || {};
    if (!b.host) throw new Error('target-delete 需要 --host <target>');
    return unwrap(await ctx.target.deleteTorrent(String(b.host), { id: b.id, url: b.url }, {
      dryRun: b.dryRun !== false, check: !!b.check, reason: b.reason, reasonType: b.reasonType
    }));
  }

  async function probe(input) {
    const b = input || {};
    const r = await ctx.targetService.probe(b);
    if (!r.ok) throw new Error(r.message || r.code || '探测失败');
    if (b.write) {
      const file = path.join(DATA_DIR, 'site-probe.json');
      fs.writeFileSync(file, JSON.stringify({ at: now(), data: r.data }, null, 2) + '\n', { mode: 0o600 });
      r.data.reportFile = 'site-probe.json';
    }
    return r.data;
  }

  async function targetAnnounce(input) {
    const b = input || {};
    if (!b.host) throw new Error('target-announce 需要 --host <target>');
    const r = await ctx.target.announceCandidates(String(b.host));
    if (!r.ok) throw new Error(r.message || r.code || 'announce 探测失败');
    return {
      host: r.data.host,
      candidates: (r.data.candidates || []).map(function (x) { return { source: x.source, kind: x.kind, hasPasskey: !!x.hasPasskey }; })
    };
  }

  function coverage(input) {
    const b = input || {};
    const list = ctx.target.list();
    const out = { total: list.length, withCookie: 0, ready: 0, upload: 0, verify: 0, engines: {}, sites: list };
    list.forEach(function (t) {
      if (t.hasCookie) out.withCookie++;
      if (t.ready) out.ready++;
      if (t.uploadPath) out.upload++;
      if (t.verifyPath) out.verify++;
      const e = t.engine || '?';
      out.engines[e] = (out.engines[e] || 0) + 1;
    });
    if (b.plan) {
      const sample = { title: 'Coverage Test 2024 1080p Blu-ray', cat: 'movie', res: '1080p', size: '20 GB', site: 'coverage.example' };
      const errors = {};
      let ok = 0;
      list.forEach(function (t) {
        const p = ctx.target.plan(t.host, sample);
        if (p.ok) ok++;
        else errors[p.code || 'PLAN_FAILED'] = (errors[p.code || 'PLAN_FAILED'] || 0) + 1;
      });
      out.plan = { ok: ok, failed: list.length - ok, errors: errors };
    }
    return out;
  }

  async function clients(input) {
    const b = input || {};
    const rows = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data) || {}; });
    const out = [];
    for (const d of rows) {
      const item = { id: d.id || '', name: d.name || '', kind: d.kind || 'qb' };
      if (b.test) {
        try {
          let r;
          if (item.kind === 'watch') r = watchClient.test({ dir: d.watchPath });
          else if (item.kind === 'qb') r = await qb.probeDownloader({ url: d.url, user: d.user, pass: qb.dlPass(d) });
          else { item.ok = false; item.message = '这个下载器类型已移除'; out.push(item); continue; }
          item.ok = !!r.pass;
          item.version = r.version || '';
          item.steps = (r.steps || []).map(function (s) { return { step: s.step || '', status: Number(s.status) || 0, ok: !!s.ok, error: s.error || '' }; });
          item.message = r.pass ? '连接通过' : (r.error || (item.steps.filter(function (s) { return s.status >= 400 || s.ok === false; })[0] || {}).step || '连接失败');
        } catch (e) {
          item.ok = false;
          item.message = String(e && e.message || e).slice(0, 160);
        }
      }
      out.push(item);
    }
    return out;
  }

  async function inject(input) {
    const b = input || {};
    const id = String(b.queueId || '').trim();
    if (!id) throw new Error('inject 需要 queueId');
    if (b.dryRun !== false) return unwrap(ctx.publisher.injectPlan(id, b));
    return unwrap(await ctx.publisher.publishItem(id, Object.assign({}, b, { dryRun: false })));
  }

  async function images(input) {
    const b = input || {};
    const id = String(b.queueId || '').trim();
    if (!id) throw new Error('images 需要 queueId');
    const row = one('SELECT data FROM queue WHERE id = ?', id);
    if (!row) throw new Error('队列条目不存在');
    const it = jparse(row.data) || {};
    const shots = Array.isArray(it.shots) ? it.shots : [];
    if (!shots.length) throw new Error('还没有截图');
    const provider = String(b.imageHost || it.imageHost || '站内');
    const dryRun = b.dryRun !== false;
    if (!dryRun && !ctx.allowReal('realImages')) throw new Error('图床真上传没打开：把配置 realImages 设为 true（或设 PTA_ALLOW_REAL=1）再试');
    const retries = b.retries !== undefined ? b.retries : flowConfig.number(flowConfig.read(ctx), '图片上传重试', 2);
    const r = await imagehost.process(provider, shots, { dryRun: dryRun, allowReal: !dryRun && ctx.allowReal('realImages'), retries: retries, delayMs: b.delayMs });
    it.imagePlan = { at: now(), provider: r.provider, dryRun: r.dryRun, total: r.total, uploaded: r.uploaded, failed: r.failed, code: r.code, message: r.message };
    if (!dryRun && r.items.some(function (x) { return x.ok; })) {
      it.imageHost = provider;
      it.imageLinks = r.items.filter(function (x) { return x.ok && x.url; }).map(function (x) { return { name: x.name, url: x.url }; });
    }
    db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(it), now(), id);
    if (!dryRun && r.items.some(function (x) { return x.ok; })) {
      const prep = ctx.release.prepare(id, {});
      if (prep.ok) r.prepared = prep.data.prepared;
    }
    return r;
  }

  async function verify(input) {
    const b = input || {};
    const item = ctx.targetService.loadQueue(b.queueId);
    if (!item) throw new Error('队列条目不存在');
    if (!b.host) throw new Error('verify 需要 --host <target>');
    const mism = ctx.targetService.checkHost(item.data, b.host);
    if (mism) throw new Error(mism.message);
    let buf = null;
    if (b.torrentBase64) buf = Buffer.from(String(b.torrentBase64), 'base64');
    if (!buf) {
      const t = await ctx.target.fetchSourceTorrent(item.data);
      if (t.err) throw new Error(t.err);
      buf = t.buf;
    }
    const r = await ctx.target.verify(b.host, item.data, buf, { url: b.url });
    if (!r.ok) throw new Error(r.message || r.code || '回查失败');
    item.data.targetVerify = Object.assign({}, r.data, { at: now() });
    ctx.targetService.saveQueue(item.data);
    return r.data;
  }

  return {
    dataDir: DATA_DIR,
    status: status,
    queue: queue,
    crawl: crawl,
    screen: input => screen.screenCatalog(ctx, input || {}),
    prepare: (id, body) => unwrap(ctx.release.prepare(id, body || {})),
    preview: id => unwrap(ctx.release.preview(id)),
    advance: (id, body) => unwrap(ctx.release.advance(id, body || {})),
    run: body => unwrap(ctx.release.run(body || {})),
    publish: async (id, body) => unwrap(await ctx.publisher.publishItem(id, body || {})),
    targets: () => ctx.target.list(),
    targetUpload: targetUpload,
    targetDelete: targetDelete,
    crossseed: crossseed,
    targetAnnounce: targetAnnounce,
    probe: probe,
    targetUploadMany: async (body) => unwrap(await ctx.targetService.uploadMany(body || {})),
    inject: inject,
    clients: clients,
    coverage: coverage,
    images: images,
    verify: verify,
    close: () => { try { db.close() } catch (e) { console.warn('[seedpod] close:', e && e.message ? e.message : e) } }
  };
}

module.exports = { createCore };

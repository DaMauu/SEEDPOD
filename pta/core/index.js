/* CLI 本地核心：不启 HTTP，直接复用 server 的抓取/查重/准备/发布模块。
   Fastify 路由仍走同一批模块；后续把剩余路由逐步改为直接调 core。 */
const fs = require('fs');
const path = require('path');
const { openDB } = require('../server/db');
const { makeCrawl } = require('../server/crawl');
const { makeTarget } = require('../server/target');
const { makePublisher } = require('../server/publish');
const { makeRelease } = require('../server/release');
const { makeTargetService } = require('../server/target-service');
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
      dryRun: b.dryRun !== false, verify: b.verify
    }));
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
    verify: verify,
    close: () => { try { db.close() } catch (e) { console.warn('[seedpod] close:', e && e.message ? e.message : e) } }
  };
}

module.exports = { createCore };

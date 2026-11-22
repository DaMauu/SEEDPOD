/* 追加到 app-fastify.js 的写接口片段：词条库、队列、流程规则、配置。
   在 build() 内被 require 注入（见 app-fastify.js 末尾 require('./routes-write')(app, ctx)）。 */
const fs = require('fs');
const path = require('path');
const { makeTarget } = require('./src/features/publish/target');
const { makeTargetService } = require('./src/features/publish/target-service');
const { hostsOf } = require('./src/features/screen/dedupe-item');

module.exports = function (app, ctx) {
  const { db, one, all, ok, bad, jparse, DATA_DIR } = ctx;
  const now = () => new Date().toISOString();
  const targetService = makeTargetService(ctx, makeTarget(ctx));
  const configSchema = require('./src/features/settings/config-schema');
const catalogBulk = require('./src/features/catalog/bulk');
const catalogItem = require('./src/features/catalog/item');
const { tx } = require('./src/infra/db');
const catalogSync = require('./src/features/catalog/sync');

  function getCatalog(id) {
    const row = one('SELECT data FROM catalog WHERE id = ?', id);
    return row ? jparse(row.data) : null;
  }

  /* ---- 词条库写入 ---- */
  app.post('/api/catalog', async (req, reply) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const items = Array.isArray(b) ? b : b.items;
    if (!Array.isArray(items)) return bad(reply, 'BAD_REQUEST', 'items 必须是数组');
    let added = 0, updated = 0;
    const ins = db.prepare(`INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, title=excluded.title, updated_at=excluded.updated_at`);
    const mx = one("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS m FROM catalog WHERE id LIKE 'cat_%'") || { m: 0 };
    const seq = Number(mx.m) || 0;
    items.slice(0, 500).forEach(function (raw, i) {
      if (!raw || !raw.title) return;
      const it = Object.assign({}, raw);
      it.id = it.id || 'cat_' + String(seq + i + 1).padStart(6, '0');
      it.status = it.status || 'new';
      it.createdAt = it.createdAt || now();
      ins.run(String(it.id), it.site || '', it.siteId != null ? String(it.siteId) : '', it.infohash || '',
        it.title, it.status, JSON.stringify(it), it.createdAt, now());
      added++;
    });
    return ok(reply, { added: added, updated: updated, skipped: items.length - added });
  });

  app.post('/api/catalog/:id/status', async (req, reply) => {
    const status = String((req.body && req.body.status) || '');
    if (!['new', 'selected', 'archived', 'published', 'skipped'].includes(status)) return bad(reply, 'BAD_REQUEST', 'status 不合法');
    const it = catalogItem.updCatalog(ctx, req.params.id, { status: status });
    if (!it) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    return ok(reply, it);
  });

  app.post('/api/catalog/:id/marks', async (req, reply) => {
    const it = getCatalog(req.params.id);
    if (!it) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    const marks = {};
    const src = (req.body && req.body.marks) || {};
    ['noRedistribute', 'exclusive', 'diy', 'hr', 'limited', 'limitedDays', 'existing'].forEach(function (k) {
      if (src[k]) marks[k] = src[k] === true ? true : Number(src[k]) || 0;
    });
    const next = catalogItem.updCatalog(ctx, req.params.id, { marks: marks });
    return ok(reply, next);
  });

  app.delete('/api/catalog/:id', async (req, reply) => {
    const id = req.params.id;
    const row = one('SELECT id FROM catalog WHERE id = ?', id);
    if (!row) return bad(reply, 'NOT_FOUND', '词条不存在', 404);
    /* 队列里的条目要保留：删词条时只摘掉 catalogId，避免留下悬空引用 */
    let detached = 0;
    tx(db, function () {
      all('SELECT id, data FROM queue').forEach(function (q) {
        const it = jparse(q.data) || {};
        if (String(it.catalogId || '') !== String(id)) return;
        delete it.catalogId;
        it.catalogDeletedAt = now();
        db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(it), now(), q.id);
        detached++;
      });
      db.prepare('DELETE FROM catalog WHERE id = ?').run(id);
    });
    return ok(reply, { id: id, detached: detached });
  });

  app.post('/api/catalog/bulk', async (req, reply) => {
    const b = req.body || {};
    const status = String(b.status || '');
    if (!['new', 'selected', 'archived', 'published', 'skipped'].includes(status)) return bad(reply, 'BAD_REQUEST', 'status 不合法');
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const from = String(b.fromStatus || '');
    const host = String(b.host || '').trim().toLowerCase();
    const includeDup = !!b.includeDup;
    if (!ids.length && !from && !includeDup) return bad(reply, 'BAD_REQUEST', '要么给 ids，要么给 fromStatus，要么 includeDup');
    let want = ids;
    if (!ids.length && from) {
      want = all('SELECT id, data, site FROM catalog WHERE status = ? LIMIT 5000', from)
        .filter(function (r) { const it = jparse(r.data) || {}; return !host || String(it.site || r.site || '').toLowerCase() === host; })
        .map(function (r) { return r.id; });
    }
    if (includeDup) {
      const dup = all("SELECT id, data, site FROM catalog WHERE status = 'new' LIMIT 5000")
        .filter(function (r) {
          const it = jparse(r.data) || {};
          return it.marks && it.marks.existing && (!host || String(it.site || r.site || '').toLowerCase() === host);
        }).map(function (r) { return r.id; });
      want = Array.from(new Set(want.concat(dup)));
    }
    /* 批量状态整批事务：中途失败不留半批 */
    const changed = catalogBulk.applyBulk(ctx, want.slice(0, 1000), status);
    return ok(reply, { changed: changed, status: status });
  });

  /* ---- 队列写入 ---- */
  app.post('/api/queue', async (req, reply) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return bad(reply, 'BAD_REQUEST', 'title 必填');
    const mxq = one("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM queue WHERE id LIKE 'q_%'") || { m: 0 };
    const n = Number(mxq.m) || 0;
    const item = Object.assign({}, b, { id: 'q_' + String(n + 1).padStart(4, '0'), status: b.status || 'pending', stage: b.stage || 'draft', createdAt: now() });
    db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
      .run(item.id, item.status, title, JSON.stringify(item), item.createdAt, now());
    return ok(reply, item);
  });

  app.post('/api/queue/:id/action', async (req, reply) => {
    const row = one('SELECT data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    /* 旧/坏数据可能没有 id，后续 UPDATE 不能拿 undefined 当键 */
    it.id = req.params.id;
    const b = req.body || {};
    if (b.title !== undefined) {
      const t = String(b.title).trim();
      if (!t) return bad(reply, 'BAD_REQUEST', '标题不能为空');
      it.title = t.slice(0, 300);
    }
    if (b.cn !== undefined) it.cn = String(b.cn).slice(0, 300);
    if (b.intro !== undefined) it.intro = String(b.intro).slice(0, 60000);
    if (b.mediaInfo !== undefined) it.mediaInfo = String(b.mediaInfo).slice(0, 200000);
    if (b.bdinfo !== undefined) it.bdinfo = String(b.bdinfo).slice(0, 200000);
    if (b.targetSite !== undefined) it.targetSite = String(b.targetSite).slice(0, 200);
    if (b.targets !== undefined) {
      const arr = Array.isArray(b.targets) ? b.targets : String(b.targets).split(',');
      it.targets = arr.map(function (h) { return String(h || '').trim().toLowerCase() }).filter(function (h, i, a) { return h && /^[a-z0-9][a-z0-9.-]*$/i.test(h) && a.indexOf(h) === i }).slice(0, 20);
      if (it.targets.length && b.targetSite === undefined) it.targetSite = it.targets[0];
    }
    if (b.imageHost !== undefined) it.imageHost = String(b.imageHost).slice(0, 40);
    if (b.anonymous !== undefined) it.anonymous = !!b.anonymous;
    /* 改了正文/媒体字段，旧的 prepared 快照就作废，发布前会重新整理 */
    if (b.title !== undefined || b.cn !== undefined || b.intro !== undefined || b.mediaInfo !== undefined || b.bdinfo !== undefined) {
      delete it.prepared;
      delete it.preparedAt;
    }
    /* 标题或目标站变了，旧查重结果不再可信；不清会跳过重新查重 */
    if (b.title !== undefined || b.targetSite !== undefined || b.targets !== undefined) {
      delete it.dupePassedAt;
      delete it.dupeResults;
      delete it.dupeSkipped;
      delete it.dupeLastError;
      delete it.dupeLastErrorCode;
      delete it.dupeLastAttemptAt;
      delete it.dupeNextRetryAt;
    }

    if (b.action === 'save') {
      db.prepare('UPDATE queue SET title = ?, data = ?, updated_at = ? WHERE id = ?')
        .run(it.title, JSON.stringify(it), now(), it.id);
      return ok(reply, { id: it.id, title: it.title, cn: it.cn, intro: it.intro, targetSite: it.targetSite });
    }
    if (b.action === 'download') {
      const r = await ctx.publisher.ensureSource(req.params.id, { allowWhenRealOff: true });
      if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
      return ok(reply, { id: req.params.id, complete: !!r.complete, progress: Number(r.progress) || 0, hash: r.hash || '', message: r.complete ? '下载完成' : '已加入 qB' });
    }
    if (b.action === 'publish') {
      if (!ctx.allowReal('realPublish')) return bad(reply, 'REAL_PUBLISH_DISABLED', '真发布还没打开：把配置 realPublish 设为 true（或设 ALLOW_REAL=1）再试', 409);
      db.prepare('UPDATE queue SET title = ?, data = ?, updated_at = ? WHERE id = ?')
        .run(it.title, JSON.stringify(it), now(), it.id);
      let src = null;
      try { src = await ctx.publisher.ensureSource(it.id, {}); } catch (e) { src = { ok: false, code: 'SOURCE_CHECK_FAILED', message: String(e && e.message || e).slice(0, 120) }; }
      if (!src || !src.ok) return bad(reply, (src && src.code) || 'SOURCE_CHECK_FAILED', (src && src.message) || '源种检查失败', (src && src.http) || 502);
      if (!src.complete) return bad(reply, 'SOURCE_INCOMPLETE', '源种还没下完，等 qB 100% 再发布', 409);
      const hosts = hostsOf(it);
      const trs = it.targetResults || {};
      const need = hosts.filter(function (h) { const tr = trs[h] || {}; return tr.stage !== 'submitted' && tr.stage !== 'injected'; });
      if (need.length) {
        const up = await targetService.uploadMany({ queueId: it.id, targets: need, dryRun: false });
        const failed = ((up && up.data && up.data.targets) || []).filter(function (x) { return !x.ok && !x.skipped; })[0];
        if (!up || !up.ok || failed) return bad(reply, (failed && failed.code) || (up && up.code) || 'UPLOAD_FAILED', (failed && failed.message) || (up && up.message) || '目标站上传失败', 502);
      }
      const r = await ctx.publisher.publishItem(req.params.id, { dryRun: false });
      if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
      return ok(reply, r.data);
    }

    const target = { approve: 'approved', reject: 'rejected', skip: 'skipped', retry: 'pending' }[b.action];
    if (!target) return bad(reply, 'BAD_REQUEST', 'action 只能是 approve / reject / skip / save / download / publish / retry');
    if (b.action === 'reject' && !String(b.reason || '').trim()) return bad(reply, 'BAD_REQUEST', '驳回要写理由');
    const wasRejected = it.status === 'rejected';
    if (it.status === 'published' && (b.action === 'retry' || b.action === 'reject' || b.action === 'skip')) {
      return bad(reply, 'PUBLISHED_LOCKED', '已发布的条目不在这里回滚；要撤种先去目标站和下载器处理', 409);
    }
    it.status = target;
    it.actionAt = now();
    /* 手动改状态后旧 held 观测失效，避免失败队列继续显示“源种未下完” */
    delete it.heldSince;
    delete it.heldAt;
    delete it.heldReason;
    delete it.heldAlertAt;
    delete it.heldAlertNextAt;
    if (b.action === 'retry') {
      /* 重新排队要把 failed 阶段也退回去，否则失败状态会一直跟着条目 */
      const from = String(it.stageFailedFrom || '');
      it.stage = wasRejected ? 'draft' : (['draft', 'prepared', 'previewed'].indexOf(from) >= 0 ? from : 'prepared');
      delete it.stageFailedFrom;
      delete it.stageLastError;
      delete it.stageLastErrorCode;
      delete it.stageNextRetryAt;
      delete it.stageUpdatedAt;
      delete it.stageEvidence;
      it.stageAttempts = 0;
    }
    /* 驳回原因只在驳回状态保留；重新送审/批准后不能继续挂着旧理由 */
    if (b.action === 'reject') it.rejectedAt = now();
    if (target === 'pending' || target === 'approved') { delete it.reason; delete it.rejectedAt; }
    if (b.reason) it.reason = String(b.reason).slice(0, 500);
    tx(db, function () {
      db.prepare('UPDATE queue SET status = ?, title = ?, data = ?, updated_at = ? WHERE id = ?')
        .run(target, it.title, JSON.stringify(it), now(), it.id);
      catalogSync.apply(ctx, it, target, it.reason);
    });
    return ok(reply, it);
  });

  app.delete('/api/queue/:id', async (req, reply) => {
    const row = one('SELECT id, status, data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    if (row.status === 'published' || one('SELECT 1 AS x FROM published WHERE id = ?', req.params.id)) {
      return bad(reply, 'PUBLISHED_LOCKED', '已发布的条目不删；先处理目标站和下载器里的种子', 409);
    }
    const it = jparse(row.data) || {};
    /* 已提交/已注入目标站的条目不能直接删，否则目标站和 qB 里会留孤儿种子 */
    const trs = it.targetResults || {};
    const submitted = Object.keys(trs).filter(function (h) {
      const tr = trs[h] || {};
      return tr.stage === 'submitted' || tr.stage === 'injected' || !!tr.publishedTorrent;
    });
    if (submitted.length) {
      return bad(reply, 'TARGET_SUBMITTED', '目标站已提交/注入：' + submitted.join('、') + '；先去目标站和下载器处理再删', 409);
    }
    tx(db, function () {
      db.prepare('DELETE FROM queue WHERE id = ?').run(req.params.id);
      catalogSync.reset(ctx, it);
    });
    /* 清掉该条目缓存的源种文件；已发布条目上面已拦，不动 published 文件 */
    let cleanedFiles = 0;
    const cleanupErrors = [];
    const hashes = [it.infohash, it.sourceState && it.sourceState.hash].map(function (x) { return String(x || '').toLowerCase(); })
      .filter(function (h, i, a) { return /^[a-f0-9]{40}$/.test(h) && a.indexOf(h) === i; });
    hashes.forEach(function (h) {
      try {
        const file = path.join(DATA_DIR, 'torrents', 'source-' + h + '.torrent');
        if (fs.existsSync(file)) { fs.unlinkSync(file); cleanedFiles++; }
      } catch (e) {
        if (cleanupErrors.length < 5) cleanupErrors.push({ hash: h, error: String(e && (e.code || e.message) || e).slice(0, 120) });
      }
    });
    return ok(reply, { id: req.params.id, catalogReset: !!it.catalogId, cleanedFiles: cleanedFiles, cleanupErrors: cleanupErrors });
  });

  /* ---- 流程规则 ---- */
  app.get('/api/flow', async () => {
    const row = one("SELECT v FROM meta WHERE k = 'flow'");
    return ok(JSON.parse(row ? row.v : 'null') || { sets: null, rx: {}, updatedAt: null });
  });
  app.put('/api/flow', async (req, reply) => {
    const b = req.body || {};
    const row = one("SELECT v FROM meta WHERE k = 'flow'");
    const prev = JSON.parse(row ? row.v : 'null') || { sets: {}, rx: {} };
    const sets = Object.assign({}, prev.sets || {}, b.sets || {});
    const rx = Object.assign({}, prev.rx || {});
    if (b.rx) {
      if (b.rx.deny !== undefined) rx.deny = String(b.rx.deny || '').slice(0, 200);
      /* 白名单已合并成单条排除正则；旧配置里的 allow 不再生效，顺便清掉 */
      delete rx.allow;
      if (b.rx.scope !== undefined) rx.scope = String(b.rx.scope || '').slice(0, 40);
    }
    const flow = { sets: sets, rx: rx, updatedAt: now(), schemaVersion: configSchema.FLOW_VERSION };
    db.prepare("INSERT INTO meta(k, v) VALUES('flow', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(flow));
    return ok(reply, flow);
  });

  /* ---- 配置 ---- */
  const DEF = configSchema.DEFAULTS;
  const LIM = { listInterval: [6, 60], interval: [8, 600], windowMinutes: [1, 1440], maxPerWindow: [1, 1000], breaker: [1, 10], concurrency: [1, 5] };
  function readCfg() { return Object.assign({}, DEF, configSchema.read(ctx)); }
  app.get('/api/config', async () => ok({ sys: { concurrency: 1, minInterval: 8, retry: 3, backoff: 30, breakerMinutes: 15, audit: true }, user: readCfg(), limits: LIM }));
  app.patch('/api/config/user', async (req, reply) => {
    const b = req.body || {};
    const cfg = readCfg();
    for (const k of ['listInterval', 'interval', 'windowMinutes', 'maxPerWindow', 'breaker', 'concurrency']) {
      if (b[k] === undefined) continue;
      const n = Number(b[k]);
      if (!Number.isInteger(n)) return bad(reply, 'BAD_REQUEST', k + ' 必须是整数');
      if (n < LIM[k][0] || n > LIM[k][1]) return bad(reply, 'OUT_OF_RANGE', k + ' 必须在 ' + LIM[k][0] + '–' + LIM[k][1] + ' 之间');
    }
    const next = Object.assign({}, cfg);
    if (b.autoDupe !== undefined) next.autoDupe = !!b.autoDupe;
    if (b.realCrawl !== undefined) next.realCrawl = !!b.realCrawl;
    if (b.realPublish !== undefined) next.realPublish = !!b.realPublish;
    if (b.realImages !== undefined) next.realImages = !!b.realImages;
    if (b.testOnly !== undefined) next.testOnly = !!b.testOnly;
    if (b.detail !== undefined) next.detail = !!b.detail;
    if (b.targetHost !== undefined) next.targetHost = String(b.targetHost || '').trim().toLowerCase().slice(0, 200);
    if (b.retryMax !== undefined) {
      const n = Number(b.retryMax);
      if (!Number.isInteger(n) || n < 0 || n > 10) return bad(reply, 'OUT_OF_RANGE', 'retryMax 必须是 0–10 的整数');
      next.retryMax = n;
    }
    if (b.retryBackoffMin !== undefined) {
      const n = Number(b.retryBackoffMin);
      if (!Number.isInteger(n) || n < 1 || n > 1440) return bad(reply, 'OUT_OF_RANGE', 'retryBackoffMin 必须是 1–1440 的整数');
      next.retryBackoffMin = n;
    }
    ['listInterval', 'interval', 'windowMinutes', 'maxPerWindow', 'breaker'].forEach(function (k) { if (b[k] !== undefined) next[k] = Number(b[k]); });
    if (ctx.logEvent) {
      ['realPublish', 'realCrawl', 'realImages'].forEach(function (k) {
        if (next[k] !== cfg[k]) ctx.logEvent(next[k] ? 'warn' : 'info', '配置', k + (next[k] ? ' 开启' : ' 关闭'));
      });
      if (String(next.targetHost || '') !== String(cfg.targetHost || '')) ctx.logEvent('warn', '配置', 'targetHost 变更');
    }
    const saved = configSchema.write(ctx, next);
    return ok(reply, saved);
  });
};

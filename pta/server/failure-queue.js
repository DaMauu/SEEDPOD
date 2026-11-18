/* 失败队列：列出 queue 里的阶段失败 / 目标站失败 / 待重试，支持单条重放。
   只读写本地 SQLite；不重建队列、不重复上传已提交的条目。 */
const errors = require('./errors');

const DEAD_AFTER_MS = 24 * 3600 * 1000;
const RETENTION_DAYS = 30;
const RETENTION_MAX = 1000;

function makeFailureQueue(ctx) {
  const { db, one, all, jparse } = ctx;

  function retryMax() {
    try {
      const row = one("SELECT v FROM meta WHERE k = 'config'");
      const cfg = JSON.parse(row ? row.v : 'null') || {};
      return Math.max(0, Math.min(10, cfg.retryMax === undefined ? 2 : Number(cfg.retryMax) || 0));
    } catch (e) { return 2; }
  }

  function failuresOf(d) {
    const out = [];
    const at = d.stageUpdatedAt || '';
    if (d.stage === 'failed' || d.stageLastError) {
      out.push({
        kind: 'stage', stage: d.stageFailedFrom || d.stage || 'publish',
        code: errors.normalize(d.stageLastErrorCode || 'UNKNOWN'),
        message: String(d.stageLastError || d.retryMsg || '').slice(0, 300),
        attempts: Number(d.retries || d.stageAttempts) || 0,
        nextRetryAt: String(d.nextRetryAt || d.stageNextRetryAt || ''),
        lastAttemptAt: String(at)
      });
    }
    const trs = d.targetResults || {};
    Object.keys(trs).forEach(function (host) {
      const tr = trs[host] || {};
      if (tr.stage !== 'failed' && !tr.nextRetryAt && !tr.error) return;
      out.push({
        kind: 'target', host: host, stage: 'target',
        code: errors.normalize(tr.errorCode || 'UNKNOWN'),
        message: String(tr.error || '').slice(0, 300),
        attempts: Number(tr.attempts) || 0,
        nextRetryAt: String(tr.nextRetryAt || ''),
        lastAttemptAt: String(tr.at || '')
      });
    });
    if (d.dedupeLastError) {
      out.push({ kind: 'dedupe', stage: 'dedupe', code: errors.normalize(d.dedupeLastErrorCode || 'UNKNOWN'),
        message: String(d.dedupeLastError).slice(0, 300), attempts: Number(d.dedupeAttempts) || 0,
        nextRetryAt: String(d.dedupeNextRetryAt || ''), lastAttemptAt: String(d.dedupeLastAttemptAt || '') });
    }
    if (d.metaLastError) {
      out.push({ kind: 'review', stage: 'review', code: errors.normalize(d.metaLastErrorCode || 'UNKNOWN'),
        message: String(d.metaLastError).slice(0, 300), attempts: Number(d.metaAttempts) || 0,
        nextRetryAt: String(d.metaNextRetryAt || ''), lastAttemptAt: String(d.metaLastAttemptAt || '') });
    }
    return out;
  }

  function isDead(failures, max) {
    const now = Date.now();
    return (failures || []).some(function (f) {
      const at = Date.parse(f.lastAttemptAt || '') || 0;
      if (max > 0 && f.attempts >= max) return true;
      return at > 0 && now - at > DEAD_AFTER_MS && !f.nextRetryAt;
    });
  }

  /* 保留策略：只做视图过滤，不删队列数据。
     默认最近 30 天或最多 1000 条；有下次重试时间的条目即使更旧也保留。 */
  function list(opts) {
    const o = opts || {};
    const limit = Math.max(1, Math.min(200, Number(o.limit) || 50));
    const offset = Math.max(0, Number(o.offset) || 0);
    const deadOnly = o.dead === true || o.dead === '1' || o.dead === 'true';
    const days = o.days === undefined ? RETENTION_DAYS : Math.max(0, Math.min(3650, Number(o.days) || 0));
    const maxItems = Math.max(1, Math.min(5000, Number(o.maxItems || o.max) || RETENTION_MAX));
    const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
    const max = retryMax();
    const items = [];
    all("SELECT id, status, title, data FROM queue ORDER BY updated_at DESC LIMIT 5000").forEach(function (row) {
      const d = jparse(row.data) || {};
      const failures = failuresOf(d);
      if (!failures.length) return;
      if (cutoff > 0) {
        const times = [];
        failures.forEach(function (f) {
          const at = Date.parse(f.lastAttemptAt || '') || 0;
          const next = Date.parse(f.nextRetryAt || '') || 0;
          if (at) times.push(at);
          if (next) times.push(next);
        });
        const latest = times.length ? Math.max.apply(null, times) : 0;
        const scheduled = failures.some(function (f) { return Date.parse(f.nextRetryAt || '') > Date.now(); });
        /* 没有时间戳的旧数据不隐藏；有未来重试的照常保留 */
        if (latest && latest < cutoff && !scheduled) return;
      }
      const dead = isDead(failures, max);
      if (deadOnly && !dead) return;
      items.push({ id: row.id, title: row.title || d.title || '', status: row.status || d.status || '', stage: d.stage || '',
        dead: dead, failures: failures, nextRetryAt: failures.map(function (x) { return x.nextRetryAt; }).filter(Boolean).sort()[0] || '' });
    });
    items.splice(maxItems);
    const total = items.length;
    const page = items.slice(offset, offset + limit);
    const byCode = {};
    const byStage = {};
    items.forEach(function (it) {
      it.failures.forEach(function (f) {
        byCode[f.code] = (byCode[f.code] || 0) + 1;
        byStage[f.stage] = (byStage[f.stage] || 0) + 1;
      });
    });
    return { total: total, dead: items.filter(function (x) { return x.dead; }).length, limit: limit, offset: offset,
      counts: byCode, byStage: byStage, items: page, retryMax: max,
      retention: { days: days, maxItems: maxItems, cutoff: cutoff } };
  }

  function replay(id) {
    const row = one('SELECT id, status, data FROM queue WHERE id = ?', id);
    if (!row) return { ok: false, code: 'NOT_FOUND', message: '队列条目不存在', http: 404 };
    const d = jparse(row.data) || {};
    if (d.stage === 'submitted' || d.stage === 'injected') {
      return { ok: false, code: 'ALREADY_SUBMITTED', message: '这个条目已经提交/注入，不能重放', http: 409 };
    }
    const trs = d.targetResults || {};
    if (Object.keys(trs).some(function (h) { return trs[h] && trs[h].publishedTorrent; })) {
      return { ok: false, code: 'ALREADY_SUBMITTED', message: '目标站已有权威种子，不能重放', http: 409 };
    }
    d.status = 'pending';
    d.stage = String(d.stageFailedFrom || 'prepared');
    delete d.stageLastError;
    delete d.stageLastErrorCode;
    delete d.stageNextRetryAt;
    delete d.nextRetryAt;
    delete d.retryMsg;
    d.retries = 0;
    d.stageAttempts = 0;
    Object.keys(trs).forEach(function (h) {
      const tr = trs[h] || {};
      if (tr.stage === 'failed' || tr.nextRetryAt || tr.error) {
        tr.stage = 'pending';
        tr.attempts = 0;
        delete tr.nextRetryAt;
        delete tr.error;
        delete tr.errorCode;
      }
    });
    delete d.dedupeLastError;
    delete d.dedupeLastErrorCode;
    delete d.dedupeLastAttemptAt;
    delete d.dedupeNextRetryAt;
    d.dedupeAttempts = 0;
    delete d.metaLastError;
    delete d.metaLastErrorCode;
    delete d.metaLastAttemptAt;
    delete d.metaNextRetryAt;
    d.metaAttempts = 0;
    d.replayedAt = new Date().toISOString();
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(d.status, JSON.stringify(d), d.replayedAt, id);
    if (ctx.logEvent) ctx.logEvent('info', '失败队列', '重放 · ' + id + ' · ' + String(d.stage || ''));
    return { ok: true, id: id, status: d.status, stage: d.stage };
  }

  return { list: list, replay: replay, failuresOf: failuresOf };
}

module.exports = { makeFailureQueue, DEAD_AFTER_MS };

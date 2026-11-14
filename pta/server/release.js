/* 单 release 准备与阶段推进：纯本地，不发外部请求。
   为 CLI prepare/preview/advance/run 提供同一套逻辑，后续 G7/G8 再扩展提交/注入。 */
const meta = require('./meta');
const { makeQb } = require('./qb');
const { makeTarget } = require('./target');
const stage = require('./stage');

function makeRelease(ctx) {
  const { db, one, all, jparse, DATA_DIR } = ctx;
  const qb = makeQb(DATA_DIR);
  const target = makeTarget(ctx);
  const now = () => new Date().toISOString();
  const STAGES = ['draft', 'prepared', 'previewed', 'submitted', 'injected', 'failed'];

  function load(id) {
    const row = one('SELECT id, status, data FROM queue WHERE id = ?', id);
    return row ? { id: row.id, status: row.status, data: jparse(row.data) || {} } : null;
  }
  function save(item) {
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(item.status || item.data.status || 'pending', JSON.stringify(item.data), now(), item.id);
  }
  function fail(code, message, http) {
    return { ok: false, code: code, message: message, http: http || 400 };
  }
  function targetPlan(item, host) {
    if (!host) return { target: null, error: '' };
    try {
      const p = target.plan(host, item);
      if (p.ok) return { target: p.data, error: '' };
      return { target: null, error: p.message || p.code || '目标站计划失败' };
    } catch (e) {
      return { target: null, error: String(e && e.message || e).slice(0, 200) };
    }
  }
  function torrentOf(body) {
    if (!body || !body.torrentBase64) return { torrent: null, error: '' };
    try {
      const buf = Buffer.from(String(body.torrentBase64), 'base64');
      if (!buf.length) return { torrent: null, error: '种子是空文件' };
      if (buf.length > 10 * 1024 * 1024) return { torrent: null, error: '种子超过 10MB' };
      const t = qb.parseTorrent(buf);
      if (!t || !t.hash) return { torrent: null, error: '种子解析不出 infohash' };
      return { torrent: { hash: t.hash, name: t.name || '', size: buf.length }, error: '' };
    } catch (e) {
      return { torrent: null, error: '种子解析失败' };
    }
  }
  function build(item, body) {
    const b = body || {};
    const names = meta.buildNames(item);
    const host = String(b.host || item.targetSite || '').trim();
    const tp = targetPlan(item, host);
    const tr = torrentOf(b);
    return {
      at: now(),
      title: names.title,
      releaseTitle: names.releaseTitle,
      subtitle: names.subtitle,
      description: names.description,
      parsed: names.parsed,
      targetHost: host,
      target: tp.target,
      targetError: tp.error,
      torrent: tr.torrent,
      torrentError: tr.error,
      shots: Array.isArray(item.shots) ? item.shots.length : 0
    };
  }
  function prepare(id, body) {
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    const prepared = build(it, body);
    it.prepared = prepared;
    it.preparedAt = prepared.at;
    stage.set(it, 'prepared', { evidence: { host: prepared.targetHost || '', shots: prepared.shots || 0, preparedAt: prepared.at } });
    save(cur);
    return { ok: true, data: { id: id, stage: 'prepared', prepared: prepared } };
  }
  function preview(id) {
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    if (!it.prepared) {
      const p = prepare(id, {});
      if (!p.ok) return p;
      it.prepared = p.data.prepared;
    }
    it.previewedAt = now();
    stage.set(it, 'previewed', { evidence: { previewedAt: it.previewedAt } });
    save(cur);
    const p = it.prepared || {};
    const payload = {
      title: p.title || '', subtitle: p.subtitle || '', description: p.description || '',
      targetHost: p.targetHost || '', target: p.target || null, targetError: p.targetError || '',
      shots: p.shots || 0, torrent: p.torrent || null
    };
    return { ok: true, data: { id: id, stage: 'previewed', prepared: it.prepared, payload: payload } };
  }
  function advance(id, body) {
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    stage.ensure(it);
    const curStage = it.stage;
    if (curStage === 'failed') {
      const next = Date.parse(it.stageNextRetryAt || '') || 0;
      if (next > Date.now()) {
        return { ok: true, data: { id: id, stage: 'failed', next: 'wait', nextRetryAt: it.stageNextRetryAt, note: '还没到重试时间' } };
      }
      if (it.stageFailedFrom === 'submitted') {
        return { ok: true, data: { id: id, stage: 'failed', next: 'target-upload', note: '提交失败；用 target-upload 重试，成功后自动标 submitted' } };
      }
      if (it.stageFailedFrom === 'injected') {
        return { ok: true, data: { id: id, stage: 'failed', next: 'publish', note: '注入失败；用 publish 重试，成功后自动标 injected' } };
      }
      stage.set(it, 'draft', { evidence: { retryAt: now() } });
      save(cur);
      return prepare(id, body);
    }
    if (curStage === 'draft') return prepare(id, body);
    if (curStage === 'prepared') return preview(id);
    if (curStage === 'previewed') {
      return { ok: true, data: { id: id, stage: curStage, next: 'target-upload / publish', note: '本地准备完成；提交和注入用 target-upload / publish，默认干跑' } };
    }
    if (curStage === 'submitted') {
      return { ok: true, data: { id: id, stage: curStage, next: 'publish', note: '已提交目标站；下一步注入下载器' } };
    }
    if (curStage === 'injected') {
      return { ok: true, data: { id: id, stage: curStage, next: '', note: '已完成' } };
    }
    return fail('BAD_STAGE', '未知阶段：' + curStage);
  }
  function run(body) {
    const b = body || {};
    const stage = String(b.stage || 'prepared');
    if (stage !== 'prepared' && stage !== 'previewed') {
      return fail('BAD_STAGE', 'run 只支持 prepared / previewed');
    }
    const limit = Math.max(1, Math.min(100, Number(b.limit) || 20));
    const rows = all('SELECT id, status, data FROM queue ORDER BY created_at ASC LIMIT ?', limit);
    const out = { stage: stage, checked: rows.length, prepared: 0, previewed: 0, skipped: 0, failed: 0, items: [] };
    rows.forEach(function (row) {
      const it = jparse(row.data) || {};
      const cur = it.stage || 'draft';
      if (stage === 'prepared') {
        if (cur === 'draft' || cur === 'failed') {
          const r = prepare(row.id, b);
          if (r.ok) { out.prepared++; out.items.push({ id: row.id, stage: 'prepared' }); }
          else { out.failed++; out.items.push({ id: row.id, error: r.message }); }
        } else { out.skipped++; }
        return;
      }
      if (stage === 'previewed') {
        if (cur === 'prepared' || cur === 'failed') {
          const r = preview(row.id);
          if (r.ok) { out.previewed++; out.items.push({ id: row.id, stage: 'previewed' }); }
          else { out.failed++; out.items.push({ id: row.id, error: r.message }); }
        } else { out.skipped++; }
      }
    });
    return { ok: true, data: out };
  }
  return { prepare: prepare, preview: preview, advance: advance, run: run, STAGES: STAGES };
}

module.exports = { makeRelease };

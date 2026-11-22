/* 失败统计：从 queue 的 stage/targetResults 和 scheduler.lastResult.errors 汇总。
   不写库；API 和 CLI 共用。 */
const errors = require('../../shared/errors');

function makeErrorStats(ctx) {
  const { all, one, jparse } = ctx;

  function snapshot(limit) {
    const items = [];
    const counts = {};
    const byStage = {};
    const add = function (rawCode, stage, message, source, id, host, extra) {
      const d = errors.describe(rawCode);
      const code = d.code;
      const it = {
        code: code, legacyCode: d.legacy !== code ? d.legacy : '', stage: d.stage,
        level: d.level, retryable: d.retryable,
        message: String(message || d.message || '').slice(0, 300),
        source: source, id: String(id || ''), host: String(host || ''),
        attempts: Number(extra && extra.attempts) || 0,
        nextRetryAt: extra && extra.nextRetryAt ? String(extra.nextRetryAt) : '',
        at: extra && extra.at ? String(extra.at) : ''
      };
      items.push(it);
      const cur = counts[code] || { code: code, stage: d.stage, level: d.level, message: d.message, retryable: d.retryable, count: 0 };
      cur.count += 1;
      counts[code] = cur;
      byStage[d.stage] = (byStage[d.stage] || 0) + 1;
    };

    try {
      const row = one("SELECT v FROM meta WHERE k = 'scheduler'");
      const st = JSON.parse(row ? row.v : 'null') || {};
      ((st.lastResult && st.lastResult.errors) || []).forEach(function (e) {
        add(e.code || 'PHASE_EXCEPTION', e.phase || 'scheduler', e.message, 'scheduler', e.phase || '', '', { at: e.at });
      });
    } catch (e) { /* stats 不应因坏 meta 失败 */ }

    const rows = all("SELECT id, status, data FROM queue LIMIT 1000");
    rows.forEach(function (row) {
      const d = jparse(row.data) || {};
      if (d.stage === 'failed' || d.stageLastError) {
        add(d.stageLastErrorCode || 'UNKNOWN', d.stageFailedFrom || d.stage || 'publish', d.stageLastError || d.retryMsg || '',
          'queue', row.id, '', { attempts: d.retries || d.stageAttempts, nextRetryAt: d.nextRetryAt || d.stageNextRetryAt, at: d.stageUpdatedAt });
      }
      const trs = d.targetResults || {};
      Object.keys(trs).forEach(function (host) {
        const tr = trs[host] || {};
        if (tr.stage !== 'failed' && !tr.nextRetryAt && !tr.error) return;
        add(tr.errorCode || 'UNKNOWN', 'target', tr.error || '', 'targetResults', row.id, host, {
          attempts: tr.attempts, nextRetryAt: tr.nextRetryAt, at: tr.at
        });
      });
    });

    const list = items.slice(-Math.max(1, Math.min(1000, Number(limit) || 200))).reverse();
    return {
      total: items.length,
      counts: Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return b.count - a.count; }),
      byStage: byStage,
      items: list
    };
  }
  return { snapshot: snapshot };
}

module.exports = { makeErrorStats };

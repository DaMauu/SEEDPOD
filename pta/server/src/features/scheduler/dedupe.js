/* 查重阶段：逐目标站检查、写 dupeResults、失败记 attempts/nextRetryAt。
   单条逻辑复用 dedupe-item.js，跟送审查重保持同一套语义。 */
const { dedupeItem, hostsOf } = require('../screen/dedupe-item');

function makeDedupePhase(deps) {
  return async function runDedupePhase(o) {
    const { want, all, jparse, targetService, ctx, batch, bumpSiteFail, resetSiteFail, pipeline, steps, force } = o;
      const dedupe = { checked: 0, kept: 0, skipped: 0, errors: [], skippedStep: false, disabled: false, requests: 0 };
      /* 自动查重开关：关掉时调度不做，但显式指定 dedupe 步骤仍可强制跑 */
      let autoDupe = true;
      try {
        const row = ctx.one("SELECT v FROM meta WHERE k = 'config'");
        const cfg = row ? (JSON.parse(row.v) || {}) : {};
        autoDupe = cfg.autoDupe === true;
      } catch (e) { autoDupe = false; }
      if (!force && !autoDupe) {
        dedupe.skippedStep = true;
        dedupe.disabled = true;
        dedupe.skippedReason = 'autoDupe off';
        if (pipeline) await pipeline.run('dedupe', ctx, steps);
        return { dedupe: dedupe, hooks: undefined };
      }
      const dedupeLimit = batch;
      const pend = want('dedupe') ? all("SELECT id, data FROM queue WHERE status = 'pending' ORDER BY updated_at ASC LIMIT " + dedupeLimit) : [];
      if (!want('dedupe')) dedupe.skippedStep = true;
      for (const row of pend) {
        const it = jparse(row.data) || {};
        const hosts = hostsOf(it);
        if (!hosts.length) continue;
        dedupe.checked++;
        const r = await dedupeItem({ item: it, hosts: hosts, targetService: targetService, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail });
        dedupe.requests += r.checked;
        if (r.disabled) dedupe.disabled = true;
        r.errors.forEach(function (e) { dedupe.errors.push({ id: row.id, host: e.host, error: e.message }); });
        if (r.allSkipped) {
          it.dupeSkipped = { at: new Date().toISOString(), hosts: hosts };
          dedupe.skipped++;
          ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
            .run('skipped', JSON.stringify(Object.assign({}, it, { status: 'skipped' })), new Date().toISOString(), row.id);
        } else if (r.errors.length || r.disabled) {
          /* 查重没查成/开关关闭：不能标记已通过，留给下一轮或人工 */
          dedupe.failed = (dedupe.failed || 0) + 1;
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(it), new Date().toISOString(), row.id);
        } else {
          it.dupePassedAt = new Date().toISOString();
          dedupe.kept++;
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(it), new Date().toISOString(), row.id);
        }
      }
    const hooks = await pipeline.run('dedupe', ctx, steps);
    return { dedupe: dedupe, hooks: hooks };
  };
}

module.exports = { makeDedupePhase };

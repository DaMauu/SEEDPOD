/* 查重阶段：逐目标站检查、写 dupeResults、失败记 attempts/nextRetryAt。 */
function makeDedupePhase(deps) {
  return async function runDedupePhase(o) {
    const { want, all, jparse, targetService, ctx, batch, bumpSiteFail, resetSiteFail, pipeline, steps } = o;
      const dedupe = { checked: 0, kept: 0, skipped: 0, errors: [], skippedStep: false, disabled: false, requests: 0 };
      const dedupeLimit = batch;
      const pend = want('dedupe') ? all("SELECT id, data FROM queue WHERE status = 'pending' LIMIT " + dedupeLimit) : [];
      if (!want('dedupe')) dedupe.skippedStep = true;
      for (const row of pend) {
        const it = jparse(row.data) || {};
        const hosts = [];
        [it.targetSite].concat(Array.isArray(it.targets) ? it.targets : []).forEach(function (h) {
          h = String(h || '').trim().toLowerCase();
          if (h && hosts.indexOf(h) < 0) hosts.push(h);
        });
        if (!hosts.length) continue;
        dedupe.checked++;
        it.dupeResults = it.dupeResults || {};
        let anyOpen = false;
        for (const host of hosts) {
          /* 本轮之前查过且可发：不重复请求目标站 */
          const prev = it.dupeResults[host];
          if (it.dupePassedAt && prev && !prev.skip) { anyOpen = true; continue; }
          let chk = { found: false, skip: false };
          dedupe.requests++;
          try {
            chk = await targetService.checkDupe(host, it, null);
            if (chk && chk.ok === false) throw Object.assign(new Error(chk.message || chk.code), { code: chk.code });
            resetSiteFail(host);
          }
          catch (e) {
            const emsg = String(e && e.message || e).slice(0, 120);
            dedupe.errors.push({ id: row.id, host: host, error: emsg });
            bumpSiteFail(host, '查重失败：' + emsg);
            it.dedupeAttempts = (Number(it.dedupeAttempts) || 0) + 1;
            it.dedupeLastAttemptAt = new Date().toISOString();
            it.dedupeLastErrorCode = e && e.code ? String(e.code) : 'TARGET_UNREACHABLE';
            it.dedupeLastError = emsg;
            it.dedupeNextRetryAt = new Date(Date.now() + 15 * 60000).toISOString();
            anyOpen = true; continue;
          }
          if (chk.disabled) { dedupe.disabled = true; anyOpen = true; continue; }
          delete it.dedupeLastError;
          delete it.dedupeLastErrorCode;
          delete it.dedupeNextRetryAt;
          it.dupeResults[host] = { found: !!chk.found, skip: !!chk.skip, kind: chk.kind || '', at: new Date().toISOString() };
          if (chk.found && chk.skip) continue;
          anyOpen = true;
        }
        if (!anyOpen) {
          it.dupeSkipped = { at: new Date().toISOString(), hosts: hosts };
          dedupe.skipped++;
          ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
            .run('skipped', JSON.stringify(Object.assign({}, it, { status: 'skipped' })), new Date().toISOString(), row.id);
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

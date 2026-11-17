/* 调度重试阶段：辅种重试与失败队列重试。 */
async function noop() {}

function makeRetryPhases() {
  async function runCrossseedPhase(o) {
    const { all, jparse, crossseed, want, ctx } = o;
      if (want('crossseed') && ctx.allowReal('realPublish')) {
        const csRows = all("SELECT id, data FROM queue WHERE status = 'published' ORDER BY updated_at DESC LIMIT 50");
        const cs = { checked: 0, ok: 0, failed: 0, errors: [] };
        for (const row of csRows) {
          if (cs.checked >= 10) break;
          const it = jparse(row.data) || {};
          for (const host of Object.keys(it.targetResults || {})) {
            if (cs.checked >= 10) break;
            const tr = it.targetResults[host] || {};
            if (tr.crossseed && tr.crossseed.ok) continue;
            if (!tr.publishedTorrent) continue;
            const retryAt = Date.parse((tr.crossseed && tr.crossseed.retryAt) || '') || 0;
            if (retryAt > Date.now()) continue;
            cs.checked++;
            let r;
            try { r = await crossseed.run({ id: row.id, data: it }, host, {}); }
            catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
            if (r.ok) cs.ok++;
            else { cs.failed++; if (cs.errors.length < 3) cs.errors.push({ id: row.id, host: host, error: r.error }); }
          }
        }
        return cs;
      } else {
        return { skipped: want('crossseed') ? 'realPublish off' : 'step not selected' };
      }
  }

  async function runRetryPhase(o) {
    const { one, all, jparse, ctx, deps, crossseed, bumpSiteFail, resetSiteFail } = o;
      if (ctx.allowReal('realPublish')) {
        const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
        const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
        const retryMax = Math.max(0, Math.min(10, cfg.retryMax === undefined ? 2 : Number(cfg.retryMax) || 0));
        const backoff = Math.max(1, Math.min(1440, cfg.retryBackoffMin === undefined ? 15 : Number(cfg.retryBackoffMin) || 15));
        let ok = 0, failed = 0, skipped = 0;
        const rows2 = all("SELECT id, data FROM queue WHERE status = 'failed' LIMIT 10");
        for (const row of rows2) {
          const it = jparse(row.data) || {};
          const retries = Number(it.retries) || 0;
          if (retries >= retryMax) { skipped++; continue; }
          if (it.nextRetryAt && Date.parse(it.nextRetryAt) > Date.now()) { skipped++; continue; }
          const r = await deps.publish.publishItem(row.id, { dryRun: false });
          if (r.ok) {
            ok++;
            resetSiteFail(it.targetSite || it.site);
            const cur = one('SELECT data FROM queue WHERE id = ?', row.id);
            const done = cur ? (jparse(cur.data) || null) : null;
            if (done) {
              for (const host of Object.keys(done.targetResults || {})) {
                const tr = done.targetResults[host] || {};
                if (tr.publishedTorrent && !tr.crossseed) {
                  try { await crossseed.run({ id: row.id, data: done }, host, {}); } catch (e) { /* 重试辅种失败不影响 */ }
                }
              }
            }
            continue;
          }
          failed++;
          bumpSiteFail(it.targetSite || it.site, r.message || r.code);
          const cur = one('SELECT data FROM queue WHERE id = ?', row.id);
          const d = cur ? (jparse(cur.data) || {}) : it;
          d.retries = retries + 1;
          d.lastRetryAt = new Date().toISOString();
          d.nextRetryAt = new Date(Date.now() + backoff * 60000).toISOString();
          d.retryMsg = String(r.message || r.code || 'failed').slice(0, 300);
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(d), new Date().toISOString(), row.id);
        }
        return { checked: rows2.length, ok: ok, failed: failed, skipped: skipped };
      } else {
        return { skipped: 'realPublish off' };
      }
  }

  return { runCrossseedPhase, runRetryPhase };
}

module.exports = { makeRetryPhases };

/* 发布阶段：并发发布 approved 队列，上传目标站后再注入下载器。 */
function makePublishPhase(deps) {
  return async function runPublishPhase(o) {
    const { one, all, jparse, targetService, crossseed, bumpSiteFail, resetSiteFail, publishLimit } = o;
    const pubDeps = o.deps || {};
          const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
          const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
          /* 发布并发：默认 1，配置最多 5；每条独立写库，SQLite 同步执行不会交叉 */
          const conc = Math.max(1, Math.min(5, Number(cfg.concurrency) || 1));
          const rows = all("SELECT id, data FROM queue WHERE status = 'approved' ORDER BY updated_at ASC LIMIT " + publishLimit);
          let ok = 0, failed = 0, held = 0;
          const errors = [];
          const queueRows = rows.slice();
          async function worker() {
            while (queueRows.length) {
              const row = queueRows.shift();
              const it = jparse(row.data) || {};
              if (!it.targetSite || !it.downloadUrl) continue;
              /* 转载流程：源种先进 qB 并下到 100%，没完成就等下一轮，不传目标站 */
              let src = null;
              try { src = await pubDeps.publish.ensureSource(row.id, {}); }
              catch (e) { src = { ok: false, code: 'SOURCE_CHECK_FAILED', message: String(e && e.message || e).slice(0, 160) }; }
              if (!src.ok) {
                failed++;
                if (errors.length < 3) errors.push({ id: row.id, code: src.code, message: src.message });
                continue;
              }
              if (!src.complete) { held++; continue; }
              /* 先传到目标站（已传过的站跳过），成功后再注入下载器；两步都算发布 */
              const hosts = [];
              [it.targetSite].concat(Array.isArray(it.targets) ? it.targets : []).forEach(function (h) {
                h = String(h || '').trim().toLowerCase();
                if (h && hosts.indexOf(h) < 0) hosts.push(h);
              });
              let uploadOk = true;
              for (const host of hosts) {
                const tr = (it.targetResults && it.targetResults[host]) || {};
                /* 已经传过并回查到的，不重复上传 */
                if (tr.publishedTorrent || (tr.verified && tr.detailsUrl)) continue;
                let up;
                try { up = await targetService.uploadMany({ queueId: row.id, targets: [host], dryRun: false }); }
                catch (e) { up = { ok: false, code: 'UPLOAD_EXCEPTION', message: String(e && e.message || e).slice(0, 160) }; }
                const first = up && up.data && (up.data.targets || [])[0];
                if (!up || !up.ok || !first || (!first.ok && !first.skipped)) {
                  uploadOk = false;
                  const msg = (first && (first.message || first.code)) || (up && (up.message || up.code)) || '目标站上传失败';
                  bumpSiteFail(host, msg);
                  if (errors.length < 3) errors.push({ id: row.id, code: (first && first.code) || (up && up.code) || 'UPLOAD_FAILED', message: host + ' · ' + msg });
                  /* 一个目标失败也继续尝试其余目标，避免后面的站永远轮不到 */
                  continue;
                }
                resetSiteFail(host);
              }
              if (!uploadOk) { failed++; continue; }
              /* 上传过但权威种子没保存成功的，发布前补抓一次 */
              const afterRow = one('SELECT data FROM queue WHERE id = ?', row.id);
              const after = afterRow ? (jparse(afterRow.data) || it) : it;
              for (const host of hosts) {
                const tr = (after.targetResults && after.targetResults[host]) || {};
                if (tr.verified && tr.detailsUrl && !tr.publishedTorrent) {
                  try { await targetService.fetchPublished(host, after); } catch (e) { /* 补抓失败不挡发布 */ }
                }
              }
              const r = await pubDeps.publish.publishItem(row.id, { dryRun: false });
              if (r.ok) {
                ok++;
                resetSiteFail(it.targetSite || it.site);
                const cur = one('SELECT data FROM queue WHERE id = ?', row.id);
                const done = cur ? (jparse(cur.data) || null) : null;
                if (done) {
                  for (const host of Object.keys(done.targetResults || {})) {
                    const tr = done.targetResults[host] || {};
                    if (tr.publishedTorrent && !tr.crossseed) {
                      try { await crossseed.run({ id: row.id, data: done }, host, {}); } catch (e) { /* 辅种失败不影响发布 */ }
                    }
                  }
                }
              } else {
                failed++;
                bumpSiteFail(it.targetSite || it.site, r.message || r.code);
                if (errors.length < 3) errors.push({ id: row.id, code: r.code, message: r.message });
              }
            }
          }
          const workers = [];
          for (let i = 0; i < Math.min(conc, rows.length); i++) workers.push(worker());
          await Promise.all(workers);
          return { checked: rows.length, ok: ok, failed: failed, held: held, errors: errors, concurrency: conc };
  };
}

module.exports = { makePublishPhase };

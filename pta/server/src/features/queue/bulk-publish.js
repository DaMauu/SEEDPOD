/* 队列批量发布：逐条检查源种、补传未完成目标站，再注入下载器。
   单条失败只记 skipped/errors，不回滚已成功的条目；已提交/已注入的目标站不重复上传。 */
const { targetReady } = require('../../../release-gates');

async function runBulkPublish(ctx, ids, opts) {
  const { one, jparse, publisher, targetService, hostsOf } = ctx;
  const list = Array.from(new Set((ids || []).map(String))).slice(0, 200);
  let changed = 0, skipped = 0;
  const errors = [];
  const fail = function (id, code, message) {
    skipped++;
    if (errors.length < 3) errors.push({ id: id, code: code, message: message });
  };
  for (const id of list) {
    const row = one('SELECT data FROM queue WHERE id = ?', id);
    if (!row) { skipped++; continue; }
    const it = jparse(row.data) || {};
    let src = null;
    try { src = await publisher.ensureSource(id, {}); }
    catch (e) { src = { ok: false, code: 'SOURCE_CHECK_FAILED', message: String(e && e.message || e).slice(0, 120) }; }
    if (!src || !src.ok || !src.complete) {
      fail(id, (src && src.code) || 'SOURCE_INCOMPLETE', (src && src.message) || '源种还没下完');
      continue;
    }
    const gate = targetReady(it);
    if (!gate.ok) { fail(id, 'TARGET_NOT_READY', gate.message); continue; }
    const hosts = hostsOf(it);
    const trs = it.targetResults || {};
    const need = hosts.filter(function (h) {
      const tr = trs[h] || {};
      return tr.stage !== 'submitted' && tr.stage !== 'injected';
    });
    if (need.length) {
      const up = await targetService.uploadMany({ queueId: id, targets: need, dryRun: false });
      const failed = ((up && up.data && up.data.targets) || []).filter(function (x) { return !x.ok && !x.skipped; })[0];
      if (!up || !up.ok || failed) {
        fail(id, (failed && failed.code) || (up && up.code) || 'UPLOAD_FAILED',
          (failed && failed.message) || (up && up.message) || '目标站上传失败');
        continue;
      }
    }
    const r = await publisher.publishItem(id, { dryRun: false });
    if (r.ok) changed++;
    else fail(id, r.code || 'PUBLISH_FAILED', r.message || '发布失败');
  }
  return { changed: changed, skipped: skipped, errors: errors };
}

module.exports = { runBulkPublish };

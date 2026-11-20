/* 队列批量状态：整批一个事务，任一条写失败全部回滚；id 去重并限量。 */
const { tx } = require('./db');
const catalogSync = require('./catalog-sync');

function applyStatus(ctx, ids, target, reason) {
  const { db, one, jparse } = ctx;
  const now = new Date().toISOString();
  const list = Array.from(new Set((ids || []).map(String))).slice(0, 200);
  let changed = 0, locked = 0;
  tx(db, function () {
    list.forEach(function (id) {
      const row = one('SELECT status, data FROM queue WHERE id = ?', id);
      if (!row) return;
      if (row.status === 'published') { locked++; return; }
      const it = jparse(row.data) || {};
      it.status = target;
      it.actionAt = now;
      if (target === 'rejected') it.rejectedAt = now;
      /* 批准或退回待审时清掉旧驳回理由 */
      if (target === 'approved' || target === 'pending') { delete it.reason; delete it.rejectedAt; }
      if (reason) it.reason = String(reason).slice(0, 500);
      db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
        .run(target, JSON.stringify(it), now, id);
      catalogSync.apply(ctx, it, target, it.reason);
      changed++;
    });
  });
  return { changed: changed, locked: locked };
}

module.exports = { applyStatus };

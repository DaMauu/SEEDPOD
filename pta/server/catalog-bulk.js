/* 词条批量状态：整批一个事务，任何一条写失败都回滚，避免“改了一半”。 */
const { tx } = require('./src/infra/db');

function applyBulk(ctx, ids, status) {
  const { db, one, jparse } = ctx;
  const now = new Date().toISOString();
  let changed = 0;
  tx(db, function () {
    (ids || []).forEach(function (id) {
      const row = one('SELECT data FROM catalog WHERE id = ?', id);
      if (!row) return;
      const it = jparse(row.data) || {};
      it.status = status;
      db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(it), status, now, id);
      changed++;
    });
  });
  return changed;
}

module.exports = { applyBulk };

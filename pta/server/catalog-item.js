/* 单条词条更新：状态/标记共用，读改写放在事务里，跨进程也不丢更新。 */
const { tx } = require('./src/infra/db');
const env = require('./src/infra/env');

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* 退化为不等待 */ }
}
function updCatalog(ctx, id, patch) {
  const { db, one, jparse } = ctx;
  return tx(db, function () {
    /* 测试钩子：拿到事务后停一下，复现两个进程的读改写交错 */
    const delay = Number(env.read('CATALOG_TEST_DELAY_MS', 'PTA_CATALOG_TEST_DELAY_MS') || 0);
    if (delay > 0 && delay < 5000) sleepSync(delay);
    const row = one('SELECT data FROM catalog WHERE id = ?', id);
    if (!row) return null;
    const it = Object.assign(jparse(row.data) || {}, patch);
    const st = it.status || 'new';
    db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(it), st, new Date().toISOString(), id);
    return it;
  });
}

module.exports = { updCatalog };

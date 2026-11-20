/* 队列状态变化同步到来源词条，避免 Sources 一直显示“已送审”。 */
const MAP = {
  pending: 'selected',
  approved: 'selected',
  failed: 'selected',
  rejected: 'skipped',
  skipped: 'skipped',
  published: 'published'
};

function statusOf(queueStatus) { return MAP[String(queueStatus || '')] || ''; }

function apply(ctx, item, queueStatus, reason) {
  if (!item || !item.catalogId) return false;
  const row = ctx.one('SELECT data FROM catalog WHERE id = ?', String(item.catalogId));
  if (!row) return false;
  const cd = ctx.jparse(row.data) || {};
  const next = statusOf(queueStatus);
  if (!next) return false;
  cd.status = next;
  cd.queueStatus = String(queueStatus || '');
  cd.updatedAt = new Date().toISOString();
  if (next === 'skipped') {
    cd.skipReason = String(reason || (queueStatus === 'rejected' ? '已驳回' : '已跳过')).slice(0, 200);
    cd.skippedAt = cd.updatedAt;
  } else {
    delete cd.skipReason;
    delete cd.skippedAt;
  }
  ctx.db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(cd), next, cd.updatedAt, String(item.catalogId));
  return true;
}

/* 队列条目删除后，来源词条回到待筛选（已发布的由调用方拦掉）。 */
function reset(ctx, item) {
  if (!item || !item.catalogId) return false;
  const row = ctx.one('SELECT data FROM catalog WHERE id = ?', String(item.catalogId));
  if (!row) return false;
  const cd = ctx.jparse(row.data) || {};
  cd.status = 'new';
  cd.queueStatus = '';
  delete cd.skipReason;
  delete cd.skippedAt;
  const at = new Date().toISOString();
  cd.updatedAt = at;
  ctx.db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(cd), 'new', at, String(item.catalogId));
  return true;
}

module.exports = { apply, reset, statusOf };

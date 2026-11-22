/* 同一条 queue 的上传互斥：进程内 Set + SQLite 锁表，单实例和多进程都能互斥。 */
const BUSY = new Set();
const SKIP = Symbol('skipQueueLock');
const TTL_MS = 60 * 60 * 1000;

function acquire(id, db) {
  const k = String(id || '');
  if (!k) return false;
  if (BUSY.has(k)) return false;
  BUSY.add(k);
  if (db) {
    try {
      db.prepare('DELETE FROM upload_locks WHERE expires_at < ?').run(Date.now());
      const r = db.prepare('INSERT OR IGNORE INTO upload_locks(key, owner, expires_at) VALUES(?, ?, ?)')
        .run(k, String(process.pid) + ':' + Date.now(), Date.now() + TTL_MS);
      if (!r.changes) { BUSY.delete(k); return false; }
    } catch (e) { /* 锁表不可用时退回进程内锁 */ }
  }
  return true;
}
function release(id, db) {
  const k = String(id || '');
  BUSY.delete(k);
  if (db) { try { db.prepare('DELETE FROM upload_locks WHERE key = ?').run(k); } catch (e) { /* 已过期/无表 */ } }
}
module.exports = { acquire, release, SKIP };

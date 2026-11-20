/* 同一条 queue 的上传互斥：进程内共享，路由/调度/多目标共用。 */
const BUSY = new Set();
const SKIP = Symbol('skipQueueLock');
function acquire(id) {
  const k = String(id || '');
  if (!k) return false;
  if (BUSY.has(k)) return false;
  BUSY.add(k);
  return true;
}
function release(id) { BUSY.delete(String(id || '')); }
module.exports = { acquire, release, SKIP };

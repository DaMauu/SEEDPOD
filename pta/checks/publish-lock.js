/* 发布锁：同一队列条目真发布只放行一个；演练不占锁，结束后释放。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makePublisher } = require('../server/publish');
const lock = require('../server/upload-lock');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-publock-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
db.prepare('INSERT INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
  .run('q_lock', 'pending', 'Lock Row', JSON.stringify({ id: 'q_lock', title: 'Lock Row', status: 'pending', targetSite: 'a.example' }), '2026-11-01', '2026-11-01');
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  all: function (s, ...a) { return db.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  DATA_DIR: DATA,
  allowReal: function () { return true; }
};
const publisher = makePublisher(ctx);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function lockCount() { return Number(db.prepare("SELECT COUNT(*) AS n FROM upload_locks WHERE key = 'pub:q_lock'").get().n) || 0; }
function status() { return JSON.parse(db.prepare("SELECT data FROM queue WHERE id = 'q_lock'").get().data).status; }

(async function () {
  try {
    await check('锁被占用时真发布返回 PUBLISH_IN_PROGRESS', async function () {
      need(lock.acquire('pub:q_lock', db) === true, '预占锁失败');
      const r = await publisher.publishItem('q_lock', { dryRun: false });
      need(r.ok === false && r.code === 'PUBLISH_IN_PROGRESS' && r.http === 409, '没拦住：' + JSON.stringify(r));
      need(status() === 'pending', '状态被改');
      need(lockCount() === 1, '锁被误释放');
    });

    await check('演练不占锁，仍返回后续门禁错误', async function () {
      const r = await publisher.publishItem('q_lock', { dryRun: true });
      need(r.ok === false && r.code === 'NO_DOWNLOADER', '演练没继续：' + JSON.stringify(r));
      need(lockCount() === 1, '演练动了锁');
    });

    await check('锁释放后真发布继续并在结束时释放', async function () {
      lock.release('pub:q_lock', db);
      need(lockCount() === 0, '锁没释放');
      const r = await publisher.publishItem('q_lock', { dryRun: false });
      need(r.ok === false && r.code === 'NO_DOWNLOADER', '释放后没继续：' + JSON.stringify(r));
      need(lockCount() === 0, '发布结束没释放锁');
    });
  } finally {
    try { lock.release('pub:q_lock', db); } catch (e) { /* 已释放 */ }
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

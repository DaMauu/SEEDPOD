/* 上传锁：进程内 + SQLite 锁表互斥，释放后可重入。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const lock = require('../src/infra/upload-lock');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-lock-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
try {
  check('同一 queue 第二次拿不到锁', function () {
    need(lock.acquire('q_0001', db) === true, '第一次没拿到');
    need(lock.acquire('q_0001', db) === false, '第二次也拿到了');
  });
  check('释放后可以重新拿到锁', function () {
    lock.release('q_0001', db);
    need(lock.acquire('q_0001', db) === true, '释放后拿不到');
    lock.release('q_0001', db);
  });
  check('过期锁会被清理', function () {
    db.prepare('INSERT INTO upload_locks(key, owner, expires_at) VALUES(?, ?, ?)').run('q_old', 'old', Date.now() - 1);
    need(lock.acquire('q_old', db) === true, '过期锁没清理');
    lock.release('q_old', db);
  });
} finally {
  db.close();
  fs.rmSync(DATA, { recursive: true, force: true });
}
const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

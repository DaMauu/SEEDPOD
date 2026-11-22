/* 队列批量状态：整批事务回滚、重复 id 去重、缺失 id 跳过。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const { applyStatus } = require('../queue-bulk');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-qbulk-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } }
};
const ins = db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)');
['q_1', 'q_2', 'q_3'].forEach(function (id) {
  ins.run(id, 'pending', id, JSON.stringify({ id: id, status: 'pending', title: id }), '2026-11-01', '2026-11-01');
});
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function statuses() {
  return db.prepare('SELECT id, status FROM queue ORDER BY id').all().map(function (r) { return r.id + ':' + r.status; }).join(',');
}

check('中途失败整批回滚', function () {
  db.exec("CREATE TRIGGER boom_q BEFORE UPDATE ON queue WHEN NEW.id = 'q_2' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  let threw = false;
  try { applyStatus(ctx, ['q_1', 'q_2', 'q_3'], 'approved'); } catch (e) { threw = true; }
  db.exec('DROP TRIGGER boom_q');
  need(threw, '没有抛出');
  need(statuses() === 'q_1:pending,q_2:pending,q_3:pending', '回滚不完整：' + statuses());
});

check('成功后整批落地，重复 id 去重', function () {
  const out = applyStatus(ctx, ['q_1', 'q_1', 'q_2', 'q_missing'], 'approved', 'batch ok');
  need(out.changed === 2 && out.locked === 0, '计数不对：' + JSON.stringify(out));
  need(statuses() === 'q_1:approved,q_2:approved,q_3:pending', '状态不对：' + statuses());
  const d = JSON.parse(db.prepare("SELECT data FROM queue WHERE id = 'q_1'").get().data);
  need(d.status === 'approved' && d.reason === 'batch ok' && typeof d.actionAt === 'string', 'data 没同步：' + JSON.stringify(d));
});

check('已发布条目批量改状态被锁', function () {
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run('q_pub', 'published', 'q_pub', JSON.stringify({ id: 'q_pub', status: 'published' }), '2026-11-01', '2026-11-01');
  const out = applyStatus(ctx, ['q_pub'], 'skipped');
  need(out.changed === 0 && out.locked === 1, '已发布没锁：' + JSON.stringify(out));
  need(db.prepare("SELECT status FROM queue WHERE id = 'q_pub'").get().status === 'published', '已发布被改');
  db.prepare("DELETE FROM queue WHERE id = 'q_pub'").run();
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
db.close();
fs.rmSync(DATA, { recursive: true, force: true });
process.exit(pass === results.length ? 0 : 1);

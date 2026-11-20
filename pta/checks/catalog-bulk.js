/* 词条批量状态：整批事务，任一条失败全部回滚；成功后全部落地。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { applyBulk } = require('../server/catalog-bulk');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-catbulk-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } }
};
const ins = db.prepare('INSERT INTO catalog(id, site, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)');
['c_1', 'c_2', 'c_3'].forEach(function (id) {
  ins.run(id, 'a.example', id, 'new', JSON.stringify({ id: id, status: 'new', title: id }), '2026-11-01', '2026-11-01');
});
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function statuses() {
  return db.prepare('SELECT id, status FROM catalog ORDER BY id').all().map(function (r) { return r.id + ':' + r.status; }).join(',');
}

check('中途失败整批回滚', function () {
  db.exec("CREATE TRIGGER boom BEFORE UPDATE ON catalog WHEN NEW.id = 'c_2' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  let threw = false;
  try { applyBulk(ctx, ['c_1', 'c_2', 'c_3'], 'archived'); } catch (e) { threw = true; }
  db.exec('DROP TRIGGER boom');
  need(threw, '没有抛出');
  need(statuses() === 'c_1:new,c_2:new,c_3:new', '回滚不完整：' + statuses());
});

check('成功后整批落地，缺失 id 跳过', function () {
  const n = applyBulk(ctx, ['c_1', 'c_2', 'c_3', 'c_missing'], 'skipped');
  need(n === 3, '成功计数不对：' + n);
  need(statuses() === 'c_1:skipped,c_2:skipped,c_3:skipped', '状态不对：' + statuses());
  const d = JSON.parse(db.prepare("SELECT data FROM catalog WHERE id = 'c_1'").get().data);
  need(d.status === 'skipped', 'data.status 没同步：' + JSON.stringify(d));
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
db.close();
fs.rmSync(DATA, { recursive: true, force: true });
process.exit(pass === results.length ? 0 : 1);

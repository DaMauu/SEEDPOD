/* SQLite 事务回滚：多步写失败时不留下半条记录。 */
const { DatabaseSync } = require('node:sqlite');
const { tx } = require('../src/infra/db');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, data TEXT)');
db.exec('CREATE TABLE catalog (id TEXT PRIMARY KEY, data TEXT)');

check('事务失败整体回滚', () => {
  try {
    tx(db, () => {
      db.prepare('INSERT INTO queue(id,data) VALUES(?,?)').run('q_rollback', '{}');
      db.prepare('INSERT INTO catalog(id,data) VALUES(?,?)').run('c_rollback', '{}');
      throw new Error('boom');
    });
  } catch (e) { /* 预期 */ }
  need(!db.prepare("SELECT 1 FROM queue WHERE id='q_rollback'").get(), 'queue 没回滚');
  need(!db.prepare("SELECT 1 FROM catalog WHERE id='c_rollback'").get(), 'catalog 没回滚');
});

check('事务成功一起提交', () => {
  tx(db, () => {
    db.prepare('INSERT INTO queue(id,data) VALUES(?,?)').run('q_ok', '{}');
    db.prepare('INSERT INTO catalog(id,data) VALUES(?,?)').run('c_ok', '{}');
  });
  need(db.prepare("SELECT 1 FROM queue WHERE id='q_ok'").get(), 'queue 没提交');
  need(db.prepare("SELECT 1 FROM catalog WHERE id='c_ok'").get(), 'catalog 没提交');
});

db.close();
const pass = results.filter(r => r[0]).length;
results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

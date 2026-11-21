/* held 条目在失败队列：不判死信、不受 30 天保留隐藏、分页正常。 */
const { DatabaseSync } = require('node:sqlite');
const { makeFailureQueue } = require('../server/failure-queue');

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE queue(id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT, updated_at TEXT)');
db.exec('CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)');
db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ retryMax: 2 }));
const old = new Date(Date.now() - 40 * 86400000).toISOString();
const ins = db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)');
ins.run('q_held_old', 'approved', 'Held Old', JSON.stringify({ id: 'q_held_old', status: 'approved', heldSince: old, heldAt: old, heldReason: '源种未下完' }), old);
ins.run('q_dead', 'failed', 'Dead Failed', JSON.stringify({ id: 'q_dead', status: 'failed', stage: 'failed', stageLastError: 'boom', stageUpdatedAt: new Date(Date.now() - 2 * 86400000).toISOString() }), new Date().toISOString());
for (let i = 0; i < 24; i++) {
  const id = 'q_h' + String(i).padStart(2, '0');
  ins.run(id, 'approved', id, JSON.stringify({ id: id, status: 'approved', heldSince: old, heldAt: old, heldReason: '源种未下完' }), new Date(Date.now() - i * 1000).toISOString());
}
const q = makeFailureQueue({ db: db, one: function (s, ...a) { return db.prepare(s).get(...a); }, all: function (s, ...a) { return db.prepare(s).all(...a); }, jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } } });
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }

check('held 不判死信，超过 30 天也保留', function () {
  const r = q.list({ limit: 50 });
  const held = r.items.filter(function (x) { return x.id === 'q_held_old'; })[0];
  need(held && held.dead === false, 'held 被判死信或隐藏：' + JSON.stringify(held));
  need(held.failures[0].kind === 'source' && held.failures[0].code === 'SOURCE_INCOMPLETE', 'held 类型不对：' + JSON.stringify(held.failures));
  need(r.items.some(function (x) { return x.id === 'q_dead' && x.dead === true; }), '真实失败没判死信');
});

check('dead 筛选只留真实死信', function () {
  const r = q.list({ limit: 50, dead: true });
  need(r.items.length === 1 && r.items[0].id === 'q_dead', 'dead 筛选混进 held：' + JSON.stringify(r.items.map(function (x) { return x.id; })));
});

check('held 与失败一起分页', function () {
  const p1 = q.list({ limit: 10, offset: 0 });
  const p2 = q.list({ limit: 10, offset: 10 });
  need(p1.total >= 25 && p1.items.length === 10 && p2.items.length === 10, '分页不对：' + JSON.stringify({ total: p1.total, a: p1.items.length, b: p2.items.length }));
  need(p2.items.some(function (x) { return x.failures[0].kind === 'source'; }), '第二页没有 held');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
db.close();
process.exit(pass === results.length ? 0 : 1);

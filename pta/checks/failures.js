/* 失败队列：列表、死信、单条重放、已提交幂等。纯内存 DB。 */
const { DatabaseSync } = require('node:sqlite');
const { makeFailureQueue } = require('../server/failure-queue');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
db.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT, updated_at TEXT)');
db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ retryMax: 2 }));
db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_fail', 'failed', 'Fail Item', JSON.stringify({
  id: 'q_fail', status: 'failed', stage: 'failed', stageFailedFrom: 'publish', stageLastErrorCode: 'BDINFO_REQUIRED', stageLastError: '缺 BDInfo',
  retries: 2, stageUpdatedAt: '2026-01-01T00:00:00Z',
  targetResults: { 'demo.example': { stage: 'failed', errorCode: 'LOGIN_REQUIRED', error: 'cookie 失效', attempts: 1, at: '2026-01-01T00:00:00Z' } }
}), '2026-01-01T00:00:00Z');
db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_done', 'published', 'Done Item', JSON.stringify({
  id: 'q_done', status: 'published', stage: 'injected', targetResults: { 'demo.example': { publishedTorrent: { infohash: 'x' } } }
}), '2026-01-01T00:00:00Z');
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const jparse = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
const q = makeFailureQueue({ db, one, all, jparse });

check('列出失败与死信', () => {
  const r = q.list({ limit: 10 });
  need(r.total === 1 && r.items[0].id === 'q_fail', '列表不对：' + JSON.stringify(r));
  need(r.items[0].dead === true, 'retries=2 应进死信');
  need(r.items[0].failures.length === 2, '失败项数量不对：' + JSON.stringify(r.items[0]));
  need(r.counts.BDINFO_REQUIRED === 1 && r.counts.LOGIN_REQUIRED === 1, '错误码统计不对：' + JSON.stringify(r.counts));
});

check('单条重放恢复 pending 且保留目标结果', () => {
  const r = q.replay('q_fail');
  need(r.ok && r.status === 'pending' && r.stage === 'publish', '重放结果不对：' + JSON.stringify(r));
  const row = one("SELECT status,data FROM queue WHERE id='q_fail'");
  const d = jparse(row.data);
  need(row.status === 'pending' && d.stage === 'publish' && !d.stageLastError && d.retries === 0, '队列没重置：' + JSON.stringify(d));
  need(d.targetResults['demo.example'].stage === 'pending', '目标站失败没重置：' + JSON.stringify(d.targetResults));
  need(q.list({ limit: 10 }).total === 0, '重放后仍被列为失败');
});

check('已提交条目拒绝重放', () => {
  const r = q.replay('q_done');
  need(!r.ok && r.code === 'ALREADY_SUBMITTED', '已提交没拦住：' + JSON.stringify(r));
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

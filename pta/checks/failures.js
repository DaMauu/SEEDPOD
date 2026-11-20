/* 失败队列：列表、死信、单条重放、已提交幂等。纯内存 DB。 */
const { DatabaseSync } = require('node:sqlite');
const { makeFailureQueue } = require('../server/failure-queue');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
const recent = new Date(Date.now() - 3600000).toISOString();

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
db.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT, updated_at TEXT)');
db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ retryMax: 2 }));
db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_fail', 'failed', 'Fail Item', JSON.stringify({
  id: 'q_fail', status: 'failed', stage: 'failed', stageFailedFrom: 'publish', stageLastErrorCode: 'BDINFO_REQUIRED', stageLastError: '缺 BDInfo',
  retries: 2, stageUpdatedAt: recent, dupePassedAt: recent,
  dupeResults: { 'demo.example': { found: false, skip: false, at: recent } },
  targetResults: { 'demo.example': { stage: 'failed', errorCode: 'LOGIN_REQUIRED', error: 'cookie 失效', attempts: 1, at: recent } }
}), recent);
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
  need(r.ok && r.status === 'pending' && r.stage === 'previewed', '重放结果不对：' + JSON.stringify(r));
  const row = one("SELECT status,data FROM queue WHERE id='q_fail'");
  const d = jparse(row.data);
  need(row.status === 'pending' && d.stage === 'previewed' && !d.stageLastError && d.retries === 0, '队列没重置：' + JSON.stringify(d));
  need(d.targetResults['demo.example'].stage === 'pending', '目标站失败没重置：' + JSON.stringify(d.targetResults));
  need(!d.dupePassedAt && (!d.dupeResults || !Object.keys(d.dupeResults).length), '重放后查重状态没清：' + JSON.stringify({ dupePassedAt: d.dupePassedAt, dupeResults: d.dupeResults }));
  need(q.list({ limit: 10 }).total === 0, '重放后仍被列为失败');
});

db.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run('q_meta', 'failed', 'Meta Item', JSON.stringify({
  id: 'q_meta', status: 'failed', stage: 'prepared', stageAttempts: 4,
  metaAttempts: 3, metaLastAttemptAt: recent, metaLastErrorCode: 'UPSTREAM_FAILED', metaLastError: 'UPSTREAM_FAILED',
  metaNextRetryAt: new Date(Date.now() + 900000).toISOString(),
  dedupeAttempts: 2, dedupeLastAttemptAt: recent, dedupeLastErrorCode: 'DEDUPE_TIMEOUT', dedupeLastError: 'timeout'
}), recent);

check('重放重置 meta/dedupe 计数与死信', () => {
  const before = q.list({ limit: 10 });
  const hit = before.items.filter(function (x) { return x.id === 'q_meta'; })[0];
  need(hit && hit.dead === true, 'q_meta 应先判死信：' + JSON.stringify(before.items));
  const r = q.replay('q_meta');
  need(r.ok, '重放失败：' + JSON.stringify(r));
  const d = jparse(one("SELECT data FROM queue WHERE id='q_meta'").data);
  need(d.metaAttempts === 0 && !d.metaLastAttemptAt && !d.metaLastErrorCode, 'meta 计数没重置：' + JSON.stringify(d));
  need(d.dedupeAttempts === 0 && !d.dedupeLastAttemptAt && !d.dedupeLastErrorCode, 'dedupe 计数没重置：' + JSON.stringify(d));
  need(d.stageAttempts === 0, 'stage 计数没重置：' + JSON.stringify(d));
  const after = q.list({ limit: 10 });
  need(!after.items.some(function (x) { return x.id === 'q_meta'; }), '重放后仍列在失败队列');
});

check('已提交条目拒绝重放', () => {
  const r = q.replay('q_done');
  need(!r.ok && r.code === 'ALREADY_SUBMITTED', '已提交没拦住：' + JSON.stringify(r));
});

check('保留策略：默认 30 天/1000 条，非破坏性', () => {
  const db2 = new DatabaseSync(':memory:');
  db2.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  db2.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, status TEXT, title TEXT, data TEXT, updated_at TEXT)');
  db2.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({ retryMax: 2 }));
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const nowIso = new Date().toISOString();
  const put = (id, at, extra) => db2.prepare('INSERT INTO queue(id,status,title,data,updated_at) VALUES(?,?,?,?,?)').run(id, 'failed', id, JSON.stringify(Object.assign({ id, status: 'failed', stage: 'failed', stageLastError: 'x', stageLastErrorCode: 'UNKNOWN', retries: 1, stageUpdatedAt: at }, extra || {})), nowIso);
  put('q_new', nowIso);
  put('q_old', old);
  put('q_future', old, { nextRetryAt: new Date(Date.now() + 86400000).toISOString() });
  const q2 = makeFailureQueue({ db: db2, one: (s2, ...a) => db2.prepare(s2).get(...a), all: (s2, ...a) => db2.prepare(s2).all(...a), jparse });
  const def = q2.list({ limit: 10 });
  need(def.retention && def.retention.days === 30, '保留参数没返回：' + JSON.stringify(def.retention));
  need(def.total === 2, '默认应保留 2 条（新 + 未来重试）：' + JSON.stringify(def.items.map(x => x.id)));
  need(!def.items.some(x => x.id === 'q_old'), '40 天旧失败应被视图过滤');
  need(def.items.some(x => x.id === 'q_future'), '有未来重试的旧条目应保留');
  const allx = q2.list({ limit: 10, days: 0 });
  need(allx.total === 3 && allx.items.some(x => x.id === 'q_old'), 'days=0 应看全部');
  const oneItem = q2.list({ limit: 10, maxItems: 1 });
  need(oneItem.total === 1, 'maxItems 没截断：' + oneItem.total);
  need(db2.prepare("SELECT 1 FROM queue WHERE id='q_old'").get(), '保留策略不应删数据');
  db2.close();
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

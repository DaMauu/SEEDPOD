/* 错误码注册表 + 失败统计：纯本地夹具，不联网。 */
const { DatabaseSync } = require('node:sqlite');
const errors = require('../src/shared/errors');
const { makeErrorStats } = require('../src/features/logs/error-stats');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('注册表：retryable 与旧码映射', () => {
  need(errors.retryable('TARGET_UNREACHABLE') === true, '网络错误应可重试');
  need(errors.retryable('LOGIN_REQUIRED') === false, '登录失效不该重试');
  need(errors.normalize('CRAWL_FAILED') === 'TARGET_UNREACHABLE', '旧抓取码没映射');
  need(errors.describe('BDINFO_REQUIRED').stage === 'publish', '阶段不对');
  need(errors.normalize('NOPE') === 'UNKNOWN', '未知码没归 UNKNOWN');
  [['NO_CATEGORY_TYPES', 'crawl'], ['UPLOAD_IN_PROGRESS', 'publish'], ['CLEAN_REQUIRED', 'publish']].forEach(function (p) {
    const d = errors.describe(p[0]);
    need(d.code === p[0] && d.stage === p[1], p[0] + ' 没注册：' + JSON.stringify(d));
  });
});

check('失败统计：scheduler + queue + targetResults', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  db.exec('CREATE TABLE queue (id TEXT PRIMARY KEY, status TEXT, data TEXT)');
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('scheduler', JSON.stringify({
    lastResult: { errors: [{ phase: 'screen', code: 'FAILPOINT', message: 'failpoint screen', at: '2026-01-01T00:00:00Z' }] }
  }));
  db.prepare('INSERT INTO queue(id,status,data) VALUES(?,?,?)').run('q_1', 'failed', JSON.stringify({
    id: 'q_1', stage: 'failed', stageFailedFrom: 'publish', stageLastErrorCode: 'BDINFO_REQUIRED', stageLastError: '缺 BDInfo',
    targetResults: { 'demo.example': { stage: 'failed', errorCode: 'LOGIN_REQUIRED', error: 'cookie 失效', nextRetryAt: '2026-01-01T01:00:00Z' } }
  }));
  const one = (s, ...a) => db.prepare(s).get(...a);
  const all = (s, ...a) => db.prepare(s).all(...a);
  const jparse = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
  const out = makeErrorStats({ db, one, all, jparse }).snapshot(50);
  const map = {};
  out.counts.forEach((x) => { map[x.code] = x.count; });
  need(out.total === 3, 'total 不对：' + out.total);
  need(map.FAILPOINT === 1, 'scheduler 错误没统计');
  need(map.BDINFO_REQUIRED === 1, 'queue 错误没统计');
  need(map.LOGIN_REQUIRED === 1, 'targetResults 错误没统计');
  need(out.byStage.scheduler === 1 && out.byStage.publish === 1 && out.byStage.target === 1, 'byStage 不对：' + JSON.stringify(out.byStage));
  db.close();
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

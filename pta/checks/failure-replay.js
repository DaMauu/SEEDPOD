/* 失败队列重放：阶段/attempts/history 归零，失败目标的旧回查清掉，其他目标保持。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeFailureQueue } = require('../server/failure-queue');
const stage = require('../server/stage');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-replay-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  all: function (s, ...a) { return db.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } }
};
const fq = makeFailureQueue(ctx);
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }
function put(it) {
  db.prepare('INSERT OR REPLACE INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(it.id, it.status, it.title || it.id, JSON.stringify(it), '2026-11-01', '2026-11-01');
}
function read(id) {
  return JSON.parse(db.prepare('SELECT data FROM queue WHERE id = ?').get(id).data);
}

check('重放把阶段/attempts 归零，失败目标的回查清掉', function () {
  const it = {
    id: 'q_replay', status: 'failed', stage: 'failed', stageFailedFrom: 'previewed',
    stageLastError: '提交返回 200，但回查未找到', stageNextRetryAt: '2026-01-01T00:00:00.000Z',
    stageAttempts: 3, stageHistory: [{ stage: 'failed', at: '2026-01-01T00:00:00.000Z', ok: false, error: 'x' }],
    heldSince: '2026-01-01T00:00:00.000Z', heldAt: '2026-01-01T00:00:00.000Z', heldReason: '源种未下完', heldAlertAt: '2026-01-01T00:00:00.000Z',
    targetResults: {
      'a.example': { stage: 'failed', error: 'VERIFY_FAILED', nextRetryAt: '2026-01-01T00:00:00.000Z', attempts: 2, verify: { found: false } },
      'b.example': { stage: 'injected', verify: { found: true } }
    },
    targetVerifyByHost: { 'a.example': { found: false }, 'b.example': { found: true } },
    targetVerify: { found: true }
  };
  put(it);
  const r = fq.replay('q_replay');
  need(r.ok && r.status === 'pending' && r.stage === 'previewed', '重放结果不对：' + JSON.stringify(r));
  const d = read('q_replay');
  need(d.stage === 'previewed' && d.stageAttempts === 0, '阶段/attempts 没归零：' + JSON.stringify({ s: d.stage, a: d.stageAttempts }));
  need(!d.stageLastError && !d.stageNextRetryAt, '失败字段没清');
  need(d.stageHistory[d.stageHistory.length - 1].stage === 'previewed', 'history 末条没同步：' + JSON.stringify(d.stageHistory.slice(-1)));
  need(stage.validate(d).length === 0, '重放后 stage 校验不过：' + JSON.stringify(stage.validate(d)));
  need(d.heldSince === undefined && d.heldReason === undefined && d.heldAlertAt === undefined, '重放没清 held：' + JSON.stringify({ s: d.heldSince, r: d.heldReason, a: d.heldAlertAt }));
  const a = d.targetResults['a.example'];
  need(a.stage === 'pending' && a.attempts === 0 && !a.error && !a.nextRetryAt && a.verify === undefined, 'a 站没复位：' + JSON.stringify(a));
  const b = d.targetResults['b.example'];
  need(b.stage === 'injected' && b.verify && b.verify.found === true, 'b 站被误清：' + JSON.stringify(b));
  need(d.targetVerifyByHost['a.example'] === undefined, 'a 的 byHost 没清');
  need(d.targetVerifyByHost['b.example'].found === true && d.targetVerify.found === true, '剩余回查不对：' + JSON.stringify({ by: d.targetVerifyByHost, one: d.targetVerify }));
});

check('提交/注入失败重放回 previewed，不回到终态', function () {
  put({ id: 'q_inj', status: 'failed', stage: 'failed', stageFailedFrom: 'injected', stageLastError: 'QB_ADD_FAILED', stageAttempts: 1,
    targetResults: { 'a.example': { stage: 'injected' } } });
  const r = fq.replay('q_inj');
  need(r.ok && r.stage === 'previewed', '注入失败重放阶段不对：' + JSON.stringify(r));
  const d = read('q_inj');
  need(stage.validate(d).length === 0, '注入失败重放校验不过：' + JSON.stringify(stage.validate(d)));
});

check('已有权威种子不允许重放', function () {
  put({ id: 'q_pub', status: 'failed', stage: 'failed', stageFailedFrom: 'previewed',
    targetResults: { 'a.example': { stage: 'failed', publishedTorrent: { path: '/x' } } } });
  const r = fq.replay('q_pub');
  need(!r.ok && r.code === 'ALREADY_SUBMITTED', '没拦住：' + JSON.stringify(r));
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
db.close();
fs.rmSync(DATA, { recursive: true, force: true });
process.exit(pass === results.length ? 0 : 1);

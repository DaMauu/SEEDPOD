/* 失败重放后的 pending 条目要能被下一轮终审接续处理。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeFailureQueue } = require('../server/failure-queue');
const { makeReviewPhase } = require('../server/scheduler-review');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-replay-sched-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const ctx = { db: db, one: one, all: all, jparse: jparse, allowReal: function () { return false; } };
const fq = makeFailureQueue(ctx);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

(async function () {
  try {
    db.prepare('INSERT INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(
      'q_replay_sched', 'failed', 'Replay Scheduler Row', JSON.stringify({
        id: 'q_replay_sched', status: 'failed', stage: 'failed', stageFailedFrom: 'previewed',
        stageLastError: 'VERIFY_FAILED', stageAttempts: 2, title: 'Replay Scheduler Row 2024 1080p'
      }), '2026-11-01', '2026-11-01');
    const rep = fq.replay('q_replay_sched');
    need(rep.ok && rep.status === 'pending', '重放失败：' + JSON.stringify(rep));

    const review = makeReviewPhase({
      one: one, all: all, jparse: jparse,
      target: { fetchDetailsInfo: async function () { return { ok: false }; } },
      targetService: { fillSourceTitle: async function () { return { ok: false }; } },
      metaFill: { fillMeta: async function () { return { ok: false, code: 'RULE_OFF' }; } },
      release: { prepare: function () { return { ok: true }; } }
    });

    await check('重放后 pending 条目被终审接续', async function () {
      const r = await review({ want: function () { return true; }, batch: 5, ctx: ctx });
      need(r.checked === 1, '终审没接续：' + JSON.stringify(r));
      need(r.hold + r.ready === 1, '终审没处理条目：' + JSON.stringify(r));
      const d = JSON.parse(one('SELECT data FROM queue WHERE id = ?', 'q_replay_sched').data);
      need(d.review && typeof d.review.at === 'string', '没写终审结果：' + JSON.stringify(d.review));
      need(d.stage === 'previewed', '终审把重放阶段改了：' + d.stage);
    });

    await check('调度未选终审时不会处理 pending', async function () {
      const r = await review({ want: function () { return false; }, batch: 5, ctx: ctx });
      need(r.checked === 0 && r.skippedStep === true, '没跳过：' + JSON.stringify(r));
    });
  } finally {
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

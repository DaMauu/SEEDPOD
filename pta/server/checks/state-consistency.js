/* status/stage 组合：旧数据推断、合法组合通过、坏组合能查出来。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const stage = require('../stage');
const { audit } = require('../scripts/audit-state');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-state-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const now = new Date().toISOString();
function put(id, status, data) {
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, status, id, JSON.stringify(Object.assign({ id: id, title: id }, data)), now, now);
}

(async function () {
  try {
    await check('旧数据按 status 推断阶段', async function () {
      const pub = { status: 'published' };
      stage.ensure(pub);
      need(pub.stage === 'injected', 'published 没推断成 injected：' + pub.stage);
      const bad = { status: 'failed' };
      stage.ensure(bad);
      need(bad.stage === 'failed', 'failed 没推断成 failed：' + bad.stage);
      const draft = { status: 'pending' };
      stage.ensure(draft);
      need(draft.stage === 'draft', 'pending 没推断成 draft：' + draft.stage);
    });

    await check('合法组合不报问题，坏组合逐条报出', async function () {
      const ok = [
        { stage: 'draft', status: 'pending', stageAttempts: 0 },
        { stage: 'submitted', status: 'approved', stageAttempts: 1 },
        { stage: 'injected', status: 'published', stageAttempts: 2, stageHistory: [{ stage: 'injected' }] }
      ];
      ok.forEach(function (it, i) { need(stage.validate(it).length === 0, '合法组合被报：' + i + ' ' + stage.validate(it).join('；')); });
      const bad = [
        { stage: 'published', status: 'pending', stageAttempts: 0 },
        { stage: 'failed', status: 'approved', stageAttempts: 0 },
        { stage: 'approved', status: 'failed', stageAttempts: 0 },
        { stage: 'draft', status: 'published', stageAttempts: 0 }
      ];
      need(stage.validate(bad[0]).length > 0, '非法 stage 没报');
      need(stage.validate(bad[1]).length > 0, 'failed 缺错误没报');
      need(stage.validate(bad[2]).length > 0, 'status failed 配 approved 阶段没报');
      need(stage.validate(bad[3]).length > 0, 'published 配 draft 没报');
    });

    await check('审计脚本只读扫描，不修数据', async function () {
      put('q_0001', 'pending', { stage: 'draft', stageAttempts: 0 });
      put('q_0002', 'published', { stage: 'draft', stageAttempts: 0 });
      put('q_0003', 'pending', { stage: 'draft', stageAttempts: 0, stageNextRetryAt: '2026-01-01T00:00:00.000Z' });
      const r = audit(db, {});
      need(r.total === 3, '总数不对：' + r.total);
      need(r.bad.length === 2, '问题条数不对：' + JSON.stringify(r.bad));
      const before = db.prepare("SELECT data FROM queue WHERE id = 'q_0002'").get().data;
      need(JSON.parse(before).stage === 'draft', '审计改写了数据');
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

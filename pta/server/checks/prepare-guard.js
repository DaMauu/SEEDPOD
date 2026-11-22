/* prepare 阶段保护：submitted 不能回退，failed 保留错误/attempts。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');
const { makeRelease } = require('../release');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-prepare-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const ctx = { db: db, DATA_DIR: DATA, one: one, all: all, jparse: jparse };
const release = makeRelease(ctx);
const now = new Date().toISOString();

function put(id, data) {
  db.prepare('INSERT OR REPLACE INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(id, data.status || 'pending', data.title || id, JSON.stringify(data), now, now);
}
function get(id) { return JSON.parse(db.prepare('SELECT data FROM queue WHERE id = ?').get(id).data); }

(async function () {
  try {
    await check('submitted 条目 prepare 被拒绝且阶段不变', async function () {
      put('q_0001', { id: 'q_0001', title: 'Guard Submitted 2024 1080p', status: 'pending', stage: 'submitted', stageAttempts: 1 });
      const r = await release.prepare('q_0001', {});
      need(r.ok === false && r.code === 'ALREADY_SUBMITTED', '没拒绝：' + JSON.stringify(r));
      const d = get('q_0001');
      need(d.stage === 'submitted', '阶段被改了：' + d.stage);
      need(Number(d.stageAttempts) === 1, 'attempts 变了：' + d.stageAttempts);
    });

    await check('failed 条目 prepare 保留错误和 attempts', async function () {
      put('q_0002', { id: 'q_0002', title: 'Guard Failed 2024 1080p', status: 'pending', stage: 'failed', stageFailedFrom: 'target', stageLastError: 'TARGET_UNREACHABLE', stageAttempts: 2 });
      const r = await release.prepare('q_0002', {});
      need(r.ok === true, 'prepare 失败：' + JSON.stringify(r));
      const d = get('q_0002');
      need(d.stage === 'failed', 'failed 阶段被改了：' + d.stage);
      need(d.stageLastError === 'TARGET_UNREACHABLE', '错误被清了：' + d.stageLastError);
      need(Number(d.stageAttempts) === 2, 'attempts 被加了：' + d.stageAttempts);
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

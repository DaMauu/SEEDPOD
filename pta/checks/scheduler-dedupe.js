/* 调度查重阶段：失败不能标记已通过；成功才写 dupePassedAt。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeDedupePhase } = require('../server/scheduler-dedupe');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sched-dedupe-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const ctx = { db: db, DATA_DIR: DATA, one: one, all: all, jparse: jparse };
const now = new Date().toISOString();
function put(id) {
  const d = { id: id, title: id, status: 'pending', targetSite: 'target.example', infohash: 'abc' };
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').run(id, 'pending', id, JSON.stringify(d), now, now);
}
function get(id) { return JSON.parse(db.prepare('SELECT data FROM queue WHERE id = ?').get(id).data); }
const phase = makeDedupePhase({});
const pipeline = { run: async function () { return {}; } };

(async function () {
  try {
    await check('查重失败不标记已通过', async function () {
      put('q_0001');
      const targetService = { checkDupe: async function () { const e = new Error('目标站不可用'); e.code = 'TARGET_UNREACHABLE'; throw e; } };
      const out = await phase({ want: function () { return true; }, all: all, jparse: jparse, targetService: targetService, ctx: ctx, batch: 5, bumpSiteFail: function () {}, resetSiteFail: function () {}, pipeline: pipeline, steps: {} });
      need(out.dedupe.checked === 1 && out.dedupe.failed === 1, '失败计数不对：' + JSON.stringify(out.dedupe));
      const d = get('q_0001');
      need(!d.dupePassedAt, '失败仍标记了查重通过');
      need(d.dedupeLastErrorCode === 'TARGET_UNREACHABLE', '没记录错误码：' + d.dedupeLastErrorCode);
    });

    await check('查重成功才标记已通过', async function () {
      db.prepare('UPDATE queue SET status = ? WHERE id = ?').run('skipped', 'q_0001');
      put('q_0002');
      const targetService = { checkDupe: async function () { return { ok: true, found: false, skip: false }; } };
      const out = await phase({ want: function () { return true; }, all: all, jparse: jparse, targetService: targetService, ctx: ctx, batch: 5, bumpSiteFail: function () {}, resetSiteFail: function () {}, pipeline: pipeline, steps: {} });
      need(out.dedupe.kept === 1 && !out.dedupe.failed, '成功计数不对：' + JSON.stringify(out.dedupe));
      const d = get('q_0002');
      need(!!d.dupePassedAt, '成功没标记查重通过');
      need(d.dupeResults['target.example'].found === false, '没写 dupeResults');
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

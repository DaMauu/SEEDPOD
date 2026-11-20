/* 终审分支：缺项转人工；齐全时 realPublish 开=自动批准，关=保持待审。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeReviewPhase } = require('../server/scheduler-review');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-review-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const all = (s, ...a) => db.prepare(s).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function put(it) {
  db.prepare('INSERT OR REPLACE INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(it.id, it.status, it.title, JSON.stringify(it), '2026-11-01', '2026-11-01');
}
function read(id) { return JSON.parse(db.prepare('SELECT data FROM queue WHERE id = ?').get(id).data); }
function phase() {
  return makeReviewPhase({
    one: one, all: all, jparse: jparse,
    target: { fetchDetailsInfo: async function () { return { ok: false }; } },
    targetService: { fillSourceTitle: async function () { return { ok: false }; } },
    metaFill: { fillMeta: async function () { return { ok: false, code: 'RULE_OFF' }; } },
    release: { prepare: function () { return { ok: true }; } }
  });
}
function ready(extra) {
  return Object.assign({
    id: 'q_review', status: 'pending', stage: 'previewed', title: 'Review Ready 2024 1080p',
    cn: '中文名', intro: '简介正文', dupePassedAt: '2026-11-01T00:00:00.000Z',
    prepared: { targets: [{ host: 'a.example', target: { fields: { type: '1' }, ready: true } }], media: { kind: 'bdinfo' }, shots: 1 }
  }, extra || {});
}
function ctxWith(allow) {
  return { db: db, one: one, all: all, jparse: jparse, allowReal: function () { return allow; } };
}

(async function () {
  try {
    await check('缺项转人工：保持 pending，review.ok=false', async function () {
      put(ready({ id: 'q_hold', intro: '' }));
      const r = await phase()({ want: function () { return true; }, batch: 5, ctx: ctxWith(true) });
      need(r.checked === 1 && r.hold === 1 && r.ready === 0, '分支计数不对：' + JSON.stringify(r));
      const d = read('q_hold');
      need(d.status === 'pending', '缺项被自动批准：' + d.status);
      need(d.review && d.review.ok === false && d.review.missing.indexOf('简介') >= 0, '缺项没记录：' + JSON.stringify(d.review));
      db.prepare("DELETE FROM queue WHERE id = 'q_hold'").run();
    });

    await check('齐全 + realPublish 开：自动批准', async function () {
      put(ready({ id: 'q_ok' }));
      const r = await phase()({ want: function () { return true; }, batch: 5, ctx: ctxWith(true) });
      need(r.checked === 1 && r.ready === 1 && r.hold === 0, '分支计数不对：' + JSON.stringify(r));
      const d = read('q_ok');
      need(d.status === 'approved', '没自动批准：' + d.status);
      need(d.review.ok === true && d.review.missing.length === 0, 'review 没通过：' + JSON.stringify(d.review));
    });

    await check('齐全 + realPublish 关：保持 pending', async function () {
      put(ready({ id: 'q_wait' }));
      const r = await phase()({ want: function () { return true; }, batch: 5, ctx: ctxWith(false) });
      need(r.ready === 1 && r.hold === 0, '分支不对：' + JSON.stringify(r));
      const d = read('q_wait');
      need(d.status === 'pending', '关真发布仍自动批准：' + d.status);
      need(d.review.ok === true, 'review 应为通过：' + JSON.stringify(d.review));
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

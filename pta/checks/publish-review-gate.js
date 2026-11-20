/* 终审未通过不能真发布：REVIEW_HOLD 在下载器/目标站之前拦下。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makePublisher } = require('../server/publish');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-review-gate-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  all: function (s, ...a) { return db.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  DATA_DIR: DATA,
  allowReal: function () { return true; }
};
const publisher = makePublisher(ctx);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function put(data) {
  db.prepare('INSERT OR REPLACE INTO queue(id,status,title,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(data.id, data.status, data.title, JSON.stringify(data), '2026-11-01', '2026-11-01');
}
function read(id) { return JSON.parse(db.prepare('SELECT data FROM queue WHERE id = ?').get(id).data); }
const base = { id: 'q_gate', status: 'pending', stage: 'previewed', title: 'Review Gate 2024', targetSite: 'a.example' };

(async function () {
  try {
    await check('终审未通过返回 REVIEW_HOLD，状态不变', async function () {
      put(Object.assign({}, base, { review: { ok: false, missing: ['简介', '副标题'] } }));
      const r = await publisher.publishItem('q_gate', { dryRun: false });
      need(r.ok === false && r.code === 'REVIEW_HOLD' && r.http === 409, '没拦住：' + JSON.stringify(r));
      need(/简介/.test(r.message), '错误没带缺失项：' + r.message);
      const d = read('q_gate');
      need(d.status === 'pending' && d.stage === 'previewed', '被拦后状态变了：' + JSON.stringify({ s: d.status, g: d.stage }));
    });

    await check('补全终审后可继续到后续门禁', async function () {
      put(Object.assign({}, base, { review: { ok: true, missing: [] } }));
      const r = await publisher.publishItem('q_gate', { dryRun: false });
      need(r.ok === false && r.code === 'NO_DOWNLOADER', '终审通过后没继续：' + JSON.stringify(r));
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

/* 调度发布：一个目标失败后仍要尝试其余目标，最后不注入。纯临时库 + stub。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');
const { makePublishPhase } = require('../scheduler-publish');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sched-pub-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const now = new Date().toISOString();
const item = { id: 'q_0001', title: 'Publish Multi 2024', status: 'approved', targetSite: 'a.example', targets: ['b.example'], downloadUrl: 'http://127.0.0.1/x.torrent' };
db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').run(item.id, 'approved', item.title, JSON.stringify(item), now, now);

(async function () {
  try {
    await check('一个目标失败后继续尝试下一个', async function () {
      const called = [];
      const phase = makePublishPhase({});
      const out = await phase({
        one: one, all: all, jparse: jparse,
        deps: {
          publish: {
            ensureSource: async function () { return { ok: true, complete: true }; },
            publishItem: async function () { return { ok: false, code: 'INJECT_FAILED', message: 'inject fail' }; }
          }
        },
        targetService: {
          uploadMany: async function (b) {
            const h = (b.targets || [])[0];
            called.push(h);
            if (h === 'a.example') return { ok: true, data: { targets: [{ host: h, ok: false, skipped: false, code: 'UPLOAD_FAILED', message: 'target fail' }] } };
            return { ok: true, data: { targets: [{ host: h, ok: true }] } };
          }
        },
        crossseed: { run: async function () { return { ok: true }; } },
        bumpSiteFail: function () {}, resetSiteFail: function () {}, publishLimit: 5
      });
      need(called.indexOf('a.example') >= 0 && called.indexOf('b.example') >= 0, '失败后没继续尝试下一个：' + JSON.stringify(called));
      need(out.failed === 1 && out.checked === 1, '发布计数不对：' + JSON.stringify(out));
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

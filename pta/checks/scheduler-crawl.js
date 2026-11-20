/* 调度抓取阶段：轮转上限之外的站要计入 waiting；失败站不能算 ok。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeCrawlPhase } = require('../server/scheduler-crawl');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sched-crawl-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const ctx = { db: db, DATA_DIR: DATA, one: one, all: all, jparse: jparse };
const now = new Date().toISOString();
for (let i = 1; i <= 12; i++) {
  const host = 'crawl-' + i + '.example';
  db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?)').run(host, JSON.stringify({ enabled: true, priority: 0 }), now);
}
db.prepare("INSERT INTO meta(k, v) VALUES('config', ?)").run(JSON.stringify({ realCrawl: true, listInterval: 10 }));
const phase = makeCrawlPhase();

(async function () {
  try {
    await check('超过 10 个到期站时 waiting 计入剩余', async function () {
      const crawl = { crawlOnce: async function () { return { added: 0, rows: 0, pageKey: 'p' }; } };
      const out = await phase({ db: db, one: one, all: all, jparse: jparse, crawl: crawl, allowReal: function () { return true; }, bumpSiteFail: function () {}, resetSiteFail: function () {}, want: function () { return true; }, sleepFn: async function () {}, logEvent: function () {} });
      need(out.sites === 10, '本轮站数不对：' + out.sites);
      need(out.waiting === 2, 'waiting 没算轮转外站点：' + out.waiting);
      need(out.ok === 10 && out.failed === 0, '成功计数不对：' + JSON.stringify(out));
    });

    await check('单站失败不会同时算成功', async function () {
      db.prepare('DELETE FROM meta WHERE k = ?').run('crawl-state');
      const crawl = { crawlOnce: async function (host) { if (host === 'crawl-1.example') throw new Error('boom'); return { added: 0, rows: 0, pageKey: 'p' }; } };
      const out = await phase({ db: db, one: one, all: all, jparse: jparse, crawl: crawl, allowReal: function () { return true; }, bumpSiteFail: function () {}, resetSiteFail: function () {}, want: function () { return true; }, sleepFn: async function () {}, logEvent: function () {} });
      need(out.failed === 1, '失败站没计入 failed：' + JSON.stringify(out));
      need(out.ok === 9, '成功数把失败站也算进去了：' + JSON.stringify(out));
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

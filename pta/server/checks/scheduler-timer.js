/* 调度器 60 秒 tick：暂停/未到点不跑，到点才跑；start 幂等，stop 清定时器。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../db');
const { makeScheduler } = require('../scheduler');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sched-timer-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const ctx = {
  db: db,
  one: function (s, ...a) { return db.prepare(s).get(...a); },
  all: function (s, ...a) { return db.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  DATA_DIR: DATA,
  allowReal: function () { return false; },
  logEvent: function () {}
};
const deps = {
  crawl: { crawlOnce: async function () { return {}; } },
  screen: {},
  release: { prepare: function () { return { ok: true }; } }
};
const sched = makeScheduler(ctx, deps);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  try {
    await check('暂停时 tick 不运行', async function () {
      sched.set({ on: false, everyMinutes: 60 });
      const before = sched.status().lastRunAt || 0;
      sched.tick();
      await sleep(150);
      need((sched.status().lastRunAt || 0) === before, '暂停仍跑了');
    });

    await check('没到间隔不运行', async function () {
      sched.set({ on: true, everyMinutes: 60 });
      await sched.runNow({ steps: ['crawl'] });
      const before = sched.status().lastRunAt;
      sched.tick();
      await sleep(150);
      need(sched.status().lastRunAt === before, '没到点仍跑了');
    });

    await check('到点 tick 会跑一轮', async function () {
      const row = db.prepare("SELECT v FROM meta WHERE k = 'scheduler'").get();
      const st = row ? JSON.parse(row.v) : {};
      st.on = true;
      st.everyMinutes = 60;
      st.lastRunAt = Date.now() - 61 * 60000;
      db.prepare("INSERT INTO meta(k,v) VALUES('scheduler', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
      const before = st.lastRunAt;
      sched.tick();
      const end = Date.now() + 3000;
      while (Date.now() < end && (sched.status().lastRunAt || 0) <= before) await sleep(50);
      need((sched.status().lastRunAt || 0) > before, '到点没跑');
    });

    await check('start 幂等、stop 清定时器', async function () {
      const realSet = global.setInterval, realClear = global.clearInterval;
      let created = 0, cleared = 0;
      global.setInterval = function (fn, ms) { created++; return realSet(fn, ms); };
      global.clearInterval = function (t) { cleared++; return realClear(t); };
      try {
        sched.start();
        sched.start();
        need(created === 1, 'start 重复创建定时器：' + created);
        sched.stop();
        need(cleared === 1, 'stop 没清定时器：' + cleared);
        sched.stop();
        need(cleared === 1, '重复 stop 又清了：' + cleared);
      } finally {
        global.setInterval = realSet;
        global.clearInterval = realClear;
      }
    });
  } finally {
    sched.stop();
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

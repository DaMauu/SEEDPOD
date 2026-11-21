/* 调度 running 标志：并发第二次直接拒绝；阶段/保存异常后 finally 必须释放。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeScheduler } = require('../server/scheduler');
const { makeFailureQueue } = require('../server/failure-queue');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sched-run-'));
const real = openDB(path.join(DATA, 'seedpod.db'));
real.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?)')
  .run('a.example', JSON.stringify({ url: 'https://a.example', title: 'A', enabled: true }), '2026-11-01');
let failSave = false;
const db = {
  prepare: function (sql) {
    if (failSave && /^INSERT INTO meta|^UPDATE meta/i.test(String(sql).trim())) {
      const e = new Error('SQLITE_IO: disk I/O error');
      e.code = 'SQLITE_IO';
      throw e;
    }
    return real.prepare(sql);
  },
  exec: function (s) { return real.exec(s); }
};
const ctx = {
  db: db,
  one: function (s, ...a) { return real.prepare(s).get(...a); },
  all: function (s, ...a) { return real.prepare(s).all(...a); },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  DATA_DIR: DATA,
  allowReal: function (key) { return key === 'realCrawl' || key === 'realPublish'; },
  logEvent: function () {}
};
let crawlDelay = 0;
let sourceComplete = false;
const schedDeps = {
  crawl: { crawlOnce: async function () { if (crawlDelay) await new Promise(function (r) { setTimeout(r, crawlDelay); }); return { added: 0, rows: 0, pageKey: 'p1' }; } },
  publish: {
    ensureSource: async function () { return { ok: true, complete: sourceComplete }; },
    publishItem: async function () { return { ok: true }; }
  },
  release: { prepare: function () { return { ok: true }; } }
};
const sched = makeScheduler(ctx, schedDeps);
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

(async function () {
  try {
    await check('并发第二次被拒绝，首轮结束后可再跑', async function () {
      crawlDelay = 150;
      const p1 = sched.runNow({ steps: ['crawl'] });
      await new Promise(function (r) { setTimeout(r, 30); });
      const p2 = await sched.runNow({ steps: ['crawl'] });
      need(p2.ok === false && /上一轮/.test(p2.error), '第二次没被拒：' + JSON.stringify(p2));
      const r1 = await p1;
      need(r1.ok === true, '首轮没跑完：' + JSON.stringify(r1));
      crawlDelay = 0;
      const r3 = await sched.runNow({ steps: ['crawl'] });
      need(r3.ok === true, '释放后仍跑不了：' + JSON.stringify(r3));
    });

    await check('held 状态写进调度结果，源种完成后下一轮继续', async function () {
      real.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').run(
        'q_held', 'approved', 'Held Row', JSON.stringify({ id: 'q_held', status: 'approved', title: 'Held Row', targetSite: 'a.example',
          downloadUrl: 'http://a.example/t', prepared: { targets: [{ host: 'a.example', target: { ready: true, fields: { type: '1' } } }] } }), '2026-11-01', '2026-11-01');
      sourceComplete = false;
      const r1 = await sched.runNow({ steps: ['publish'] });
      need(r1.ok === true && r1.steps.publish.held === 1, '没记 held：' + JSON.stringify(r1.steps && r1.steps.publish));
      const st = sched.status();
      need(st.lastResult && st.lastResult.publish && st.lastResult.publish.held === 1, '状态里看不到 held：' + JSON.stringify(st.lastResult && st.lastResult.publish));
      let qd = JSON.parse(real.prepare('SELECT data FROM queue WHERE id = ?').get('q_held').data);
      need(typeof qd.heldSince === 'string' && qd.heldReason === '源种未下完', 'held 没持久化：' + JSON.stringify({ since: qd.heldSince, reason: qd.heldReason }));
      const fq = makeFailureQueue(ctx);
      const fl = fq.list({ limit: 20 });
      need(fl.items.some(function (x) { return x.id === 'q_held' && x.failures[0].kind === 'source' && x.failures[0].code === 'SOURCE_INCOMPLETE'; }), '失败队列看不到 held：' + JSON.stringify(fl.items));
      qd.heldSince = new Date(Date.now() - 2 * 86400000).toISOString();
      real.prepare('UPDATE queue SET data = ? WHERE id = ?').run(JSON.stringify(qd), 'q_held');
      const rold = await sched.runNow({ steps: ['publish'] });
      need(rold.steps.publish.heldOld === 1, '超 24h held 没统计：' + JSON.stringify(rold.steps.publish));
      sourceComplete = true;
      /* 目标站已确认过，跳过真实上传，只验证 held 清零后继续注入 */
      const qrow = real.prepare('SELECT data FROM queue WHERE id = ?').get('q_held');
      const qdata = JSON.parse(qrow.data);
      qdata.targetResults = { 'a.example': { verified: true, detailsUrl: 'http://a.example/d', stage: 'submitted' } };
      real.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(qdata), new Date().toISOString(), 'q_held');
      const r2 = await sched.runNow({ steps: ['publish'] });
      need(r2.ok === true && r2.steps.publish.ok === 1 && r2.steps.publish.held === 0, '完成后没继续：' + JSON.stringify(r2.steps && r2.steps.publish));
      qd = JSON.parse(real.prepare('SELECT data FROM queue WHERE id = ?').get('q_held').data);
      need(qd.heldSince === undefined && qd.heldReason === undefined, '完成后 held 没清：' + JSON.stringify({ s: qd.heldSince, r: qd.heldReason }));
    });

    await check('调度状态重启后仍可读', async function () {
      const st1 = sched.status();
      const again = makeScheduler(ctx, schedDeps);
      const st2 = again.status();
      need(st1.lastRunAt > 0, '首轮 lastRunAt 没写');
      need(st2.lastRunAt === st1.lastRunAt, '重启后 lastRunAt 变了：' + JSON.stringify({ a: st1.lastRunAt, b: st2.lastRunAt }));
      need(st2.lastResult && st2.lastResult.publish && typeof st2.lastResult.publish.held === 'number', '重启后 lastResult 丢了');
    });

    await check('保存异常返回失败后 running 已释放', async function () {
      failSave = true;
      const bad = await sched.runNow({ steps: ['crawl'] });
      failSave = false;
      need(bad.ok === false && /SQLITE_IO/.test(bad.error || ''), '保存异常没返回失败：' + JSON.stringify(bad));
      const ok = await sched.runNow({ steps: ['crawl'] });
      need(ok.ok === true, '异常后 running 没释放：' + JSON.stringify(ok));
    });
  } finally {
    real.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

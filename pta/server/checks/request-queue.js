/* 目标站请求队列夹具：全局串行，搜索 30 秒级、写操作 10 秒级（测试用短间隔）。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require(path.join(__dirname, '..', 'src', 'infra', 'db.js'));
const { makeRequestQueue } = require(path.join(__dirname, '..', 'src', 'infra', 'request-queue.js'));

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-queue-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const ctx = { db, one };
process.env.SEARCH_WAIT_SEC = '0.08';
process.env.UPLOAD_WAIT_SEC = '0.03';
process.env.WAIT_RANDOM_PERCENT = '0';
const queue = makeRequestQueue(ctx);
function clear() { db.prepare("DELETE FROM meta WHERE k = 'target-req-queue'").run(); }

async function main() {
  await check('搜索请求按搜索间隔排队', async function () {
    clear();
    const t0 = Date.now();
    await queue.wait('search');
    const t1 = Date.now();
    await queue.wait('search');
    const t2 = Date.now();
    need(t1 - t0 < 30, '第一次不该等：' + (t1 - t0));
    need(t2 - t1 >= 70, '第二次没等搜索间隔：' + (t2 - t1));
  });

  await check('写请求按写间隔排队，比搜索快', async function () {
    clear();
    const t0 = Date.now();
    await queue.wait('write');
    await queue.wait('write');
    const ms = Date.now() - t0;
    need(ms >= 25 && ms < 70, '写间隔不对：' + ms);
  });

  await check('并发请求也串行', async function () {
    clear();
    const t0 = Date.now();
    await Promise.all([queue.wait('write'), queue.wait('write'), queue.wait('write')]);
    const ms = Date.now() - t0;
    need(ms >= 55, '三个并发没串行：' + ms);
  });

  await check('多实例并发 wait 仍然串行', async function () {
    clear();
    const q1 = makeRequestQueue(ctx);
    const q2 = makeRequestQueue(ctx);
    const t0 = Date.now();
    await Promise.all([q1.wait('write'), q2.wait('write')]);
    const ms = Date.now() - t0;
    need(ms >= 25, '多实例没串行：' + ms);
  });

  await check('状态落库，新实例继续等待', async function () {
    clear();
    await queue.wait('write');
    const st1 = queue.status();
    const q2 = makeRequestQueue(ctx);
    const st2 = q2.status();
    need(st1.nextAt > 0 && st1.nextAt === st2.nextAt, '新实例没读到 nextAt：' + JSON.stringify({ a: st1.nextAt, b: st2.nextAt }));
    const t = Date.now();
    await q2.wait('write');
    need(Date.now() - t >= 10, '新实例没继续等待：' + (Date.now() - t));
  });

  await check('写库失败后队列能恢复', async function () {
    const bad = makeRequestQueue({ db: { prepare: function () { throw new Error('db down'); } }, one: function () { return null; } });
    let failed = false;
    try { await bad.wait('write'); } catch (e) { failed = true; }
    need(failed, '写库失败没有抛出');
    clear();
    const t = Date.now();
    await queue.wait('write');
    await queue.wait('write');
    need(Date.now() - t >= 25, '失败后队列没恢复串行：' + (Date.now() - t));
  });

  await check('旧 PTA_ 名字仍兼容', function () {
    delete process.env.SEARCH_WAIT_SEC;
    delete process.env.UPLOAD_WAIT_SEC;
    delete process.env.WAIT_RANDOM_PERCENT;
    process.env.PTA_REQ_SEARCH_GAP_MS = '120';
    process.env.PTA_REQ_WRITE_GAP_MS = '60';
    process.env.PTA_REQ_JITTER = '0';
    const old = makeRequestQueue(ctx);
    const st = old.status();
    need(st.searchGapMs === 120 && st.writeGapMs === 60, '旧名字没兼容：' + JSON.stringify(st));
  });

  await check('暂停期间 nextAt 不推进', async function () {
    clear();
    await queue.wait('write');
    const a = queue.status().nextAt;
    await sleep(120);
    const b = queue.status().nextAt;
    need(a === b, '暂停期间 nextAt 变了：' + JSON.stringify({ a: a, b: b }));
  });

  await check('重启后过期 nextAt 立即执行', async function () {
    clear();
    db.prepare("INSERT INTO meta(k, v) VALUES('target-req-queue', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify({ nextAt: Date.now() - 1000 }));
    const q2 = makeRequestQueue(ctx);
    const t = Date.now();
    await q2.wait('write');
    const ms = Date.now() - t;
    need(ms < 15, '过期 nextAt 还在等：' + ms);
    need(q2.status().nextAt > Date.now(), '执行后没推进 nextAt');
  });

  await check('搜索/写入交替按 FIFO 公平执行', async function () {
    clear();
    const order = [];
    const t0 = Date.now();
    await Promise.all([
      queue.wait('search').then(function () { order.push('s1'); }),
      queue.wait('write').then(function () { order.push('w1'); }),
      queue.wait('search').then(function () { order.push('s2'); }),
      queue.wait('write').then(function () { order.push('w2'); })
    ]);
    const ms = Date.now() - t0;
    need(order.join(',') === 's1,w1,s2,w2', '执行顺序不公平：' + order.join(','));
    need(ms >= 180 && ms < 400, '总耗时不正常：' + ms);
  });

  await check('状态里能看到两种间隔', function () {
    const st = queue.status();
    need(st.searchGapMs === 80 && st.writeGapMs === 30, '间隔不对：' + JSON.stringify(st));
    need(st.nextAt > Date.now(), 'nextAt 没设置：' + JSON.stringify(st));
  });

  const failed = results.filter(function (r) { return !r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  try { db.close(); } catch (e) { /* 忽略：失败不影响主流程 */ }
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
main().catch(function (e) { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

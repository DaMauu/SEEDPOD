/* 目标站请求队列夹具：全局串行，一次一个，间隔固定。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require(path.join(__dirname, '..', 'server', 'db.js'));
const { makeRequestQueue } = require(path.join(__dirname, '..', 'server', 'request-queue.js'));

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-queue-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const ctx = { db, one };
process.env.PTA_REQ_GAP_MS = '80';
process.env.PTA_REQ_JITTER = '0';
const queue = makeRequestQueue(ctx);

async function main() {
  await check('第一次不等待，后续按间隔排队', async function () {
    const t0 = Date.now();
    await queue.wait();
    const t1 = Date.now();
    await queue.wait();
    const t2 = Date.now();
    need(t1 - t0 < 50, '第一次不该等：' + (t1 - t0));
    need(t2 - t1 >= 70, '第二次没等间隔：' + (t2 - t1));
  });

  await check('并发请求也串行，不会一起发', async function () {
    const t0 = Date.now();
    await Promise.all([queue.wait(), queue.wait(), queue.wait()]);
    const ms = Date.now() - t0;
    need(ms >= 140, '三个并发没串行：' + ms);
  });

  await check('状态里能看到间隔和下一次时间', function () {
    const st = queue.status();
    need(st.gapMs === 80, 'gap 不对：' + st.gapMs);
    need(st.nextAt > Date.now(), 'nextAt 没设置：' + JSON.stringify(st));
  });

  const failed = results.filter(function (r) { return !r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  try { db.close(); } catch (e) {}
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
main().catch(function (e) { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

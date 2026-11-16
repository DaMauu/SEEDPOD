/* 目标站请求队列夹具：全局串行，搜索 30 秒级、写操作 10 秒级（测试用短间隔）。 */
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

  await check('状态里能看到两种间隔', function () {
    const st = queue.status();
    need(st.searchGapMs === 80 && st.writeGapMs === 30, '间隔不对：' + JSON.stringify(st));
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

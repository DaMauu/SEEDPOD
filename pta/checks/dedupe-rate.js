/* 查重限速夹具：每站时间窗 + 全局时间窗，不用日额度。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require(path.join(__dirname, '..', 'server', 'db.js'));
const { makeDedupeRate } = require(path.join(__dirname, '..', 'server', 'dedupe-rate.js'));

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-rate-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const ctx = { db, one };
process.env.PTA_DEDUPE_SITE_GAP_MS = '30';
process.env.PTA_DEDUPE_GLOBAL_GAP_MS = '10';
process.env.PTA_DEDUPE_SITE_HOUR_MAX = '2';
process.env.PTA_DEDUPE_GLOBAL_HOUR_MAX = '3';
process.env.PTA_DEDUPE_JITTER = '0';
const rate = makeDedupeRate(ctx);

async function main() {
  await check('每站每小时上限用完后拒绝', async function () {
    need((await rate.take('a.example')).ok, '第 1 次应通过');
    need((await rate.take('a.example')).ok, '第 2 次应通过');
    const no = await rate.take('a.example');
    need(!no.ok && no.limit === 'SITE_HOUR', '第 3 次没被站窗口拦住：' + JSON.stringify(no));
    need(no.retryAfterMs > 0, '没给重试等待时间');
  });

  await check('全局每小时上限用完后所有站都停', async function () {
    const b = await rate.take('b.example');
    need(b.ok, '第 3 次全局应通过：' + JSON.stringify(b));
    const no = await rate.take('c.example');
    need(!no.ok && no.limit === 'GLOBAL_HOUR', '第 4 次没被全局窗口拦住：' + JSON.stringify(no));
  });

  await check('状态里能看到每小时用量', function () {
    const st = rate.status();
    need(st.site.hourMax === 2 && st.global.hourMax === 3, '限制值不对：' + JSON.stringify(st));
    need(st.global.hourUsed === 3, '全局用量不对：' + JSON.stringify(st.global));
    need(st.sites['a.example'].hourUsed === 2, 'a 站用量不对：' + JSON.stringify(st.sites));
  });

  const failed = results.filter(function (r) { return !r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  try { db.close(); } catch (e) {}
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
main().catch(function (e) { console.error('检查脚本自身出错：' + e.message); process.exit(1); });

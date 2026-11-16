/* 查重总预算夹具：所有站共用日额度，额度用完必须停。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require(path.join(__dirname, '..', 'server', 'db.js'));
const { makeDedupeBudget } = require(path.join(__dirname, '..', 'server', 'dedupe-budget.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-dedupe-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (s, ...a) => db.prepare(s).get(...a);
const ctx = { db, one };
process.env.PTA_DEDUPE_DAILY_MAX = '3';
process.env.PTA_DEDUPE_ROUND_MAX = '2';
const budget = makeDedupeBudget(ctx);

check('全局日额度用完就拒绝', function () {
  need(budget.take(1).ok, '第 1 次应通过');
  need(budget.take(1).ok, '第 2 次应通过');
  need(budget.take(1).ok, '第 3 次应通过');
  const no = budget.take(1);
  need(no.ok === false && no.code === 'DEDUPE_BUDGET_EXHAUSTED', '额度用完没拦住：' + JSON.stringify(no));
  const st = budget.status();
  need(st.used === 3 && st.left === 0 && st.max === 3, '计数不对：' + JSON.stringify(st));
});

check('一次取多次会整笔拒绝', function () {
  const no = budget.take(2);
  need(no.ok === false, '超额预支没拦住');
  need(budget.status().used === 3, '被拒时不应扣额度');
});

check('每轮上限独立于日额度', function () {
  const b2 = makeDedupeBudget(ctx);
  need(b2.roundMax === 2, 'roundMax 没读到：' + b2.roundMax);
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
try { db.close(); } catch (e) {}
fs.rmSync(DATA, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

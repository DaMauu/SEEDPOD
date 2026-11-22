/* 环境变量命名夹具：新名字优先，旧 PTA_ 名字兜底。 */
const path = require('path');
const env = require(path.join(__dirname, '..', 'env.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('新名字优先', function () {
  process.env.SEARCH_WAIT_SEC = '12';
  process.env.PTA_REQ_SEARCH_GAP_MS = '99999';
  need(env.read('SEARCH_WAIT_SEC', 'PTA_REQ_SEARCH_GAP_MS') === '12', '没优先读新名字');
});

check('只有旧名字时兜底', function () {
  delete process.env.PANEL_PORT;
  process.env.PTA_PORT = '8099';
  need(env.read('PANEL_PORT', 'PTA_PORT') === '8099', '旧名字没兜底');
});

check('都没有时返回 undefined', function () {
  delete process.env.NOT_SET_NEW;
  delete process.env.PTA_NOT_SET_NEW;
  need(env.read('NOT_SET_NEW', 'PTA_NOT_SET_NEW') === undefined, '不该返回空串');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

/* 静态回归：发布/整理/操作必须在 await 前捕获 queue id，不能在响应后用 sel.value.id。
   这是 Vue 页面，纯 Node 检查源码结构，不需要浏览器。 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'web-src', 'src', 'views', 'Queue.vue');
const src = fs.readFileSync(FILE, 'utf8');
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function section(name, nextName) {
  const a = src.indexOf('async function ' + name);
  if (a < 0) throw new Error('找不到函数 ' + name);
  const b = nextName ? src.indexOf(nextName, a) : src.indexOf('\nfunction ', a + 10);
  return src.slice(a, b > 0 ? b : undefined);
}

check('doSubmitTarget 在 await 前捕获 id，后续 URL 全用 id', function () {
  const s = section('doSubmitTarget', 'async function act');
  const cap = s.indexOf('const id = sel.value.id');
  const firstAwait = s.indexOf('await ');
  need(cap >= 0 && cap < firstAwait, 'id 不是在第一个 await 前捕获');
  need(/const url = multi \? '\/api\/queue\/' \+ encodeURIComponent\(id\)/.test(s), '多目标上传没用捕获的 id');
  need(/\/api\/targets\/' \+ encodeURIComponent\(targets\[0\]\)/.test(s) === false || /encodeURIComponent\(id\)/.test(s), '单目标上传缺少 id');
  need(s.indexOf("'/prepare'") < 0 || (s.match(/encodeURIComponent\(id\) \+ '\/prepare'/g) || []).length >= 1, 'prepare 没用捕获的 id');
});

check('prepareRelease / act / doRetryTarget 都捕获 id', function () {
  [['prepareRelease', 'async function refresh'], ['act', 'async function bulkApprove'], ['doRetryTarget', 'function stageTime']].forEach(function (p) {
    const s = section(p[0], p[1]);
    const cap = s.indexOf('const id = sel.value.id');
    const firstAwait = s.indexOf('await ');
    need(cap >= 0 && cap < firstAwait, p[0] + ' 没在 await 前捕获 id');
  });
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

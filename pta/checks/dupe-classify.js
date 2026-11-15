/* 目标站查重判重夹具：体积容差、原盘/DIY、4K 对齐。 */
const path = require('path');
const { classify } = require(path.join(__dirname, '..', 'server', 'dupe-classify.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function row(title, gb, diy) {
  return { title: title + (diy ? ' DIY' : ''), sizeBytes: Math.round(gb * 1073741824) };
}

check('同标题 4K 原盘命中', function () {
  const r = classify('Movie 2024 2160p UHD Blu-ray', 60, [row('Movie 2024 2160p UHD Blu-ray', 60)]);
  need(r.status === 'dupe' && r.row, '没判重：' + r.status);
});

check('体积容差 2% 拦 10% 差异，15% 放行', function () {
  const src = 'Movie 2024 2160p UHD Blu-ray';
  const rows = [row('Movie 2024 2160p UHD Blu-ray', 66)];
  need(classify(src, 60, rows, 2).status === 'clean', '2% 应判不同');
  need(classify(src, 60, rows, 15).status === 'dupe', '15% 应判相同');
});

check('DIY 单独标记，不冒充普通原盘', function () {
  const r = classify('Movie 2024 2160p UHD Blu-ray', 60, [row('Movie 2024 2160p UHD Blu-ray', 60, true)]);
  need(r.status === 'diy' && r.row, 'DIY 状态不对：' + r.status);
});

check('非原盘/Encode 不参与原盘判重', function () {
  const r = classify('Movie 2024 2160p UHD Blu-ray', 60, [row('Movie 2024 2160p WEB-DL', 60)]);
  need(r.status === 'clean', 'WEB-DL 不该判原盘重复：' + r.status);
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

/* 流程规则摊平：同名行只取第一条，数字/开关默认值可覆盖。 */
const path = require('path');
const fc = require(path.join(__dirname, '..', 'src', 'features', 'settings', 'flow-config.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const map = fc.fromSets({
  pub: [[
    { t: '图片上传重试', v: '2 次' },
    { t: '主演最多几个', v: '3' },
    { t: '年份必须一致', on: true },
    { t: '简介图片', v: '转存到图床' }
  ]],
  dedupe: [[{ t: '目标站搜索', on: false }, { t: '体积容差', v: '2' }]]
});

check('摊平同名规则并读开关', function () {
  need(fc.on(map, '年份必须一致', false) === true, '年份开关没读到');
  need(fc.on(map, '目标站搜索', true) === false, '目标站开关没读到');
  need(fc.on(map, '不存在', true) === true, '默认开关不对');
});

check('数字规则能去掉“次”等单位', function () {
  need(fc.number(map, '图片上传重试', 2) === 2, '重试数字不对');
  need(fc.number(map, '主演最多几个', 8) === 3, '主演数字不对');
  need(fc.onLegacy({ BDInfo: { v: '不要求' } }, 'BDInfo', true, function (v) { return v !== '不要求'; }) === false, '旧 BDInfo 下拉没迁成关');
  need(fc.onLegacy({ BDInfo: { v: '必须存在且校验通过' } }, 'BDInfo', true, function (v) { return v !== '不要求'; }) === true, '旧 BDInfo 下拉没迁成开');
  need(fc.number(map, '体积容差', 0) === 2, '容差数字不对');
  need(fc.number(map, '不存在', 7) === 7, '默认数字不对');
});

check('文字规则原样读取', function () {
  need(fc.value(map, '简介图片', '保留外链') === '转存到图床', '文字规则不对');
  need(fc.value(map, '不存在', '默认') === '默认', '默认文字不对');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

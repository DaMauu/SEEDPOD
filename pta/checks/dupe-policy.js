/* 查重开关语义：重复一律跳过；DIY/原盘/禁转只由对应开关决定例外。 */
const { _dupeDecision, _dedupeSwitchOn } = require('../server/target-service');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('普通重复始终跳过', () => {
  need(_dupeDecision('other', false, { diy: true, full: false, restrict: false }) === true, '普通重复被放行');
  need(_dupeDecision('remux', false, {}) === true, 'Remux 重复被放行');
});

check('DIY 开关：开=仍可发，关=跳过', () => {
  need(_dupeDecision('diy', false, { diy: true }) === false, 'DIY 开关开时仍跳过');
  need(_dupeDecision('diy', false, { diy: false }) === true, 'DIY 开关关时没跳过');
});

check('原盘开关：开=跳过，关=放行', () => {
  need(_dupeDecision('full_disc', false, { full: true }) === true, '原盘开关开时没跳过');
  need(_dupeDecision('full_disc', false, { full: false }) === false, '原盘开关关时仍跳过');
});

check('禁转/限转开关优先：开=跳过，关=不覆盖其他判断', () => {
  need(_dupeDecision('full_disc', true, { full: false, restrict: true }) === true, '禁转开关开时没跳过');
  need(_dupeDecision('diy', true, { diy: true, restrict: true }) === true, 'DIY+禁转开关开时没跳过');
  need(_dupeDecision('full_disc', true, { full: false, restrict: false }) === false, '禁转开关关时误跳');
  need(_dupeDecision('other', true, { restrict: false }) === true, '普通重复被禁转开关关掉');
});

check('旧下拉值兼容成开关', () => {
  need(_dedupeSwitchOn({ '目标站只有 DIY': { v: '跳过' } }, '目标站只有 DIY', true) === false, '旧 DIY“跳过”没转成关');
  need(_dedupeSwitchOn({ '目标站只有 DIY': { v: '可发（标复核）' } }, '目标站只有 DIY', true) === true, '旧 DIY“可发”没转成开');
  need(_dedupeSwitchOn({ '禁转/限转处理': { v: '不检查' } }, '禁转/限转处理', true) === false, '旧禁转“不检查”没转成关');
  need(_dedupeSwitchOn({ '禁转/限转处理': { v: '跳过发布' } }, '禁转/限转处理', true) === true, '旧禁转“跳过”没转成开');
  need(_dedupeSwitchOn({}, '目标站已有原盘', true) === true, '没有旧值时默认没开');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

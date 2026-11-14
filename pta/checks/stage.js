/* 发布状态机单元检查：阶段、尝试次数、错误、重试时间、证据、幂等标记。 */
const stage = require('../server/stage');
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }

check('默认 draft，初始化字段', function () {
  const it = stage.ensure({});
  need(it.stage === 'draft', 'stage=' + it.stage);
  need(Array.isArray(it.stageHistory), 'history 不是数组');
  need(it.stageAttempts === 0, 'attempts=' + it.stageAttempts);
});
check('prepared / previewed 推进并记证据', function () {
  const it = stage.ensure({});
  stage.set(it, 'prepared', { evidence: { host: 'x.example' } });
  need(it.stage === 'prepared' && it.stageAttempts === 1, 'prepared');
  stage.set(it, 'previewed', { evidence: { shots: 3 } });
  need(it.stage === 'previewed' && it.stageEvidence.shots === 3, 'previewed');
  need(it.stageHistory.length === 2, 'history=' + it.stageHistory.length);
});
check('failed 记 lastError / nextRetryAt / failedFrom', function () {
  const it = stage.ensure({});
  stage.set(it, 'previewed');
  stage.fail(it, 'previewed', '目标站 500');
  need(it.stage === 'failed', 'stage=' + it.stage);
  need(it.stageLastError === '目标站 500', 'error=' + it.stageLastError);
  need(it.stageFailedFrom === 'previewed', 'from=' + it.stageFailedFrom);
  need(Date.parse(it.stageNextRetryAt) > Date.now(), 'nextRetryAt 不在未来');
});
check('submitted / injected 幂等标记', function () {
  const it = stage.ensure({});
  need(!stage.isSubmitted(it), 'draft 不应算已提交');
  stage.set(it, 'submitted', { evidence: { infohash: 'abc' } });
  need(stage.isSubmitted(it), 'submitted 未识别');
  stage.set(it, 'injected', { evidence: { client: 'qb' } });
  need(stage.isInjected(it), 'injected 未识别');
  need(it.stageEvidence.infohash === 'abc' && it.stageEvidence.client === 'qb', '证据被覆盖');
});
check('成功推进清除错误', function () {
  const it = stage.ensure({});
  stage.fail(it, 'prepared', 'boom');
  stage.set(it, 'prepared');
  need(it.stageLastError === '', 'lastError 没清');
  need(it.stageNextRetryAt === '', 'nextRetryAt 没清');
});

results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

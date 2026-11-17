/* 查重开关语义：纯函数，服务和上传共用。 */
const flowConfig = require('./flow-config');

function dupeDecision(kind, restricted, switches) {
  const sw = switches || {};
  const ruleRestrict = sw.restrict !== false;
  const ruleDiy = sw.diy !== false;
  const ruleFull = sw.full !== false;
  let skip = true;
  if (kind === 'diy') skip = !ruleDiy;
  else if (kind === 'full_disc') skip = ruleFull;
  if (restricted && ruleRestrict) skip = true;
  return skip;
}

function dedupeSwitchOn(flowCfg, name, defaultValue) {
  const r = flowCfg && flowCfg[name];
  if (r && r.on === undefined && r.v !== undefined) {
    if (name === '目标站只有 DIY') return String(r.v) !== '跳过';
    if (name === '禁转/限转处理') return String(r.v) !== '不检查';
    if (name === '目标站已有原盘') return true;
  }
  return flowConfig.on(flowCfg, name, defaultValue);
}

module.exports = { dupeDecision, dedupeSwitchOn };

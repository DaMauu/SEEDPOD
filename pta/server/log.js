/* 轻量日志：被忽略的异常至少留一条 scope + message，方便排查，不打印凭据。 */
function warn(scope, e) {
  const msg = e && e.message ? e.message : String(e || '');
  try { console.warn('[seedpod] ' + scope + ': ' + msg.slice(0, 300)); } catch (_) { /* 日志失败不挡主流程 */ }
}
module.exports = { warn: warn };

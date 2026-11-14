/* 页面侧错误上报：不改变流程，只让被忽略的失败在控制台可见。 */
export function reportError(scope, e) {
  try {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[seedpod] ' + scope + ':', e && e.message ? e.message : e)
    }
  } catch (_) {}
}

/* 页面共用的 UI 小函数：toast / confirm / 登录态 / 页面可见性。
   只做 DOM/window 适配，不持有页面状态。 */
export function toast(msg) {
  if (window.PTA && window.PTA.toast) window.PTA.toast(msg)
}

export function confirmBox(title, text, fn) {
  if (window.PTA && window.PTA.confirm) window.PTA.confirm(title, text, fn)
  else if (window.confirm(title + '\n\n' + text)) fn()
}

export function loggedIn() {
  return !document.querySelector('#login-mask')
}

export function viewVisible(name) {
  const v = document.querySelector('[data-view="' + name + '"]')
  return !!(v && !v.hidden)
}

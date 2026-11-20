/* 共用格式化：字节数。 */
export function fmtBytes(n) {
  let v = Number(n) || 0
  if (!v) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + u[i]
}

/* 统一时间显示：只留月-日 时:分，列表/详情共用 */
export function stageTime(iso) {
  return String(iso || '').slice(5, 16).replace('T', ' ')
}

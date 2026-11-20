/* 本地日期键：统计“今日/近 14 天”按服务器时区算，不用 UTC 切片。 */
function dayOf(ms) {
  const d = new Date(Number(ms) || Date.now());
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
module.exports = { dayOf };

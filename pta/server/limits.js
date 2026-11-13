/* 服务端硬顶：每日抓取次数不跟界面配置走，默认 20 次/站/天。 */
const DEFAULT_DAILY_MAX = 20;

function dailyMax() {
  const n = Number(process.env.PTA_DAILY_MAX);
  const v = Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_MAX;
  return Math.max(1, Math.min(v, 100));
}
function dailyBlocked(count, max) {
  return Number(count) >= Number(max || dailyMax());
}

module.exports = { dailyMax, dailyBlocked };

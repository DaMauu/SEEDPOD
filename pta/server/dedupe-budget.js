/* 查重请求总预算：所有目标站共用，不按站配置。
   默认每天 200 次、每轮 12 次；可用 PTA_DEDUPE_DAILY_MAX / PTA_DEDUPE_ROUND_MAX 调整。
   一次搜索算 1 次，命中后读详情再算 1 次；多目标按站累加。 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeDedupeBudget(ctx) {
  const { one, db } = ctx;
  const DAY_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_DAILY_MAX) || 200);
  const ROUND_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_ROUND_MAX) || 12);

  function read() {
    const row = one("SELECT v FROM meta WHERE k = 'dedupe-budget'");
    let st = null;
    try { st = JSON.parse(row ? row.v : 'null'); } catch (e) { st = null; }
    if (!st || st.day !== today()) st = { day: today(), count: 0 };
    return st;
  }
  function save(st) {
    db.prepare("INSERT INTO meta(k, v) VALUES('dedupe-budget', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(st));
  }
  function status() {
    const st = read();
    return { day: st.day, used: Number(st.count) || 0, max: DAY_MAX, left: Math.max(0, DAY_MAX - (Number(st.count) || 0)), roundMax: ROUND_MAX };
  }
  function take(n) {
    const need = Math.max(1, Number(n) || 1);
    const st = read();
    if ((Number(st.count) || 0) + need > DAY_MAX) {
      return { ok: false, code: 'DEDUPE_BUDGET_EXHAUSTED', message: '今天查重请求到上限 ' + DAY_MAX + ' 次', status: status() };
    }
    st.count = (Number(st.count) || 0) + need;
    save(st);
    return { ok: true, status: status() };
  }
  return { take: take, status: status, dayMax: DAY_MAX, roundMax: ROUND_MAX };
}

module.exports = { makeDedupeBudget };

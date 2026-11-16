/* 查重请求限速：时间窗 + 最小间隔，不用日额度。
   默认（偏保守）：
   - 每站：10 分钟内最多 10 次，最小间隔 6 秒
   - 全局：10 分钟内最多 30 次（多目标共用，防止翻倍打爆）
   一次搜索算 1 次，命中后读详情再算 1 次。
   环境变量：PTA_DEDUPE_SITE_MAX / PTA_DEDUPE_SITE_MIN /
             PTA_DEDUPE_GLOBAL_MAX / PTA_DEDUPE_GLOBAL_MIN / PTA_DEDUPE_MIN_GAP_MS */
function nowMs() { return Date.now(); }
function windowMs(minutes) { return Math.max(1, Number(minutes) || 10) * 60000; }

function makeDedupeRate(ctx) {
  const { one, db } = ctx;
  const SITE_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_SITE_MAX) || 10);
  const SITE_MIN = windowMs(process.env.PTA_DEDUPE_SITE_MIN || 10);
  const GLOBAL_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_GLOBAL_MAX) || 30);
  const GLOBAL_MIN = windowMs(process.env.PTA_DEDUPE_GLOBAL_MIN || 10);
  const MIN_GAP = Math.max(0, Number(process.env.PTA_DEDUPE_MIN_GAP_MS == null ? 6000 : process.env.PTA_DEDUPE_MIN_GAP_MS) || 0);

  function read() {
    const row = one("SELECT v FROM meta WHERE k = 'dedupe-rate'");
    let st = null;
    try { st = JSON.parse(row ? row.v : 'null'); } catch (e) { st = null; }
    if (!st || typeof st !== 'object') st = {};
    if (!st.sites || typeof st.sites !== 'object') st.sites = {};
    if (!Array.isArray(st.global)) st.global = [];
    return st;
  }
  function save(st) {
    db.prepare("INSERT INTO meta(k, v) VALUES('dedupe-rate', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(st));
  }
  function prune(list, span, t) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return Number(x) > t - span; });
  }
  function status() {
    const t = nowMs();
    const st = read();
    const sites = {};
    Object.keys(st.sites).forEach(function (h) {
      const n = prune(st.sites[h].times, SITE_MIN, t).length;
      if (n) sites[h] = { used: n, max: SITE_MAX };
    });
    return {
      site: { windowMinutes: Math.round(SITE_MIN / 60000), max: SITE_MAX, minGapMs: MIN_GAP },
      global: { windowMinutes: Math.round(GLOBAL_MIN / 60000), max: GLOBAL_MAX, used: prune(st.global, GLOBAL_MIN, t).length },
      sites: sites
    };
  }
  async function take(host) {
    const h = String(host || '').toLowerCase();
    if (!h) return { ok: false, limit: 'NO_HOST', message: '没有目标站' };
    const t = nowMs();
    const st = read();
    const site = st.sites[h] || { times: [] };
    const siteTimes = prune(site.times, SITE_MIN, t);
    const globalTimes = prune(st.global, GLOBAL_MIN, t);
    if (siteTimes.length >= SITE_MAX) {
      return { ok: false, limit: 'SITE_WINDOW', retryAfterMs: Math.max(0, siteTimes[0] + SITE_MIN - t), message: '这个站 ' + Math.round(SITE_MIN / 60000) + ' 分钟内已查 ' + siteTimes.length + ' 次' };
    }
    if (globalTimes.length >= GLOBAL_MAX) {
      return { ok: false, limit: 'GLOBAL_WINDOW', retryAfterMs: Math.max(0, globalTimes[0] + GLOBAL_MIN - t), message: '所有站 ' + Math.round(GLOBAL_MIN / 60000) + ' 分钟内已查 ' + globalTimes.length + ' 次' };
    }
    const last = siteTimes.length ? siteTimes[siteTimes.length - 1] : 0;
    const wait = Math.max(0, last + MIN_GAP - t);
    if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });
    const at = nowMs();
    siteTimes.push(at);
    globalTimes.push(at);
    st.sites[h] = { times: siteTimes.slice(-SITE_MAX) };
    st.global = globalTimes.slice(-GLOBAL_MAX);
    save(st);
    return { ok: true, site: { used: siteTimes.length, max: SITE_MAX }, global: { used: globalTimes.length, max: GLOBAL_MAX } };
  }
  return { take: take, status: status, limits: { siteMax: SITE_MAX, siteWindowMs: SITE_MIN, globalMax: GLOBAL_MAX, globalWindowMs: GLOBAL_MIN, minGapMs: MIN_GAP } };
}

module.exports = { makeDedupeRate };

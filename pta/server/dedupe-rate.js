/* 查重请求平滑限速：按“下一次允许时间”排队，不允许窗口内突发。
   默认：
   - 每站：1 次/分钟（±20% 抖动），每小时最多 30 次
   - 全局：1 次/20 秒，每小时最多 60 次（多目标共用）
   一次搜索算 1 次，命中后读详情再算 1 次。
   环境变量：PTA_DEDUPE_SITE_GAP_MS / PTA_DEDUPE_GLOBAL_GAP_MS /
             PTA_DEDUPE_SITE_HOUR_MAX / PTA_DEDUPE_GLOBAL_HOUR_MAX / PTA_DEDUPE_JITTER */
function hourKey() { return new Date().toISOString().slice(0, 13); }
function jitter(base, ratio) {
  const r = Math.max(0, Math.min(1, ratio == null ? 0.2 : Number(ratio)));
  return Math.round(base * (1 - r + Math.random() * r * 2));
}

function makeDedupeRate(ctx) {
  const { one, db } = ctx;
  const SITE_GAP = Math.max(1000, Number(process.env.PTA_DEDUPE_SITE_GAP_MS) || 60000);
  const GLOBAL_GAP = Math.max(500, Number(process.env.PTA_DEDUPE_GLOBAL_GAP_MS) || 20000);
  const SITE_HOUR_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_SITE_HOUR_MAX) || 30);
  const GLOBAL_HOUR_MAX = Math.max(1, Number(process.env.PTA_DEDUPE_GLOBAL_HOUR_MAX) || 60);
  const JITTER = Math.max(0, Math.min(1, Number(process.env.PTA_DEDUPE_JITTER == null ? 0.2 : process.env.PTA_DEDUPE_JITTER) || 0));

  function read() {
    const row = one("SELECT v FROM meta WHERE k = 'dedupe-rate'");
    let st = null;
    try { st = JSON.parse(row ? row.v : 'null'); } catch (e) { st = null; }
    if (!st || typeof st !== 'object') st = {};
    if (!st.sites || typeof st.sites !== 'object') st.sites = {};
    if (!st.global || typeof st.global !== 'object') st.global = {};
    return st;
  }
  function save(st) {
    db.prepare("INSERT INTO meta(k, v) VALUES('dedupe-rate', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(st));
  }
  function siteRec(st, host) {
    const h = String(host || '').toLowerCase();
    const rec = st.sites[h] || {};
    const hour = hourKey();
    if (rec.hour !== hour) { rec.hour = hour; rec.hourCount = 0; }
    return rec;
  }
  function globalRec(st) {
    const rec = st.global || {};
    const hour = hourKey();
    if (rec.hour !== hour) { rec.hour = hour; rec.hourCount = 0; }
    return rec;
  }
  function status() {
    const st = read();
    const g = globalRec(st);
    const sites = {};
    Object.keys(st.sites).forEach(function (h) {
      const r = siteRec(st, h);
      if (r.nextAt || r.hourCount) sites[h] = { nextAt: r.nextAt || 0, hourUsed: r.hourCount || 0, hourMax: SITE_HOUR_MAX };
    });
    return {
      site: { gapMs: SITE_GAP, hourMax: SITE_HOUR_MAX, jitter: JITTER },
      global: { gapMs: GLOBAL_GAP, hourMax: GLOBAL_HOUR_MAX, hourUsed: g.hourCount || 0, nextAt: g.nextAt || 0 },
      sites: sites
    };
  }
  async function take(host) {
    const h = String(host || '').toLowerCase();
    if (!h) return { ok: false, limit: 'NO_HOST', message: '没有目标站' };
    const st = read();
    const site = siteRec(st, h);
    const g = globalRec(st);
    if (Number(site.hourCount) >= SITE_HOUR_MAX) {
      return { ok: false, limit: 'SITE_HOUR', retryAfterMs: Math.max(0, Number(site.nextAt || 0) - Date.now()), message: '这个站本小时已查 ' + site.hourCount + ' 次' };
    }
    if (Number(g.hourCount) >= GLOBAL_HOUR_MAX) {
      return { ok: false, limit: 'GLOBAL_HOUR', retryAfterMs: Math.max(0, Number(g.nextAt || 0) - Date.now()), message: '所有站本小时已查 ' + g.hourCount + ' 次' };
    }
    const now = Date.now();
    const wait = Math.max(0, Number(site.nextAt || 0) - now, Number(g.nextAt || 0) - now);
    if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });
    const at = Date.now();
    site.nextAt = at + jitter(SITE_GAP, JITTER);
    site.hourCount = (Number(site.hourCount) || 0) + 1;
    g.nextAt = at + jitter(GLOBAL_GAP, JITTER);
    g.hourCount = (Number(g.hourCount) || 0) + 1;
    st.sites[h] = site;
    st.global = g;
    save(st);
    return { ok: true, waitedMs: wait, site: { hourUsed: site.hourCount, hourMax: SITE_HOUR_MAX }, global: { hourUsed: g.hourCount, hourMax: GLOBAL_HOUR_MAX } };
  }
  return { take: take, status: status, limits: { siteGapMs: SITE_GAP, globalGapMs: GLOBAL_GAP, siteHourMax: SITE_HOUR_MAX, globalHourMax: GLOBAL_HOUR_MAX, jitter: JITTER } };
}

module.exports = { makeDedupeRate };

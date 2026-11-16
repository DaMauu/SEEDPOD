/* 目标站请求队列：所有站共用一个队列，一次只发一个请求，发完等固定间隔。
   不做次数上限，只限制节奏。默认 8 秒（±20% 抖动），可用
   PTA_REQ_GAP_MS / PTA_REQ_JITTER 调整。
   队列状态落 meta，进程重启后仍按上一次时间继续排。 */
let CHAIN = Promise.resolve();

function makeRequestQueue(ctx) {
  const { one, db } = ctx;
  const GAP = Math.max(0, Number(process.env.PTA_REQ_GAP_MS == null ? 8000 : process.env.PTA_REQ_GAP_MS) || 0);
  const JITTER = Math.max(0, Math.min(1, Number(process.env.PTA_REQ_JITTER == null ? 0.2 : process.env.PTA_REQ_JITTER) || 0));

  function read() {
    const row = one("SELECT v FROM meta WHERE k = 'target-req-queue'");
    try { return JSON.parse(row ? row.v : 'null') || {}; } catch (e) { return {}; }
  }
  function save(st) {
    db.prepare("INSERT INTO meta(k, v) VALUES('target-req-queue', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(st));
  }
  function gapMs() {
    const g = GAP ? Math.round(GAP * (1 - JITTER + Math.random() * JITTER * 2)) : 0;
    return Math.max(0, g);
  }
  function status() {
    const st = read();
    return { gapMs: GAP, jitter: JITTER, nextAt: Number(st.nextAt) || 0, waitMs: Math.max(0, (Number(st.nextAt) || 0) - Date.now()) };
  }
  async function wait() {
    const run = CHAIN.then(async function () {
      const now = Date.now();
      const st = read();
      const startAt = Math.max(now, Number(st.nextAt) || 0);
      const delay = startAt - now;
      if (delay > 0) await new Promise(function (r) { setTimeout(r, delay); });
      const at = Date.now();
      save({ nextAt: at + gapMs(), lastAt: at });
      return { waitedMs: delay };
    });
    CHAIN = run.then(function () {}, function () {});
    return run;
  }
  return { wait: wait, status: status, gapMs: GAP, jitter: JITTER };
}

module.exports = { makeRequestQueue };

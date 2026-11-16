/* 目标站请求队列：所有站共用一个队列，一次只发一个请求，发完等固定间隔。
   参考 cross-seed：搜索/详情 30 秒一个，上传/回查/种子等写操作 10 秒一个。
   不做次数上限，只限制节奏。新名字：SEARCH_WAIT_SEC / UPLOAD_WAIT_SEC /
   WAIT_RANDOM_PERCENT；旧的 PTA_REQ_* 仍兼容。
   队列状态落 meta，进程重启后仍按上一次时间继续排。 */
let CHAIN = Promise.resolve();
const env = require('./env');

function gapFromEnv(newName, oldName, defMs) {
  const v = env.read(newName, oldName);
  if (v === undefined) return defMs;
  /* 新名字单位是秒，允许小数；旧名字是毫秒 */
  return Math.max(0, process.env[newName] !== undefined ? Number(v) * 1000 || 0 : Number(v) || 0);
}

function makeRequestQueue(ctx) {
  const { one, db } = ctx;
  const SEARCH_GAP = gapFromEnv('SEARCH_WAIT_SEC', 'PTA_REQ_SEARCH_GAP_MS', 30000);
  const WRITE_GAP = gapFromEnv('UPLOAD_WAIT_SEC', 'PTA_REQ_WRITE_GAP_MS', 10000);
  const jitterRaw = env.read('WAIT_RANDOM_PERCENT', 'PTA_REQ_JITTER');
  const JIT = Math.max(0, Math.min(1,
    jitterRaw === undefined ? 0.2
      : (process.env.WAIT_RANDOM_PERCENT !== undefined ? Number(jitterRaw) / 100 : Number(jitterRaw)) || 0));

  function read() {
    const row = one("SELECT v FROM meta WHERE k = 'target-req-queue'");
    try { return JSON.parse(row ? row.v : 'null') || {}; } catch (e) { return {}; }
  }
  function save(st) {
    db.prepare("INSERT INTO meta(k, v) VALUES('target-req-queue', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(JSON.stringify(st));
  }
  function gapMs(kind) {
    const base = kind === 'search' ? SEARCH_GAP : WRITE_GAP;
    const g = base ? Math.round(base * (1 - JIT + Math.random() * JIT * 2)) : 0;
    return Math.max(0, g);
  }
  function status() {
    const st = read();
    return { searchGapMs: SEARCH_GAP, writeGapMs: WRITE_GAP, jitter: JIT, nextAt: Number(st.nextAt) || 0, waitMs: Math.max(0, (Number(st.nextAt) || 0) - Date.now()) };
  }
  async function wait(kind) {
    const run = CHAIN.then(async function () {
      const now = Date.now();
      const st = read();
      const startAt = Math.max(now, Number(st.nextAt) || 0);
      const delay = startAt - now;
      if (delay > 0) await new Promise(function (r) { setTimeout(r, delay); });
      const at = Date.now();
      save({ nextAt: at + gapMs(kind), lastAt: at, lastKind: kind === 'search' ? 'search' : 'write' });
      return { waitedMs: delay };
    });
    CHAIN = run.then(function () {}, function () {});
    return run;
  }
  return { wait: wait, status: status, searchGapMs: SEARCH_GAP, writeGapMs: WRITE_GAP, jitter: JIT };
}

module.exports = { makeRequestQueue };

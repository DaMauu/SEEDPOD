/* 调度状态与站点失败计数：meta 读写集中在这里。 */
function makeSchedulerState(o) {
  const one = o.one;
  const jparse = o.jparse;
  const db = o.db;
  const isRunning = o.isRunning;
  const KEY = 'scheduler';
  const DEF = { on: false, everyMinutes: 60, lastRunAt: 0, lastResult: null, lastError: '' };

function read() {
    const row = one("SELECT v FROM meta WHERE k = ?", KEY);
    return Object.assign({}, DEF, JSON.parse(row ? row.v : 'null') || {});
  }

function save(s) {
    db.prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(KEY, JSON.stringify(s));
  }

function status() {
    const s = read();
    return { on: !!s.on, everyMinutes: Number(s.everyMinutes) || 60, running: isRunning(),
      lastRunAt: Number(s.lastRunAt) || 0, lastResult: s.lastResult || null, lastError: s.lastError || '' };
  }

function set(body) {
    const b = body || {};
    const next = read();
    if (b.on !== undefined) next.on = !!b.on;
    if (b.everyMinutes !== undefined) {
      const n = Number(b.everyMinutes);
      if (!Number.isInteger(n) || n < 30 || n > 1440) return { err: 'everyMinutes 必须是 30–1440 的整数' };
      next.everyMinutes = n;
    }
    save(next);
    return { ok: true, data: status() };
  }

function readFails() {
    const row = one("SELECT v FROM meta WHERE k = 'site-fails'");
    try { return JSON.parse(row ? row.v : 'null') || {}; } catch (e) { return {}; }
  }

function saveFails(map) {
    db.prepare("INSERT INTO meta(k, v) VALUES('site-fails', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(map));
  }

function bumpSiteFail(host, reason) {
    if (!host) return;
    const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
    const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
    /* 规则：连续失败几次暂停该站 */
    const limit = Math.max(1, Math.min(20, Number(cfg.breaker) || 3));
    const map = readFails();
    const cur = map[host] || { n: 0 };
    cur.n = Number(cur.n) + 1;
    cur.at = new Date().toISOString();
    cur.reason = String(reason || '').slice(0, 200);
    map[host] = cur;
    saveFails(map);
    if (cur.n >= limit) {
      const row = one('SELECT data FROM sites WHERE host = ?', host);
      if (row) {
        const d = jparse(row.data) || {};
        if (d.enabled !== false) {
          d.enabled = false;
          d.pausedAt = cur.at;
          d.pauseReason = '连续失败 ' + cur.n + ' 次';
          db.prepare('UPDATE sites SET data = ?, updated_at = ? WHERE host = ?').run(JSON.stringify(d), cur.at, host);
        }
      }
    }
  }

function resetSiteFail(host) {
    if (!host) return;
    const map = readFails();
    if (!map[host]) return;
    delete map[host];
    saveFails(map);
  }

  return { read, save, status, set, readFails, saveFails, bumpSiteFail, resetSiteFail };
}

module.exports = { makeSchedulerState };

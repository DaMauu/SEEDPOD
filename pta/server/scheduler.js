/* 调度器：按固定间隔跑抓取 → 送审 → 发布；默认关，真抓/真发仍受各自开关约束。 */
function makeScheduler(ctx, deps) {
  const { one, all, jparse } = ctx;
  const KEY = 'scheduler';
  const DEF = { on: false, everyMinutes: 60, lastRunAt: 0, lastResult: null, lastError: '' };
  let timer = null;
  let running = false;

  function read() {
    const row = one("SELECT v FROM meta WHERE k = ?", KEY);
    return Object.assign({}, DEF, JSON.parse(row ? row.v : 'null') || {});
  }
  function save(s) {
    ctx.db.prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(KEY, JSON.stringify(s));
  }
  function status() {
    const s = read();
    return { on: !!s.on, everyMinutes: Number(s.everyMinutes) || 60, running: running,
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
  async function runNow() {
    if (running) return { ok: false, error: '上一轮还没跑完' };
    running = true;
    const startedAt = new Date().toISOString();
    const steps = { startedAt: startedAt, crawl: null, screen: null, publish: null };
    const s = read();
    try {
      if (ctx.allowReal('realCrawl')) {
        const sites = all('SELECT data FROM sites').map(function (r) { return jparse(r.data) || {}; })
          .filter(function (x) { return x && x.enabled !== false && x.host; }).slice(0, 10);
        let ok = 0, failed = 0;
        for (const x of sites) {
          try {
            const r = await deps.crawl.crawlOnce(x.host, { limit: 100 });
            if (r && r.err) failed++; else ok++;
          } catch (e) { failed++; }
        }
        steps.crawl = { sites: sites.length, ok: ok, failed: failed };
      } else {
        steps.crawl = { skipped: 'realCrawl off' };
      }

      steps.screen = deps.screen.screenCatalog(ctx, { limit: 200 });

      if (ctx.allowReal('realPublish')) {
        const rows = all("SELECT id, data FROM queue WHERE status = 'approved' LIMIT 5");
        let ok = 0, failed = 0;
        const errors = [];
        for (const row of rows) {
          const it = jparse(row.data) || {};
          if (!it.targetSite || !it.downloadUrl) continue;
          const r = await deps.publish.publishItem(row.id, { dryRun: false });
          if (r.ok) ok++;
          else { failed++; if (errors.length < 3) errors.push({ id: row.id, code: r.code, message: r.message }); }
        }
        steps.publish = { checked: rows.length, ok: ok, failed: failed, errors: errors };
      } else {
        steps.publish = { skipped: 'realPublish off' };
      }

      save(Object.assign({}, s, { lastRunAt: Date.now(), lastResult: steps, lastError: '' }));
      return { ok: true, steps: steps };
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 300);
      save(Object.assign({}, s, { lastRunAt: Date.now(), lastError: msg }));
      return { ok: false, error: msg, steps: steps };
    } finally {
      running = false;
    }
  }
  function tick() {
    if (running) return;
    const s = read();
    if (!s.on) return;
    if (Date.now() - (Number(s.lastRunAt) || 0) < (Number(s.everyMinutes) || 60) * 60000) return;
    runNow();
  }
  function start() {
    if (timer) return;
    timer = setInterval(tick, 60000);
    if (timer.unref) timer.unref();
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  return { start: start, stop: stop, status: status, set: set, runNow: runNow, tick: tick };
}

module.exports = { makeScheduler };

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
    const steps = { startedAt: startedAt, crawl: null, screen: null, publish: null, retry: null };
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

      if (ctx.allowReal('realPublish')) {
        const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
        const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
        const retryMax = Math.max(0, Math.min(10, cfg.retryMax === undefined ? 2 : Number(cfg.retryMax) || 0));
        const backoff = Math.max(1, Math.min(1440, cfg.retryBackoffMin === undefined ? 15 : Number(cfg.retryBackoffMin) || 15));
        let ok = 0, failed = 0, skipped = 0;
        const rows2 = all("SELECT id, data FROM queue WHERE status = 'failed' LIMIT 10");
        for (const row of rows2) {
          const it = jparse(row.data) || {};
          const retries = Number(it.retries) || 0;
          if (retries >= retryMax) { skipped++; continue; }
          if (it.nextRetryAt && Date.parse(it.nextRetryAt) > Date.now()) { skipped++; continue; }
          const r = await deps.publish.publishItem(row.id, { dryRun: false });
          if (r.ok) { ok++; continue; }
          failed++;
          const cur = one('SELECT data FROM queue WHERE id = ?', row.id);
          const d = cur ? (jparse(cur.data) || {}) : it;
          d.retries = retries + 1;
          d.lastRetryAt = new Date().toISOString();
          d.nextRetryAt = new Date(Date.now() + backoff * 60000).toISOString();
          d.retryMsg = String(r.message || r.code || 'failed').slice(0, 300);
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(d), new Date().toISOString(), row.id);
        }
        steps.retry = { checked: rows2.length, ok: ok, failed: failed, skipped: skipped };
      } else {
        steps.retry = { skipped: 'realPublish off' };
      }

      const crawlFail = (steps.crawl && steps.crawl.failed) || 0;
      const pubFail = (steps.publish && steps.publish.failed) || 0;
      const retryFail = (steps.retry && steps.retry.failed) || 0;
      const selected = (steps.screen && steps.screen.selected) || 0;
      if (ctx.notify) {
        try {
          if (crawlFail || pubFail || retryFail) {
            await ctx.notify.send('scheduler.error', 'SEEDPOD 调度：抓取失败 ' + crawlFail + ' · 送审入选 ' + selected + ' · 发布失败 ' + pubFail + ' · 重试失败 ' + retryFail, { steps: steps });
          } else if (ctx.notify.status().events === 'always') {
            await ctx.notify.send('scheduler.run', 'SEEDPOD 调度完成：送审入选 ' + selected, { steps: steps });
          }
        } catch (e2) {}
      }
      save(Object.assign({}, s, { lastRunAt: Date.now(), lastResult: steps, lastError: '' }));
      return { ok: true, steps: steps };
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 300);
      if (ctx.notify) {
        try { await ctx.notify.send('scheduler.error', 'SEEDPOD 调度失败：' + msg); } catch (e2) {}
      }
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

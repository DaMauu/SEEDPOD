/* 调度器：按固定间隔跑抓取 → 送审 → 终审 → 发布；默认关，真抓/真发仍受各自开关约束。 */
const flowConfig = require('./flow-config');
const { makeCrossseed } = require('./crossseed');
const pipeline = require('./pipeline');
const { makeTarget } = require('./target');
const { makeTargetService } = require('./target-service');

function makeScheduler(ctx, deps) {
  const { one, all, jparse } = ctx;
  const KEY = 'scheduler';
  const DEF = { on: false, everyMinutes: 60, lastRunAt: 0, lastResult: null, lastError: '' };
  const crossseed = makeCrossseed(ctx);
  const targetService = makeTargetService(ctx, makeTarget(ctx));
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
  function readFails() {
    const row = one("SELECT v FROM meta WHERE k = 'site-fails'");
    try { return JSON.parse(row ? row.v : 'null') || {}; } catch (e) { return {}; }
  }
  function saveFails(map) {
    ctx.db.prepare("INSERT INTO meta(k, v) VALUES('site-fails', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(map));
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
          ctx.db.prepare('UPDATE sites SET data = ?, updated_at = ? WHERE host = ?').run(JSON.stringify(d), cur.at, host);
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

      steps.hooksCrawl = await pipeline.run('crawl', ctx, steps);

      steps.screen = deps.screen.screenCatalog(ctx, { limit: 200 });
      steps.hooksScreen = await pipeline.run('screen', ctx, steps);

      /* 查重（初筛之后、补齐之前）：命中就跳过，省补齐和详情请求 */
      const dedupe = { checked: 0, kept: 0, skipped: 0, errors: [] };
      const pend = all("SELECT id, data FROM queue WHERE status = 'pending' LIMIT 20");
      for (const row of pend) {
        const it = jparse(row.data) || {};
        const host = String(it.targetSite || (Array.isArray(it.targets) && it.targets[0]) || '').toLowerCase();
        if (!host) continue;
        dedupe.checked++;
        let chk = { found: false, skip: false };
        try { chk = await targetService.checkDupe(host, it, null); }
        catch (e) { dedupe.errors.push({ id: row.id, error: String(e && e.message || e).slice(0, 120) }); }
        if (chk.found && chk.skip) {
          it.dupeSkipped = { host: host, kind: chk.kind, at: new Date().toISOString() };
          dedupe.skipped++;
          ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
            .run('skipped', JSON.stringify(Object.assign({}, it, { status: 'skipped' })), new Date().toISOString(), row.id);
        } else {
          it.dupePassedAt = new Date().toISOString();
          if (chk.found) it.dupeReview = { host: host, kind: chk.kind, title: chk.title, at: it.dupePassedAt };
          dedupe.kept++;
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(it), new Date().toISOString(), row.id);
        }
      }
      steps.dedupe = dedupe;
      steps.hooksDedupe = await pipeline.run('dedupe', ctx, steps);

      /* 终审：补齐之后看还缺什么，齐了才允许自动发；缺了转人工或按设置跳过 */
      const flow = flowConfig.read(ctx);
      const needIntro = flowConfig.on(flow, '必须有简介', false);
      const needSub = flowConfig.on(flow, '必须有副标题', false);
      const bdMode = String(flowConfig.value(flow, 'BDInfo', '不要求'));
      const shotMin = Math.max(0, Number(flowConfig.value(flow, '截图至少几张', 0)) || 0);
      const missMode = String(flowConfig.value(flow, '不满足时', '转待确认'));
      const reviewRows = all("SELECT id, status, data FROM queue WHERE status = 'pending' LIMIT 20");
      const review = { checked: reviewRows.length, ready: 0, hold: 0, skipped: 0, reasons: [] };
      for (const row of reviewRows) {
        const prep = deps.release ? deps.release.prepare(row.id, {}) : { ok: false };
        const cur = one('SELECT status, data FROM queue WHERE id = ?', row.id);
        const d = jparse(cur ? cur.data : row.data) || {};
        const p = (d.prepared) || {};
        const missing = [];
        if (needIntro && !String(d.intro || '').trim()) missing.push('简介');
        if (needSub && !String(d.subtitle || '').trim()) missing.push('副标题');
        if (shotMin > 0 && Number(p.shots || 0) < shotMin) missing.push('截图 ' + Number(p.shots || 0) + '/' + shotMin);
        if (bdMode !== '不要求' && !(p.media && p.media.kind)) missing.push('BDInfo');
        const t0 = (p.targets || [])[0] || null;
        if (!t0 || !t0.target) missing.push('目标站未就绪');
        else {
          if (!t0.target.fields || !t0.target.fields.type) missing.push('分类映射');
          if (t0.target.ready === false) missing.push('目标站未就绪');
        }
        d.review = { at: new Date().toISOString(), ok: missing.length === 0, missing: missing };
        let status = cur ? cur.status : row.status;
        if (!missing.length) {
          review.ready++;
          if (ctx.allowReal('realPublish')) status = 'approved';
        } else {
          review.hold++;
          if (missMode === '直接跳过') { status = 'skipped'; review.skipped++; }
          if (review.reasons.length < 5) review.reasons.push({ id: row.id, missing: missing });
        }
        d.status = status;
        ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
          .run(status, JSON.stringify(d), new Date().toISOString(), row.id);
      }
      steps.review = review;
      steps.hooksReview = await pipeline.run('review', ctx, steps);

      if (ctx.allowReal('realPublish')) {
        const rows = all("SELECT id, data FROM queue WHERE status = 'approved' LIMIT 5");
        let ok = 0, failed = 0;
        const errors = [];
        for (const row of rows) {
          const it = jparse(row.data) || {};
          if (!it.targetSite || !it.downloadUrl) continue;
          const r = await deps.publish.publishItem(row.id, { dryRun: false });
          if (r.ok) {
            ok++;
            resetSiteFail(it.targetSite || it.site);
            const cur = one('SELECT data FROM queue WHERE id = ?', row.id);
            const done = cur ? (jparse(cur.data) || null) : null;
            if (done) {
              for (const host of Object.keys(done.targetResults || {})) {
                const tr = done.targetResults[host] || {};
                if (tr.publishedTorrent && !tr.crossseed) {
                  try { await crossseed.run({ id: row.id, data: done }, host, {}); } catch (e) { /* 辅种失败不影响发布 */ }
                }
              }
            }
          }
          else {
            failed++;
            bumpSiteFail(it.targetSite || it.site, r.message || r.code);
            if (errors.length < 3) errors.push({ id: row.id, code: r.code, message: r.message });
          }
        }
        steps.publish = { checked: rows.length, ok: ok, failed: failed, errors: errors };
      } else {
        steps.publish = { skipped: 'realPublish off' };
      }

      steps.hooksPublish = await pipeline.run('publish', ctx, steps);

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
          if (r.ok) { ok++; resetSiteFail(it.targetSite || it.site); continue; }
          failed++;
          bumpSiteFail(it.targetSite || it.site, r.message || r.code);
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

      steps.hooksCrossseed = await pipeline.run('crossseed', ctx, steps);

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
        } catch (e2) { console.warn('[seedpod] scheduler notify failed:', e2 && e2.message ? e2.message : e2) }
      }
      save(Object.assign({}, s, { lastRunAt: Date.now(), lastResult: steps, lastError: '' }));
      return { ok: true, steps: steps };
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 300);
      if (ctx.notify) {
        try { await ctx.notify.send('scheduler.error', 'SEEDPOD 调度失败：' + msg); } catch (e2) { console.warn('[seedpod] scheduler error notify failed:', e2 && e2.message ? e2.message : e2) }
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

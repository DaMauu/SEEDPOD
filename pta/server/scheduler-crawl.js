/* 抓取阶段：站点轮转、间隔控制、失败计数；每个站从当前页翻到底或到窗口/失败为止。 */
function makeCrawlPhase() {
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  return async function runCrawlPhase(o) {
    const { db, one, all, jparse, crawl, allowReal, bumpSiteFail, resetSiteFail, want, sleepFn, logEvent } = o;
        const sleepFor = sleepFn || sleep;
        if (!want('crawl')) {
          return { skipped: 'step not selected' };
        } else if (allowReal('realCrawl')) {
          /* 站点轮转：优先级高的先跑；同优先级按上次抓取时间从早到晚，间隔没到的跳过 */
          const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
          const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
          const gapMs = Math.max(6, Math.min(Number(cfg.listInterval) || 10, 60)) * 1000;
          const stateRow = one("SELECT v FROM meta WHERE k = 'crawl-state'");
          const crawlState = JSON.parse(stateRow ? stateRow.v : 'null') || {};
          const nowMs = Date.now();
          const allSites = all('SELECT host, data FROM sites').map(function (r) { return Object.assign({}, jparse(r.data) || {}, { host: r.host }); })
            .filter(function (x) { return x && x.enabled !== false && x.host; })
            .map(function (x) {
              const rec = crawlState[x.host] || {};
              return Object.assign(x, { lastAt: Number(rec.lastAt) || 0, priority: Number(x.priority) || 0 });
            })
            .sort(function (a, b) { return (b.priority - a.priority) || (a.lastAt - b.lastAt) || a.host.localeCompare(b.host); });
          const due = allSites.filter(function (x) { return !x.lastAt || nowMs - x.lastAt >= gapMs; });
          const sites = due.slice(0, 10);
          let ok = 0, failed = 0, skipped = 0, added = 0, rows = 0, pages = 0;
          const BENIGN = /^(TOO_SOON|WINDOW_LIMIT|BUSY)$/;
          const readState = function () {
            const row = one("SELECT v FROM meta WHERE k = 'crawl-state'");
            return JSON.parse(row ? row.v : 'null') || {};
          };
          const saveState = function (st) {
            db.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
          };
          for (const x of sites) {
            const mode = (crawlState[x.host] && crawlState[x.host].fullDoneAt) ? 'incremental' : 'full';
            let siteOk = false, siteFailed = false, siteSkipped = false, endBy = '';
            let lastKey = '';
            for (let pageNo = 0; pageNo < 1000; pageNo++) {
              let r = null;
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  r = await crawl.crawlOnce(x.host, { limit: 100, detail: pageNo === 0 ? undefined : false });
                } catch (e) {
                  siteFailed = true;
                  bumpSiteFail(x.host, e && e.message ? e.message : '抓取异常');
                  break;
                }
                if (r && r.err && r.err.code === 'TOO_SOON') {
                  const waitMs = Number(r.err.extra && r.err.extra.waitMs) || gapMs;
                  await sleepFor(Math.max(100, waitMs + 250));
                  continue;
                }
                break;
              }
              if (siteFailed) break;
              if (!r) break;
              if (r.err) {
                endBy = r.err.code;
                if (BENIGN.test(r.err.code)) siteSkipped = true;
                else { siteFailed = true; bumpSiteFail(x.host, r.err.message || r.err.code); }
                break;
              }
              siteOk = true;
              pages++;
              added += Number(r.added) || 0;
              rows += Number(r.rows) || 0;
              resetSiteFail(x.host);
              const key = String(r.pageKey || '');
              if (pageNo > 0 && key && key === lastKey) { endBy = 'repeated-page'; break; }
              lastKey = key;
              if (mode === 'incremental' && Number(r.added) === 0) {
                endBy = 'no-new';
                if (logEvent) logEvent('info', '抓取', x.host + ' · 增量无新增，下一轮从第 1 页再查');
                break;
              }
              if (!Number(r.rows)) { endBy = 'end'; break; }
              await sleepFor(gapMs + 250);
            }
            /* 第一次抓完整个预设后标 fullDoneAt；之后增量：遇到 0 新增就停，并从第 1 页重开 */
            try {
              const st = readState();
              const rec = st[x.host] || {};
              if (mode === 'full' && endBy === 'end') {
                rec.fullDoneAt = new Date().toISOString();
                if (logEvent) logEvent('info', '抓取', x.host + ' · 全量完成，下一轮转增量');
              }
              if (mode === 'incremental') { rec.page = 0; rec.catIdx = 0; }
              st[x.host] = rec;
              saveState(st);
            } catch (e) { /* 状态写失败不影响本轮抓取 */ }
            if (siteOk) ok++;
            else if (siteFailed) failed++;
            else { siteSkipped = true; skipped++; }
          }
          return { sites: sites.length, ok: ok, failed: failed, skipped: skipped, waiting: allSites.length - due.length, added: added, rows: rows, pages: pages };
        } else {
          return { skipped: 'realCrawl off' };
        }
  };
}

module.exports = { makeCrawlPhase };

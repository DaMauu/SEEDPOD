/* 抓取阶段：站点轮转、间隔控制、失败计数。 */
function makeCrawlPhase() {
  return async function runCrawlPhase(o) {
    const { one, all, jparse, crawl, allowReal, bumpSiteFail, resetSiteFail, want } = o;
        if (!want('crawl')) {
          return { skipped: 'step not selected' };
        } else if (allowReal('realCrawl')) {
          /* 站点轮转：优先级高的先跑；同优先级按上次抓取时间从早到晚，间隔没到的跳过 */
          const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
          const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
          const gapMs = Math.max(8, Math.min(Number(cfg.interval) || 60, 600)) * 1000;
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
          let ok = 0, failed = 0, skipped = 0;
          const BENIGN = /^(TOO_SOON|WINDOW_LIMIT|DAILY_LIMIT|BUSY)$/;
          for (const x of sites) {
            try {
              const r = await crawl.crawlOnce(x.host, { limit: 100 });
              if (r && r.err) {
                if (BENIGN.test(r.err.code)) skipped++;
                else { failed++; bumpSiteFail(x.host, r.err.message || r.err.code); }
              } else { ok++; resetSiteFail(x.host); }
            } catch (e) { failed++; bumpSiteFail(x.host, e && e.message ? e.message : '抓取异常'); }
          }
          return { sites: sites.length, ok: ok, failed: failed, skipped: skipped, waiting: allSites.length - due.length };
        } else {
          return { skipped: 'realCrawl off' };
        }
  };
}

module.exports = { makeCrawlPhase };

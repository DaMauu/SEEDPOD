/* 调度器：按固定间隔跑抓取 → 送审 → 终审 → 发布；默认关，真抓/真发仍受各自开关约束。 */
const flowConfig = require('./flow-config');
const errors = require('./errors');
const { makeCrossseed } = require('./crossseed');
const pipeline = require('./pipeline');
const { makeTarget } = require('./target');
const { makeTargetService } = require('./target-service');
const { makeMetaFill } = require('./meta-fill');
const { makePublishPhase } = require('./scheduler-publish');
const { makeRetryPhases } = require('./scheduler-retry');
const { makeSchedulerState } = require('./scheduler-state');
const { makeCrawlPhase } = require('./scheduler-crawl');
const { makeScreenPhase } = require('./scheduler-screen');
function makeScheduler(ctx, deps) {
  const { one, all, jparse } = ctx;
  const crossseed = makeCrossseed(ctx);
  const target = makeTarget(ctx);
  const targetService = makeTargetService(ctx, target);
  const metaFill = makeMetaFill(ctx);
  let timer = null;
  let running = false;
  const schedulerState = makeSchedulerState({ one: one, jparse: jparse, db: ctx.db, isRunning: function () { return running; } });
  const { read, save, status, set, readFails, saveFails, bumpSiteFail, resetSiteFail } = schedulerState;

  const runCrawlPhase = makeCrawlPhase();
  const runScreenPhase = makeScreenPhase();
  const runPublishPhase = makePublishPhase({});
  const { runCrossseedPhase, runRetryPhase } = makeRetryPhases();
  async function runNow(opts) {
    if (running) return { ok: false, error: '上一轮还没跑完' };
    running = true;
    const startedAt = new Date().toISOString();
    const steps = { startedAt: startedAt, crawl: null, screen: null, publish: null, retry: null, errors: [] };
    const only = opts && Array.isArray(opts.steps) && opts.steps.length ? opts.steps : null;
    const want = function (name) { return !only || only.indexOf(name) >= 0; };
    const batch = Math.max(1, Math.min(20, Number(opts && opts.batchLimit) || 20));
    const screenLimit = Math.max(1, Math.min(200, Number(opts && opts.screenLimit) || 200));
    const publishLimit = Math.max(1, Math.min(5, Number(opts && opts.publishLimit) || 5));
    const s = read();
    const failStep = process.env.NODE_ENV === 'test' ? String(process.env.SEEDPOD_FAIL_STEP || '').toLowerCase() : '';
    const phaseError = function (name, e) {
      const msg = String(e && e.message || e).slice(0, 300);
      const code = errors.normalize(String(e && e.code || 'PHASE_EXCEPTION').slice(0, 80));
      steps.errors.push({ phase: name, code: code, message: msg, at: new Date().toISOString() });
      if (!steps[name] || typeof steps[name] !== 'object') steps[name] = {};
      steps[name].error = msg;
      steps[name].errorCode = code;
      if (/SQLITE|constraint|database|disk I\/O/i.test(code + ' ' + msg)) throw e;
    };
    const failpoint = function (name) {
      if (!failStep || failStep !== name) return;
      const e = new Error('failpoint ' + name);
      e.code = 'FAILPOINT';
      throw e;
    };
    try {
      try {
      failpoint('crawl');
      steps.crawl = await runCrawlPhase({ one: one, all: all, jparse: jparse, crawl: deps.crawl, allowReal: ctx.allowReal, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail, want: want });
      steps.hooksCrawl = await pipeline.run('crawl', ctx, steps);
      } catch (e) { phaseError('crawl', e); }

      try {
      failpoint('screen');
      const screenPhase = await runScreenPhase({ want: want, screen: deps.screen, ctx: ctx, screenLimit: screenLimit, pipeline: pipeline, steps: steps });
      steps.screen = screenPhase.screen;
      steps.hooksScreen = screenPhase.hooks;
      } catch (e) { phaseError('screen', e); }

      /* 查重（初筛之后、补齐之前）：逐目标站检查，命中就跳过该站 */
      try {
      failpoint('dedupe');
      const dedupe = { checked: 0, kept: 0, skipped: 0, errors: [], skippedStep: false, disabled: false, requests: 0 };
      const dedupeLimit = batch;
      const pend = want('dedupe') ? all("SELECT id, data FROM queue WHERE status = 'pending' LIMIT " + dedupeLimit) : [];
      if (!want('dedupe')) dedupe.skippedStep = true;
      let stopDedupe = false;
      for (const row of pend) {
        const it = jparse(row.data) || {};
        const hosts = [];
        [it.targetSite].concat(Array.isArray(it.targets) ? it.targets : []).forEach(function (h) {
          h = String(h || '').trim().toLowerCase();
          if (h && hosts.indexOf(h) < 0) hosts.push(h);
        });
        if (!hosts.length) continue;
        dedupe.checked++;
        it.dupeResults = it.dupeResults || {};
        let anyOpen = false;
        for (const host of hosts) {
          /* 本轮之前查过且可发：不重复请求目标站 */
          const prev = it.dupeResults[host];
          if (it.dupePassedAt && prev && !prev.skip) { anyOpen = true; continue; }
          let chk = { found: false, skip: false };
          dedupe.requests++;
          try { chk = await targetService.checkDupe(host, it, null); resetSiteFail(host); }
          catch (e) {
            const emsg = String(e && e.message || e).slice(0, 120);
            dedupe.errors.push({ id: row.id, host: host, error: emsg });
            bumpSiteFail(host, '查重失败：' + emsg);
            it.dedupeAttempts = (Number(it.dedupeAttempts) || 0) + 1;
            it.dedupeLastAttemptAt = new Date().toISOString();
            it.dedupeLastErrorCode = e && e.code ? String(e.code) : 'TARGET_UNREACHABLE';
            it.dedupeLastError = emsg;
            it.dedupeNextRetryAt = new Date(Date.now() + 15 * 60000).toISOString();
            anyOpen = true; continue;
          }
          if (chk.disabled) { dedupe.disabled = true; anyOpen = true; continue; }
          delete it.dedupeLastError;
          delete it.dedupeLastErrorCode;
          delete it.dedupeNextRetryAt;
          it.dupeResults[host] = { found: !!chk.found, skip: !!chk.skip, kind: chk.kind || '', at: new Date().toISOString() };
          if (chk.found && chk.skip) continue;
          anyOpen = true;
        }
        if (stopDedupe) break;
        if (!anyOpen) {
          it.dupeSkipped = { at: new Date().toISOString(), hosts: hosts };
          dedupe.skipped++;
          ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
            .run('skipped', JSON.stringify(Object.assign({}, it, { status: 'skipped' })), new Date().toISOString(), row.id);
        } else {
          it.dupePassedAt = new Date().toISOString();
          dedupe.kept++;
          ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(it), new Date().toISOString(), row.id);
        }
      }
      steps.dedupe = dedupe;
      steps.hooksDedupe = await pipeline.run('dedupe', ctx, steps);
      } catch (e) { phaseError('dedupe', e); }

      /* 终审：补齐之后看还缺什么，齐了才允许自动发；缺了转人工或按设置跳过 */
      try {
      failpoint('review');
      const flow = flowConfig.read(ctx);
      const titleOn = flowConfig.on(flow, '标题原样回填', true);
      const subOn = flowConfig.on(flow, '副标题拼贴', true);
      const introOn = flowConfig.on(flow, '简介回填', true);
      const needIntro = flowConfig.on(flow, '必须有简介', true);
      const needSub = flowConfig.on(flow, '必须有副标题', true);
      const bdOn = flowConfig.onLegacy(flow, 'BDInfo', true, function (v) { return String(v) === '不要求' ? false : true; });
      const shotOn = flowConfig.onLegacy(flow, '截图至少几张', true, function (v) { return Number(v) > 0; });
      const yearOn = flowConfig.on(flow, '年份必须一致', true);
      const reviewRows = want('review') ? all("SELECT id, status, data FROM queue WHERE status = 'pending' LIMIT " + batch) : [];
      const review = { checked: reviewRows.length, ready: 0, hold: 0, skipped: 0, reasons: [], skippedStep: !want('review'), filled: 0, detailFetched: 0 };
      let fillTries = 0, detailTries = 0;
      for (const row of reviewRows) {
        const pre = jparse(row.data) || {};
        /* 缺源站 BBCode 简介：回源站详情页取一次，每轮最多 2 条、间隔 6 秒 */
        if (!String(pre.descrBb || '').trim() && pre.detailsUrl && pre.site && detailTries < 2) {
          const srow = one('SELECT data FROM sites WHERE host = ?', String(pre.site).toLowerCase());
          const sd = srow ? (jparse(srow.data) || null) : null;
          if (!sd || sd.enabled !== false) {
            if (detailTries > 0) await new Promise(function (r) { setTimeout(r, 6000); });
            detailTries++;
            let di = null;
            try { di = await target.fetchDetailsInfo(pre.site, pre.detailsUrl); } catch (e) { di = null; }
            if (di && di.ok && di.data) {
              const dd = di.data;
              if (dd.descrBb) { pre.descrBb = dd.descrBb; pre.intro = dd.descrBb; }
              if (dd.descr) pre.descr = dd.descr;
              if (dd.subtitle && !pre.subtitle) pre.subtitle = dd.subtitle;
              if (dd.tags && !pre.tags) pre.tags = dd.tags;
              if (dd.region && !pre.region) pre.region = dd.region;
              if (dd.language && !pre.language) pre.language = dd.language;
              if (dd.bdinfo) pre.bdinfo = dd.bdinfo;
              if (dd.mediainfo) pre.mediainfo = dd.mediainfo;
              if (dd.sizeBytes && !pre.sizeBytes) { pre.sizeBytes = dd.sizeBytes; pre.size = dd.sizeText || pre.size; }
              pre.detailAt = new Date().toISOString();
              review.detailFetched++;
              ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
                .run(JSON.stringify(pre), new Date().toISOString(), row.id);
            }
          }
        }
        /* 副标题/简介开关打开时，统一从豆影拉一次；每轮最多 5 条 */
        if ((subOn || introOn) && !pre.metaAt && fillTries < 5) {
          fillTries++;
          const fr = await metaFill.fillMeta(pre);
          if (fr.ok) {
            review.filled++;
            delete pre.metaLastError;
            delete pre.metaLastErrorCode;
            delete pre.metaNextRetryAt;
            ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(pre), new Date().toISOString(), row.id);
          } else if (fr.code !== 'RULE_OFF') {
            pre.metaAttempts = (Number(pre.metaAttempts) || 0) + 1;
            pre.metaLastAttemptAt = new Date().toISOString();
            pre.metaLastErrorCode = String(fr.code || 'UNKNOWN');
            pre.metaLastError = String(fr.code || 'META_FAILED');
            pre.metaNextRetryAt = new Date(Date.now() + 15 * 60000).toISOString();
            ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(pre), new Date().toISOString(), row.id);
          }
        }
        if (pre.downloadUrl && !pre.sourceTitleAt) {
          const ft = await targetService.fillSourceTitle(pre);
          if (ft.ok) {
            ctx.db.prepare('UPDATE queue SET title = ?, data = ?, updated_at = ? WHERE id = ?')
              .run(ft.title, JSON.stringify(pre), new Date().toISOString(), row.id);
          }
        }
        const prep = deps.release ? deps.release.prepare(row.id, {}) : { ok: false };
        const cur = one('SELECT status, data FROM queue WHERE id = ?', row.id);
        const d = jparse(cur ? cur.data : row.data) || {};
        const p = (d.prepared) || {};
        const missing = [];
        if (!d.dupePassedAt) missing.push('查重未完成');
        if (!titleOn || !String(d.title || '').trim()) missing.push('标题');
        if (!subOn || !String(d.cn || d.subtitle || '').trim()) missing.push('副标题');
        if (needIntro && !String(d.intro || d.descrBb || '').trim()) missing.push('简介');
        if (needSub && !String(d.cn || d.subtitle || '').trim() && missing.indexOf('副标题') < 0) missing.push('副标题');
        if (bdOn && !(p.media && p.media.kind)) missing.push('BDInfo');
        if (shotOn) {
          const srcImgs = Array.isArray(d.sourceImages) ? d.sourceImages : [];
          const text = String(d.descrBb || d.intro || '');
          if (srcImgs.some(function (u) { return text.indexOf(u) < 0; })) missing.push('截图未保留');
        }
        if (yearOn && d.year && d.meta && d.meta.year && Number(d.meta.year) > Number(d.year) + 2) missing.push('年份不一致');
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
          if (review.reasons.length < 5) review.reasons.push({ id: row.id, missing: missing });
        }
        d.status = status;
        ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
          .run(status, JSON.stringify(d), new Date().toISOString(), row.id);
      }
      steps.review = review;
      steps.hooksReview = await pipeline.run('review', ctx, steps);
      } catch (e) { phaseError('review', e); }

      try {
      failpoint('publish');
      if (want('publish') && ctx.allowReal('realPublish')) {
        steps.publish = await runPublishPhase({ one: one, all: all, jparse: jparse, deps: deps, targetService: targetService, crossseed: crossseed, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail, publishLimit: publishLimit });
      } else {
        steps.publish = { skipped: want('publish') ? 'realPublish off' : 'step not selected' };
      }

      steps.hooksPublish = await pipeline.run('publish', ctx, steps);
      } catch (e) { phaseError('publish', e); }

      /* 辅种重试：已发布但辅种没成功（源数据没下完、tracker 没起来）的，按 retryAt 再试 */
      try {
      failpoint('crossseed');
      steps.crossseedRetry = await runCrossseedPhase({ all: all, jparse: jparse, crossseed: crossseed, want: want, ctx: ctx });
      } catch (e) { phaseError('crossseed', e); }

      try {
      failpoint('retry');
      steps.retry = await runRetryPhase({ one: one, all: all, jparse: jparse, ctx: ctx, deps: deps, crossseed: crossseed, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail });
      } catch (e) { phaseError('retry', e); }

      try { failpoint('crossseed'); steps.hooksCrossseed = await pipeline.run('crossseed', ctx, steps); } catch (e) { phaseError('crossseed', e); }

      const crawlFail = (steps.crawl && steps.crawl.failed) || 0;
      const pubFail = (steps.publish && steps.publish.failed) || 0;
      const retryFail = (steps.retry && steps.retry.failed) || 0;
      const selected = (steps.screen && steps.screen.selected) || 0;
      const phaseFail = steps.errors.length;
      const firstErr = phaseFail ? steps.errors[0] : null;
      if (ctx.notify) {
        try {
          if (crawlFail || pubFail || retryFail || phaseFail) {
            const extra = phaseFail ? ' · 阶段失败 ' + phaseFail + (firstErr ? '（' + firstErr.phase + '/' + firstErr.code + '）' : '') : '';
            await ctx.notify.send('scheduler.error', 'SEEDPOD 调度：抓取失败 ' + crawlFail + ' · 送审入选 ' + selected + ' · 发布失败 ' + pubFail + ' · 重试失败 ' + retryFail + extra, { steps: steps });
          } else if (ctx.notify.status().events === 'always') {
            await ctx.notify.send('scheduler.run', 'SEEDPOD 调度完成：送审入选 ' + selected, { steps: steps });
          }
        } catch (e2) { console.warn('[seedpod] scheduler notify failed:', e2 && e2.message ? e2.message : e2) }
      }
      const phaseErrorText = phaseFail ? ('部分阶段失败：' + firstErr.phase + '/' + firstErr.code + ' ' + firstErr.message).slice(0, 400) : '';
      save(Object.assign({}, s, { lastRunAt: Date.now(), lastResult: steps, lastError: phaseErrorText }));
      return { ok: true, partial: phaseFail > 0, steps: steps };
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

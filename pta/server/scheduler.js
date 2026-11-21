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
const { makeDedupePhase } = require('./scheduler-dedupe');
const { makeReviewPhase } = require('./scheduler-review');
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
  const runDedupePhase = makeDedupePhase();
  const runReviewPhase = makeReviewPhase({ one: one, all: all, jparse: jparse, target: target, targetService: targetService, metaFill: metaFill, release: deps.release });
  const runPublishPhase = makePublishPhase({});
  const { runCrossseedPhase, runRetryPhase } = makeRetryPhases();
  async function runNow(opts) {
    if (running) return { ok: false, error: '上一轮还没跑完' };
    running = true;
    const startedAt = new Date().toISOString();
    if (ctx.logEvent) ctx.logEvent('info', '调度', '开始一轮' + (opts && Array.isArray(opts.steps) && opts.steps.length ? '（' + opts.steps.join('+') + '）' : ''));
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
      steps.crawl = await runCrawlPhase({ db: ctx.db, one: one, all: all, jparse: jparse, crawl: deps.crawl, allowReal: ctx.allowReal, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail, want: want, logEvent: ctx.logEvent });
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
      const dedupePhase = await runDedupePhase({ want: want, all: all, jparse: jparse, targetService: targetService, ctx: ctx, batch: batch, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail, pipeline: pipeline, steps: steps, force: !!(only && only.indexOf('dedupe') >= 0) });
      steps.dedupe = dedupePhase.dedupe;
      steps.hooksDedupe = dedupePhase.hooks;
      } catch (e) { phaseError('dedupe', e); }

      /* 终审：补齐之后看还缺什么，齐了才允许自动发；缺了转人工或按设置跳过 */
      try {
      failpoint('review');
      steps.review = await runReviewPhase({ want: want, batch: batch, ctx: ctx });
      steps.hooksReview = await pipeline.run('review', ctx, steps);
      } catch (e) { phaseError('review', e); }

      try {
      failpoint('publish');
      if (want('publish') && ctx.allowReal('realPublish')) {
        steps.publish = await runPublishPhase({ one: one, all: all, jparse: jparse, db: ctx.db, ctx: ctx, deps: deps, targetService: targetService, crossseed: crossseed, bumpSiteFail: bumpSiteFail, resetSiteFail: resetSiteFail, publishLimit: publishLimit });
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
      const heldOld = (steps.publish && steps.publish.heldOld) || 0;
      const retryFail = (steps.retry && steps.retry.failed) || 0;
      const selected = (steps.screen && steps.screen.selected) || 0;
      const phaseFail = steps.errors.length;
      const firstErr = phaseFail ? steps.errors[0] : null;
      if (ctx.notify) {
        try {
          if (crawlFail || pubFail || retryFail || phaseFail || heldOld) {
            const extra = phaseFail ? ' · 阶段失败 ' + phaseFail + (firstErr ? '（' + firstErr.phase + '/' + firstErr.code + '）' : '') : '';
            if (heldOld) extra += ' · 源种超 24h 未完成 ' + heldOld;
            await ctx.notify.send('scheduler.error', 'SEEDPOD 调度：抓取失败 ' + crawlFail + ' · 送审入选 ' + selected + ' · 发布失败 ' + pubFail + ' · 重试失败 ' + retryFail + extra, { steps: steps });
          } else if (ctx.notify.status().events === 'always') {
            await ctx.notify.send('scheduler.run', 'SEEDPOD 调度完成：送审入选 ' + selected, { steps: steps });
          }
        } catch (e2) { console.warn('[seedpod] scheduler notify failed:', e2 && e2.message ? e2.message : e2) }
      }
      if (ctx.logEvent) {
        steps.errors.forEach(function (x) { ctx.logEvent('error', '调度', '阶段失败 · ' + x.phase + '/' + x.code + ' ' + String(x.message || '').slice(0, 160)); });
        const c = steps.crawl || {};
        const sc = steps.screen || {};
        const rv = steps.review || {};
        const pb = steps.publish || {};
        const bits = [];
        if (c.skipped) bits.push('抓取跳过（' + c.skipped + '）');
        else bits.push('抓取 ' + (Number(c.sites) || 0) + ' 站 / ' + (Number(c.pages) || 0) + ' 页（新增 ' + (Number(c.added) || 0) + ' / 失败 ' + (Number(c.failed) || 0) + ' / 等待 ' + (Number(c.waiting) || 0) + '）');
        if (!sc.skipped) bits.push('初筛 ' + (Number(sc.selected) || 0));
        if (!rv.skippedStep) bits.push('终审 ready ' + (Number(rv.ready) || 0) + ' / hold ' + (Number(rv.hold) || 0));
        if (pb && pb.published !== undefined) bits.push('发布 ' + (Number(pb.published) || 0));
        ctx.logEvent(phaseFail ? 'warn' : 'info', '调度', (phaseFail ? '部分失败 · ' : '完成 · ') + bits.join(' · '));
      }
      const phaseErrorText = phaseFail ? ('部分阶段失败：' + firstErr.phase + '/' + firstErr.code + ' ' + firstErr.message).slice(0, 400) : '';
      save(Object.assign({}, s, { lastRunAt: Date.now(), lastResult: steps, lastError: phaseErrorText }));
      return { ok: true, partial: phaseFail > 0, steps: steps };
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 300);
      if (ctx.logEvent) ctx.logEvent('error', '调度', '失败 · ' + msg.slice(0, 160));
      if (ctx.notify) {
        try { await ctx.notify.send('scheduler.error', 'SEEDPOD 调度失败：' + msg); } catch (e2) { console.warn('[seedpod] scheduler error notify failed:', e2 && e2.message ? e2.message : e2) }
      }
      /* 失败落库本身也可能失败（磁盘/SQLite），不能让它再抛出把 finally 之外的调用方打崩 */
      try { save(Object.assign({}, s, { lastRunAt: Date.now(), lastError: msg })); }
      catch (e2) { console.warn('[seedpod] scheduler save failed:', e2 && e2.message ? e2.message : e2); }
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

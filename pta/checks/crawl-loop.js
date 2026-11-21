/* 抓取阶段：第一次全量翻到底，之后增量遇到 0 新增就停；用假 crawl 验证。 */
const { makeCrawlPhase } = require('../server/scheduler-crawl');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

function harness(pages) {
  const state = { box: {} };
  const seen = [];
  let calls = 0;
  const one = function (sql) {
    if (sql.indexOf("k = 'config'") >= 0) return { v: JSON.stringify({ listInterval: 6 }) };
    if (sql.indexOf("k = 'crawl-state'") >= 0) return { v: JSON.stringify(state.box) };
    return null;
  };
  const db = { prepare: function () { return { get: function () { return null; }, run: function (v) { state.box = JSON.parse(v); } }; } };
  const all = function (sql) {
    return sql.indexOf('FROM sites') >= 0 ? [{ host: 'a.example', data: JSON.stringify({ enabled: true }) }] : [];
  };
  const crawl = {
    crawlOnce: async function (host, opts) {
      seen.push({ detail: opts.detail });
      return pages[calls++];
    }
  };
  return {
    state: state, seen: seen,
    calls: function () { return calls; },
    run: function (extra) {
      return makeCrawlPhase()(Object.assign({
        db: db, one: one, all: all, jparse: JSON.parse, crawl: crawl, allowReal: function () { return true; },
        bumpSiteFail: function () {}, resetSiteFail: function () {}, want: function () { return true; },
        sleepFn: function () { return Promise.resolve(); }
      }, extra || {}));
    }
  };
}

(async function () {
  await check('第一次全量：翻到 0 条为止并记 fullDoneAt', async function () {
    const h = harness([
      { rows: 2, page: 1, added: 5, updated: 0 },
      { rows: 2, page: 2, added: 3, updated: 1 },
      { rows: 0, page: 3, added: 0, updated: 0 }
    ]);
    const r = await h.run();
    need(r.ok === 1 && r.pages === 3, '全量页数不对：' + JSON.stringify(r));
    need(h.calls() === 3, 'crawlOnce 调用次数不对：' + h.calls());
    need(h.state.box['a.example'] && h.state.box['a.example'].fullDoneAt, 'fullDoneAt 没写：' + JSON.stringify(h.state.box));
    need(h.seen[0].detail === undefined && h.seen[1].detail === false && h.seen[2].detail === false, '详情开关不对：' + JSON.stringify(h.seen));
  });

  await check('第二次增量：遇到 0 新增就停，游标回第 1 页', async function () {
    const h = harness([
      { rows: 5, page: 1, added: 2, updated: 3 },
      { rows: 5, page: 2, added: 0, updated: 5 },
      { rows: 5, page: 3, added: 9, updated: 0 }
    ]);
    h.state.box['a.example'] = { fullDoneAt: new Date().toISOString(), page: 4, catIdx: 0 };
    const r = await h.run();
    need(r.ok === 1 && r.pages === 2, '增量页数不对：' + JSON.stringify(r));
    need(h.calls() === 2, '增量不该继续翻：' + h.calls());
    need(h.state.box['a.example'].page === 0, '增量后游标没归零：' + JSON.stringify(h.state.box));
  });

  await check('站点把页码夹在最后一页时，重复页会停', async function () {
    const h = harness([
      { rows: 5, page: 1, added: 1, updated: 0, pageKey: '1|5|5' },
      { rows: 5, page: 2, added: 1, updated: 0, pageKey: '1|5|5' },
      { rows: 5, page: 3, added: 1, updated: 0, pageKey: '9|9|5' }
    ]);
    const r = await h.run();
    need(r.ok === 1 && r.pages === 2, '重复页应停在第 2 页：' + JSON.stringify(r));
    need(h.calls() === 2, '重复页后还在请求：' + h.calls());
    need(!h.state.box['a.example'].fullDoneAt, '重复页不该标全量完成');
  });

  await check('连续失败停站计数仍生效', async function () {
    let fail = 0;
    const h = harness([{ err: { code: 'CRAWL_HTTP_403', message: '403' } }]);
    const r = await h.run({ bumpSiteFail: function () { fail++; } });
    need(r.failed === 1, '失败站数不对：' + JSON.stringify(r));
    need(fail === 1, '失败计数没上报：' + fail);
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

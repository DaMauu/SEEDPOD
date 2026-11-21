/* 调度重试阶段：retryMax、nextRetryAt 退避、成功后清理重试标记。 */
const { makeRetryPhases } = require('../server/scheduler-retry');

const store = {
  q_ok: { id: 'q_ok', status: 'failed', retries: 0, nextRetryAt: '' },
  q_wait: { id: 'q_wait', status: 'failed', retries: 1, nextRetryAt: new Date(Date.now() + 3600000).toISOString() },
  q_max: { id: 'q_max', status: 'failed', retries: 2, nextRetryAt: '' },
  q_fail: { id: 'q_fail', status: 'failed', retries: 0, nextRetryAt: '' }
};
const published = [];
const ctx = {
  allowReal: function () { return true; },
  db: {
    prepare: function (sql) {
      return {
        run: function () {
          const args = Array.prototype.slice.call(arguments);
          if (/^UPDATE queue SET data = \?/i.test(String(sql).trim())) {
            const id = String(args[args.length - 1]);
            store[id] = JSON.parse(args[0]);
          }
        }
      };
    }
  }
};
const config = { retryMax: 2, retryBackoffMin: 15 };
const deps = {
  publish: {
    publishItem: async function (id) {
      published.push(id);
      return id === 'q_fail' ? { ok: false, code: 'QB_ADD_FAILED', message: 'qB 失败' } : { ok: true };
    }
  }
};
const phase = makeRetryPhases().runRetryPhase;
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function o() {
  return {
    one: function (sql, ...a) {
      if (/FROM meta WHERE k = 'config'/.test(sql)) return { v: JSON.stringify(config) };
      if (/FROM queue WHERE id = \?/.test(sql)) return { data: JSON.stringify(store[a[0]]) };
      return null;
    },
    all: function (sql) {
      if (/FROM queue WHERE status = 'failed'/.test(sql)) return Object.keys(store).map(function (id) { return { id: id, data: JSON.stringify(store[id]) }; });
      return [];
    },
    jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
    ctx: ctx,
    deps: deps,
    crossseed: { run: async function () { return { ok: true }; } },
    bumpSiteFail: function () {},
    resetSiteFail: function () {}
  };
}

(async function () {
  await check('retryMax 和 nextRetryAt 未到期的条目跳过', async function () {
    published.length = 0;
    const r = await phase(o());
    need(r.checked === 4, '检查数不对：' + JSON.stringify(r));
    need(r.skipped === 2, '跳过数不对：' + JSON.stringify(r));
    need(published.indexOf('q_wait') < 0 && published.indexOf('q_max') < 0, '未到期/超限仍重试：' + JSON.stringify(published));
    need(published.indexOf('q_ok') >= 0 && published.indexOf('q_fail') >= 0, '应重试的没重试：' + JSON.stringify(published));
  });

  await check('成功后清掉重试标记', async function () {
    const d = store.q_ok;
    need(d.retries === undefined && d.nextRetryAt === undefined && d.retryMsg === undefined && d.stageNextRetryAt === undefined, '成功没清标记：' + JSON.stringify(d));
  });

  await check('失败写回 retries/nextRetryAt/retryMsg 退避', async function () {
    const d = store.q_fail;
    need(Number(d.retries) === 1, 'retries 不对：' + d.retries);
    const at = Date.parse(d.nextRetryAt || '') || 0;
    need(at > Date.now() + 10 * 60000, 'nextRetryAt 没退避：' + d.nextRetryAt);
    need(/qB 失败/.test(String(d.retryMsg || '')), 'retryMsg 没写：' + d.retryMsg);
  });

  await check('达到 retryMax 后不再重试', async function () {
    published.length = 0;
    store.q_fail.nextRetryAt = new Date(Date.now() - 1000).toISOString();
    store.q_fail.retries = 2;
    const r = await phase(o());
    need(r.checked >= 1 && published.indexOf('q_fail') < 0, '超限仍重试：' + JSON.stringify({ r: r, p: published }));
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

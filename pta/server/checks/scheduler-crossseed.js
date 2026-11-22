/* 已发布条目辅种重试：只处理 targetResults 里已有 publishedTorrent 且未成功的站。 */
const { makeRetryPhases } = require('../scheduler-retry');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

function rowsFor() {
  return [
    { id: 'q_ok', data: JSON.stringify({ id: 'q_ok', targetResults: { 'a.example': { publishedTorrent: { id: 1 } } } }) },
    { id: 'q_done', data: JSON.stringify({ id: 'q_done', targetResults: { 'a.example': { publishedTorrent: { id: 2 }, crossseed: { ok: true } } } }) },
    { id: 'q_nopub', data: JSON.stringify({ id: 'q_nopub', targetResults: { 'a.example': { stage: 'injected' } } }) },
    { id: 'q_future', data: JSON.stringify({ id: 'q_future', targetResults: { 'a.example': { publishedTorrent: { id: 3 }, crossseed: { retryAt: new Date(Date.now() + 3600000).toISOString() } } } }) }
  ];
}
function deps(allow, calls) {
  return {
    all: function () { return rowsFor(); },
    jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
    want: function () { return true; },
    ctx: { allowReal: function () { return allow; } },
    crossseed: {
      run: async function (item, host) {
        calls.push(item.id + '@' + host);
        if (item.id === 'q_ok') return { ok: true };
        return { ok: false, error: 'fixture crossseed fail' };
      }
    }
  };
}

(async function () {
  const phases = makeRetryPhases();
  await check('realPublish 关闭时整段跳过', async function () {
    const calls = [];
    const r = await phases.runCrossseedPhase(deps(false, calls));
    need(r.skipped === 'realPublish off' && calls.length === 0, '没跳过：' + JSON.stringify({ r: r, calls: calls }));
  });
  await check('只对已发布且有目标站种子的条目辅种', async function () {
    const calls = [];
    const r = await phases.runCrossseedPhase(deps(true, calls));
    need(r.checked === 1 && r.ok === 1 && r.failed === 0, '统计不对：' + JSON.stringify(r));
    need(calls.length === 1 && calls[0] === 'q_ok@a.example', '调用不对：' + JSON.stringify(calls));
  });
  await check('失败只记录不中断，错误最多 3 条', async function () {
    const calls = [];
    const o = deps(true, calls);
    const rows = rowsFor();
    rows.push({ id: 'q_bad', data: JSON.stringify({ id: 'q_bad', targetResults: { 'a.example': { publishedTorrent: { id: 4 } } } }) });
    o.all = function () { return rows; };
    const r = await phases.runCrossseedPhase(o);
    need(r.checked === 2 && r.ok === 1 && r.failed === 1, '统计不对：' + JSON.stringify(r));
    need(r.errors.length === 1 && r.errors[0].id === 'q_bad' && r.errors[0].host === 'a.example', '错误记录不对：' + JSON.stringify(r.errors));
    need(calls.length === 2, '调用次数不对：' + calls.length);
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

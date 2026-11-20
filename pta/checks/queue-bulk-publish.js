/* 队列批量发布：部分成功不回滚成功项，失败限量；已提交/已注入目标站不重复上传。 */
const { runBulkPublish } = require('../server/queue-bulk-publish');

const items = {
  q_ok: { id: 'q_ok', targets: ['a.example', 'b.example'], targetResults: { 'a.example': { stage: 'submitted' } } },
  q_bad: { id: 'q_bad', targets: ['a.example', 'b.example'], targetResults: {} },
  q_nosrc: { id: 'q_nosrc', targets: ['a.example'], targetResults: {} },
  q_pubfail: { id: 'q_pubfail', targets: ['a.example', 'b.example'], targetResults: {} },
  q_inj: { id: 'q_inj', targets: ['a.example'], targetResults: { 'a.example': { stage: 'injected' } } },
  q_e1: { id: 'q_e1', targets: ['a.example'] },
  q_e2: { id: 'q_e2', targets: ['a.example'] },
  q_e3: { id: 'q_e3', targets: ['a.example'] },
  q_e4: { id: 'q_e4', targets: ['a.example'] },
  q_e5: { id: 'q_e5', targets: ['a.example'] }
};
const uploads = [];
const published = [];
const publisher = {
  ensureSource: async function (id) {
    if (/^q_e/.test(id) || id === 'q_nosrc') return { ok: false, code: 'SOURCE_INCOMPLETE', message: '源种没下完' };
    return { ok: true, complete: true };
  },
  publishItem: async function (id) {
    published.push(id);
    if (id === 'q_pubfail') return { ok: false, code: 'QB_ADD_FAILED', message: 'qB 加种失败' };
    return { ok: true };
  }
};
const targetService = {
  uploadMany: async function (body) {
    uploads.push({ queueId: body.queueId, targets: body.targets });
    if (body.queueId === 'q_bad') {
      return { ok: true, data: { targets: [
        { host: 'a.example', ok: true },
        { host: 'b.example', ok: false, code: 'UPLOAD_REJECTED', message: '目标站拒绝' }
      ] } };
    }
    return { ok: true, data: { targets: body.targets.map(function (h) { return { host: h, ok: true }; }) } };
  }
};
const ctx = {
  one: function (sql, id) { return items[id] ? { data: JSON.stringify(items[id]) } : undefined; },
  jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
  publisher: publisher,
  targetService: targetService,
  hostsOf: function (it) { return (it.targets || []).slice(); }
};
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

(async function () {
  await check('部分成功保留成功项，失败限量，未完成目标不重传', async function () {
    const ids = ['q_ok', 'q_bad', 'q_nosrc', 'q_pubfail', 'q_missing', 'q_e1', 'q_e2', 'q_e3', 'q_e4', 'q_e5'];
    const r = await runBulkPublish(ctx, ids);
    need(r.changed === 1, '成功数不对：' + r.changed);
    need(r.skipped === 9, '跳过数不对：' + r.skipped);
    need(r.errors.length === 3, '错误没限量：' + JSON.stringify(r.errors));
    need(r.errors[0].code === 'UPLOAD_REJECTED' && r.errors[1].code === 'SOURCE_INCOMPLETE' && r.errors[2].code === 'QB_ADD_FAILED', '错误顺序/码不对：' + JSON.stringify(r.errors));
    const okUp = uploads.filter(function (x) { return x.queueId === 'q_ok'; })[0];
    need(okUp && okUp.targets.length === 1 && okUp.targets[0] === 'b.example', '已提交目标被重复上传：' + JSON.stringify(okUp));
    const badUp = uploads.filter(function (x) { return x.queueId === 'q_bad'; })[0];
    need(badUp && badUp.targets.length === 2, '失败项没上传全部目标');
    need(!uploads.some(function (x) { return x.queueId === 'q_nosrc' || /^q_e/.test(x.queueId); }), '源种未完成仍上传');
    need(published.indexOf('q_ok') >= 0 && published.indexOf('q_pubfail') >= 0, '发布调用不对：' + JSON.stringify(published));
    need(published.indexOf('q_bad') < 0, '上传失败后仍发布');
  });

  await check('已注入目标站直接发布，不再上传', async function () {
    uploads.length = 0; published.length = 0;
    const r = await runBulkPublish(ctx, ['q_inj']);
    need(r.changed === 1 && r.skipped === 0, '结果不对：' + JSON.stringify(r));
    need(uploads.length === 0, '已注入目标仍上传：' + JSON.stringify(uploads));
    need(published[0] === 'q_inj', '没调用发布');
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

/* 调度发布：目标站未就绪在碰下载器/目标站之前拦下；重新 prepare 后下一轮恢复；错误最多 3 条。 */
const { makePublishPhase } = require('../server/scheduler-publish');

function row(id, ready) {
  return { id: id, data: JSON.stringify({ id: id, title: id, targetSite: 'a.example', downloadUrl: 'http://a.example/t',
    prepared: { targets: [{ host: 'a.example', target: { ready: ready, fields: { type: '1' } } }] } }) };
}
let currentRows = [];
const calls = { source: [], upload: [], publish: [] };
const phase = makePublishPhase();
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function reset() { calls.source.length = 0; calls.upload.length = 0; calls.publish.length = 0; }
function run() {
  return phase({
    one: function () { return null; },
    all: function () { return currentRows; },
    jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
    targetService: { uploadMany: async function (b) { calls.upload.push(b.queueId); return { ok: true, data: { targets: [{ host: b.targets[0], ok: true }] } }; } },
    deps: { publish: {
      ensureSource: async function (id) { calls.source.push(id); return id === 'q_slow' ? { ok: true, complete: false } : { ok: true, complete: true }; },
      publishItem: async function (id) { calls.publish.push(id); return { ok: true }; }
    } },
    crossseed: { run: async function () { return { ok: true }; } },
    bumpSiteFail: function () {}, resetSiteFail: function () {}, publishLimit: 20
  });
}

(async function () {
  await check('未就绪条目不碰源种/上传，记 TARGET_NOT_READY', async function () {
    reset();
    currentRows = [row('q_ready', false), row('q_slow', true)];
    const r = await run();
    need(r.checked === 2 && r.failed === 1, '计数不对：' + JSON.stringify(r));
    need(calls.source.indexOf('q_ready') < 0, '未就绪仍检查源种：' + JSON.stringify(calls.source));
    need(calls.upload.length === 0, '未就绪仍上传目标站：' + JSON.stringify(calls.upload));
    need(r.errors.length === 1 && r.errors[0].code === 'TARGET_NOT_READY', '错误码不对：' + JSON.stringify(r.errors));
    need(calls.source.length === 1 && calls.source[0] === 'q_slow' && r.held === 1, '就绪条目没继续：' + JSON.stringify({ src: calls.source, held: r.held }));
  });

  await check('重新 prepare 后下一轮调度自动恢复', async function () {
    reset();
    currentRows = [row('q_ready', true), row('q_slow', true)];
    const r = await run();
    need(r.ok === 1 && r.failed === 0, '恢复结果不对：' + JSON.stringify(r));
    need(calls.source.indexOf('q_ready') >= 0, '恢复后没检查源种：' + JSON.stringify(calls.source));
    need(calls.upload.indexOf('q_ready') >= 0, '恢复后没上传：' + JSON.stringify(calls.upload));
    need(calls.publish.indexOf('q_ready') >= 0, '恢复后没发布：' + JSON.stringify(calls.publish));
  });

  await check('调度发布错误最多 3 条', async function () {
    reset();
    currentRows = ['e1', 'e2', 'e3', 'e4', 'e5'].map(function (id) { return row(id, false); });
    const r = await run();
    need(r.checked === 5 && r.failed === 5, '计数不对：' + JSON.stringify(r));
    need(r.errors.length === 3 && r.errors.every(function (x) { return x.code === 'TARGET_NOT_READY'; }), '错误没限量：' + JSON.stringify(r.errors));
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

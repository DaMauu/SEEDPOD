/* 调度发布并发：同一条目只处理一次；held 每轮重新检查，完成后下一轮继续。 */
const { makePublishPhase } = require('../scheduler-publish');

const calls = { source: [], upload: [], publish: [] };
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function row(id, ready) {
  return { id: id, data: JSON.stringify({ id: id, title: id, targetSite: 'a.example', downloadUrl: 'http://a.example/t',
    prepared: { targets: [{ host: 'a.example', target: { ready: ready !== false, fields: { type: '1' } } }] } }) };
}
function reset() { calls.source.length = 0; calls.upload.length = 0; calls.publish.length = 0; }
function counts(list) {
  const m = {};
  list.forEach(function (x) { m[x] = (m[x] || 0) + 1; });
  return m;
}
let heldComplete = false;
function phaseWith(rows) {
  return makePublishPhase()({
    one: function (sql) {
      if (/FROM meta/.test(sql)) return { v: JSON.stringify({ concurrency: 4 }) };
      return null;
    },
    all: function () { return rows; },
    jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
    targetService: { uploadMany: async function (b) { calls.upload.push(b.queueId); await sleep(20); return { ok: true, data: { targets: [{ host: b.targets[0], ok: true }] } }; } },
    deps: { publish: {
      ensureSource: async function (id) { calls.source.push(id); await sleep(id === 'q_1' ? 30 : 5); return { ok: true, complete: id === 'q_held' ? heldComplete : true }; },
      publishItem: async function (id) { calls.publish.push(id); await sleep(10); return { ok: true }; }
    } },
    crossseed: { run: async function () { return { ok: true }; } },
    bumpSiteFail: function () {}, resetSiteFail: function () {}, publishLimit: 20
  });
}

(async function () {
  await check('并发处理同一批条目，每个 id 只处理一次', async function () {
    reset();
    const rows = ['q_1', 'q_2', 'q_3', 'q_4', 'q_5', 'q_6'].map(function (id) { return row(id); });
    const r = await phaseWith(rows);
    need(r.checked === 6 && r.ok === 6 && r.failed === 0, '计数不对：' + JSON.stringify(r));
    need(r.concurrency === 4, '并发数没按配置：' + r.concurrency);
    const src = counts(calls.source), pub = counts(calls.publish), up = counts(calls.upload);
    need(Object.keys(src).every(function (k) { return src[k] === 1; }), '源种检查重复：' + JSON.stringify(src));
    need(Object.keys(pub).every(function (k) { return pub[k] === 1; }), '发布重复：' + JSON.stringify(pub));
    need(Object.keys(up).every(function (k) { return up[k] === 1; }), '上传重复：' + JSON.stringify(up));
  });

  await check('held 每轮重查，源种完成后下一轮继续', async function () {
    reset();
    heldComplete = false;
    let r = await phaseWith([row('q_held')]);
    need(r.held === 1 && r.failed === 0 && calls.publish.length === 0, 'held 第一轮不对：' + JSON.stringify({ r: r, pub: calls.publish }));
    r = await phaseWith([row('q_held')]);
    need(r.held === 1 && calls.source.length === 2, 'held 第二轮没重查：' + JSON.stringify({ r: r, src: calls.source }));
    heldComplete = true;
    r = await phaseWith([row('q_held')]);
    need(r.ok === 1 && r.held === 0, '源种完成后没继续：' + JSON.stringify(r));
    need(calls.publish.length === 1 && calls.publish[0] === 'q_held', '完成后没发布：' + JSON.stringify(calls.publish));
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

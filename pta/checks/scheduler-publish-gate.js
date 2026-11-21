/* 调度发布：目标站未就绪在碰下载器/目标站之前拦下，记为 TARGET_NOT_READY。 */
const { makePublishPhase } = require('../server/scheduler-publish');

const rows = [
  { id: 'q_ready', data: JSON.stringify({ id: 'q_ready', title: 'ready', targetSite: 'a.example', downloadUrl: 'http://a.example/t', prepared: { targets: [{ host: 'a.example', target: { ready: false } }] } }) },
  { id: 'q_ok', data: JSON.stringify({ id: 'q_ok', title: 'ok', targetSite: 'a.example', downloadUrl: 'http://a.example/t', prepared: { targets: [{ host: 'a.example', target: { ready: true, fields: { type: '1' } } }] } }) }
];
const calls = { source: [], upload: [], publish: [] };
const phase = makePublishPhase();
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

(async function () {
  try {
    const r = await phase({
      one: function () { return null; },
      all: function () { return rows; },
      jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
      targetService: { uploadMany: async function (b) { calls.upload.push(b); return { ok: true, data: { targets: [{ host: b.targets[0], ok: true }] } }; } },
      deps: { publish: {
        ensureSource: async function (id) { calls.source.push(id); return id === 'q_ok' ? { ok: true, complete: false } : { ok: true, complete: true }; },
        publishItem: async function (id) { calls.publish.push(id); return { ok: true }; }
      } },
      crossseed: { run: async function () { return { ok: true }; } },
      bumpSiteFail: function () {},
      resetSiteFail: function () {},
      publishLimit: 10
    });
    await check('未就绪条目不碰源种/上传，记 TARGET_NOT_READY', async function () {
      need(r.checked === 2 && r.failed === 1, '计数不对：' + JSON.stringify(r));
      need(calls.source.indexOf('q_ready') < 0, '未就绪仍检查源种：' + JSON.stringify(calls.source));
      need(calls.upload.length === 0, '未就绪仍上传目标站：' + JSON.stringify(calls.upload));
      need(r.errors.length === 1 && r.errors[0].code === 'TARGET_NOT_READY', '错误码不对：' + JSON.stringify(r.errors));
    });
    await check('就绪条目继续到源种检查', async function () {
      need(calls.source.length === 1 && calls.source[0] === 'q_ok', '就绪条目没检查源种：' + JSON.stringify(calls.source));
      need(r.held === 1, '源种未完成没 held：' + r.held);
    });
  } finally { /* 无外部资源 */ }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

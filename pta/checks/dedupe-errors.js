/* 查重错误语义：目标站不可达/验证失败必须报错，不能当成“没有重复”。 */
const { makeServiceCommon } = require('../server/target-service-common');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

function svcWith(verify) {
  return makeServiceCommon({
    target: { verify: verify, fetchDetailsInfo: async function () { return { ok: false }; } },
    ctx: { one: function () { return null; }, all: function () { return []; }, jparse: JSON.parse, db: { prepare: function () { return { run: function () {} }; } } },
    DATA_DIR: '/tmp', now: function () { return ''; }, saveQueue: function () {}, preparedItem: function (x) { return x; }
  });
}

(async function () {
  await check('目标站 500/登录失效 → 报错，不当作没重复', async function () {
    const r = await svcWith(async function () { return { ok: false, code: 'LOGIN_REQUIRED', message: 'cookie 失效' }; })
      .checkDupe('t.example', { title: 'X 2024 1080p' });
    need(r.ok === false && r.code === 'LOGIN_REQUIRED', '应返回错误：' + JSON.stringify(r));
  });

  await check('目标站抛异常 → TARGET_UNREACHABLE', async function () {
    const r = await svcWith(async function () { throw new Error('ECONNREFUSED'); })
      .checkDupe('t.example', { title: 'X 2024 1080p' });
    need(r.ok === false && r.code === 'TARGET_UNREACHABLE', '应返回不可达：' + JSON.stringify(r));
  });

  await check('目标站正常但没搜到 → ok + found:false', async function () {
    const r = await svcWith(async function () { return { ok: true, data: { found: false } }; })
      .checkDupe('t.example', { title: 'X 2024 1080p' });
    need(r.ok === true && r.found === false, '应返回没找到：' + JSON.stringify(r));
  });

  await check('目标站搜到 → ok + found:true', async function () {
    const r = await svcWith(async function () { return { ok: true, data: { found: true, title: 'X 2024 1080p', detailsUrl: '' } }; })
      .checkDupe('t.example', { title: 'X 2024 1080p' });
    need(r.ok === true && r.found === true, '应返回找到：' + JSON.stringify(r));
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

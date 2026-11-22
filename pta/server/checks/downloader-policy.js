/* 下载器探测地址策略：默认拒内网，允许白名单/开发开关，黑名单优先。 */
const policy = require('../downloader-policy');
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function setEnv(k, v) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
const old = {
  allow: process.env.PTA_DOWNLOADER_ALLOW,
  deny: process.env.PTA_DOWNLOADER_DENY,
  priv: process.env.PTA_DOWNLOADER_ALLOW_PRIVATE
};

(async function () {
  try {
    await check('默认允许公网、拒绝内网/回环', async function () {
      setEnv('PTA_DOWNLOADER_ALLOW', undefined); setEnv('PTA_DOWNLOADER_DENY', undefined); setEnv('PTA_DOWNLOADER_ALLOW_PRIVATE', undefined);
      need((await policy.assertProbeUrl('http://8.8.8.8:8080')).ok === true, '公网被拒');
      const p = await policy.assertProbeUrl('http://192.168.1.5:8080');
      need(p.ok === false && p.code === 'DOWNLOADER_PRIVATE_BLOCKED', '内网没拦住：' + JSON.stringify(p));
      need((await policy.assertProbeUrl('http://127.0.0.1:8080')).ok === false, '回环没拦住');
    });
    await check('白名单可放行内网，黑名单优先', async function () {
      setEnv('PTA_DOWNLOADER_ALLOW', '192.168.1.0/24'); setEnv('PTA_DOWNLOADER_DENY', '192.168.1.9');
      need((await policy.assertProbeUrl('http://192.168.1.5:8080')).ok === true, '白名单没放行');
      const d = await policy.assertProbeUrl('http://192.168.1.9:8080');
      need(d.ok === false && d.code === 'DOWNLOADER_DENIED', '黑名单没优先：' + JSON.stringify(d));
    });
    await check('开发开关可放开所有内网', async function () {
      setEnv('PTA_DOWNLOADER_ALLOW', undefined); setEnv('PTA_DOWNLOADER_DENY', undefined); setEnv('PTA_DOWNLOADER_ALLOW_PRIVATE', '1');
      need((await policy.assertProbeUrl('http://127.0.0.1:8080')).ok === true, '开发开关没生效');
    });
  } finally {
    setEnv('PTA_DOWNLOADER_ALLOW', old.allow); setEnv('PTA_DOWNLOADER_DENY', old.deny); setEnv('PTA_DOWNLOADER_ALLOW_PRIVATE', old.priv);
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

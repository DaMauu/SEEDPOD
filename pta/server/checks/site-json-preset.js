/* 站点预设 JSON 检查：不打印站名/网址；确认没有 cookie 明文、没有 settings、网址是 Base64。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function read(file) { return JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'pack', file), 'utf8')); }
function decode(v) {
  const s = String(v || '');
  if (!s.startsWith('b64:')) return '';
  try { return Buffer.from(s.slice(4), 'base64').toString('utf8'); } catch (e) { return ''; }
}

(async function () {
  const sitesDoc = read('sites.preset.json');
  const urlsDoc = read('site-urls.preset.json');
  const cookiesDoc = read('cookies.example.json');
  const sites = sitesDoc.sites || {};
  const urls = urlsDoc.sites || {};
  const cookies = cookiesDoc.cookies || {};
  const hosts = Object.keys(sites);

  await check('预设站点、网址、cookie 模板 host 一致', async function () {
    need(hosts.length >= 1, 'sites.preset.json 没有站点');
    need(Object.keys(urls).length === hosts.length, '网址数量不一致：' + Object.keys(urls).length + ' / ' + hosts.length);
    need(Object.keys(cookies).length === hosts.length, 'cookie 模板数量不一致：' + Object.keys(cookies).length + ' / ' + hosts.length);
    hosts.forEach(function (h) {
      need(urls[h], '缺网址段：' + h);
      need(cookies[h], '缺 cookie 模板：' + h);
    });
  });

  await check('sites.preset 只有定义，没有 settings 和明文网址', async function () {
    /* publish.form 的 option label 里可能有普通网页地址，不是站点 base；检查时排除 */
    const clone = JSON.parse(JSON.stringify(sitesDoc));
    Object.keys(clone.sites || {}).forEach(function (h) { if (clone.sites[h].publish) delete clone.sites[h].publish.form; });
    const raw = JSON.stringify(clone);
    need(raw.indexOf('https://') < 0 && raw.indexOf('http://') < 0, 'sites.preset.json 出现明文网址');
    hosts.forEach(function (h) {
      const s = sites[h] || {};
      need(s.urlRef === 'site-urls.json#' + h, 'urlRef 不对：' + h);
      need(!s.settings, '预设不该带 settings：' + h);
      need(!s.cookie && !s.cookies, '预设不该带 cookie 字段：' + h);
    });
  });

  await check('网址段全部是 Base64 且能解出 http(s)', async function () {
    Object.keys(urls).forEach(function (h) {
      const u = urls[h] || {};
      const base = decode(u.base);
      need(/^https?:\/\//i.test(base), 'base 解不出网址：' + h);
      const up = decode(u.upload);
      if (up) need(/^\//.test(up) || /^https?:\/\//i.test(up), 'upload 段不对：' + h);
      const vf = decode(u.verify);
      if (vf) need(/^\//.test(vf) || /^https?:\/\//i.test(vf), 'verify 段不对：' + h);
    });
  });

  await check('cookie 模板全部为空', async function () {
    Object.keys(cookies).forEach(function (h) {
      const c = cookies[h] || {};
      need(c.cookie === '', 'cookie 模板不是空值：' + h);
      need(Object.keys(c).length === 1, 'cookie 模板多出字段：' + h);
    });
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

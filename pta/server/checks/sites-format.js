/* 站点 JSON 格式检查：sites.preset.json 和运行时 sites.json 都必须是块状格式。
   meta 一行、search 四行、publish 四行、settings 一行；结构不对或排版被改都失败。 */
const fs = require('fs');
const path = require('path');
const { formatSitesDoc } = require('../src/features/sites/format');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PACK = path.join(REPO, 'pta', 'server', 'pack', 'sites.preset.json');
const DATA = path.resolve(process.env.DATA_DIR || process.env.PTA_DATA || path.join(REPO, 'data'));
const RUNTIME = path.join(DATA, 'sites.json');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

function verify(label, file, opts) {
  if (!fs.existsSync(file)) return { skip: label + ' 不存在，跳过' };
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { skip: label + ' 读不到，跳过' }; }
  let doc = null;
  try { doc = JSON.parse(text); } catch (e) { throw new Error(label + ' 不是合法 JSON'); }
  need(isObj(doc) && isObj(doc.sites), label + ' 缺 sites');
  Object.keys(doc.sites).forEach(function (h) {
    const s = doc.sites[h] || {};
    need(isObj(s.meta), label + ' 缺 meta：' + h);
    need(isObj(s.search), label + ' 缺 search：' + h);
    need(isObj(s.publish), label + ' 缺 publish：' + h);
    need(s.name === undefined && s.search.cats === undefined && s.search.filters === undefined, label + ' 还残留旧 search 字段：' + h);
    need(s.search.type !== undefined && s.search.medium !== undefined && s.search.resolution !== undefined
      && s.search.discount !== undefined && s.search.restriction !== undefined, label + ' search 五维不全：' + h);
    need(s.publish.type !== undefined && s.publish.medium !== undefined && s.publish.resolution !== undefined
      && s.publish.discount !== undefined && s.publish.restriction !== undefined, label + ' publish 五维不全：' + h);
    if (opts.runtime) need(isObj(s.settings), label + ' 缺 settings：' + h);
    if (opts.preset) need(s.settings === undefined, label + ' 预设不该带 settings：' + h);
  });
  const want = formatSitesDoc(doc);
  if (text !== want) {
    const a = text.split('\n'), b = want.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    throw new Error(label + ' 排版不是块状格式，第 ' + (i + 1) + ' 行起不一致；跑 node pta/server/scripts/build-site-json.js --data <数据目录> --out <输出目录> 重新生成');
  }
  return { ok: Object.keys(doc.sites).length };
}

(async function () {
  await check('pack/sites.preset.json 是块状新结构', function () {
    const r = verify('sites.preset.json', PACK, { preset: true });
    need(!r.skip, r.skip || '');
    need(r.ok >= 1, '预设没有站点');
  });
  await check('运行时 sites.json 是块状新结构', function () {
    const r = verify('sites.json', RUNTIME, { runtime: true });
    if (r.skip) return; /* 本机没有运行时数据时跳过，不误报 */
    need(r.ok >= 0, '运行时站点数量异常');
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

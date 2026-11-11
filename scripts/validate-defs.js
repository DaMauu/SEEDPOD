/* 校验生成的站点定义：路径、参数模板、分类 id 一致性、catMode 与多分类是否冲突。
   只读 pta/data/site-defs/，不联网。用法：node scripts/validate-defs.js [--verbose]
   退出码 1 = 有错误（警告不算错误）。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'pta', 'data', 'site-defs');
const verbose = process.argv.indexOf('--verbose') > 0;

const ENGINE_PREFIX = { nexusphp: '/torrents.php', unit3d: '/torrents', gazelle: '/torrents.php' };
const CATMODE_OK = ['single', 'multi', 'bracket'];

let files = [];
try { files = fs.readdirSync(DIR).filter(function (f) { return /\.json$/.test(f); }); } catch (e) { files = []; }
if (!files.length) { console.log('还没有站点定义，先跑 scripts/pipeline.js'); process.exit(1); }

const errors = [];
const warns = [];
let ok = 0;

files.forEach(function (f) {
  const host = f.replace(/\.json$/, '');
  let d = null;
  try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { errors.push(host + '：JSON 读不了'); return; }
  const bad = function (m) { errors.push(host + '：' + m); };
  const warn = function (m) { warns.push(host + '：' + m); };

  if (!d.host) bad('缺 host');
  else if (d.host !== host) bad('host 与文件名不一致');
  if (!ENGINE_PREFIX[d.engine] && d.engine !== 'custom') bad('未知引擎 ' + d.engine);
  if (d.base !== 'https://' + host) warn('base 不是 https://' + host);
  if (!d.searchPath || d.searchPath.charAt(0) !== '/') bad('searchPath 必须以 / 开头：' + d.searchPath);
  else if (ENGINE_PREFIX[d.engine] && d.searchPath !== ENGINE_PREFIX[d.engine]) warn('searchPath 与引擎默认不同：' + d.searchPath);
  if (CATMODE_OK.indexOf(d.catMode) < 0) bad('catMode 非法：' + d.catMode);

  const params = d.params || {};
  const keys = Object.keys(params);
  const qKeys = keys.filter(function (k) { return params[k] === '{q}'; });
  const catKeys = keys.filter(function (k) { return params[k] === '{cats}'; });
  if (!qKeys.length) bad('params 里没有 {q} 占位符');
  if (qKeys.length > 1) warn('params 里有多个 {q}：' + qKeys.join(','));
  const cats = d.cats || {};
  const groups = Object.keys(cats);
  let idCount = 0;
  groups.forEach(function (g) {
    const arr = cats[g] || [];
    idCount += arr.length;
    if (d.catMode === 'single' && arr.length > 1) warn('catMode=single 但 ' + g + ' 有 ' + arr.length + ' 个分类，只会用第一个');
  });
  if (idCount && !catKeys.length) bad('有分类但 params 里没有 {cats} 占位符');
  if (groups.length > 20) bad('分类组超过 20：' + groups.length);

  /* 分类 id 必须在 catMap 里能找到，免得映射对不上 */
  if (Array.isArray(d.catMap) && d.catMap.length) {
    const known = {};
    d.catMap.forEach(function (c) { known[String(c.id)] = 1; });
    groups.forEach(function (g) {
      (cats[g] || []).forEach(function (id) {
        if (!known[String(id)]) bad('分类 id ' + id + '（' + g + '）不在 catMap 里');
      });
    });
  }

  if (!(d.rate && d.rate.minGapMs >= 500)) warn('请求间隔偏小或缺失');

  /* 下载链接模板与重试上限：接手执行器时要直接能用 */
  if (d.source && d.source.kind === 'sample' && !d.downloadLink) warn('没有 downloadLink 模板（下载链接拼不出来）');
  if (d.downloadLink && d.downloadLink.indexOf('{ID}') < 0) bad('downloadLink 模板缺 {ID} 占位：' + d.downloadLink);
  if (!(d.limits && d.limits.maxRetryCount >= 1 && d.limits.maxRetryCount <= 20)) warn('limits.maxRetryCount 缺失或越界');

  /* 列表行选择器与大小字段策略：请求层要靠它定位行 */
  const SIZE_STRATEGY = ['td_size', 'row-window-br-flatten', 'row-window-inline', 'missing', 'none', 'unknown'];
  if (!d.list || typeof d.list !== 'object') bad('缺 list（行选择器与大小策略）');
  else {
    if (!d.list.anchor) {
      if (d.source && d.source.kind === 'sample') bad('采样过的站却没有 list.anchor');
      else warn('list.anchor 为空');
    }
    if (SIZE_STRATEGY.indexOf(d.list.sizeStrategy) < 0) bad('sizeStrategy 非法：' + d.list.sizeStrategy);
    if (d.list.rows && d.list.sizeRows === 0 && d.list.sizeStrategy === 'missing') warn('解析出行但没有大小，策略是 missing');
  }
  if (!errors.some(function (e) { return e.indexOf(host + '：') === 0; })) ok++;
});

const myErrors = errors.length;
console.log('站点定义 ' + files.length + ' 份：通过 ' + ok + '，错误 ' + myErrors + ' 条，警告 ' + warns.length + ' 条');
if (myErrors) errors.slice(0, 25).forEach(function (e) { console.log('  错误 ' + e); });
if (warns.length && (verbose || myErrors === 0)) warns.slice(0, 15).forEach(function (w) { console.log('  警告 ' + w); });
process.exit(myErrors ? 1 : 0);

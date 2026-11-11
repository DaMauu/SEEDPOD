/* 预设体检：把每站的搜索预设真的拼成 URL，看有没有明显问题（域名不对、没有搜索词、分类没带上、编码坏了）。
   只读本地数据，不联网。用法：node scripts/audit-presets.js [--verbose]；有错误退出码 1 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const adapters = require(path.join(ROOT, 'server', 'adapters', 'index.js'));
const verbose = process.argv.indexOf('--verbose') > 0;

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const presets = readJson(path.join(DATA, 'site-search.local.json'), { sites: {} }).sites || {};
const defs = {};
const DIR = path.join(DATA, 'site-defs');
try {
  fs.readdirSync(DIR).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
    defs[f.replace(/\.json$/, '')] = readJson(path.join(DIR, f), null);
  });
} catch (e) {}

const errors = [], warns = [];
let checked = 0, withCats = 0, withUrl = 0;

Object.keys(presets).sort().forEach(function (host) {
  const p = presets[host] || {};
  const def = defs[host];
  if (!def) { warns.push(host + '：有预设但没有站点定义'); return; }
  checked++;
  const cats = p.cats && typeof p.cats === 'object' ? p.cats : {};
  const groups = Object.keys(cats);
  if (groups.length) withCats++;
  const firstIds = groups.length ? (cats[groups[0]] || []) : [];
  const url = adapters.buildSearchUrl(Object.assign({}, def, { params: p.params || def.params, catMode: p.catMode || def.catMode, catSlot: p.catSlot || def.catSlot }), '测试关键词', firstIds.slice(0, 1));
  if (!url) { errors.push(host + '：拼不出搜索 URL'); return; }
  withUrl++;

  if (url.indexOf('https://' + host) !== 0) errors.push(host + '：域名不对 ' + url.slice(0, 60));
  if (url.indexOf(' ') >= 0) errors.push(host + '：URL 里有空格');
  if (/[{}]/.test(url)) errors.push(host + '：URL 里有没替换的占位符 ' + url.slice(0, 80));
  const q = /[?&](search|searchstr|name|q|keyword|query)=/i.test(url);
  if (!q) errors.push(host + '：URL 里没有搜索词参数 ' + url.slice(url.indexOf('?')));
  if (firstIds.length && !/[?&](cat|filter_cat|categories)[^=]*=/i.test(url)) {
    errors.push(host + '：有分类却没带分类参数 ' + url.slice(url.indexOf('?')));
  }
  if (!groups.length && !verbose) { /* 没分类的推断站很多，只在 verbose 里列 */ }
  if (!groups.length) warns.push(host + '：预设没有分类 id（' + (p.source || '?') + '）');
  if (verbose) console.log('  ' + host + '  ' + url);
});

console.log('检查 ' + checked + ' 份预设：拼出 URL ' + withUrl + '，带分类 ' + withCats + '，错误 ' + errors.length + '，警告 ' + warns.length);
errors.slice(0, 20).forEach(function (e) { console.log('  错误 ' + e); });
if (verbose) warns.slice(0, 20).forEach(function (w) { console.log('  警告 ' + w); });
process.exit(errors.length ? 1 : 0);

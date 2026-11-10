/* 清掉「不是内容」的样本：Chrome 网络错误页、Cloudflare 挑战页、站点 404 页、被脚本顶掉的页面。
   这些文件留着只会让分析把错误页当成站点页面。删掉后状态里记上原因，采样器 12 小时内不会重打。
   只读/改本地文件。用法：node scripts/clean-samples.js [--dry] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const DIR = path.resolve(__dirname, '..', 'pta', 'data', 'samples');
const STATE = path.join(DIR, '_state.json');
const dry = process.argv.indexOf('--dry') > 0;

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
const state = readJson(STATE, {});

const rules = [
  ['net-error', /ERR_[A-Z_]{4,}|diagnoseErrors|This site can.t be reached/i],
  ['cloudflare', /Just a moment|cf-browser-verification|challenge-platform|Attention Required/i],
  ['http-404', /<title>\s*404 Not Found\s*<\/title>/i],
  ['error-panel', /pt-checker-panel/]
];

let files = [];
try { files = fs.readdirSync(DIR).filter(function (f) { return /\.html\.gz$/.test(f); }); } catch (e) { files = []; }
const removed = {};
files.forEach(function (f) {
  const host = f.replace(/\.html\.gz$/, '').replace(/_/g, '.');
  let html = '';
  try { html = zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))).toString('utf8'); } catch (e) { return; }
  let hit = '';
  for (const [note, re] of rules) { if (re.test(html)) { hit = note; break; } }
  /* 内容过小（<2000 字符）也当没采到 */
  if (!hit && html.length < 2000) hit = 'too-small';
  if (!hit) return;
  removed[hit] = (removed[hit] || 0) + 1;
  if (!dry) {
    try { fs.unlinkSync(path.join(DIR, f)); } catch (e) {}
    if (state[host]) { state[host].note = hit; state[host].at = new Date().toISOString(); }
  }
});
if (!dry) {
  /* 没有样本文件、却还记着 ok 的站，标成 no-sample，避免状态里出现假成功 */
  let files2 = [];
  try { files2 = fs.readdirSync(DIR).filter(function (f) { return /\.html\.gz$/.test(f); }); } catch (e) { files2 = []; }
  const have = {};
  files2.forEach(function (f) { have[f.replace(/\.html\.gz$/, '').replace(/_/g, '.')] = 1; });
  let noSample = 0;
  Object.keys(state).forEach(function (h) {
    if (!have[h] && (state[h].note || '') === '') { state[h].note = 'no-sample'; noSample++; }
  });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1), 'utf8');
  if (noSample) console.log('没有样本却记着成功的站已改标 no-sample：' + noSample);
}
console.log((dry ? '[dry] ' : '') + '清理样本 ' + Object.keys(removed).reduce(function (n, k) { return n + removed[k]; }, 0) +
  ' 份：' + Object.keys(removed).map(function (k) { return k + ' ' + removed[k]; }).join(' / '));

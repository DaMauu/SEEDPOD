/* 把「采不到」的站点按原因分组成清单文件，方便人工补：登录墙、连不上、挑战页、404、页面被脚本顶掉。
   只读本地状态与分析结果，不联网。产物在 pta/data/blocked-*.txt（不入库）。
   用法：node scripts/collect-blocked.js */
const fs = require('fs');
const path = require('path');
const DATA = path.resolve(__dirname, '..', 'pta', 'data');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const state = readJson(path.join(DATA, 'samples', '_state.json'), {});
const analysis = readJson(path.join(DATA, 'analysis.json'), {});
const arch = {};
try {
  fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    const c = l.split(',');
    if (c[0]) arch[c[0].trim()] = (c[2] || '').trim();
  });
} catch (e) {}

const groups = {
  'login-wall': '登录墙：浏览器里没登录，页面只有登录框',
  'net-error': '连不上：DNS 或连接被拒（多半要走代理）',
  'cloudflare': 'Cloudflare 挑战页：等一会儿或人工过一下',
  'http-404': '路径 404：首页路径猜错或站点改版',
  'error-panel': '页面被脚本顶掉：拿到的是错误页，不是真实列表',
  'no-sample': '没有样本：之前失败过，还没补采',
  'thin': '页面太小：像是 JS 渲染的空壳',
  'unknown': '有页面但认不出引擎'
};

const buckets = {};
Object.keys(groups).forEach(function (k) { buckets[k] = []; });

Object.keys(state).forEach(function (host) {
  const st = state[host] || {};
  const a = analysis[host] || {};
  if (a.engine) return;                       /* 已经识别出引擎的不算采不到 */
  const note = st.note || '';
  let key = '';
  if (note === 'login-wall' || a.verdict === 'login-wall') key = 'login-wall';
  else if (note === 'net-error' || a.verdict === 'unreachable') key = 'net-error';
  else if (note === 'cloudflare' || a.verdict === 'challenge') key = 'cloudflare';
  else if (note === 'http-404' || a.verdict === 'not-found') key = 'http-404';
  else if (note === 'error-panel' || a.verdict === 'blocked') key = 'error-panel';
  else if (!a.rawMissing && a.verdict === 'thin') key = 'thin';
  else if (!a.rawMissing && a.verdict === 'unknown') key = 'unknown';
  else if (note === 'no-sample' || !note) key = 'no-sample';
  if (!key) return;
  buckets[key].push(host + '\t' + (arch[host] || '?'));
});

let total = 0;
Object.keys(buckets).forEach(function (k) {
  const list = buckets[k];
  total += list.length;
  const file = path.join(DATA, 'blocked-' + k + '.txt');
  fs.writeFileSync(file, '# ' + groups[k] + '\n#' + k + ' 共 ' + list.length + ' 站\n' + list.join('\n') + '\n', 'utf8');
});
console.log('采不到的站 ' + total + ' 个，清单写在 pta/data/blocked-*.txt：');
Object.keys(buckets).forEach(function (k) {
  if (buckets[k].length) console.log('  blocked-' + k + '.txt  ' + buckets[k].length + ' 站  ' + groups[k]);
});

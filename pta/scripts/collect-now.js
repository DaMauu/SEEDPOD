/* 人工登录后一键补采：只打清单里的站，补采 → 分析 → 生成定义/预设 → 校验。
   用法：
     node scripts/collect-now.js --from pta/data/blocked-login-wall.txt --dry   只看会打哪些站
     node scripts/collect-now.js --from pta/data/blocked-login-wall.txt         真跑
     node scripts/collect-now.js --cookies                                      顺手把这些站的 cookie 导出到 pta/data/cookies.tmp.json
   约束：每个站只发一次 GET，站间 4-6 秒；清单里的站会清掉 12 小时冷却标记。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const argv = process.argv.slice(2);

function argOf(name, fb) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && argv[i + 1].charAt(0) !== '-' ? argv[i + 1] : fb;
}
const from = path.resolve(ROOT, argOf('--from', path.join(DATA, 'blocked-login-wall.txt')));
const dry = argv.indexOf('--dry') >= 0;
const withCookies = argv.indexOf('--cookies') >= 0;

let lines = [];
try { lines = fs.readFileSync(from, 'utf8').split(/\r?\n/); } catch (e) { console.log('清单读不了：' + from); process.exit(1); }
const hosts = lines.map(function (l) { return l.split('\t')[0].trim(); })
  .filter(function (l) { return l && l.charAt(0) !== '#'; });
if (!hosts.length) { console.log('清单里没有站点：' + from); process.exit(1); }

console.log('待补采 ' + hosts.length + ' 站（清单：' + path.relative(ROOT, from) + '）');
if (dry) {
  hosts.slice(0, 20).forEach(function (h) { console.log('  ' + h); });
  if (hosts.length > 20) console.log('  …还有 ' + (hosts.length - 20) + ' 站');
  console.log('这是 dry run，没有发任何请求。');
  process.exit(0);
}

/* 清掉这些站的冷却标记，让采样器愿意再打一次 */
const STATE = path.join(DATA, 'samples', '_state.json');
let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { state = {}; }
hosts.forEach(function (h) { if (state[h]) state[h].note = ''; });
fs.writeFileSync(STATE, JSON.stringify(state, null, 1), 'utf8');

const onlyFile = path.join(DATA, 'samples', '_only.txt');
fs.writeFileSync(onlyFile, hosts.join('\n'), 'utf8');

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)].concat(args || []), {
    cwd: ROOT, stdio: 'inherit', env: Object.assign({}, process.env, { PTA_SAMPLE_ONLY: onlyFile })
  });
  return r.status === 0;
}

if (withCookies) {
  console.log('导出这些站的 cookie 到 pta/data/cookies.tmp.json …');
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'import-cookies.js')].concat(hosts), { cwd: ROOT, stdio: 'inherit' });
}

if (!run('sample-sites.js', [])) { console.log('采样失败了，先看上面的输出'); process.exit(1); }
run('analyze-samples.js', ['--quiet']);
run('collect-site-defs.js', []);
run('validate-defs.js', []);
run('coverage.js', []);
console.log('补采完成：定义与预设在 pta/data/site-defs 与 pta/data/site-search.local.json，发到测试机后刷新面板。');

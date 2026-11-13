/* 扫流程页规则：data.js 里的每条 t，在 v2 服务端出现几次。
   用法：node pta/scripts/audit-rules.js [--fail]
   默认只报告；带 --fail 时存在 0 命中的规则就退出 1。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'web', 'assets', 'data.js');
const SERVER = path.join(ROOT, 'server');
const V2_FILES = fs.readdirSync(SERVER)
  .filter(f => f.endsWith('.js') && f !== 'app.js')
  .map(f => path.join(SERVER, f));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(RULES, 'utf8'), sandbox);
const R = sandbox.window.PTA_RULES || {};
const text = V2_FILES.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const rows = [];
Object.keys(R).forEach(function (cat) {
  (R[cat] || []).forEach(function (g) {
    (g.rows || []).forEach(function (r) {
      if (!r || !r.t || r.type === 'section') return;
      const name = String(r.t);
      const n = text.split(name).length - 1;
      rows.push({ cat: cat, group: g.name, name: name, n: n });
    });
  });
});

const dead = rows.filter(r => r.n === 0);
const weak = rows.filter(r => r.n > 0 && r.n < 2);
console.log('规则总数 ' + rows.length + '，v2 服务端 0 命中 ' + dead.length + '，仅 1 次命中 ' + weak.length);
if (dead.length) {
  console.log('\n0 命中：');
  dead.forEach(r => console.log('  [' + r.cat + '] ' + r.group + ' · ' + r.name));
}
if (weak.length) {
  console.log('\n仅 1 次（可能只在注释/日志里出现）：');
  weak.forEach(r => console.log('  [' + r.cat + '] ' + r.group + ' · ' + r.name + '（' + r.n + '）'));
}
if (process.argv.includes('--fail') && dead.length) process.exit(1);

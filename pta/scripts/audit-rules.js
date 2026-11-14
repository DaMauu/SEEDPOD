/* 扫流程页规则：data.js 里的每条 t，在 v2 服务端出现几次。
   - todo:true 表示未接，不参与“缺读者”判定
   - 别名：有些规则用字段名落地（发布到→targetSite，排除→rx.deny）
   用法：node pta/scripts/audit-rules.js [--fail] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'web-src', 'src', 'data', 'rules.js');
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
      rows.push({ cat: cat, group: g.name, name: String(r.t), todo: !!r.todo });
    });
  });
});

const ALIAS = { '发布到': ['targetSite'], '排除匹配': ['rx.deny'], '白名单匹配': ['rx.allow'] };
const UI_ONLY = new Set(['测试匹配']);
const count = name => text.split(name).length - 1;

const keep = rows.filter(r => !r.todo);
const todo = rows.filter(r => r.todo);
const missing = keep.filter(function (r) {
  if (UI_ONLY.has(r.name)) return false;
  let n = count(r.name);
  (ALIAS[r.name] || []).forEach(a => { n += count(a); });
  return n === 0;
});

console.log('规则总数 ' + rows.length + '，保留 ' + keep.length + '，未接 ' + todo.length);
console.log('保留规则缺读者 ' + missing.length);
missing.forEach(r => console.log('  [' + r.cat + '] ' + r.group + ' · ' + r.name));
if (process.argv.includes('--fail') && missing.length) process.exit(1);

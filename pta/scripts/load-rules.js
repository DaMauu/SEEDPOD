/* 读 rules.js 给 vm 用：去掉 ESM import，把全局预设内联进去。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'web', 'src', 'data', 'rules.js');
const PRESETS = path.join(ROOT, 'web', 'shared', 'presets.json');

function rulesSource() {
  const src = fs.readFileSync(RULES, 'utf8').replace(/^import .*$/gm, '');
  const presets = JSON.parse(fs.readFileSync(PRESETS, 'utf8'));
  return 'const presets = ' + JSON.stringify(presets) + ';\n' + src;
}
module.exports = { RULES: RULES, PRESETS: PRESETS, rulesSource: rulesSource };

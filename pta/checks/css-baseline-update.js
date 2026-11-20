/* CSS 断点基线更新流程：--baseline 写临时文件，校验通过；故意改坏基线必须失败。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'checks', 'css-breakpoints.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-cssbase-'));
const BASE = path.join(TMP, 'baseline.json');
function run(args) { return spawnSync(process.execPath, [SCRIPT].concat(args), { encoding: 'utf8' }); }
const up = run(['--update', '--baseline', BASE]);
const check = run(['--baseline', BASE]);
let bad = null;
if (check.status === 0) {
  const j = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  j.variants = 0;
  fs.writeFileSync(BASE, JSON.stringify(j));
  bad = run(['--baseline', BASE]);
}
const pass = up.status === 0 && check.status === 0 && bad && bad.status !== 0;
console.log((pass ? 'PASS' : 'FAIL') + '  CSS 基线更新/校验流程' + (pass ? '' : '：' + JSON.stringify({ update: up.status, check: check.status, bad: bad && bad.status, err: (up.stderr || check.stderr || (bad && bad.stderr) || '').slice(0, 120) })));
console.log('\n' + (pass ? '1/1' : '0/1') + ' 通过');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(pass ? 0 : 1);

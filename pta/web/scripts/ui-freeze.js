/* WebUI 冻结：对界面文件做哈希基线，改了没更新基线就失败。
   想改 UI：node pta/web/scripts/ui-freeze.js --update  然后跑检查。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', 'src');
const BASE = path.resolve(__dirname, '..', 'checks', 'baselines', 'ui-baseline.json');
const DIRS = ['styles', 'components', 'views'];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(css|vue)$/.test(f)) out.push(p);
  }
  return out;
}
function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
}
function snapshot() {
  const files = [];
  DIRS.forEach(d => walk(path.join(ROOT, d), files));
  const app = path.join(ROOT, 'App.vue');
  if (fs.existsSync(app)) files.push(app);
  const out = {};
  files.sort().forEach(p => { out[path.relative(ROOT, p).replace(/\\/g, '/')] = hashFile(p); });
  return out;
}

function main() {
  const update = process.argv.includes('--update');
  const now = snapshot();
  if (update) {
    fs.writeFileSync(BASE, JSON.stringify({ at: new Date().toISOString(), files: now }, null, 2) + '\n');
    console.log('已更新 UI 基线：' + Object.keys(now).length + ' 个文件');
    return;
  }
  let base = null;
  try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')).files; } catch (e) { base = null; }
  if (!base) {
    console.log('没有 UI 基线，先跑 node pta/web/scripts/ui-freeze.js --update');
    process.exit(2);
  }
  const changed = [];
  Object.keys(base).forEach(k => { if (now[k] !== base[k]) changed.push(k); });
  Object.keys(now).forEach(k => { if (!(k in base)) changed.push(k + '（新增）'); });
  if (changed.length) {
    console.log('UI 文件变了，但基线没更新：');
    changed.slice(0, 20).forEach(k => console.log('  ' + k));
    if (changed.length > 20) console.log('  …共 ' + changed.length + ' 个');
    console.log('确认要改 UI 就跑：node pta/web/scripts/ui-freeze.js --update');
    process.exit(1);
  }
  console.log('UI 冻结检查通过：' + Object.keys(base).length + ' 个文件未变');
}
main();

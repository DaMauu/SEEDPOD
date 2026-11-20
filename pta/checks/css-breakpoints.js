/* CSS 断点维护性：同上下文选择器不得重复；跨断点变体数量按基线锁定。
   新增/删除断点变体时，先跑 --update 并说明原因。 */
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const ROOT = path.resolve(__dirname, '..', 'web-src', 'src');
const BASE = path.resolve(__dirname, '..', 'fixtures', 'css-breakpoint-baseline.json');
const UPDATE = process.argv.indexOf('--update') >= 0;
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.css$/.test(p)) out.push(p);
  }
  return out;
}
const files = walk(ROOT, []);
const contexts = {};
const variants = {};
for (const file of files) {
  const root = postcss.parse(fs.readFileSync(file, 'utf8'));
  root.walkRules(function (r) {
    const ctx = [];
    let p = r.parent;
    while (p && p.type === 'atrule') { ctx.push('@' + p.name + ' ' + (p.params || '')); p = p.parent; }
    const c = ctx.reverse().join(' > ');
    const sel = r.selector.replace(/\s+/g, ' ').trim();
    contexts[c + '||' + sel] = (contexts[c + '||' + sel] || 0) + 1;
    variants[sel] = (variants[sel] || 0) + 1;
  });
}
const sameContext = Object.keys(contexts).filter(k => contexts[k] > 1);
const variantCount = Object.keys(variants).filter(k => variants[k] > 1).length;
const current = { sameContext: sameContext.length, variants: variantCount };
if (UPDATE || !fs.existsSync(BASE)) {
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, JSON.stringify(current, null, 2) + '\n');
  console.log('已写入 CSS 断点基线：' + JSON.stringify(current));
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const problems = [];
if (current.sameContext !== 0) problems.push('同上下文重复 ' + current.sameContext + ' 个：' + sameContext.slice(0, 5).join('、'));
if (current.variants !== base.variants) problems.push('断点变体数 ' + base.variants + ' -> ' + current.variants + '，先确认是否刻意改断点');
if (problems.length) {
  problems.forEach(function (p) { console.log('FAIL  ' + p); });
  process.exit(1);
}
console.log('PASS  CSS 同上下文重复 0，断点变体 ' + current.variants + ' 个与基线一致');

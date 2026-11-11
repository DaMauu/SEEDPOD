/* 生成流程页规则树文档：node pta/scripts/gen-rules-tree.js（仓库根执行）
   只读 pta/web/assets/data.js，写 pta/docs/RULES-TREE.md，不联网。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'web', 'assets', 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const R = sandbox.window.PTA_RULES;
const TITLE = { fetch: '抓取', dedupe: '查重', pub: '发布' };
const lines = [];
lines.push('# 流程页规则树（类目 / 手风琴 / 里面的每一条）');
lines.push('');
lines.push('由 `pta/web/assets/data.js` 直接生成：`node pta/scripts/gen-rules-tree.js`。行末的 [类型] 是控件形态，后面是选项或默认值。');
lines.push('');
Object.keys(TITLE).forEach(function (key) {
  const groups = R[key] || [];
  lines.push('## ' + TITLE[key] + '（' + key + '，' + groups.length + ' 个手风琴）');
  lines.push('');
  groups.forEach(function (g, gi) {
    const last = gi === groups.length - 1;
    lines.push((last ? '└─ ' : '├─ ') + g.name + '（' + (g.rows || []).length + ' 行）');
    (g.rows || []).forEach(function (r, ri) {
      const lastRow = ri === (g.rows || []).length - 1;
      const stem = last ? '   ' : '│  ';
      let desc = '[' + (r.type || (r.chips ? 'chips' : 'text')) + ']';
      if (r.chips) desc += ' 选项：' + r.chips.join(' / ');
      else if (r.opts) desc += ' 选项：' + r.opts.join(' / ');
      else if (r.type === 'switch') desc += ' 开关';
      else if (r.v) desc += ' 默认：' + r.v;
      if (r.ph) desc += ' 提示：' + r.ph;
      if (r.hint) desc += ' 说明：' + r.hint;
      lines.push(stem + (lastRow ? '└─ ' : '├─ ') + r.t + ' ' + desc);
    });
    lines.push('');
  });
});
fs.writeFileSync(path.join(ROOT, 'docs', 'RULES-TREE.md'), lines.join('\n'));
console.log('已写 pta/docs/RULES-TREE.md');

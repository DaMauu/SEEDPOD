/* 一次性脚本：把规则表重排成「抓取 → 筛选 → 发布」三步（只改 data.js 的结构，不改渲染代码）。
   跑一次即可，之后手工维护 data.js。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'web', 'assets', 'data.js');

const ctx = { window: {} };
new vm.Script(fs.readFileSync(FILE, 'utf8')).runInNewContext(ctx);
const R = ctx.window.PTA_RULES;

function group(set, name) {
  const g = (R[set] || []).filter(function (x) { return x.name === name; })[0];
  if (!g) throw new Error('找不到分组 ' + set + '/' + name);
  return g;
}
function rows(set, name) { return group(set, name).rows || []; }

/* 抓取：搜索预设 → 抓取标记（原判定）→ 拉取 → 站点分类映射 */
const fetchGroups = [
  group('fetch', '搜索预设'),
  Object.assign({}, group('fetch', '判定'), {
    name: '抓取标记',
    sum: '抓回来先打标记，不在这里过滤',
    rows: rows('fetch', '判定').map(function (r) {
      return Object.assign({}, r, r.hint ? {} : { hint: '只打标记，是否跳过交给第二步筛选' });
    })
  }),
  group('fetch', '拉取'),
  group('fetch', '站点分类映射')
];

/* 筛选：发布前检查（改名筛选条件）+ 查重规则（改名已有与归档） */
const dedupeGroups = [
  Object.assign({}, group('pub', '发布前检查'), {
    name: '筛选条件',
    sum: '按条件挑出可发的词条',
    rows: rows('pub', '发布前检查')
  }),
  Object.assign({}, group('dedupe', '查重规则'), {
    name: '已有与归档',
    sum: '已有 / 已发 / 跳过 的标记方式',
    rows: rows('dedupe', '查重规则')
  })
];

/* 发布：目标站 → 标题与副标题 → 简介 → 发布字段 → 自动发布 → 失败与兜底 → 下载条件 */
const subGroup = group('pub', '副标题与简介');
const introGroup = group('pub', '简介');
const titleRows = rows('pub', '标题规则');
const subRows = rows('pub', '副标题与简介').filter(function (r) { return /发布标题|副标题/.test(r.t); });
const introRows = rows('pub', '副标题与简介').filter(function (r) { return !/发布标题|副标题/.test(r.t); })
  .concat(rows('pub', '简介'));

const pubGroups = [
  group('pub', '目标站'),
  Object.assign({}, group('pub', '标题规则'), {
    name: '标题与副标题',
    sum: '标题在前、副标题在后',
    rows: titleRows.concat(subRows)
  }),
  Object.assign({}, introGroup, { name: '简介', sum: '简介来源与图片', rows: introRows }),
  Object.assign({}, group('pub', '发种字段'), {
    name: '发布字段',
    sum: '发种表单里要填的标签',
    rows: rows('pub', '发种字段')
  }),
  group('pub', '自动发布'),
  group('pub', '失败与兜底'),
  group('pub', '下载条件')
];

const out = { fetch: fetchGroups, dedupe: dedupeGroups, pub: pubGroups };
const body = '/* 面板的规则表数据：纯数据、无逻辑。改这里不影响渲染代码。 */\n' +
  '(function () {\n  window.PTA_RULES = ' + JSON.stringify(out, null, 2).replace(/\n/g, '\n  ') + ';\n})();\n';
fs.writeFileSync(FILE, body, 'utf8');

Object.keys(out).forEach(function (k) {
  console.log('[' + k + '] ' + out[k].map(function (g) { return g.name + '(' + (g.rows || []).length + ')'; }).join(' → '));
});

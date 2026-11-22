/* 审计一批保存下来的种子页 HTML，统计限制标签识别覆盖。
   用法：node pta/scripts/audit-sitecat.js --dir /path/to/sitecat/done [--verbose]
   不打印站名/网址；默认只输出汇总，--verbose 才列文件名。 */
const fs = require('fs');
const path = require('path');
const adapters = require('../adapters');

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DIR = arg('--dir', '');
const VERBOSE = argv.includes('--verbose');
if (!DIR) {
  console.error('需要 --dir 指向保存 HTML 的目录');
  process.exit(2);
}
if (!fs.existsSync(DIR)) {
  console.error('目录不存在');
  process.exit(2);
}

const files = fs.readdirSync(DIR).filter(function (f) { return /_browse\.html?$/i.test(f); });
const summary = { files: files.length, parsed: 0, zeroRows: 0, taggedFiles: 0, rows: 0, taggedRows: 0, types: {} };
const noRows = [];
files.forEach(function (f) {
  const html = fs.readFileSync(path.join(DIR, f), 'utf8');
  const engine = adapters.detectEngine(html);
  let rows = [];
  if (engine) {
    try { rows = adapters.parseList(html, engine) || []; } catch (e) { rows = []; }
  }
  if (!rows.length) { summary.zeroRows += 1; noRows.push(f); return; }
  summary.parsed += 1;
  summary.rows += rows.length;
  let tagged = 0;
  rows.forEach(function (r) {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    if (tags.length) { tagged += 1; summary.taggedRows += 1; }
    tags.forEach(function (t) { summary.types[t] = (summary.types[t] || 0) + 1; });
  });
  if (tagged) {
    summary.taggedFiles += 1;
    if (VERBOSE) console.log(f + ' · ' + engine + ' · ' + rows.length + ' 行 / ' + tagged + ' 带限制标签');
  }
});
console.log(JSON.stringify(summary, null, 2));
if (VERBOSE && noRows.length) console.log('没有解析出种子行的文件：\n' + noRows.join('\n'));

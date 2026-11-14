/* SEEDPOD 质量审计：代码 / 功能 / 开发 / 逻辑 / 简洁 / 复用 / 质量。
   纯静态，不联网；支持全库、单文件、单功能、单项目。
   用法：
     node pta/scripts/audit-quality.js                     # 整个 pta
     node pta/scripts/audit-quality.js --file pta/server/crawl.js
     node pta/scripts/audit-quality.js --feature sites
     node pta/scripts/audit-quality.js --project bluray
     node pta/scripts/audit-quality.js --json --fail
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const postcss = require('postcss');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const FILE = arg('--file', '');
const FEATURE = arg('--feature', '');
const PROJECT = arg('--project', 'pta');
const JSON_OUT = argv.includes('--json');
const FAIL = argv.includes('--fail');
const STRICT = argv.includes('--strict');

const DIMENSIONS = [
  ['code', '代码'],
  ['function', '功能'],
  ['development', '编写'],
  ['logic', '逻辑'],
  ['simplicity', '简洁度'],
  ['reuse', '复用率'],
  ['quality', '质量']
];
const FEATURES = {
  dashboard: ['pta/web-src/src/views/Dashboard.vue', 'pta/web-src/src/App.vue'],
  sites: ['pta/web-src/src/views/Sites.vue', 'pta/server/routes-data.js', 'pta/server/routes-probe.js'],
  crawl: ['pta/web-src/src/views/Crawl.vue', 'pta/server/crawl.js', 'pta/server/routes-crawl.js', 'pta/server/scheduler.js'],
  queue: ['pta/web-src/src/views/Queue.vue', 'pta/server/routes-write.js', 'pta/server/publish.js', 'pta/server/target.js'],
  sources: ['pta/web-src/src/views/Sources.vue', 'pta/server/routes-data.js', 'pta/server/media.js'],
  logs: ['pta/web-src/src/views/Logs.vue', 'pta/server/routes-data.js'],
  settings: ['pta/web-src/src/views/Settings.vue', 'pta/server/routes-write.js', 'pta/server/notify.js'],
  changelog: ['pta/web-src/src/views/Changelog.vue'],
  target: ['pta/server/target.js', 'pta/server/routes-target.js'],
  publish: ['pta/server/publish.js', 'pta/server/qb.js', 'pta/server/routes-publish.js'],
  scheduler: ['pta/server/scheduler.js', 'pta/server/routes-misc.js'],
  metadata: ['pta/server/meta.js', 'pta/server/meta-ext.js', 'pta/server/routes-misc.js'],
  media: ['pta/server/media.js', 'pta/server/routes-media.js'],
  clients: ['pta/server/clients/watch.js', 'pta/server/clients/rtorrent.js', 'pta/server/clients/deluge.js', 'pta/server/routes-qb.js'],
  'site-pack': ['pta/server/site-pack.js', 'pta/scripts/build-site-pack.js', 'pta/checks/site-pack.js'],
  auth: ['pta/server/app-fastify.js', 'pta/server/routes-data.js', 'pta/server/security.js']
};
const PROJECTS = {
  pta: ['pta'],
  bluray: ['scripts/bluray'],
  ptscripts: ['scripts/PTScripts'],
  repo: ['.']
};
const REQUIRED_DOCS = [
  'AGENTS.md', 'CHECKLIST.md', 'HANDOFF.md', 'CHANGELOG.md',
  'pta/docs/DELIVERY.md', 'pta/docs/DESIGN.md', 'pta/docs/DECISIONS.md',
  'pta/docs/ROADMAP.md', 'pta/docs/RULES-TREE.md', 'pta/docs/RULES-RECONCILIATION.md',
  'pta/docs/SITE-PACK.md', 'pta/docs/UPSTREAM.md', 'pta/docs/QUALITY.md'
];

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function exists(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function rate(score) {
  if (score >= 85) return '优质';
  if (score >= 70) return '平衡';
  if (score >= 55) return '勉强';
  return '差';
}
function walk(dir, out, filter) {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of list) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git' || e.name === 'data' && dir.endsWith('pta')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, filter);
    else if (!filter || filter(p)) out.push(p);
  }
  return out;
}

function scopeFiles() {
  if (FILE) {
    const p = path.resolve(REPO, FILE);
    return exists(p) ? [p] : [];
  }
  if (FEATURE) {
    return (FEATURES[FEATURE] || []).map(p => path.resolve(REPO, p)).filter(exists);
  }
  const roots = (PROJECTS[PROJECT] || PROJECTS.pta).map(p => path.resolve(REPO, p));
  const all = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const st = fs.statSync(root);
    if (st.isFile()) { all.push(root); continue; }
    walk(root, all, p => /\.(js|vue|css|md|json|sh)$/.test(p));
  }
  return all;
}

function collect(files) {
  const src = files.filter(f => /\.(js|vue|css)$/.test(f));
  const docs = files.filter(f => /\.md$/.test(f));
  const runtime = src.filter(f => !/\/checks\/|\/scripts\/build-|\/scripts\/audit-/.test(f));
  let lines = 0, maxLines = 0, maxFile = '', maxCodeLines = 0, maxCodeFile = '', todos = 0, consoleLogs = 0, emptyCatch = 0;
  const fnMap = {};
  let cssSelectors = {};
  for (const f of src) {
    const s = read(f);
    const n = s.split('\n').length;
    lines += n;
    const code = /\.vue$/.test(f) ? s.replace(/<style[\s\S]*?<\/style>/gi, '').split('\n').length : n;
    if (n > maxLines) { maxLines = n; maxFile = rel(f); }
    if (code > maxCodeLines) { maxCodeLines = code; maxCodeFile = rel(f); }
    todos += (s.match(/\b(TODO|FIXME|XXX)\b/g) || []).length;
    const runtimeFile = /\/server\//.test(f) || /\/web-src\/src\//.test(f);
    if (runtimeFile) {
      consoleLogs += (s.match(/console\.log\s*\(/g) || []).length;
      emptyCatch += (s.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
    }
    if (/\.vue$/.test(f)) {
      for (const m of s.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) fnMap[m[1]] = (fnMap[m[1]] || 0) + 1;
    }
    if (/\.css$/.test(f)) {
      try {
        postcss.parse(s).walkRules(r => {
          const k = r.selector.replace(/\s+/g, ' ').trim();
          cssSelectors[k] = (cssSelectors[k] || 0) + 1;
        });
      } catch (e) {}
    }
  }
  const dupFunctions = Object.keys(fnMap).filter(k => fnMap[k] > 1);
  const dupCss = Object.keys(cssSelectors).filter(k => cssSelectors[k] > 1).length;
  const ptaScope = PROJECT === 'pta' || !!FEATURE || /\/pta\//.test(FILE);
  const globalServerFiles = ptaScope ? walk(path.join(ROOT, 'server'), [], x => x.endsWith('.js')) : [];
  const serverText = globalServerFiles.map(read).join('\n');
  const routes = new Set();
  for (const m of serverText.matchAll(/app\.(get|post|put|delete|patch)\(\s*'(\/api\/[^']+)'/g)) routes.add(m[2].replace(/:[A-Za-z_]+/g, '*').replace(/\/+$/, ''));
  const frontCalls = new Set();
  for (const f of src.filter(x => /\/web-src\//.test(x))) {
    const s = read(f);
    for (const m of s.matchAll(/['"`]\/api\/([^'"`?]+)/g)) {
      const p = '/api/' + m[1].replace(/\$\{[^}]+\}/g, '*').replace(/:[A-Za-z_]+/g, '*').replace(/\/+$/, '');
      frontCalls.add(p);
    }
  }
  const missingApis = [...frontCalls].filter(p => {
    if (routes.has(p)) return false;
    return ![...routes].some(r => r.startsWith(p + '/') || p.startsWith(r + '/'));
  });
  const checksText = read(path.join(ROOT, 'checks', 'run.sh'));
  const checks = [...checksText.matchAll(/^run\s+(\S+)\s+(\S+)/gm)].map(m => ({ name: m[1], file: m[2], exists: exists(path.join(ROOT, 'checks', m[2])) }));
  let rules = { total: 0, todo: 0, keep: 0 };
  if (ptaScope) try {
    const sb = { window: {} };
    vm.runInNewContext(read(path.join(ROOT, 'web-src', 'src', 'data', 'rules.js')), sb, { timeout: 1000 });
    const R = sb.window.PTA_RULES || {};
    for (const k of Object.keys(R)) for (const g of R[k] || []) for (const r of g.rows || []) {
      if (!r || !r.t || r.type === 'section') continue;
      rules.total++;
      if (r.todo) rules.todo++; else rules.keep++;
    }
  } catch (e) {}
  const missingDocs = REQUIRED_DOCS.filter(p => !exists(path.resolve(REPO, p)));
  const pkg = (() => { try { return JSON.parse(read(path.resolve(REPO, 'package.json'))); } catch (e) { return {}; } })();
  const version = String(pkg.version || '');
  const changelog = read(path.resolve(REPO, 'CHANGELOG.md'));
  const handoff = read(path.resolve(REPO, 'HANDOFF.md'));
  const versionOk = version && changelog.includes('v' + version) && handoff.includes('v' + version);
  const missingImports = [];
  for (const f of src.filter(x => /\.(js|vue)$/.test(x))) {
    const s = read(f);
    for (const m of s.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      let p = path.resolve(path.dirname(f), m[1]);
      if (!/\.(js|vue|css|json|png|woff2)$/.test(p)) {
        if (!exists(p + '.js') && !exists(p + '.vue') && !exists(p + '.css') && !exists(p + '/index.js')) missingImports.push(rel(f) + ' -> ' + m[1]);
      } else if (!exists(p)) missingImports.push(rel(f) + ' -> ' + m[1]);
    }
  }
  const shared = files.filter(f => /\/components\/|styles\/(00-base|01-shell|03-shared|08-components|09-responsive|11-dock)/.test(f)).length;
  return { files, src, docs, lines, maxLines, maxFile, maxCodeLines, maxCodeFile, todos, consoleLogs, emptyCatch, dupFunctions, dupCss, routes: routes.size, frontCalls: frontCalls.size, missingApis, checks, rules, missingDocs, versionOk, missingImports, shared, version };
}

function score(c, scope) {
  const isWide = !FILE && !FEATURE && PROJECT === 'pta';
  const maxPenalty = Math.min(22, Math.max(0, (c.maxCodeLines - 800) / 40));
  const code = clamp(100 - maxPenalty - Math.min(8, c.todos) - Math.min(6, c.consoleLogs) - Math.min(6, c.emptyCatch / 4));
  const ruleRatio = c.rules.total ? c.rules.keep / c.rules.total : 1;
  const functionScore = clamp(55 + Math.min(15, c.routes / 6) + Math.min(15, c.checks.length * 1.2) + ruleRatio * 20 - Math.min(20, c.missingApis.length * 3));
  const docRatio = 1 - (c.missingDocs.length / REQUIRED_DOCS.length);
  const development = clamp(40 + docRatio * 40 + (c.versionOk ? 10 : 0) + (c.checks.length >= 10 ? 10 : 0));
  const apiRatio = c.frontCalls ? 1 - c.missingApis.length / c.frontCalls : 1;
  const importRatio = c.missingImports.length ? 0 : 1;
  const logic = clamp(apiRatio * 50 + ruleRatio * 30 + importRatio * 20);
  const simplicity = clamp(100 - maxPenalty - Math.min(10, c.dupCss * 0.5));
  const reuse = clamp(100 - Math.min(40, c.dupFunctions.length * 5) + Math.min(10, c.shared * 2));
  const quality = clamp(40 + Math.min(30, c.checks.length * 1.5) + (c.missingDocs.length ? 0 : 10) + 10 + (c.missingApis.length || c.missingImports.length ? 0 : 10));
  const vals = { code, function: functionScore, development, logic, simplicity, reuse, quality };
  if (!isWide) {
    vals.function = clamp(65 + Math.min(20, c.routes * 3) + Math.min(15, c.checks.length));
    vals.development = clamp(70 + (c.versionOk ? 10 : 0));
    vals.quality = clamp(60 + Math.min(20, c.checks.length * 2) + (c.missingApis.length || c.missingImports.length ? 0 : 15));
  }
  const weights = { code: .2, function: .2, development: .1, logic: .2, simplicity: .1, reuse: .1, quality: .1 };
  const overall = clamp(Object.keys(vals).reduce((a, k) => a + vals[k] * weights[k], 0));
  return { vals, overall };
}

function findings(c) {
  const out = [];
  if (c.maxCodeLines > 800) out.push(`最大代码文件 ${c.maxCodeFile} 有 ${c.maxCodeLines} 行（不含 scoped style），建议拆分`);
  if (c.todos) out.push(`源码里有 ${c.todos} 处 TODO/FIXME`);
  if (c.consoleLogs) out.push(`运行时代码里有 ${c.consoleLogs} 处 console.log`);
  if (c.emptyCatch) out.push(`有 ${c.emptyCatch} 个空 catch，失败会被吞`);
  if (c.missingApis.length) out.push(`前端调用了 ${c.missingApis.length} 个后端没有的接口：${c.missingApis.slice(0, 5).join('、')}`);
  if (c.missingImports.length) out.push(`有 ${c.missingImports.length} 个 import 找不到目标：${c.missingImports.slice(0, 3).join('、')}`);
  if (c.rules.todo) out.push(`${c.rules.todo} 条流程规则仍是未接状态（共 ${c.rules.total} 条）`);
  if (c.dupFunctions.length) out.push(`重复函数名 ${c.dupFunctions.length} 个：${c.dupFunctions.slice(0, 8).join('、')}`);
  if (c.dupCss) out.push(`CSS 有 ${c.dupCss} 个选择器出现多次，可继续合并`);
  if (c.missingDocs.length) out.push(`缺少文档：${c.missingDocs.join('、')}`);
  if (!c.versionOk) out.push('版本号没有同步到 CHANGELOG/HANDOFF');
  return out;
}

function loadBaseline() {
  const p = path.resolve(REPO, arg('--baseline', 'pta/quality-baseline.json'));
  try { return JSON.parse(read(p)); } catch (e) { return null; }
}
function updateBaseline(report) {
  const p = path.resolve(REPO, arg('--baseline', 'pta/quality-baseline.json'));
  const data = { version: report.version, scope: 'project:pta', updatedAt: new Date().toISOString(), overall: report.overall, dimensions: {} };
  report.dimensions.forEach(d => { data.dimensions[d.key] = { score: d.score, rating: d.rating }; });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  console.log('基线已写入 ' + rel(p));
}
function main() {
  const files = scopeFiles();
  if (!files.length) { console.error('没有匹配的文件'); process.exit(2); }
  const c = collect(files);
  const s = score(c, PROJECT);
  const rows = DIMENSIONS.map(([k, label]) => ({ key: k, label, score: s.vals[k], rating: rate(s.vals[k]) }));
  const report = { scope: FILE ? 'file:' + FILE : FEATURE ? 'feature:' + FEATURE : 'project:' + PROJECT, version: c.version, files: files.length, lines: c.lines, overall: s.overall, overallRating: rate(s.overall), dimensions: rows, findings: findings(c) };
  if (argv.includes('--update-baseline')) updateBaseline(report);
  if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`质量审计 · ${report.scope} · ${files.length} 文件 / ${c.lines} 行 · v${c.version || '?'}`);
    console.log('维度\t分数\t评级');
    for (const r of rows) console.log(`${r.label}\t${r.score}\t${r.rating}`);
    console.log(`总体\t${s.overall}\t${rate(s.overall)}`);
    if (report.findings.length) { console.log('\n发现：'); report.findings.forEach((x, i) => console.log(`${i + 1}. ${x}`)); }
  }
  const base = loadBaseline();
  let regressed = false;
  if (base && PROJECT === 'pta' && !FILE && !FEATURE) {
    for (const r of rows) {
      const b = base.dimensions && base.dimensions[r.key];
      if (!b) continue;
      if (r.score < b.score - 2) { regressed = true; console.error('回退：' + r.label + ' ' + b.score + ' → ' + r.score); }
    }
    if (base.overall && s.overall < base.overall - 2) { regressed = true; console.error('回退：总体 ' + base.overall + ' → ' + s.overall); }
  }
  const bad = rows.some(r => r.rating === '差') || rate(s.overall) === '差';
  const strictBad = STRICT && rows.some(r => r.rating === '勉强' || r.rating === '差');
  if (FAIL && (regressed || (!base && bad) || strictBad)) process.exit(1);
}
main();

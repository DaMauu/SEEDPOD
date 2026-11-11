/* 一条命令跑完整条站点适配流水线：采样 → 离线分析 → 生成站点定义与搜索预设 → 覆盖率报告。
   用法：
     node scripts/pipeline.js                 只分析已有样本（不联网）
     node scripts/pipeline.js --sample        先补采样再分析
     node scripts/pipeline.js --sample 20     只补采 20 个站
     node scripts/pipeline.js --skip-analyze  直接用现有 analysis.json
   产物都在 pta/data/ 下（不入库）：samples/、analysis.json、site-defs/、site-search.local.json、coverage.json */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const argv = process.argv.slice(2);
const doSample = argv.indexOf('--sample') >= 0;
const skipAnalyze = argv.indexOf('--skip-analyze') >= 0;
const sampleCount = (function () {
  const i = argv.indexOf('--sample');
  if (i < 0) return '';
  const v = argv[i + 1];
  return v && /^\d+$/.test(v) ? v : '';
})();

function run(script, args, label) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)].concat(args || []), {
    cwd: ROOT, stdio: 'inherit', env: process.env
  });
  const ok = r.status === 0;
  console.log((ok ? 'OK   ' : 'FAIL ') + label + ' · ' + Math.round((Date.now() - t0) / 1000) + 's');
  return ok;
}

const steps = [];
if (doSample) steps.push(['sample-sites.js', sampleCount ? [sampleCount] : [], '补采样']);
if (!skipAnalyze) steps.push(['analyze-samples.js', ['--quiet'], '离线分析']);
steps.push(['collect-site-defs.js', [], '生成站点定义与预设']);
steps.push(['validate-defs.js', [], '校验站点定义']);
steps.push(['audit-presets.js', [], '预设体检']);
steps.push(['coverage.js', [], '覆盖率']);

let failed = 0;
for (const [script, args, label] of steps) {
  if (!run(script, args, label)) { failed++; break; }
}

let report = null;
try { report = JSON.parse(fs.readFileSync(path.join(DATA, 'coverage.json'), 'utf8')); } catch (e) {}
if (report) {
  fs.writeFileSync(path.join(DATA, 'pipeline-report.json'), JSON.stringify({
    at: new Date().toISOString(), coverage: report
  }, null, 1), 'utf8');
  console.log('—'.repeat(40));
  console.log('站点 ' + report.total + ' · 已采 ' + report.sampled + ' · 有引擎 ' +
    (report.sampled - (report.unparsed || []).length) + ' · 未识别 ' + (report.unparsed || []).length +
    ' · 未开始 ' + (report.notSampled || []).length);
}
process.exit(failed ? 1 : 0);

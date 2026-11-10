/* 覆盖率报告：把「清单里的站」和「采样/分析结果」对起来，看还差哪些。
   只读本地文件，不联网。用法：node scripts/coverage.js [--list] */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const list = readJson(path.join(DATA, 'sites-bookmark.local.json'), []);
const arch = {};
try {
  fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    const c = l.split(',');
    if (c[0]) arch[c[0].trim()] = (c[2] || '').trim();
  });
} catch (e) {}

const targets = [];
const seen = {};
for (const it of list) {
  if (!/内站|外站/.test(it.path || '')) continue;
  const host = String(it.url || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (!host || seen[host]) continue;
  seen[host] = 1;
  targets.push({ host: host, arch: arch[host] || '?' });
}

const state = readJson(path.join(DATA, 'samples', '_state.json'), {});
const analysis = readJson(path.join(DATA, 'analysis.json'), {});
let rawFiles = [];
try { rawFiles = fs.readdirSync(path.join(DATA, 'samples')).filter(function (f) { return /\.html\.gz$/.test(f); }); } catch (e) { rawFiles = []; }
const rawSet = {};
rawFiles.forEach(function (f) { rawSet[f.replace(/\.html\.gz$/, '')] = 1; });
const presets = (readJson(path.join(DATA, 'site-search.local.json'), { sites: {} }).sites) || {};

const report = {
  total: targets.length,
  sampled: 0, withRaw: 0, analysisOnly: [], failedList: [], notSampled: [],
  engine: {}, byArch: {}, unparsed: [], noCats: [], noRows: [], noPreset: [], verdict: {},
  generatedAt: new Date().toISOString()
};

targets.forEach(function (t) {
  const st = state[t.host];
  const a = analysis[t.host];
  const hasFile = !!a;
  report.byArch[t.arch] = report.byArch[t.arch] || { total: 0, engine: {} };
  report.byArch[t.arch].total++;
  if (!hasFile) {
    if (!st) report.notSampled.push(t.host);
    else report.failedList.push(t.host);
    return;
  }
  report.sampled++;
  if (rawSet[t.host.replace(/[^a-z0-9.-]/gi, '_')]) report.withRaw++; else report.analysisOnly.push(t.host);

  const e = a.engine || 'unknown';
  const v = a.verdict || (a.engine ? 'ok' : 'unknown');
  report.verdict[v] = (report.verdict[v] || 0) + 1;
  report.engine[e] = (report.engine[e] || 0) + 1;
  report.byArch[t.arch].engine[e] = (report.byArch[t.arch].engine[e] || 0) + 1;
  if (!a.engine) report.unparsed.push(t.host);
  else {
    if (!a.cats) report.noCats.push(t.host);
    if (!a.rows) report.noRows.push(t.host);
  }
  if (!presets[t.host]) report.noPreset.push(t.host);
});

fs.writeFileSync(path.join(DATA, 'coverage.json'), JSON.stringify(report, null, 1), 'utf8');

const pct = function (n) { return report.total ? Math.round(n / report.total * 100) : 0; };
console.log('清单 ' + report.total + ' 站：有分析 ' + report.sampled + '（' + pct(report.sampled) + '%，其中原始样本 ' + report.withRaw + '）' +
  '，未开始 ' + report.notSampled.length + '，采样失败 ' + report.failedList.length);
const eng = Object.keys(report.engine).map(function (k) { return k + ' ' + report.engine[k]; }).join(' / ');
console.log('判定：' + Object.keys(report.verdict).map(function (k) { return k + ' ' + report.verdict[k]; }).join(' / '));
console.log('引擎：' + (eng || '无') + '；有搜索预设 ' + Object.keys(presets).length + ' 站');
console.log('未识别 ' + report.unparsed.length + '，有引擎无分类 ' + report.noCats.length + '，有引擎无列表 ' + report.noRows.length);
Object.keys(report.byArch).sort().forEach(function (k) {
  const b = report.byArch[k];
  console.log('  ' + k.padEnd(8) + ' ' + String(b.total).padStart(3) + ' 站 · ' +
    Object.keys(b.engine).map(function (e) { return e + ' ' + b.engine[e]; }).join(' '));
});
if (process.argv.indexOf('--list') > 0) {
  if (report.unparsed.length) console.log('未识别：' + report.unparsed.join(' '));
  if (report.noRows.length) console.log('无列表：' + report.noRows.join(' '));
  if (report.notSampled.length) console.log('还没采：' + report.notSampled.slice(0, 40).join(' ') + (report.notSampled.length > 40 ? ' …' : ''));
}

/* 离线分析已采样的站点页面：识别引擎、抽分类、抽列表、反推搜索参数。
   只读 pta/data/samples/ 下的 gz，不发任何网络请求。
   产物：pta/data/analysis.json（每站一条）+ 控制台汇总。
   用法：node scripts/analyze-samples.js [--quiet] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'samples');
const adapters = require(path.join(ROOT, 'server', 'adapters', 'index.js'));

const quiet = process.argv.indexOf('--quiet') > 0;

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

function loadArch() {
  const arch = {};
  try {
    fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
      const c = l.split(',');
      if (c[0]) arch[c[0].trim()] = (c[2] || '').trim();
    });
  } catch (e) {}
  return arch;
}

const state = readJson(path.join(OUT, '_state.json'), {});
const arch = loadArch();

const result = readJson(path.join(DATA, 'analysis.json'), {}) || {};   /* 保留没有样本的旧结果，避免删样本后丢定义 */
let files = [];
try {
  files = fs.readdirSync(OUT).filter(function (f) { return /\.html\.gz$/.test(f); });
} catch (e) { files = []; }

for (const f of files) {
  const host = f.replace(/\.html\.gz$/, '').replace(/_/g, '.');
  let html = '';
  try { html = zlib.gunzipSync(fs.readFileSync(path.join(OUT, f))).toString('utf8'); } catch (e) { continue; }
  const um = state[host] || {};
  const engine = adapters.detectEngine(html);
  delete result[host];
  const spec = adapters.detectSearchSpec(html);
  const cats = engine ? adapters.parseCategories(html, engine) : [];
  const rows = engine ? adapters.parseList(html, engine) : [];
  const withSize = rows.filter(function (r) { return r.size; }).length;
  const withDl = rows.filter(function (r) { return r.downloadUrl; }).length;
  const withCat = rows.filter(function (r) { return r.catId || r.catName; }).length;
  result[host] = {
    host: host,
    arch: um.arch || arch[host] || '?',
    engine: engine,
    engineHint: spec.engine,
    url: um.url || '',
    status: um.status || 0,
    bytes: html.length,
    login: adapters.isLoggedIn(html),
    rows: rows.length,
    rowsWithSize: withSize,
    rowsWithDl: withDl,
    rowsWithCat: withCat,
    cats: cats.length,
    catList: cats,
    searchPath: (function () { const u = um.url || ''; const m = /^https?:\/\/[^\/]+(\/[^?#]*)/.exec(u); return m ? m[1] : ''; })(),
    analyzedAt: new Date().toISOString(),
    catSample: cats.slice(0, 5).map(function (c) { return c.id + ':' + c.label; }),
    params: spec.params,
    catMode: spec.catMode,
    catParam: spec.catParam,
    sample: rows.slice(0, 2).map(function (r) { return { id: r.id, title: r.title.slice(0, 40), size: r.size, catId: r.catId || '' }; }),
    note: um.note || ''
  };
}

fs.writeFileSync(path.join(DATA, 'analysis.json'), JSON.stringify(result, null, 1), 'utf8');

const hosts = Object.keys(result);
const by = {};
hosts.forEach(function (h) { const e = result[h].engine || '(未识别)'; by[e] = (by[e] || 0) + 1; });
const noRows = hosts.filter(function (h) { return result[h].engine && !result[h].rows; });
const noCats = hosts.filter(function (h) { return result[h].engine && !result[h].cats; });
const noSize = hosts.filter(function (h) { return result[h].rows && !result[h].rowsWithSize; });
const loggedOut = hosts.filter(function (h) { return result[h].login === false; });

console.log('样本 ' + hosts.length + ' 站，已写 pta/data/analysis.json');
console.log('引擎分布 ' + JSON.stringify(by));
console.log('解析出列表 ' + hosts.filter(function (h) { return result[h].rows > 0; }).length + ' 站，' +
  '有分类 ' + hosts.filter(function (h) { return result[h].cats > 0; }).length + ' 站，' +
  '有大小 ' + hosts.filter(function (h) { return result[h].rowsWithSize > 0; }).length + ' 站');
if (loggedOut.length) console.log('疑似未登录 / 登录墙 ' + loggedOut.length + ' 站');
if (noRows.length) console.log('有引擎但没解析出列表 ' + noRows.length + ' 站：' + noRows.slice(0, 12).join(' '));
if (noCats.length) console.log('有引擎但没分类 ' + noCats.length + ' 站：' + noCats.slice(0, 12).join(' '));

if (!quiet) {
  hosts.sort().forEach(function (h) {
    const r = result[h];
    if (r.rows && r.cats && r.rowsWithSize) return;      /* 完全正常的只看汇总 */
    console.log([h, r.arch, r.engine || '-', 'rows=' + r.rows, 'size=' + r.rowsWithSize, 'cats=' + r.cats,
      'login=' + String(r.login), r.note, (r.params ? Object.keys(r.params).join('+') : '')].join(' | '));
  });
}

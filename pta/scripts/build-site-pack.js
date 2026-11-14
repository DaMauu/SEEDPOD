/* 离线生成加密站点包：读私有 data/site-defs 和 data/site-pack.json，
   自动匹配分类，写 pta/pack/site-pack.enc。不联网，不打印站名/网址。
   用法：
     node pta/scripts/build-site-pack.js --data /path/to/data --dry
     PTA_SITE_PACK_KEY=... node pta/scripts/build-site-pack.js --data /path/to/data
*/
const fs = require('fs');
const path = require('path');
const categories = require('../server/categories');
const secretbox = require('../server/secretbox');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = arg('--data', process.env.PTA_DATA || path.join(ROOT, '..', 'data'));
const OUT = arg('--out', path.join(ROOT, 'pack', 'site-pack.enc'));
const REPORT = arg('--report', '');
const DRY = argv.includes('--dry');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function normHost(h) { return String(h || '').trim().toLowerCase(); }

function autoPurpose(item) {
  const before = String(item.purpose || 'other');
  if (before && before !== 'other') return { purpose: before, auto: false };
  const s = categories.suggest(item.label || item.desc || item.id);
  return { purpose: s.purpose, auto: s.purpose !== 'other', confidence: s.confidence };
}

function normalizeSite(host, def, packSite) {
  const d = Object.assign({}, def || {}, packSite || {});
  const site = {};
  ['base', 'engine', 'searchPath', 'params', 'catMode', 'limits'].forEach(function (k) {
    if (d[k] !== undefined) site[k] = d[k];
  });
  let catMap = d.catMap;
  let cats = d.cats;
  if (Array.isArray(catMap)) {
    const arr = catMap.map(function (x) { return Object.assign({}, x); });
    const stats = [];
    const cm = {};
    const cs = {};
    arr.forEach(function (x) {
      const a = autoPurpose(x);
      x.purpose = a.purpose;
      stats.push(a);
      if (!cm[a.purpose] && x.id != null) cm[a.purpose] = String(x.id);
      if (x.id != null) (cs[a.purpose] = cs[a.purpose] || []).push(String(x.id));
    });
    site.catMap = cm;
    site.cats = cs;
    site._catStats = stats;
  } else if (catMap && typeof catMap === 'object') {
    site.catMap = catMap;
    if (cats && typeof cats === 'object') site.cats = cats;
  }
  const upload = d.upload || d.uploadMap;
  if (upload && typeof upload === 'object') {
    site.upload = {};
    ['path', 'formPath', 'fileField'].forEach(function (k) { if (upload[k] !== undefined) site.upload[k] = upload[k]; });
    if (upload.fields && typeof upload.fields === 'object') site.upload.fields = upload.fields;
  }
  if (d.verify && typeof d.verify === 'object') site.verify = { path: d.verify.path || '' };
  return site;
}

function sensitiveKeys(obj, trail) {
  const bad = [];
  if (!obj || typeof obj !== 'object') return bad;
  for (const k of Object.keys(obj)) {
    const p = trail ? trail + '.' + k : k;
    if (/cookie|password|passwd|secret|token|authorization/i.test(k)) bad.push(p);
    if (obj[k] && typeof obj[k] === 'object') bad.push.apply(bad, sensitiveKeys(obj[k], p));
  }
  return bad;
}

function main() {
  const dir = path.join(DATA, 'site-defs');
  let files = [];
  try { files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }); } catch (e) {
    console.error('读不到站点定义目录：' + dir);
    process.exit(1);
  }
  const privatePack = readJson(path.join(DATA, 'site-pack.json'), { sites: {} });
  const packSites = (privatePack && privatePack.sites) || {};
  const sites = {};
  const seen = {};
  let total = 0, mapped = 0, other = 0;
  const byPurpose = {};
  const exceptions = [];
  const exceptionCount = {};
  files.concat(Object.keys(packSites).map(function (h) { return h + '.json'; })).forEach(function (f) {
    const host = normHost(f.replace(/\.json$/, ''));
    if (!host || seen[host]) return;
    seen[host] = true;
    const def = readJson(path.join(dir, f), null);
    const ps = packSites[host] || null;
    if (!def && !ps) return;
    const site = normalizeSite(host, def, ps);
    if (!site.base || !site.engine) return;
    (site._catStats || []).forEach(function (a) {
      total++;
      const p = a.purpose || 'other';
      byPurpose[p] = (byPurpose[p] || 0) + 1;
      if (p === 'other') other++; else mapped++;
    });
    if (Array.isArray((def || {}).catMap)) {
      (def.catMap || []).forEach(function (x) {
        const a = autoPurpose(x);
        if (a.purpose === 'other') {
          const label = String(x.label || x.id || '');
          exceptionCount[label] = (exceptionCount[label] || 0) + 1;
          exceptions.push({ host: host, id: String(x.id || ''), label: label });
        }
      });
    }
    delete site._catStats;
    sites[host] = site;
  });
  const siteCount = Object.keys(sites).length;
  if (!siteCount) { console.error('没有可打包的站点'); process.exit(1); }

  const coverage = total ? (mapped / total * 100) : 0;
  console.log('站点包' + (DRY ? ' dry-run' : '') + '：');
  console.log('  站点 ' + siteCount);
  console.log('  分类 ' + total + ' · 自动匹配 ' + mapped + ' (' + coverage.toFixed(1) + '%) · 待确认 ' + other);
  console.log('  用途分布 ' + Object.keys(byPurpose).sort().map(function (k) { return k + '=' + byPurpose[k]; }).join(' '));
  const top = Object.keys(exceptionCount).sort(function (a, b) { return exceptionCount[b] - exceptionCount[a]; }).slice(0, 20);
  if (top.length) {
    console.log('  待确认标签（前 20，不含站名）：');
    top.forEach(function (k) { console.log('    ' + exceptionCount[k] + ' × ' + JSON.stringify(k)); });
  }
  if (REPORT) {
    const rp = path.resolve(REPORT);
    fs.mkdirSync(path.dirname(rp), { recursive: true });
    fs.writeFileSync(rp, JSON.stringify({ generatedAt: new Date().toISOString(), sites: siteCount, total: total, mapped: mapped, other: other, exceptions: exceptions }, null, 2) + '\n', { mode: 0o600 });
    console.log('  例外清单已写私有文件（0600）');
  }
  if (DRY) return;

  const key = secretbox.parseKey(process.env.PTA_SITE_PACK_KEY);
  if (!key) { console.error('缺 PTA_SITE_PACK_KEY，未写包'); process.exit(1); }
  const pack = { v: 1, version: 1, updatedAt: new Date().toISOString(), sites: sites };
  const bad = sensitiveKeys(pack, '');
  if (bad.length) { console.error('站点包里有疑似敏感字段：' + bad.slice(0, 5).join(', ')); process.exit(1); }
  const enc = secretbox.encrypt(JSON.stringify(pack), key);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, enc + '\n', { mode: 0o644 });
  console.log('  已写密文 ' + path.relative(process.cwd(), OUT) + ' · ' + fs.statSync(OUT).size + ' 字节');
  console.log('  包里没有明文站名/网址；密钥不在文件里');
}

main();

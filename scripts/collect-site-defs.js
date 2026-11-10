/* 把采集到的搜索预设整理成站点定义（pta/data/site-defs/<host>.json）。
   站点定义是适配器的输入：登录地址与字段、搜索参数、分类映射、请求间隔。
   只读 pta/data 下的本地文件，不联网。用法：node scripts/collect-site-defs.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'site-defs');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

const presets = readJson(path.join(DATA, 'site-search.local.json'), { sites: {} }).sites || {};
const arch = {};
try {
  fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
    const c = l.split(',');
    if (c[0]) arch[c[0].trim()] = (c[2] || '').trim();
  });
} catch (e) {}

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
Object.keys(presets).forEach(function (host) {
  const p = presets[host];
  const def = {
    host: host,
    base: 'https://' + host,
    engine: p.engine || (arch[host] === 'UNIT3D' ? 'unit3d' : arch[host] === 'GZ' ? 'gazelle' : 'nexusphp'),
    login: { path: '/takelogin.php', fields: { username: 'username', password: 'password' }, method: 'POST' },
    searchPath: p.searchPath || '/torrents.php',
    params: p.params || { search: '{q}', cat: '{cats}' },
    catMode: 'single',
    cats: p.cats || {},
    rate: { minGapMs: 1000, jitterMs: 800, maxPerRun: 20 },
    note: p.note || '',
    updatedAt: p.updatedAt || null
  };
  fs.writeFileSync(path.join(OUT, host + '.json'), JSON.stringify(def, null, 1), 'utf8');
  n++;
});
console.log('wrote ' + n + ' site defs to ' + OUT);

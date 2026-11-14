/* 一次性迁移：把 v1 的 data/sites-data.local.js 基础站点清单写进 SQLite sites 表。
   不打印站名/网址；已有配置保留，只补 base:true、url、arch、title。
   用法：node pta/scripts/migrate-sites-js.js --data /path/to/data [--dry]
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = arg('--data', process.env.PTA_DATA || path.join(ROOT, '..', 'data'));
const DRY = argv.includes('--dry');
const FILE = path.join(DATA, 'sites-data.local.js');

if (!fs.existsSync(FILE)) {
  console.error('没有 sites-data.local.js，可能已经迁移过');
  process.exit(1);
}

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), sandbox, { timeout: 1000 });
const urls = Array.isArray(sandbox.window.SITE_URLS) ? sandbox.window.SITE_URLS : [];
const arch = sandbox.window.PT_ARCH || {};
const names = sandbox.window.PT_NAMES || {};
const seen = {};
const rows = [];
urls.forEach(function (u) {
  const host = String(u || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').toLowerCase();
  if (!host || seen[host]) return;
  seen[host] = 1;
  rows.push({ host: host, url: String(u), arch: arch[host] || '?', title: names[host] || host });
});

if (DRY) {
  console.log('待迁移站点 ' + rows.length + '（dry-run，未写库）');
  process.exit(0);
}

const db = new DatabaseSync(path.join(DATA, 'seedpod.db'));
db.exec('CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)');
const select = db.prepare('SELECT data FROM sites WHERE host = ?');
const upsert = db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at');
const now = new Date().toISOString();
let inserted = 0, updated = 0;
db.exec('BEGIN');
try {
  rows.forEach(function (x) {
    const prev = select.get(x.host);
    const old = prev ? (JSON.parse(prev.data) || {}) : null;
    const next = Object.assign({ url: x.url, arch: x.arch, title: x.title, base: true }, old || {});
    next.base = true;
    delete next.added;
    if (!next.url) next.url = x.url;
    if (!next.arch) next.arch = x.arch;
    if (!next.title) next.title = x.title;
    upsert.run(x.host, JSON.stringify(next), now);
    if (prev) updated++; else inserted++;
  });
  db.exec('COMMIT');
} catch (e) {
  try { db.exec('ROLLBACK'); } catch (e2) {}
  console.error('迁移失败：' + (e && e.message || e));
  process.exit(1);
}
console.log('站点清单迁移完成：新写入 ' + inserted + '，保留已有配置 ' + updated);

#!/usr/bin/env node
/* 一次性迁移：旧内容类型里的原盘/Remux/压制/样品/预告归到 other；
   旧媒介 full_disc/uhd/3d 归到 bluray 大分类。默认干跑，--write 才写。
   不打印站名/网址/cookie。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('../src/infra/json-file');
const makeStore = require('../src/features/sites/store');
const { formatSitesDoc } = require('../src/features/sites/format');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', require('../src/infra/env').read('DATA_DIR', 'PTA_DATA') || path.join(ROOT, '..', 'data')));
const WRITE = argv.includes('--write');
const store = makeStore(DATA);
store.ensureRuntime();
const raw = JSON.parse(fs.readFileSync(store.FILE, 'utf8'));
const sites = raw.sites && typeof raw.sites === 'object' ? raw.sites : {};
const out = {};
let changed = 0;
Object.keys(sites).forEach(function (h) {
  const before = JSON.stringify(sites[h]);
  const rec = store.normalizeRecord(store.fromPersisted(sites[h], h));
  const next = store.toPersisted(rec, h);
  if (JSON.stringify(next) !== before) changed++;
  out[h] = next;
});
const summary = { sites: Object.keys(sites).length, changed: changed, write: WRITE };
console.log(JSON.stringify(summary, null, 2));
if (!WRITE) return;
try { if (fs.existsSync(store.FILE)) fs.copyFileSync(store.FILE, store.FILE + '.bak'); } catch (e) { /* 备份失败不挡写入 */ }
jsonFile.writeAtomicText(store.FILE, formatSitesDoc({ version: raw.version || 1, presets: raw.presets, generatedAt: raw.generatedAt, sites: out }), 0o600);
console.log('已写入 ' + store.FILE);

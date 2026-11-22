#!/usr/bin/env node
/* 把 sites.json 里的中文类型 key 迁到全局预设 key（movie/tv/...）。
   只改 search.cats 和 publish.catMap；不打印站名和网址。
   用法：node pta/scripts/migrate-site-presets.js --data /path/to/data [--write|--check] */
const fs = require('fs');
const path = require('path');
const makeSiteStore = require('../site-store');
const jsonFile = require('../json-file');

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const DATA = path.resolve(arg('--data', process.env.PTA_DATA || path.join(__dirname, '..', '..', 'data')));
const WRITE = argv.includes('--write');
const FILE = path.join(DATA, 'sites.json');
const store = makeSiteStore(DATA);

let doc = null;
try { doc = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {
  console.error('读不到 sites.json：' + FILE);
  process.exit(1);
}
const sites = doc.sites || {};
let changed = 0, catsChanged = 0, mapChanged = 0, typesDropped = 0;
Object.keys(sites).forEach(function (host) {
  const rec = sites[host] || {};
  const before = JSON.stringify(rec);
  const oldCats = JSON.stringify((rec.search || {}).cats || {});
  const oldMap = JSON.stringify((rec.publish || {}).catMap || {});
  if ((rec.search || {}).types !== undefined) typesDropped++;
  const next = store.normalizeRecord(rec);
  if (JSON.stringify((next.search || {}).cats) !== oldCats) catsChanged++;
  if (JSON.stringify((next.publish || {}).catMap) !== oldMap) mapChanged++;
  if (JSON.stringify(next) !== before) { changed++; sites[host] = next; }
});
doc.sites = sites;
doc.presets = 'presets.preset.json';
const summary = { sites: Object.keys(sites).length, changed: changed, catsChanged: catsChanged, mapChanged: mapChanged, typesDropped: typesDropped, write: WRITE };
console.log(JSON.stringify(summary, null, 2));
if (!WRITE) process.exit(changed ? 2 : 0);
jsonFile.writeAtomic(FILE, doc, 0o600);
console.log('已写入 ' + FILE);

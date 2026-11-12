/* 一次性迁移：把 data/ 下的 JSON 文件搬进 SQLite。
   只读旧文件，不删除；跑完可以用 SQL 校验条数。 */
const fs = require('fs');
const path = require('path');
const { openDB, kvSet } = require('../pta/server/db');

const DATA = process.env.PTA_DATA || path.join(__dirname, '..', 'data');
const db = openDB(path.join(DATA, 'seedpod.db'));

function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); } catch (e) { return fallback; }
}

const now = new Date().toISOString();
let stats = {};

/* 词条库 */
const catalog = readJSON('catalog.json', { items: [] });
const insCat = db.prepare(`INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at)
  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET site=excluded.site, site_id=excluded.site_id, infohash=excluded.infohash,
    title=excluded.title, status=excluded.status, data=excluded.data, updated_at=excluded.updated_at`);
let nCat = 0;
for (const it of catalog.items || []) {
  if (!it || !it.id) continue;
  insCat.run(String(it.id), it.site || '', it.siteId != null ? String(it.siteId) : '', it.infohash || '',
    it.title || '', it.status || 'new', JSON.stringify(it), it.createdAt || now, it.updatedAt || now);
  nCat++;
}
stats.catalog = nCat;

/* 待审核队列 */
const queue = readJSON('queue.json', { items: [] });
const insQ = db.prepare(`INSERT INTO queue(id, status, title, data, created_at, updated_at)
  VALUES(?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET status=excluded.status, title=excluded.title, data=excluded.data, updated_at=excluded.updated_at`);
let nQ = 0;
for (const it of queue.items || []) {
  if (!it || !it.id) continue;
  insQ.run(String(it.id), it.status || 'pending', it.title || '', JSON.stringify(it), it.createdAt || now, now);
  nQ++;
}
stats.queue = nQ;

/* 已发布记录 */
const published = readJSON('published.json', []);
const insP = db.prepare('INSERT INTO published(id, data, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
let nP = 0;
(published || []).forEach((it, i) => {
  const id = it && (it.id || it.infohash) ? String(it.id || it.infohash) : 'pub_' + (i + 1);
  insP.run(id, JSON.stringify(it), (it && it.at) || now);
  nP++;
});
stats.published = nP;

/* 下载器 */
const dls = readJSON('downloaders.json', { items: [] });
const insD = db.prepare('INSERT INTO downloaders(id, data, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
let nD = 0;
for (const it of dls.items || []) {
  if (!it || !it.id) continue;
  insD.run(String(it.id), JSON.stringify(it), now);
  nD++;
}
stats.downloaders = nD;

/* 站点配置 */
const sc = readJSON('site-config.json', { sites: {} });
const insS = db.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at');
let nS = 0;
Object.keys(sc.sites || {}).forEach((h) => {
  insS.run(h, JSON.stringify(sc.sites[h]), now);
  nS++;
});
stats.sites = nS;

/* 凭据：cookie/password 已是密文，原样入库 */
const creds = readJSON('credentials.json', {});
const insC = db.prepare('INSERT INTO credentials(host, cookie, password, user, updated_at) VALUES(?, ?, ?, ?, ?) ON CONFLICT(host) DO UPDATE SET cookie=excluded.cookie, password=excluded.password, user=excluded.user, updated_at=excluded.updated_at');
let nC = 0;
Object.keys(creds || {}).forEach((h) => {
  const c = creds[h] || {};
  insC.run(h, c.cookie || null, c.password || null, c.user || null, c.updatedAt || now);
  nC++;
});
stats.credentials = nC;

/* 配置与流程规则 */
kvSet(db, 'config', readJSON('config.json', {}));
kvSet(db, 'flow', readJSON('flow.json', {}));
kvSet(db, 'site-config-meta', { hidden: (sc && sc.hidden) || [] });
kvSet(db, 'crawl-state', readJSON('crawl-state.json', {}));
kvSet(db, 'migratedAt', now);

console.log('migrated', JSON.stringify(stats));
const cnt = (t) => db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n;
console.log('verify', JSON.stringify({ catalog: cnt('catalog'), queue: cnt('queue'), sites: cnt('sites'), downloaders: cnt('downloaders'), credentials: cnt('credentials'), published: cnt('published') }));
db.close();

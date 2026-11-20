/* 初筛类型闸门 + host 前置过滤 + queue id MAX。纯临时库。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { screenCatalog } = require('../server/screen');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-screen-'));
const db = openDB(path.join(DATA, 'seedpod.db'));
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const jparse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const ctx = { db: db, DATA_DIR: DATA, one: one, all: all, jparse: jparse };
const now = new Date().toISOString();
const results = [];
function check(name, fn) { return Promise.resolve().then(fn).then(() => results.push([true, name, ''])).catch(e => results.push([false, name, e && e.message ? e.message : String(e)])); }
function need(c, m) { if (!c) throw new Error(m); }
function cat(id, title, site, catName) {
  const d = { id: id, site: site, siteId: id, title: title, cat: catName, catName: catName, status: 'new', downloadUrl: 'https://' + site + '/download.php?id=1' };
  db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, site, id, '', title, 'new', JSON.stringify(d), now, now);
}
function q(id, title) {
  const d = { id: id, title: title, status: 'pending', stage: 'draft' };
  db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').run(id, 'pending', title, JSON.stringify(d), now, now);
}

(async function () {
  try {
    fs.writeFileSync(path.join(DATA, 'site-maps.json'), JSON.stringify({ version: 1, sites: { 'source.example': { cat: { '电影': '401', '音乐': '413' } } } }, null, 2));
    db.prepare("INSERT INTO meta(k, v) VALUES('flow', ?)").run(JSON.stringify({ sets: { fetch: [[{ t: '类型', sel: ['电影'] }]] } }));
    cat('cat_000001', 'Music Video 2024 1080p', 'source.example', '413');
    cat('cat_000002', 'Movie 2024 1080p', 'source.example', '401');
    await check('类型不符的 413 不进入队列，电影分类进入且 catName 可读', async function () {
      const r = screenCatalog(ctx, { limit: 10 });
      need(r.checked === 2, 'checked 不对：' + JSON.stringify(r));
      need(r.skipped === 1 && r.selected === 1, 'selected/skipped 不对：' + JSON.stringify(r));
      need((r.byReason['类型不符 音乐'] || 0) === 1, '没有类型不符原因：' + JSON.stringify(r.byReason));
      const qs = all('SELECT data FROM queue').map(function (x) { return jparse(x.data); });
      need(qs.length === 1 && qs[0].catName === '电影', '队列分类不对：' + JSON.stringify(qs));
    });
    await check('前 500 条都跳过时，新条目仍能送审', async function () {
      const base = Date.now();
      for (let i = 0; i < 505; i++) {
        const id = 'cat_' + String(100 + i).padStart(6, '0');
        const d = { id: id, site: 'source.example', siteId: id, title: 'Music Filler ' + i + ' 2024', cat: '413', catName: '413', status: 'new' };
        db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, 'source.example', id, '', d.title, 'new', JSON.stringify(d), new Date(base + i).toISOString(), new Date(base + i).toISOString());
      }
      cat('cat_999999', 'Latest Movie 2024 1080p', 'source.example', '401');
      db.prepare("UPDATE catalog SET created_at = ? WHERE id = 'cat_999999'").run(new Date(base + 9999).toISOString());
      const r = screenCatalog(ctx, { limit: 5 });
      need(r.selected === 1, '最新电影没被送审：' + JSON.stringify(r));
      const qs = all('SELECT title FROM queue').map(function (x) { return x.title; });
      need(qs.indexOf('Latest Movie 2024 1080p') >= 0, '队列里没有最新电影：' + JSON.stringify(qs));
    });

    await check('queue id 从 MAX 生成，不因空洞冲突', async function () {
      q('q_0003', 'Existing Gap 2024');
      cat('cat_000003', 'Movie Two 2024 1080p', 'source.example', '401');
      const r = screenCatalog(ctx, { limit: 10 });
      need(r.selected === 1, '第二轮没选中：' + JSON.stringify(r));
      const ids = all('SELECT id FROM queue ORDER BY id').map(function (x) { return x.id; });
      need(ids.indexOf('q_0004') >= 0, '没有生成 q_0004：' + JSON.stringify(ids));
    });
    await check('数字分类没映射时不放行', async function () {
      const d = { id: 'cat_800001', site: 'source.example', siteId: 'x1', title: 'Unknown Cat 2024 1080p', cat: '999', catName: '999', status: 'new' };
      db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(d.id, d.site, d.siteId, '', d.title, 'new', JSON.stringify(d), new Date().toISOString(), new Date().toISOString());
      const r = screenCatalog(ctx, { limit: 5 });
      need((r.byReason['类型未知 999'] || 0) === 1, '未映射数字分类没被拦：' + JSON.stringify(r.byReason));
    });

    await check('跨站同片只留一条，后到的记 dupeOf', async function () {
      const a = { id: 'cat_700001', site: 'a.example', siteId: '1', title: 'Same Movie 2024 1080p', cat: '401', catName: '电影', status: 'new', infohash: 'abc123' };
      const b = { id: 'cat_700002', site: 'b.example', siteId: '2', title: 'Same Movie 2024 1080p', cat: '401', catName: '电影', status: 'new', infohash: 'abc123' };
      [a, b].forEach(function (d) {
        db.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(d.id, d.site, d.siteId, d.infohash, d.title, 'new', JSON.stringify(d), new Date().toISOString(), new Date().toISOString());
      });
      const r = screenCatalog(ctx, { limit: 5 });
      need(r.selected === 1 && (r.byReason['已有同片'] || 0) === 1, '跨站同片没跳过：' + JSON.stringify(r));
      const kept = all("SELECT id, data FROM queue WHERE title = 'Same Movie 2024 1080p'");
      need(kept.length === 1, '队列里同片不是一条：' + kept.length);
      const rows = all("SELECT data FROM catalog WHERE id IN ('cat_700001', 'cat_700002')").map(function (x) { return jparse(x.data); });
      const sk = rows.filter(function (x) { return x.status === 'skipped'; })[0];
      const sel = rows.filter(function (x) { return x.status === 'selected'; })[0];
      need(sk && sel && sk.dupeOf === kept[0].id, 'dupeOf 没指向保留词条：' + JSON.stringify({ rows: rows.map(function (x) { return { id: x.id, status: x.status, dupeOf: x.dupeOf }; }), kept: kept[0].id }));
      need(sk.skipReason === '已有同片' && sk.skippedAt, '跳过原因/时间没记：' + JSON.stringify(sk));
    });

  } finally {
    db.close();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

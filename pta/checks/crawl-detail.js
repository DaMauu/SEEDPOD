/* 详情补抓：当前页优先，剩下的从 catalog 缺详情条目里按入库时间补；
   验证“每页只抓前 10 条、后面永远轮不到”的回归。纯本地 fetch 桩，不联网。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../server/db');
const { makeCrawl } = require('../server/crawl');
const secretbox = require('../server/secretbox');
const dns = require('dns');
const makeSiteStore = require('../server/site-store');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-detail-'));
const HOST = 'detail.example';
const listHtml = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nexusphp-browse.html'), 'utf8');
const detailHtml = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nexusphp-details.html'), 'utf8');

(async function () {
  let core = null;
  let realFetch = null;
  const siteStore = makeSiteStore(DATA);
  const realLookup = dns.promises.lookup;
  dns.promises.lookup = async function (h) {
    const host = String(h || '').toLowerCase();
    if (host === HOST) return [{ address: '203.0.113.10', family: 4 }];
    const e = new Error('mock ENOTFOUND'); e.code = 'ENOTFOUND'; throw e;
  };
  try {
    fs.mkdirSync(path.join(DATA, 'site-defs'), { recursive: true });
    fs.writeFileSync(path.join(DATA, 'site-defs', HOST + '.json'), JSON.stringify({
      engine: 'nexusphp', base: 'https://detail.example', searchPath: '/torrents.php',
      params: { name: '{q}', 'categories[0]': '{cats}' }, catMode: 'single', catMap: { '电影': '401', '剧集': '402' }
    }, null, 2));
    fs.writeFileSync(path.join(DATA, 'site-search.local.json'), JSON.stringify({ sites: { [HOST]: { types: ['电影'], cats: { 电影: ['401'] } } } }, null, 2));

    const db = openDB(path.join(DATA, 'seedpod.db'));
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)').run(HOST, JSON.stringify({
      url: 'https://detail.example/', arch: 'NP', title: 'Detail Fixture', enabled: true, base: true
    }), now);
    const key = secretbox.loadKey(DATA);
    db.prepare('INSERT OR REPLACE INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?)')
      .run(HOST, secretbox.encrypt('session=fixture', key.key), now);
    db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify({
      detail: true, listInterval: 6, interval: 8, windowMinutes: 60, maxPerWindow: 100, realCrawl: true
    }));
    db.close();

    realFetch = global.fetch;
    global.fetch = async function (url) {
      const u = String(url);
      const html = /details\.php/i.test(u) ? detailHtml : listHtml;
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    };
    const db2 = openDB(path.join(DATA, 'seedpod.db'));
    const one = function (sql, ...args) { return db2.prepare(sql).get(...args); };
    const all = function (sql, ...args) { return db2.prepare(sql).all(...args); };
    const jparse = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
    core = makeCrawl({ db: db2, DATA_DIR: DATA, one: one, all: all, jparse: jparse, allowReal: function () { return true; }, logEvent: function () {} });
    global.__detailDb = db2;
    function resetGaps() {
      const row = one("SELECT v FROM meta WHERE k = 'crawl-state'");
      const st = row ? JSON.parse(row.v) : {};
      const rec = st[HOST] || {};
      rec.lastAt = 0;
      rec.lastListAt = 0;
      rec.lastDetailAt = 0;
      st[HOST] = rec;
      db2.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
    }

    await check('详情按轮补齐，不重复抓前几条', async function () {
      const r1 = await core.crawlOnce(HOST, { limit: 100, detail: true, detailLimit: 1 });
      need(r1 && !r1.err, '第一轮失败：' + JSON.stringify(r1));
      need(r1.detail && r1.detail.tried === 1 && r1.detail.ok === 1, '第一轮详情数量不对：' + JSON.stringify(r1.detail));
      let rows = all("SELECT data FROM catalog WHERE site = ? ORDER BY id", HOST).map(function (x) { return jparse(x.data); });
      need(rows.length === 3, '第一轮入库数量不对：' + rows.length);
      need(rows.filter(function (x) { return x.detailAt; }).length === 1, '第一轮应只补 1 条详情');

      resetGaps();
      const r2 = await core.crawlOnce(HOST, { limit: 100, detail: true, detailLimit: 1 });
      need(r2 && !r2.err, '第二轮失败：' + JSON.stringify(r2));
      need(r2.detail.tried === 1, '第二轮不该重复抓已补过的：' + JSON.stringify(r2.detail));
      rows = all("SELECT data FROM catalog WHERE site = ? ORDER BY id", HOST).map(function (x) { return jparse(x.data); });
      need(rows.filter(function (x) { return x.detailAt; }).length === 2, '第二轮应累计 2 条详情');

      resetGaps();
      const r3 = await core.crawlOnce(HOST, { limit: 100, detail: true, detailLimit: 1 });
      need(r3 && !r3.err, '第三轮失败：' + JSON.stringify(r3));
      rows = all("SELECT data FROM catalog WHERE site = ? ORDER BY id", HOST).map(function (x) { return jparse(x.data); });
      need(rows.filter(function (x) { return x.detailAt; }).length === 3, '第三轮后 3 条都应有详情：' + rows.map(function (x) { return !!x.detailAt; }));

      resetGaps();
      const r4 = await core.crawlOnce(HOST, { limit: 100, detail: true, detailLimit: 1 });
      need(r4 && !r4.err, '第四轮失败：' + JSON.stringify(r4));
      need(r4.detail.tried === 0 && r4.detail.backlog === 0, '补完后不该再抓详情：' + JSON.stringify(r4.detail));
    });

    await check('改分类预设不清 fullDoneAt', async function () {
      const row = one("SELECT v FROM meta WHERE k = 'crawl-state'");
      const st = row ? JSON.parse(row.v) : {};
      st[HOST] = st[HOST] || {};
      st[HOST].fullDoneAt = '2026-01-01T00:00:00Z';
      st[HOST].page = 0;
      db2.prepare("INSERT INTO meta(k, v) VALUES('crawl-state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(st));
      fs.writeFileSync(path.join(DATA, 'site-search.local.json'), JSON.stringify({ sites: { [HOST]: { types: ['电影'], cats: { 电影: ['401', '402'] } } } }, null, 2));
      resetGaps();
      const r = await core.crawlOnce(HOST, { limit: 100, detail: false });
      need(r && !r.err, '改预设后抓取失败：' + JSON.stringify(r));
      const row2 = one("SELECT v FROM meta WHERE k = 'crawl-state'");
      const st2 = row2 ? JSON.parse(row2.v) : {};
      need(st2[HOST] && st2[HOST].fullDoneAt, '改分类预先把全量标记清掉了');
    });
    await check('详情地址跨站时不带 cookie 去抓', async function () {
      db2.prepare('INSERT INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('ext_detail_1', HOST, '999', '', 'External Detail', 'new', JSON.stringify({
          site: HOST, siteId: '999', title: 'External Detail', sizeBytes: 1024,
          detailsUrl: 'https://evil.example/details.php?id=999', downloadUrl: 'https://evil.example/dl.php?id=999'
        }), new Date().toISOString(), new Date().toISOString());
      const seen = [];
      global.fetch = async function (url, opts) {
        const u = String(url);
        seen.push({ url: u, cookie: (opts && opts.headers && opts.headers.cookie) || '' });
        const html = /details\.php/i.test(u) ? detailHtml : listHtml;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      };
      resetGaps();
      const r = await core.crawlOnce(HOST, { limit: 100, detail: true, detailLimit: 1 });
      need(r && !r.err, '跨站详情轮次失败：' + JSON.stringify(r && r.err));
      const evil = seen.filter(function (x) { return x.url.indexOf('evil.example') >= 0; });
      need(evil.length === 0, '跨站详情被请求了：' + JSON.stringify(evil));
      const row = one("SELECT data FROM catalog WHERE id = 'ext_detail_1'");
      const it = jparse(row.data);
      need(/不是来源站/.test(String(it.detailNote || '')), '跨站详情没记原因：' + it.detailNote);
      need(r.detail.failed >= 1, '跨站详情没计入失败：' + JSON.stringify(r.detail));
    });

    await check('列表页域名解析到内网时拒绝抓取', async function () {
      const seen = [];
      global.fetch = async function (url) {
        seen.push(String(url));
        return new Response(listHtml, { status: 200, headers: { 'content-type': 'text/html' } });
      };
      const pub = dns.promises.lookup;
      dns.promises.lookup = async function (h) {
        if (String(h || '').toLowerCase() === HOST) return [{ address: '10.0.0.7', family: 4 }];
        return pub(h);
      };
      try {
        resetGaps();
        const r = await core.crawlOnce(HOST, { limit: 10, detail: false });
        need(r && r.err && /内网/.test(String(r.err.message || '')), '内网解析没拦住：' + JSON.stringify(r && r.err));
        need(seen.length === 0, '拦住后还发了请求：' + seen.join(' , '));
      } finally { dns.promises.lookup = pub; }
    });

    await check('已移除站点拒绝抓取且不发请求', async function () {
      const seen = [];
      global.fetch = async function (url) { seen.push(String(url)); return new Response(listHtml, { status: 200 }); };
      siteStore.setHidden(HOST, true, db2);
      try {
        resetGaps();
        const r = await core.crawlOnce(HOST, { limit: 10, detail: false });
        need(r && r.err && r.err.code === 'SITE_HIDDEN', '已移除站点没拦住：' + JSON.stringify(r && r.err));
        need(seen.length === 0, '拦住后还发了请求：' + seen.join(' , '));
      } finally { siteStore.setHidden(HOST, false, db2); }
    });

    await check('没有保存类型时拒绝抓取，不静默全分类', async function () {
      const cur = siteStore.get(HOST);
      siteStore.save(HOST, { search: Object.assign({}, cur.search, { types: [], cats: {} }) }, db2);
      resetGaps();
      const r = await core.crawlOnce(HOST, { limit: 100, detail: false });
      need(r && r.err && r.err.code === 'NO_CATEGORY_TYPES', '缺 types 没拦住：' + JSON.stringify(r));
      siteStore.save(HOST, { search: Object.assign({}, cur.search, { cats: { '电影': ['401'] } }) }, db2);
    });
  } finally {
    dns.promises.lookup = realLookup;
    if (global.fetch !== realFetch) global.fetch = realFetch;
    if (global.__detailDb) { try { global.__detailDb.close(); } catch (e) { /* 忽略 */ } }
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

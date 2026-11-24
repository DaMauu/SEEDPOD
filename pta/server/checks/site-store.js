/* site-store：首次复制 preset、读写 sites.json/site-urls.json、原子写/.bak/锁。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../src/infra/db');
const makeSiteStore = require('../src/features/sites/store');
const uploadLock = require('../src/infra/upload-lock');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sitestore-'));
const PRESET = path.join(DATA, 'preset');
fs.mkdirSync(PRESET, { recursive: true });
const b64 = function (s) { return 'b64:' + Buffer.from(s, 'utf8').toString('base64'); };
fs.writeFileSync(path.join(PRESET, 'sites.preset.json'), JSON.stringify({
  version: 1,
  sites: {
    'site-a.example': {
      name: 'Site A', nameZh: '站点甲', engine: 'nexusphp',
      urlRef: 'site-urls.json#site-a.example',
      search: { path: '/torrents.php', params: {}, cats: { '电影': ['401'] }, types: ['电影'] },
      publish: { upload: { path: '/takeupload.php', fields: {} }, verify: { path: '/torrents.php?search={title}' }, catMap: { movie: '999' }, catLabels: { '电影': '999' } },
      localEdited: false
    }
  }
}, null, 2));
fs.writeFileSync(path.join(PRESET, 'site-urls.preset.json'), JSON.stringify({
  version: 1,
  sites: { 'site-a.example': { base: b64('https://site-a.example'), upload: b64('/takeupload.php'), verify: b64('/torrents.php?search={title}') } }
}, null, 2));
const db = openDB(path.join(DATA, 'seedpod.db'));
const store = makeSiteStore(DATA, { presetDir: PRESET });
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }

(async function () {
  try {
    await check('首次读取从 preset 复制并解码网址', async function () {
      const s = store.get('site-a.example');
      need(s && s.name === 'Site A', '站点没读到：' + JSON.stringify(s));
      need(s.url.base === 'https://site-a.example', 'base 解不出：' + JSON.stringify(s.url));
      need(s.url.upload === '/takeupload.php', 'upload 解不出');
      need(s.settings.enabled === false && s.settings.hidden === false, '默认 settings 不对：' + JSON.stringify(s.settings));
      need(store.has('site-a.example') === true, 'has 不对');
      need(store.list().length === 1, 'list 数量不对');
      need((fs.statSync(store.FILE).mode & 0o777) === 0o600, 'sites.json 权限不是 0600');
    });

    await check('保存 settings/网址写回，并留 .bak', async function () {
      const r = store.save('site-a.example', { settings: { enabled: true, interval: 6 }, url: { base: 'https://new.example' }, localEdited: true }, db);
      need(r.ok && r.site.settings.enabled === true && r.site.settings.interval === 6, '保存结果不对：' + JSON.stringify(r));
      need(r.site.url.base === 'https://new.example', '网址没更新');
      need(fs.existsSync(store.FILE + '.bak'), '没留 .bak');
      const again = store.get('site-a.example');
      need(again.settings.enabled === true && again.url.base === 'https://new.example', '重新读不对：' + JSON.stringify(again));
    });

    await check('sites.json 是新结构且块状排版', async function () {
      const { formatSitesDoc } = require('../src/features/sites/format');
      const text = fs.readFileSync(store.FILE, 'utf8');
      const doc = JSON.parse(text);
      const site = doc.sites['site-a.example'] || {};
      need(!!site.meta && site.meta.name === 'Site A', '缺 meta：' + JSON.stringify(site));
      need(site.search && site.search.type && site.search.type.movie && site.search.type.movie[0] === '401', 'search.type 不对：' + JSON.stringify(site.search));
      need(site.publish && site.publish.type && site.publish.type.movie === '999', 'publish.type 不对：' + JSON.stringify(site.publish));
      need(site.settings && site.settings.enabled === true, 'settings 没写到站点块');
      need(site.name === undefined && site.cats === undefined && site.catMap === undefined, '还残留旧字段');
      need(text === formatSitesDoc(doc), 'sites.json 不是块状格式');
    });

    await check('制作组过滤条件保存不丢', async function () {
      const cur = store.get('site-a.example');
      const search = Object.assign({}, cur.search, {
        filters: {
          values: { team: { BTS: '1' } },
          params: { team: { BTS: 'team1' } },
          selected: { team: ['BTS'] }
        }
      });
      const r = store.save('site-a.example', { search: search }, db);
      need(r.ok, '保存失败：' + JSON.stringify(r));
      const again = store.get('site-a.example');
      need(again.search.filters.values.team.BTS === '1', 'team 值丢了：' + JSON.stringify(again.search.filters));
      need(again.search.filters.params.team.BTS === 'team1', 'team 参数名丢了：' + JSON.stringify(again.search.filters));
      need(JSON.stringify(again.search.filters.selected.team) === JSON.stringify(['BTS']), 'team 选中项丢了：' + JSON.stringify(again.search.filters));
    });

    await check('新增/隐藏/删除站点', async function () {
      const a = store.add('site-b.example', { name: 'Site B', engine: 'unit3d', url: { base: 'https://site-b.example' } }, db);
      need(a.ok && store.has('site-b.example'), '新增失败：' + JSON.stringify(a));
      const h = store.setHidden('site-b.example', true, db);
      need(h.ok && store.get('site-b.example').settings.hidden === true, '隐藏失败');
      const d = store.remove('site-b.example', db);
      need(d.ok && d.removed && !store.has('site-b.example'), '删除失败：' + JSON.stringify(d));
    });

    await check('写入锁被占用时返回 SITE_BUSY', async function () {
      need(uploadLock.acquire('sites', db) === true, '预占锁失败');
      try {
        const r = store.save('site-a.example', { settings: { note: 'x' } }, db);
        need(r.ok === false && r.code === 'SITE_BUSY', '没拦住：' + JSON.stringify(r));
      } finally { uploadLock.release('sites', db); }
    });

    await check('非法 host 被拒绝', async function () {
      const r = store.save('../bad', {}, db);
      need(r.ok === false && r.code === 'BAD_HOST', '非法 host 没拦住：' + JSON.stringify(r));
    });
    await check('legacyDef/targetDef 从旧表迁移后可用', async function () {
      const LEG = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sitestore-legacy-'));
      try {
        fs.mkdirSync(path.join(LEG, 'site-defs'), { recursive: true });
        fs.writeFileSync(path.join(LEG, 'site-defs', 'legacy.example.json'), JSON.stringify({
          engine: 'nexusphp', base: 'https://legacy.example', searchPath: '/torrents.php',
          cats: { '电影': ['401'] },
          upload: { path: '/takeupload.php', fileField: 'file', fields: { name: '{title}' } },
          verify: { path: '/torrents.php?search={title}' },
          catMap: [{ id: '999', label: '电影', purpose: 'movie' }]
        }));
        fs.writeFileSync(path.join(LEG, 'site-search.local.json'), JSON.stringify({ sites: { 'legacy.example': { cats: { '电影': ['401'] }, types: ['电影'] } } }));
        fs.writeFileSync(path.join(LEG, 'site-maps.json'), JSON.stringify({ sites: { 'legacy.example': { cat: { '电影': '999' } } } }));
        const ldb = openDB(path.join(LEG, 'seedpod.db'));
        ldb.prepare('INSERT INTO sites(host, data, updated_at) VALUES(?,?,?)').run('legacy.example', JSON.stringify({ title: 'Legacy', enabled: true, interval: 6 }), new Date().toISOString());
        const lstore = makeSiteStore(LEG);
        const def = lstore.legacyDef('legacy.example');
        need(def && def.base === 'https://legacy.example' && def.types[0] === '电影', 'legacyDef 不对：' + JSON.stringify(def));
        need(def.catList.some(function (x) { return x.id === '401'; }), 'catList 没生成');
        const td = lstore.targetDef('legacy.example');
        need(td && td.upload.path === '/takeupload.php' && td.catMap.movie === '999', 'targetDef 不对：' + JSON.stringify(td));
        ldb.close();
      } finally { fs.rmSync(LEG, { recursive: true, force: true }); }
    });

  } finally {
    try { db.close(); } catch (e) { /* 已关 */ }
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }
  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

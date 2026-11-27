/* 全局预设检查：类型/搜索维度只有一份；站点 cats/catMap 只写 key。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const makePresets = require('../src/features/presets/store');
const makeSiteStore = require('../src/features/sites/store');

const ROOT = path.resolve(__dirname, '..', '..');
const PRESETS = path.join(ROOT, 'server', 'pack', 'presets.preset.json');
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(c, m) { if (!c) throw new Error(m); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

(async function () {
  const doc = read(PRESETS);
  const presets = makePresets();

  await check('全局类型覆盖需求清单且 key 唯一', async function () {
    const want = ['电影', '剧集', '综艺', '动漫', '纪录片', '音乐', '演唱会', '音乐短片', '体育', '游戏',
      '软件', '电子书', '有声书', '短剧', '舞台演出', '成人', '图片', '其他'];
    const got = Object.keys(doc.types || {}).map(function (k) { return doc.types[k]; });
    need(JSON.stringify(got) === JSON.stringify(want), '类型清单不一致：' + JSON.stringify(got));
    const keys = Object.keys(doc.types || {});
    need(keys.length === new Set(keys).size, '类型 key 有重复');
    keys.forEach(function (k) { need(/^[a-z0-9_]+$/.test(k), '类型 key 不是英文小写：' + k); });
  });

  await check('搜索维度齐全：媒介/分辨率/优惠/限制', async function () {
    const s = doc.search || {};
    need(Object.keys(s.medium || {}).length === 10, '媒介数量不对');
    need(Object.keys(s.resolution || {}).length === 7, '分辨率数量不对');
    need(Object.keys(s.discount || {}).length === 8, '优惠数量不对');
    need(Object.keys(s.restriction || {}).length === 5, '限制数量不对');
    need(s.medium.bluray === 'Blu-ray', '媒介缺少 Blu-ray');
    need(s.resolution['4320p'] === '4320p/8K', '分辨率缺少 4320p/8K');
    need(s.discount['2x_free'] === '2x 免费', '优惠缺少 2x 免费');
    need(s.restriction.hr === 'HR', '限制缺少 HR');
  });

  await check('中文名/旧 key/英文别名都能归一到同一个 key', async function () {
    need(presets.keyOf('电影') === 'movie' && presets.keyOf('Movies') === 'movie' && presets.keyOf('film') === 'movie', '电影别名不对');
    need(presets.keyOf('紀錄片') === 'documentary' && presets.keyOf('動畫') === 'anime', '繁体类型没归一：' + presets.keyOf('紀錄片') + '/' + presets.keyOf('動畫'));
    need(presets.keyOfDim('discount', '免費') === 'free', '繁体免费没归一：' + presets.keyOfDim('discount', '免費'));
    need(presets.keyOfDim('discount', '半價') === 'half', '繁体半价没归一：' + presets.keyOfDim('discount', '半價'));
    need(presets.keyOfDim('discount', '兩倍') === '2x', '繁体两倍没归一：' + presets.keyOfDim('discount', '兩倍'));
    need(presets.keyOfDim('restriction', '禁轉') === 'no_repost' && presets.keyOfDim('restriction', '限轉') === 'limited_repost', '繁体限制没归一');
    need(presets.keyOfDim('medium', '藍光') === 'bluray', '繁体蓝光没归一');
    const cases = [['电影', 'movie'], ['电视剧', 'tv'], ['纪录', 'documentary'], ['体育', 'sports'],
      ['电子书', 'ebook'], ['动画', 'anime'], ['演唱', 'concert'], ['其它', 'other'], ['doc', 'documentary'], ['sport', 'sports']];
    cases.forEach(function (c) { need(presets.keyOf(c[0]) === c[1], c[0] + ' 没归一到 ' + c[1] + '：' + presets.keyOf(c[0])); });
    need(presets.labelOf('movie') === '电影', 'movie 中文名不对');
    need(presets.keyOfDim('medium', 'TVRip') === 'hdtv', 'TVRip 应归 HDTV：' + presets.keyOfDim('medium', 'TVRip'));
    need(presets.keyOfDim('medium', 'LaserDisc') === 'other', 'LaserDisc 应归 Other：' + presets.keyOfDim('medium', 'LaserDisc'));
    need(presets.keyOfDim('audio', 'DTSMA') === 'dts_hd', 'DTSMA 应归 DTS-HD：' + presets.keyOfDim('audio', 'DTSMA'));
    need(presets.keyOfDim('audio', 'PCM') === 'lpcm', 'PCM 应归 LPCM：' + presets.keyOfDim('audio', 'PCM'));
    need(presets.keyOfDim('resolution', 'SD') === '480p', 'SD 应归 480p：' + presets.keyOfDim('resolution', 'SD'));
    need(presets.keyOfDim('medium', 'Blu-ray Remux') === 'remux', 'Blu-ray Remux 应归 Remux：' + presets.keyOfDim('medium', 'Blu-ray Remux'));
    need(presets.keyOfDim('medium', '4K UHD Remux') === 'remux', '4K UHD Remux 应归 Remux：' + presets.keyOfDim('medium', '4K UHD Remux'));
    need(presets.keyOfDim('medium', 'Blu-ray DIY') === 'bluray', 'Blu-ray DIY 应归 Blu-ray：' + presets.keyOfDim('medium', 'Blu-ray DIY'));
    need(presets.keyOfDim('medium', '2K原盘中字（国粤语）') === 'full_disc', '2K原盘中字应归原盘：' + presets.keyOfDim('medium', '2K原盘中字（国粤语）'));
  });

  await check('站点只存 key：读取时中文自动补齐，保存时中文自动归一', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-presets-'));
    const preset = path.join(dir, 'preset');
    fs.mkdirSync(preset, { recursive: true });
    fs.writeFileSync(path.join(preset, 'sites.preset.json'), JSON.stringify({ version: 1, sites: {
      'a.example': { name: 'A', engine: 'nexusphp', urlRef: 'site-urls.json#a.example',
        search: { path: '/t', cats: { '电影': ['401'], movie: ['402'], doc: ['403'] }, types: ['电影'] },
        publish: { catMap: { '电影': '401', movie: '402', doc: '403' }, catLabels: {} } }
    } }, null, 2));
    fs.writeFileSync(path.join(preset, 'site-urls.preset.json'), JSON.stringify({ version: 1, sites: {
      'a.example': { base: 'b64:' + Buffer.from('https://a.example').toString('base64') }
    } }, null, 2));
    try {
      const store = makeSiteStore(dir, { presetDir: preset });
      const s = store.get('a.example');
      need(JSON.stringify(Object.keys(s.search.cats)) === JSON.stringify(['movie', 'documentary']), 'cats key 没归一：' + JSON.stringify(s.search.cats));
      need(JSON.stringify(s.search.cats.movie) === JSON.stringify(['401', '402']), '同类型 ID 没合并');
      need(JSON.stringify(s.search.types) === JSON.stringify(['电影', '纪录片']), 'types 没派生：' + JSON.stringify(s.search.types));
      need(s.publish.catMap.movie === '402', '发布映射没保留 key 值：' + JSON.stringify(s.publish.catMap));
      need(!Object.prototype.hasOwnProperty.call(s.publish.catMap, '电影'), '发布映射还留中文 key');
      need(store.targetDef('a.example').catMap['电影'] === '402', 'targetDef 没补中文别名');
      store.save('a.example', { search: Object.assign({}, s.search, { cats: { '剧集': ['501'] } }) });
      const raw = JSON.parse(fs.readFileSync(store.FILE, 'utf8'));
      const rec = raw.sites['a.example'];
      need(JSON.stringify(Object.keys(rec.search.type)) === JSON.stringify(['tv']), '保存后没写 key：' + JSON.stringify(rec.search.type));
      need(rec.search.types === undefined, '保存后不该再存 types');
      need(rec.meta && rec.meta.name === 'A', '保存后缺 meta');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await check('旧过滤条件归一到全局 key，长选项名不再进站点 JSON', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-filters-'));
    try {
      fs.writeFileSync(path.join(dir, 'sites.json'), JSON.stringify({ version: 1, sites: {
        'f.example': { name: 'F', engine: 'nexusphp', urlRef: 'site-urls.json#f.example', publish: { catMap: { '电影': '401', tv: '2' }, catLabels: { '电影': '401' } },
          search: { path: '/t', cats: { '电影': ['401'] },
            filters: { map: { spstate: { '普通（下载量全计量 没标记的所谓黑种）': '1', 'Free（下载量不统计）': '2', '2X 50%（上传量2倍统计 下载50%统计）': '6' } },
              selectedLabels: { spstate: ['普通', '免费'] }, selectedValues: { spstate: ['1', '2'] } } } }
      } }));
      fs.writeFileSync(path.join(dir, 'site-urls.json'), JSON.stringify({ version: 1, sites: { 'f.example': { base: 'b64:' + Buffer.from('https://f.example').toString('base64') } } }));
      const st = makeSiteStore(dir);
      const r = st.get('f.example');
      need(!r.publish.catLabels, 'catLabels 没删');
      need(r.publish.catMap.movie === '401' && r.publish.catMap.tv === '2', '发布 key 没归一');
      const f = r.search.filters;
      need(!f.map && !f.selectedLabels && !f.selectedValues, '旧过滤字段没删：' + JSON.stringify(f));
      need(f.values.discount.normal === '1' && f.values.discount.free === '2' && f.values.discount['2x_half'] === '6', '优惠值没归一：' + JSON.stringify(f.values));
      need(JSON.stringify(f.selected.discount) === JSON.stringify(['normal', 'free']), '选中项没归一：' + JSON.stringify(f.selected));
      st.save('f.example', { search: Object.assign({}, r.search, { filters: f }) });
      const raw = JSON.parse(fs.readFileSync(st.FILE, 'utf8')).sites['f.example'];
      need(raw.search.discount.normal === 'spstate = 1' && raw.search.discount.free === 'spstate = 2', '优惠没写进 search.discount：' + JSON.stringify(raw.search.discount));
      need(raw.search.type.movie[0] === '401' && raw.publish.type.movie === '401', '分类没写进 type');
      need(!raw.publish.catLabels && !raw.search.cats, '保存后又写回旧字段');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await check('首次启动把 pack 模板复制成 data/presets.json，之后以 data 为准', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-preset-copy-'));
    try {
      const p1 = makePresets(dir);
      need(p1.types().movie === '电影', '模板没读出来');
      const file = path.join(dir, 'presets.json');
      need(fs.existsSync(file), '首次读取没生成 data/presets.json');
      need((fs.statSync(file).mode & 0o777) === 0o600, '运行时预设权限不是 0600');
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const pack = read(PRESETS);
      need(JSON.stringify(raw.types) === JSON.stringify(pack.types), '复制内容与 pack 不一致');
      raw.types.custom = '自定义';
      fs.writeFileSync(file, JSON.stringify(raw, null, 2));
      const p2 = makePresets(dir);
      need(p2.types().custom === '自定义', '用户新增类型没生效');
      p2.ensure();
      const after = JSON.parse(fs.readFileSync(file, 'utf8'));
      need(after.types.custom === '自定义', 'ensure 覆盖了用户文件');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await check('limits/downloadLink/refreshCron 和未知字段保存时不丢', async function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sitefields-'));
    try {
      fs.writeFileSync(path.join(dir, 'sites.json'), JSON.stringify({ version: 1, sites: {
        'x.example': { name: 'X', engine: 'nexusphp', urlRef: 'site-urls.json#x.example', search: { path: '/t', cats: {} }, publish: { catMap: {} } }
      } }));
      fs.writeFileSync(path.join(dir, 'site-urls.json'), JSON.stringify({ version: 1, sites: { 'x.example': { base: 'b64:' + Buffer.from('https://x.example').toString('base64') } } }));
      const st = makeSiteStore(dir);
      const first = st.get('x.example');
      need(Object.prototype.hasOwnProperty.call(first, 'limits'), '缺 limits');
      need(first.downloadLink === '' && first.refreshCron === '', '缺 downloadLink/refreshCron 默认值');
      st.save('x.example', {
        limits: { perHour: 20, perDay: 100 },
        downloadLink: '/download.php?id={ID}',
        refreshCron: '0 */4 * * *',
        customField: { keep: true }
      });
      st.save('x.example', { settings: { note: '改个备注' } });
      const raw = JSON.parse(fs.readFileSync(st.FILE, 'utf8')).sites['x.example'];
      need(JSON.stringify(raw.search.limits) === JSON.stringify({ perHour: 20, perDay: 100 }), 'limits 丢了：' + JSON.stringify(raw.search.limits));
      need(raw.search.downloadLink === '/download.php?id={ID}', 'downloadLink 丢了');
      need(raw.search.refreshCron === '0 */4 * * *', 'refreshCron 丢了');
      need(raw.extra && raw.extra.customField && raw.extra.customField.keep === true, '未知字段丢了');
      const def = st.legacyDef('x.example');
      need(def.downloadLink === '/download.php?id={ID}' && def.limits.perHour === 20, 'legacyDef 没带新字段');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await check('仓库预设里没有中文类型 key，也没有 types 字段', async function () {
    const doc2 = read(path.join(ROOT, 'server', 'pack', 'sites.preset.json'));
    const bad = [];
    Object.keys(doc2.sites || {}).forEach(function (h) {
      const rec = doc2.sites[h] || {};
      if (rec.search && rec.search.types !== undefined) bad.push(h + ':types');
      Object.keys((rec.search || {}).cats || {}).forEach(function (k) {
        if (!presets.keyOf(k) || presets.keyOf(k) !== k) bad.push(h + ':cats.' + k);
      });
      Object.keys((rec.publish || {}).catMap || {}).forEach(function (k) {
        if (!presets.keyOf(k) || presets.keyOf(k) !== k) bad.push(h + ':catMap.' + k);
      });
    });
    need(!bad.length, '还有旧 key：' + bad.slice(0, 8).join(' / '));
  });

  await check('前端预设与全局预设同源', async function () {
    const web = read(path.join(ROOT, 'web', 'shared', 'presets.json'));
    need(JSON.stringify(web) === JSON.stringify(doc), 'web/shared/presets.json 不是最新；跑 node pta/scripts/gen-presets.js');
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();

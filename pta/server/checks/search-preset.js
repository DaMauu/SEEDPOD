/* 搜索页预设识别：分类 ID、媒介/编码/音频/分辨率/制作组和参数名。纯夹具，不联网。 */
const fs = require('fs');
const path = require('path');
const makePresets = require('../src/features/presets/store');
const { parseSearchPreset, dimOf, isCatField, mapType } = require('../src/features/sites/search-preset');
const { buildSiteSearchUrl } = require('../src/features/sites/search-url');

const presets = makePresets();
const html = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'search-preset.html'), 'utf8');
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }

check('分类 ID 和分类模式能识别', function () {
  const r = parseSearchPreset(html, presets);
  need(Array.isArray(r.cats.movie) && r.cats.movie.indexOf('401') >= 0 && r.cats.movie.indexOf('405') >= 0, '电影分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.tv) && r.cats.tv[0] === '406', '剧集分类不对：' + JSON.stringify(r.cats));
  need(r.catMode === 'key', '分类模式应为 key：' + r.catMode);
});

check('参数名不当成未识别标签', function () {
  const html = '<a href="?cat401=1">Movies/电影</a><input type="checkbox" name="cat401" value="1"><select name="medium"><option value="1">medium1</option><option value="2">Blu-ray</option></select>';
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie && r.cats.movie[0] === '401', '分类没识别：' + JSON.stringify(r.cats));
  need(!r.unmatched.some(function (x) { return /^(cat|medium)\d+$/.test(x.label) }), '参数名进了未识别：' + JSON.stringify(r.unmatched));
});

check('下拉子分类/标签链接不当分类', function () {
  const html = '<a href="/torrents.php?cat401=1">电影</a><a href="/torrents.php?cat401=1&processing2=1&incldead=0">中国大陆</a><a href="/special.php?cat411=1&incldead=0&tag_id=62">无限流</a>';
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie && r.cats.movie[0] === '401', '父分类没识别：' + JSON.stringify(r.cats));
  need(!r.cats.ebook && !r.cats.audiobook, '子分类/标签被当分类：' + JSON.stringify(r.cats));
  need(r.unmatched.length === 0, '子分类/标签进了未识别：' + JSON.stringify(r.unmatched));
});

check('原盘/Remux 不再当内容类型', function () {
  need(mapType('原盘', presets) === '', '原盘不该是内容类型：' + mapType('原盘', presets));
  need(mapType('Remux', presets) === '', 'Remux 不该是内容类型：' + mapType('Remux', presets));
  need(mapType('样品', presets) === 'other', '样品应归 Other：' + mapType('样品', presets));
  need(mapType('Trailer', presets) === 'other', 'Trailer 应归 Other：' + mapType('Trailer', presets));
});

check('Unit3D checkbox 分类能识别', function () {
  const u3 = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'unit3d-browse.html'), 'utf8');
  const r = parseSearchPreset(u3, presets);
  need(Array.isArray(r.cats.movie) && r.cats.movie[0] === '1', 'Unit3D 电影分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.tv) && r.cats.tv[0] === '2', 'Unit3D 剧集分类不对：' + JSON.stringify(r.cats));
  need(r.catMode === 'bracket', 'Unit3D catMode 应为 bracket：' + r.catMode);
});

check('NexusPHP 分类复选框按 img alt 识别', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nexusphp-cat-checkbox.html'), 'utf8');
  const r = parseSearchPreset(html, presets);
  need(Array.isArray(r.cats.movie) && r.cats.movie[0] === '401', '电影分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.tv) && r.cats.tv[0] === '402', '剧集分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.anime) && r.cats.anime[0] === '405', '动漫分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.music) && r.cats.music[0] === '408', '音乐分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.adult) && r.cats.adult[0] === '411', '成人分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.music) && r.cats.music[0] === '408', '408 应归音乐：' + JSON.stringify(r.cats));
  need(!r.cats.concert, '组合链接不该产生 concert：' + JSON.stringify(r.cats));
  need(r.unmatched.some(function (x) { return x.dim === 'type' && /Foo/.test(x.label); }), '未知标签没进报告：' + JSON.stringify(r.unmatched));
  need(r.catMode === 'key', 'catMode 应为 key：' + r.catMode);
});

check('Unit3D Livewire 复选框分类能识别', function () {
  const lw = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'unit3d-livewire.html'), 'utf8');
  const r = parseSearchPreset(lw, presets);
  need(Array.isArray(r.cats.movie) && r.cats.movie[0] === '1', 'Livewire 电影分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.tv) && r.cats.tv[0] === '2', 'Livewire 剧集分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.music) && r.cats.music[0] === '3', 'Livewire 音乐分类不对：' + JSON.stringify(r.cats));
  need(!r.cats.other || r.cats.other.indexOf('99') < 0, 'typeIds 不该当分类：' + JSON.stringify(r.cats));
  need(r.catMode === 'bracket', 'Livewire catMode 应为 bracket：' + r.catMode);
});

check('媒介向下匹配：Blu-ray / Blu-rayUHD 参数名分开存', function () {
  const r = parseSearchPreset(html, presets);
  need(r.values.medium.bluray === '1', 'Blu-ray 值不对：' + JSON.stringify(r.values.medium));
  need(r.values.medium.uhd_full_disc === '1', 'Blu-rayUHD 值不对：' + JSON.stringify(r.values.medium));
  need(r.params.medium.bluray === 'medium1', 'Blu-ray 参数名不对：' + JSON.stringify(r.params.medium));
  need(r.params.medium.uhd_full_disc === 'medium12', 'Blu-rayUHD 参数名不对：' + JSON.stringify(r.params.medium));
  need(presets.expandDims('medium', ['full_disc']).indexOf('bluray') >= 0, 'full_disc 没展开到 bluray');
});

check('编码/音频/分辨率/制作组能识别', function () {
  const r = parseSearchPreset(html, presets);
  need(r.values.codec.h264 === '1' && r.values.codec.h265 === '10', '编码不对：' + JSON.stringify(r.values.codec));
  need(r.values.audio['dts_hd'] === '3', '音频不对：' + JSON.stringify(r.values.audio));
  need(r.values.resolution['1080p'] === '1' && r.values.resolution['2160p'] === '5', '分辨率不对：' + JSON.stringify(r.values.resolution));
  need(r.values.team.BTSCHOOL === '1' && r.values.team.WiKi === '2', '制作组不对：' + JSON.stringify(r.values.team));
});

check('字段归类不把 medium/codec 误认成分类', function () {
  need(dimOf('medium1') === 'medium', 'medium1 没归到媒介');
  need(dimOf('audiocodec') === 'audio', 'audiocodec 没归到音频');
  need(isCatField('cat') === true, 'cat 没认成分类');
  need(isCatField('medium1') === false, 'medium1 被误认成分类');
});

check('Gazelle 搜索表单 media/codec/audioformat 能识别', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'gazelle-search-form.html'), 'utf8');
  const r = parseSearchPreset(html, presets);
  need(r.values.medium.bluray === 'BluRay' && r.params.medium.bluray === 'media', 'media 没识别：' + JSON.stringify(r));
  need(r.values.medium.webdl === 'WEB' && r.values.medium.other === 'LaserDisc', 'media 选项没归一：' + JSON.stringify(r.values.medium));
  need(r.values.codec.av1 === 'AV1' && r.values.codec.mpeg1 === 'MPEG1', 'codec 没识别：' + JSON.stringify(r.values.codec));
  need(r.values.audio.dts_hd === 'DTSMA' && r.values.audio.eac3 === 'EAC3' && r.values.audio.lpcm === 'PCM', 'audioformat 没识别：' + JSON.stringify(r.values.audio));
  need(r.values.resolution['1080p'] === '1080p' && r.values.resolution['2160p'] === '2160p', 'resolution 没识别');
});

check('搜索 URL 带媒介/编码/音频/分辨率/制作组', function () {
  const site = {
    url: { base: 'https://x.example' },
    search: {
      path: '/torrents.php', params: { search: '{q}', cat: '{cats}' }, catMode: 'single', catSlot: '',
      cats: { movie: ['401'] },
      filters: {
        values: { medium: { bluray: '1' }, codec: { h264: '1' }, audio: { dts_hd: '3' }, resolution: { '1080p': '1' }, team: { BTSCHOOL: '1' } },
        params: { medium: { bluray: 'medium1' }, codec: { h264: 'codec' }, audio: { dts_hd: 'audiocodec' }, resolution: { '1080p': 'standard' }, team: { BTSCHOOL: 'team1' } },
        selected: { medium: ['bluray'], codec: ['h264'], audio: ['dts_hd'], resolution: ['1080p'], team: ['BTSCHOOL'] }
      }
    }
  };
  need(presets.expandDims('medium', ['bluray']).indexOf('full_disc') >= 0, 'Blu-ray 大分类没包含原盘');
  const url = buildSiteSearchUrl(site, ['401'], '', presets);
  need(url.indexOf('medium1=1') >= 0, '缺媒介：' + url);
  need(url.indexOf('codec=1') >= 0, '缺编码：' + url);
  need(url.indexOf('audiocodec=3') >= 0, '缺音频：' + url);
  need(url.indexOf('standard=1') >= 0, '缺分辨率：' + url);
  need(url.indexOf('team1=1') >= 0, '缺制作组：' + url);
});

check('同一单选参数多选时不拼重复值', function () {
  const site = {
    url: { base: 'https://x.example' },
    search: {
      path: '/torrents.php', params: { search: '{q}', cat: '{cats}' }, catMode: 'single', catSlot: '',
      cats: { movie: ['401'] },
      filters: {
        values: { discount: { normal: '1', free: '2', thirty: '7' } },
        params: { discount: { normal: 'spstate', free: 'spstate', thirty: 'spstate' } },
        selected: { discount: ['normal', 'free', 'thirty'] }
      }
    }
  };
  const url = buildSiteSearchUrl(site, ['401'], '', presets);
  need(url.indexOf('spstate=') < 0, '多选 spstate 不该拼成单选：' + url);
  site.search.filters.selected.discount = ['free'];
  const one = buildSiteSearchUrl(site, ['401'], '', presets);
  need(one.indexOf('spstate=2') >= 0, '单选 spstate 应保留：' + one);
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

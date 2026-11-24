/* 搜索页预设识别：分类 ID、媒介/编码/音频/分辨率/制作组和参数名。纯夹具，不联网。 */
const fs = require('fs');
const path = require('path');
const makePresets = require('../src/features/presets/store');
const { parseSearchPreset, dimOf, isCatField } = require('../src/features/sites/search-preset');

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

check('Unit3D checkbox 分类能识别', function () {
  const u3 = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'unit3d-browse.html'), 'utf8');
  const r = parseSearchPreset(u3, presets);
  need(Array.isArray(r.cats.movie) && r.cats.movie[0] === '1', 'Unit3D 电影分类不对：' + JSON.stringify(r.cats));
  need(Array.isArray(r.cats.tv) && r.cats.tv[0] === '2', 'Unit3D 剧集分类不对：' + JSON.stringify(r.cats));
  need(r.catMode === 'bracket', 'Unit3D catMode 应为 bracket：' + r.catMode);
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

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

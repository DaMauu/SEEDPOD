/* 跨引擎识别矩阵：同一组夹具同时验架构判定和分类/维度结果。
   任何关键词或解析器改动，四个引擎必须一起过。 */
const fs = require('fs');
const path = require('path');
const makePresets = require('../src/features/presets/store');
const { detectEngine } = require('../src/features/sites/detect');
const { parseSearchPreset } = require('../src/features/sites/search-preset');

const presets = makePresets();
const FIX = path.join(__dirname, '..', 'fixtures');
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }
function load(f) { return fs.readFileSync(path.join(FIX, f), 'utf8'); }

check('NexusPHP：架构 + 52PT 分类', function () {
  const html = load('nexusphp-cat-checkbox.html');
  const e = detectEngine(html, '');
  need(e.engine === 'nexusphp' && e.confidence >= 0.6, '架构不对：' + JSON.stringify(e));
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie[0] === '401' && r.cats.tv[0] === '402', '电影/剧集不对：' + JSON.stringify(r.cats));
  need(r.cats.music[0] === '408' && !r.cats.concert, '408 应归音乐：' + JSON.stringify(r.cats));
  need(r.catMode === 'key', 'catMode 不对：' + r.catMode);
});

check('Unit3D：架构 + 复选框分类', function () {
  const html = load('unit3d-browse.html');
  const e = detectEngine(html, '');
  need(e.engine === 'unit3d' && e.confidence >= 0.6, '架构不对：' + JSON.stringify(e));
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie[0] === '1' && r.cats.tv[0] === '2' && r.cats.music[0] === '3', '分类不对：' + JSON.stringify(r.cats));
  need(r.catMode === 'bracket', 'catMode 不对：' + r.catMode);
});

check('Unit3D Livewire：架构 + categoryIds', function () {
  const html = load('unit3d-livewire.html');
  const e = detectEngine(html, '');
  need(e.engine === 'unit3d' && e.confidence >= 0.6, '架构不对：' + JSON.stringify(e));
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie[0] === '1' && r.cats.tv[0] === '2' && r.cats.music[0] === '3', '分类不对：' + JSON.stringify(r.cats));
  need(r.catMode === 'bracket', 'catMode 不对：' + r.catMode);
});

check('Gazelle：架构 + filter_cat/media/codec/audioformat', function () {
  const html = load('gazelle-search-form.html');
  const e = detectEngine(html, '');
  need(e.engine === 'gazelle' && e.confidence >= 0.6, '架构不对：' + JSON.stringify(e));
  const r = parseSearchPreset(html, presets);
  need(r.cats.movie[0] === '1' && r.cats.tv[0] === '2', 'filter_cat 分类不对：' + JSON.stringify(r.cats));
  need(r.values.medium.bluray === 'BluRay' && r.values.medium.other === 'LaserDisc', 'media 不对：' + JSON.stringify(r.values.medium));
  need(r.values.codec.av1 === 'AV1' && r.values.audio.dts_hd === 'DTSMA' && r.values.audio.lpcm === 'PCM', '编码/音频不对：' + JSON.stringify({ codec: r.values.codec, audio: r.values.audio }));
  need(r.values.resolution['1080p'] === '1080p' && r.values.resolution['2160p'] === '2160p', '分辨率不对');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

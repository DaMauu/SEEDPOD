/* 批量搜索预设识别：纯函数夹具，不联网。 */
const fs = require('fs');
const path = require('path');
const makePresets = require('../src/features/presets/store');
const { parseSearchPreset } = require('../src/features/sites/search-preset');
const { summarizeDetection, mergeDetection } = require('../scripts/detect-search-presets');
const { applyOverrides, mergeWithOverrides } = require('../src/features/sites/detect-merge');

const presets = makePresets();
const html = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'search-preset.html'), 'utf8');
const detected = parseSearchPreset(html, presets);
const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(c, m) { if (!c) throw new Error(m); }

check('夹具识别为高置信度，分类和维度都有', function () {
  const s = summarizeDetection(detected);
  need(s.confidence === 'high', '置信度不对：' + s.confidence);
  need(s.types.indexOf('movie') >= 0 && s.types.indexOf('tv') >= 0, '分类 key 不对：' + JSON.stringify(s.types));
  need(s.typeCount >= 3, '分类 ID 数量不对：' + s.typeCount);
  need(s.dims.values.indexOf('medium') >= 0 && s.dims.values.indexOf('codec') >= 0, '维度不对：' + JSON.stringify(s.dims.values));
});

check('默认合并只补缺失，不覆盖手工值，不替用户勾选', function () {
  const cur = {
    cats: { movie: ['999'] },
    catMode: 'single',
    filters: {
      values: { movie: ['keep'], discount: { free: '9' } },
      selected: { medium: ['full_disc'] }
    }
  };
  const r = mergeDetection(cur, detected, {});
  need(r.search.cats.movie.indexOf('999') >= 0 && r.search.cats.movie.indexOf('401') >= 0, '手工分类没保留或新分类没补：' + JSON.stringify(r.search.cats));
  need(r.search.catMode === 'key', 'catMode 没升级：' + r.search.catMode);
  need(r.search.filters.values.medium.bluray === '1', '媒介值没补：' + JSON.stringify(r.search.filters.values));
  need(r.search.filters.values.discount.free === '9', '未识别维度被覆盖：' + JSON.stringify(r.search.filters.values));
  need(JSON.stringify(r.search.filters.selected.medium) === JSON.stringify(['full_disc']), 'selected 没保留');
  need(r.changed === true, 'changed 应为 true');
});

check('没有识别结果时不改现有分类和 catMode', function () {
  const cur = { cats: { movie: ['999'] }, catMode: 'single', filters: {} };
  const r = mergeDetection(cur, { cats: {}, catMode: '', values: {}, params: {}, labels: {} }, { force: true });
  need(r.search.cats.movie[0] === '999', '空识别把分类清了：' + JSON.stringify(r.search.cats));
  need(r.search.catMode === 'single', '空识别改了 catMode');
});

check('同一个站点 ID 被识别成多个分类时不写', function () {
  const amb = { cats: { movie: ['411'], audiobook: ['411'], concert: ['408'] }, catMode: 'key', values: {}, params: {}, labels: {} };
  const sum = summarizeDetection(amb);
  need(sum.ambiguous.indexOf('411') >= 0, 'ambiguous 没标出来：' + JSON.stringify(sum.ambiguous));
  const r = mergeDetection({ cats: {}, filters: {} }, amb, {});
  need(!r.search.cats.movie && !r.search.cats.audiobook, '冲突 ID 被写进去了：' + JSON.stringify(r.search.cats));
  need(JSON.stringify(r.search.cats.concert) === JSON.stringify(['408']), '不冲突的分类没写');
});

check('站点覆盖：skip / map / engine', function () {
  const d = { cats: { movie: ['408'] }, catLabels: { '408': 'Foo' }, catMode: 'key', values: {}, params: {}, labels: {} };
  const skipped = applyOverrides(d, { skip: ['408'] }, { keyOf: presets.keyOf });
  need(!skipped.cats.movie, 'skip 没生效：' + JSON.stringify(skipped.cats));
  const mapped = applyOverrides(d, { map: { Foo: 'music' } }, { keyOf: presets.keyOf });
  need(JSON.stringify(mapped.cats.music) === JSON.stringify(['408']) && !mapped.cats.movie, 'map 没生效：' + JSON.stringify(mapped.cats));
  const forced = applyOverrides(d, { engine: 'unit3d' }, { keyOf: presets.keyOf });
  need(forced.engine === 'unit3d' && forced.engineConfidence === 1, 'engine 没生效：' + JSON.stringify(forced));
  const cleaned = mergeWithOverrides({ cats: { music: ['408'] }, filters: {} }, d, { skip: ['408'] }, { keyOf: presets.keyOf });
  need(!(cleaned.merged.search.cats.music || []).length, 'skip 没清掉已保存的旧分类：' + JSON.stringify(cleaned.merged.search.cats));
});

check('force 只替换识别到的维度和分类', function () {
  const cur = {
    cats: { movie: ['999'] },
    catMode: 'single',
    filters: { values: { discount: { free: '9' } }, selected: { discount: ['free'] } }
  };
  const r = mergeDetection(cur, detected, { force: true });
  need(r.search.cats.movie.indexOf('999') < 0 && r.search.cats.movie.indexOf('401') >= 0, 'force 没替换分类：' + JSON.stringify(r.search.cats));
  need(r.search.filters.values.medium.bluray === '1', 'force 没写媒介');
  need(r.search.filters.values.discount.free === '9', 'force 把未识别维度清了');
  need(JSON.stringify(r.search.filters.selected.discount) === JSON.stringify(['free']), 'force 把 selected 清了');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

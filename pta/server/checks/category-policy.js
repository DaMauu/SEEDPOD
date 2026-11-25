/* 分类政策纯函数：类型归一、按类型过滤站点分类。 */
const path = require('path');
const cp = require(path.join(__dirname, '..', 'src', 'features', 'crawl', 'category.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('类型归一：电影/剧集/音乐/MV/有声书', () => {
  need(cp.typeOf('电影 (Movie)') === '电影', '电影：' + cp.typeOf('电影 (Movie)'));
  need(cp.typeOf('电视剧 (TV Series)') === '剧集', '剧集：' + cp.typeOf('电视剧 (TV Series)'));
  need(cp.typeOf('TV Shows/综艺') === '综艺', 'TV Shows/综艺 应归综艺：' + cp.typeOf('TV Shows/综艺'));
  need(cp.typeOf('Music Videos/音乐MV(演唱会)') === 'MV', '音乐MV 应优先归 MV：' + cp.typeOf('Music Videos/音乐MV(演唱会)'));
  need(cp.typeOf('Opera/戏曲 曲艺') === '舞台演出', '戏曲 曲艺 应归舞台演出：' + cp.typeOf('Opera/戏曲 曲艺'));
  need(cp.typeOf('HQ Audio/无损音乐') === '音乐', 'HQ Audio 应归音乐：' + cp.typeOf('HQ Audio/无损音乐'));
  need(cp.typeOf('音乐') === '音乐', '音乐：' + cp.typeOf('音乐'));
  need(cp.typeOf('MV') === 'MV', 'MV：' + cp.typeOf('MV'));
  need(cp.typeOf('音乐短片') === 'MV', '音乐短片：' + cp.typeOf('音乐短片'));
  need(cp.typeOf('有声书') === '有声书', '有声书：' + cp.typeOf('有声书'));
  need(cp.typeOf('Audiobook') === '有声书', 'Audiobook 应归有声书：' + cp.typeOf('Audiobook'));
  need(cp.typeOf('Audio Book') === '有声书', 'Audio Book 应归有声书：' + cp.typeOf('Audio Book'));
  need(cp.typeOf('Soundtrack') === '音乐', 'Soundtrack 应归音乐：' + cp.typeOf('Soundtrack'));
  need(cp.typeOf('电子书') === '电子书', '电子书：' + cp.typeOf('电子书'));
  need(cp.typeOf('其他') === '其他', '其他：' + cp.typeOf('其他'));
});

check('选电影只保留电影分类，不混入音乐/MV', () => {
  const cats = [
    { id: '401', label: '电影 (Movie)' },
    { id: '404', label: '电视剧 (TV Series)' },
    { id: '413', label: '音乐' },
    { id: '418', label: '舞台演出' }
  ];
  const r = cp.filterCatsByTypes(cats, ['电影']);
  need(r.cats.length === 1 && r.cats[0].id === '401', '命中分类不对：' + JSON.stringify(r));
  need(r.unmatched.length === 0, '不该有未匹配：' + JSON.stringify(r.unmatched));
});

check('多选类型和未匹配提示', () => {
  const cats = [{ id: '401', label: '电影' }, { id: '413', label: '音乐短片' }];
  const r = cp.filterCatsByTypes(cats, ['电影', 'MV', '不存在']);
  need(r.cats.length === 2, '多选分类数不对：' + JSON.stringify(r.cats));
  need(r.matched.indexOf('电影') >= 0 && r.matched.indexOf('MV') >= 0, '命中类型不对：' + JSON.stringify(r.matched));
  need(r.unmatched.length === 1 && r.unmatched[0] === '不存在', '未匹配提示不对：' + JSON.stringify(r.unmatched));
});

check('流程类型读取只认 fetch[0] 的「类型」', () => {
  const flow = { sets: { fetch: [[{ t: '类型', sel: ['电影'] }], [{ t: '类型', sel: ['音乐'] }]] } };
  const types = cp.selectedTypesOf(flow);
  need(types.length === 1 && types[0] === '电影', '流程类型：' + JSON.stringify(types));
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

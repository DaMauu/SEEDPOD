/* 副标题拼贴与豆影简介保留块的纯函数回归。 */
const collage = require('../src/features/media/collage');
const metaFill = require('../src/features/media/meta-fill');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('BDInfo 音轨/字幕语言归一', () => {
  const m = collage.parseLanguages('Audio: English / DTS-HD MA\nAudio: Chinese / DD 5.1\nSubtitle: German\nSubtitle: Chinese');
  need(m.audio.join(',') === '英语,国语', '音轨不对：' + JSON.stringify(m.audio));
  need(m.subtitle.join(',') === '德语,国语', '字幕不对：' + JSON.stringify(m.subtitle));
  need(collage.langText(m.audio, '语') === '国英语', '多音轨拼法不对：' + collage.langText(m.audio, '语'));
  need(collage.langText(m.subtitle, '字') === '国德字', '多字幕拼法不对：' + collage.langText(m.subtitle, '字'));
});

check('MediaInfo 分段 Language 也能读', () => {
  const text = 'Audio\nID : 2\nLanguage : Japanese\nText\nID : 4\nLanguage : Chinese';
  const m = collage.parseLanguages(text);
  need(m.audio.indexOf('日语') >= 0, 'MediaInfo 音轨没读到：' + JSON.stringify(m));
  need(m.subtitle.indexOf('国语') >= 0, 'MediaInfo 字幕没读到：' + JSON.stringify(m));
});

check('拼贴：原盘加地区、主演优先中文、最多 3 个', () => {
  const item = { title: 'Foo 2024 1080p Blu-ray AVC', medium: 'Blu-ray', fullDisc: true, region: '美国', bdinfo: 'Audio: English\nSubtitle: Chinese' };
  const meta = { title: ' foo ', directors: ['Christopher Nolan / 克里斯托弗·诺兰'], cast: ['Matt Damon / 马特·达蒙', 'Tom Holland / 汤姆·霍兰德', 'Anne Hathaway / 安妮·海瑟薇', 'Fourth / 第四个'] };
  const s = collage.composeSubtitle(item, meta);
  need(s.indexOf('foo') >= 0, '片名不对：' + s);
  need(s.indexOf('美国原盘') >= 0, '原盘地区没加：' + s);
  need(s.indexOf('导演:克里斯托弗·诺兰') >= 0, '导演没取中文：' + s);
  need(s.indexOf('主演:马特·达蒙/汤姆·霍兰德/安妮·海瑟薇') >= 0, '主演没取 3 个中文：' + s);
  need(s.indexOf('[英语]') >= 0 && s.indexOf('[中字]') >= 0, '语言段不对：' + s);
});

check('拼贴：非原盘不加地区，没中文才用英文', () => {
  const item = { title: 'Bar 2024 1080p WEB-DL', medium: 'WEB-DL', region: '美国' };
  const meta = { title: 'Bar', directors: ['Jane Doe'], cast: ['John Smith', 'Mary Jane'] };
  const s = collage.composeSubtitle(item, meta);
  need(s.indexOf('原盘') < 0, '非原盘不该加地区：' + s);
  need(s.indexOf('导演:Jane Doe') >= 0 && s.indexOf('主演:John Smith/Mary Jane') >= 0, '英文名没兜底：' + s);
});

check('源简介保留 hide/技术 quote/截图，不保留旧电影简介', () => {
  const src = '旧电影简介\n\n[hide=mediainfo]General\nComplete name : x.mkv[/hide]\n\n[quote]Disc Title: X\nVideo: HEVC[/quote]\n\n[img]https://example.org/shot1.jpg[/img]';
  const keep = metaFill._preservedOf(src);
  need(keep.blocks.some((x) => x.indexOf('[hide=mediainfo]') >= 0), 'hide 块没保留');
  need(keep.blocks.some((x) => x.indexOf('Disc Title') >= 0), '技术 quote 没保留');
  need(keep.images.some((x) => x.indexOf('shot1.jpg') >= 0), '截图没保留');
  need(keep.blocks.join(' ').indexOf('旧电影简介') < 0, '旧简介不该进保留块');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);

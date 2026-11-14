/* 标题解析夹具：纯文本，不联网。覆盖电影、剧集、动漫、音乐、修复版、年份歧义。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { parseRelease, buildNames } = require(path.join(ROOT, 'server', 'meta.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('电影：UHD 原盘 + DoVi + Atmos', () => {
  const p = parseRelease('The.Matrix.1999.2160p.UHD.BluRay.REMUX.HEVC.DV.TrueHD.7.1.Atmos-FRDS');
  need(p.title === 'The Matrix', '标题：' + p.title);
  need(p.year === 1999, '年份：' + p.year);
  need(p.resolution === '2160p', '分辨率：' + p.resolution);
  need(p.source.indexOf('UHD Blu-ray') >= 0 && p.source.indexOf('Remux') >= 0, '来源：' + p.source);
  need(p.codec === 'HEVC', '编码：' + p.codec);
  need(p.audio.indexOf('TrueHD') >= 0 && p.audio.indexOf('7.1') >= 0 && p.audio.indexOf('Atmos') >= 0, '音轨：' + p.audio);
  need(p.group === 'FRDS', '制作组：' + p.group);
  need(p.hdr.indexOf('DoVi') >= 0, 'HDR：' + p.hdr.join(','));
  need(p.category === 'movie' && p.catName === '电影', '分类：' + p.category);
});

check('剧集：S02E03 + WEB-DL + DDP', () => {
  const p = parseRelease('Severance.S02E03.1080p.WEB-DL.DDP5.1.H.264-NTb');
  need(p.title === 'Severance', '标题：' + p.title);
  need(p.season === 2 && p.episode === 3, '季集：' + p.season + '/' + p.episode);
  need(p.resolution === '1080p', '分辨率：' + p.resolution);
  need(p.source === 'WEB-DL', '来源：' + p.source);
  need(p.codec === 'AVC', '编码：' + p.codec);
  need(p.audio.indexOf('DDP') >= 0 && p.audio.indexOf('5.1') >= 0, '音轨：' + p.audio);
  need(p.group === 'NTb', '制作组：' + p.group);
  need(p.category === 'tv' && p.catName === '剧集', '分类：' + p.category);
});

check('电影：Blu-ray Remux + 数字制作组', () => {
  const p = parseRelease('A.Strange.House.2024.1080p.Blu-ray.Remux.AVC.TrueHD.5.1-52pt');
  need(p.title === 'A Strange House', '标题：' + p.title);
  need(p.year === 2024, '年份：' + p.year);
  need(p.source === 'Blu-ray Remux', '来源：' + p.source);
  need(p.codec === 'AVC', '编码：' + p.codec);
  need(p.audio.indexOf('TrueHD') >= 0, '音轨：' + p.audio);
  need(p.group === '52pt', '制作组：' + p.group);
  need(p.category === 'movie', '分类：' + p.category);
});

check('中文片名：修复版 + DTS-HD MA', () => {
  const p = parseRelease('金瓶双艳.1974.修复版.1080p.BluRay.x264.DTS-HD.MA.2.0-ABC');
  need(p.title === '金瓶双艳', '标题：' + p.title);
  need(p.year === 1974, '年份：' + p.year);
  need(p.tags.indexOf('修复版') >= 0, '标签：' + p.tags.join(','));
  need(p.source === 'Blu-ray', '来源：' + p.source);
  need(p.codec === 'AVC', '编码：' + p.codec);
  need(p.audio.indexOf('DTS') >= 0, '音轨：' + p.audio);
  need(p.group === 'ABC', '制作组：' + p.group);
});

check('剧集整季：S01 + HDR10', () => {
  const p = parseRelease('Some.Show.S01.2024.2160p.WEB-DL.HDR10.DDP5.1.Atmos-ABC');
  need(p.title === 'Some Show', '标题：' + p.title);
  need(p.season === 1 && p.episode === null, '季集：' + p.season + '/' + p.episode);
  need(p.year === 2024, '年份：' + p.year);
  need(p.source === 'WEB-DL', '来源：' + p.source);
  need(p.hdr.indexOf('HDR10') >= 0, 'HDR：' + p.hdr.join(','));
  need(p.audio.indexOf('DDP') >= 0, '音轨：' + p.audio);
  need(p.category === 'tv', '分类：' + p.category);
});

check('音乐：Concert + FLAC', () => {
  const p = parseRelease('Concert.2023.1080p.BluRay.FLAC.2.0-GRP');
  need(p.title === 'Concert', '标题：' + p.title);
  need(p.year === 2023, '年份：' + p.year);
  need(p.category === 'music' && p.catName === '音乐', '分类：' + p.category);
  need(p.audio.indexOf('FLAC') >= 0, '音轨：' + p.audio);
});

check('动漫：组名 + 集数', () => {
  const p = parseRelease('[SubsPlease] One Piece - 1120 (1080p) [ABCD1234]');
  need(p.title === 'One Piece', '标题：' + p.title);
  need(p.episode === 1120, '集数：' + p.episode);
  need(p.resolution === '1080p', '分辨率：' + p.resolution);
  need(p.category === 'anime' && p.catName === '动漫', '分类：' + p.category);
});

check('剧集：UHD Blu-ray + DTS-HD MA', () => {
  const p = parseRelease('Planet.Earth.III.S01E01.2160p.BBC.UHD.BluRay.HEVC.DTS-HD.MA.5.1-ABC');
  need(p.title === 'Planet Earth III', '标题：' + p.title);
  need(p.season === 1 && p.episode === 1, '季集：' + p.season + '/' + p.episode);
  need(p.source.indexOf('UHD Blu-ray') >= 0, '来源：' + p.source);
  need(p.codec === 'HEVC', '编码：' + p.codec);
  need(p.group === 'ABC', '制作组：' + p.group);
  need(p.category === 'tv', '分类：' + p.category);
});

check('片名带年份：Blade Runner 2049', () => {
  const p = parseRelease('Blade.Runner.2049.2017.2160p.UHD.BluRay.REMUX.HEVC.DTS-HD.MA.5.1-GRP');
  need(p.title === 'Blade Runner 2049', '标题：' + p.title);
  need(p.year === 2017, '年份：' + p.year);
});

check('无标记标题不瞎猜', () => {
  const p = parseRelease('Hello World');
  need(p.title === 'Hello World', '标题：' + p.title);
  need(p.year === null && p.season === null && p.episode === null, '不该猜出年份/季集');
  need(p.category === 'movie', '分类：' + p.category);
});

check('buildNames 生成规范名/副标题/简介', () => {
  const b = buildNames({ title: 'The.Matrix.1999.2160p.UHD.BluRay.REMUX.HEVC.DV.TrueHD.7.1.Atmos-FRDS', size: '60 GB', site: 'demo-a.example' });
  need(b.title === 'The Matrix', '标题：' + b.title);
  need(b.releaseTitle.indexOf('The.Matrix.1999.2160p') === 0, '规范名：' + b.releaseTitle);
  need(b.subtitle.indexOf('2160p') >= 0 && b.subtitle.indexOf('60 GB') >= 0, '副标题：' + b.subtitle);
  need(b.description.indexOf('1999') >= 0 && b.description.indexOf('FRDS') >= 0, '简介：' + b.description);
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(r => !r[0]).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

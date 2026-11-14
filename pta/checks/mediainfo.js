/* MediaInfo / BDInfo 解析夹具：纯文本，不联网。覆盖两种格式、内联字段和无法识别。 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const mi = require(path.join(ROOT, 'server', 'mediainfo.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const BD = `Disc Title: The.Matrix.1999.UHD.BluRay.2160p.HEVC.DTS-HD.MA.5.1
Disc Label: The Matrix
Disc Size: 90,000,000,000 bytes
Protection: AACS2
Playlist: 00800.MPLS
Size: 80,000,000,000 bytes
Length: 2:16:00.000
Total Bitrate: 78.00 Mbps
Video: MPEG-H HEVC Video / 65000 kbps / 2160p / 23.976 fps / 16:9 / Main 10 @ Level 5.1 @ High / 10 bits / HDR10 / BT.2020
Audio: English / DTS-HD Master Audio / 5.1 / 48 kHz / 24-bit
Audio: Chinese / Dolby TrueHD/Atmos Audio / 7.1 / 48 kHz / 24-bit
Subtitle: English / 32.000 kbps
Subtitle: Chinese / 28.000 kbps`;

const MI = `General
Complete name : The.Matrix.1999.2160p.mkv
Format : Matroska
File size : 60.0 GiB
Duration : 2 h 16 min
Overall bit rate : 63.0 Mb/s

Video
Format : HEVC
Format/Info : High Efficiency Video Coding
Format profile : Main 10@L5.1@High
HDR format : Dolby Vision, Version 1.0, dvhe.08.06, BL+RPU, HDR10 compatible
Width : 3 840 pixels
Height : 2 160 pixels
Frame rate : 23.976 FPS
Bit depth : 10 bits

Audio #1
Format : DTS XLL
Commercial name : DTS-HD Master Audio
Channel(s) : 6 channels
Channel layout : C L R Ls Rs LFE
Language : Chinese
Title : 国语
Bit rate : 4 000 kb/s

Text #1
Format : PGS
Language : Chinese
Title : 简中
Forced : No`;

check('BDInfo：标题/体积/视频/音轨/字幕/摘要', () => {
  const p = mi.parse(BD);
  need(p.kind === 'bdinfo', 'kind：' + p.kind);
  need(p.title.indexOf('The.Matrix') === 0, '标题：' + p.title);
  need(p.label === 'The Matrix', 'Disc Label：' + p.label);
  need(p.sizeBytes > 0 && p.sizeText, '体积：' + p.sizeBytes + '/' + p.sizeText);
  need(p.video && p.video.codec === 'HEVC', '编码：' + (p.video && p.video.codec));
  need(p.video.resolution === '2160p', '分辨率：' + (p.video && p.video.resolution));
  need(p.video.hdr === 'HDR10', 'HDR：' + (p.video && p.video.hdr));
  need(p.video.bitDepth === 10 && p.video.fps === 23.976, '位深/帧率：' + p.video.bitDepth + '/' + p.video.fps);
  need(p.audio.length === 2, '音轨数：' + p.audio.length);
  need(p.audio[0].format === 'DTS-HD MA' && p.audio[0].channelsText === '5.1', '第一条音轨：' + JSON.stringify(p.audio[0]));
  need(p.audio[1].atmos === true, '第二条音轨没有 Atmos');
  need(p.subtitle.length === 2 && p.subtitle[1].language === 'zh', '字幕：' + JSON.stringify(p.subtitle));
  need(p.flags.chineseSub && p.flags.englishSub && p.flags.mandarinAudio && p.flags.atmos, '标记：' + JSON.stringify(p.flags));
  need(p.summary.indexOf('2160p') >= 0 && p.summary.indexOf('HEVC') >= 0 && p.summary.indexOf('中字') >= 0, '摘要：' + p.summary);
});

check('MediaInfo：General/Video/Audio/Text 分段解析', () => {
  const p = mi.parse(MI);
  need(p.kind === 'mediainfo', 'kind：' + p.kind);
  need(p.sizeBytes > 0 && p.sizeText, '体积：' + p.sizeBytes + '/' + p.sizeText);
  need(p.durationText.indexOf('2 h') >= 0, '时长：' + p.durationText);
  need(p.video && p.video.codec === 'HEVC', '编码：' + (p.video && p.video.codec));
  need(p.video.resolution === '2160p' && p.video.height === 2160, '分辨率：' + JSON.stringify(p.video));
  need(p.video.hdr === 'DoVi', 'HDR：' + (p.video && p.video.hdr));
  need(p.video.bitDepth === 10 && p.video.fps === 23.976, '位深/帧率：' + p.video.bitDepth + '/' + p.video.fps);
  need(p.audio.length === 1, '音轨数：' + p.audio.length);
  need(p.audio[0].format === 'DTS-HD MA' && p.audio[0].channelsText === '5.1', '音轨：' + JSON.stringify(p.audio[0]));
  need(p.audio[0].language === 'zh' && p.audio[0].title === '国语', '音轨语言/标题：' + p.audio[0].language + '/' + p.audio[0].title);
  need(p.subtitle.length === 1 && p.subtitle[0].language === 'zh' && p.subtitle[0].title === '简中', '字幕：' + JSON.stringify(p.subtitle));
  need(p.flags.chineseSub && p.flags.mandarinAudio && p.flags.dovi, '标记：' + JSON.stringify(p.flags));
  need(p.summary.indexOf('2160p') >= 0 && p.summary.indexOf('DoVi') >= 0 && p.summary.indexOf('中字') >= 0, '摘要：' + p.summary);
});

check('BDInfo：内联字段也能断行', () => {
  const one = 'Disc Title: Demo Disc Disc Label: Demo Label Disc Size: 1,000,000,000 bytes Length: 1:30:00.000 Video: MPEG-4 AVC Video / 1080p / 23.976 fps / 8 bits Audio: Chinese / DTS / 5.1 Subtitle: Chinese / 20 kbps';
  const p = mi.parse(one);
  need(p.kind === 'bdinfo', 'kind：' + p.kind);
  need(p.title === 'Demo Disc', '标题：' + p.title);
  need(p.label === 'Demo Label', '标签：' + p.label);
  need(p.video && p.video.resolution === '1080p', '分辨率：' + (p.video && p.video.resolution));
  need(p.audio.length === 1 && p.audio[0].format === 'DTS', '音轨：' + JSON.stringify(p.audio));
  need(p.flags.chineseSub, '中字没识别');
});

check('无法识别的文本不瞎猜', () => {
  const p = mi.parse('这不是 MediaInfo，也不是 BDInfo。');
  need(p.kind === '', 'kind 应为空：' + p.kind);
  need(p.error === 'unrecognized', 'error：' + p.error);
  need(mi.toBBCode(p) === '', '无法识别时不该生成 BBCode');
});

check('toBBCode 只包一层，已有包裹不重复', () => {
  const p = mi.parse(BD);
  const a = mi.toBBCode(p);
  need(a.indexOf('【BDInfo】') === 0 && a.indexOf('[quote]') > 0, 'BBCode 头不对：' + a.slice(0, 60));
  const b = mi.toBBCode({ kind: 'bdinfo', raw: a });
  need(b === a, '重复包裹：' + b.slice(0, 60));
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);

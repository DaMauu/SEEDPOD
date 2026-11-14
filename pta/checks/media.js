/* 媒体夹具：ffmpeg 合成 2 秒测试视频，验证 ffprobe、截图、bencode 种子。不联网。 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const media = require(path.join(ROOT, 'server', 'media.js'));
const { makeQb } = require(path.join(ROOT, 'server', 'qb.js'));

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-media-'));
const FILE = path.join(DATA, 'test.mp4');
const qb = makeQb(DATA);
const results = [];

async function check(name, fn) {
  try { await fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  try {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
      '-t', '2', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-b:a', '64k', FILE
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
  } catch (e) {
    console.error('生成测试视频失败：' + String(e && e.stderr || e && e.message || e).slice(0, 300));
    process.exit(2);
  }

  await check('ffprobe 读取分辨率/编码/音轨/时长', async () => {
    const p = await media.probe(FILE);
    need(p.video && p.video.width === 320 && p.video.height === 240, '宽高不对：' + JSON.stringify(p.video));
    need(p.video.resolution === '240p', '分辨率标签不对：' + p.video.resolution);
    need(p.video.codec === 'mpeg4', '视频编码不对：' + p.video.codec);
    need(p.duration > 1.5 && p.duration < 2.5, '时长不对：' + p.duration);
    need(p.audios.length === 1 && p.audios[0].codec === 'aac', '音轨不对：' + JSON.stringify(p.audios));
    need(p.summary.indexOf('240p') >= 0 && p.summary.indexOf('mpeg4') >= 0, '摘要不对：' + p.summary);
  });

  await check('ffmpeg 截图 3 张', async () => {
    const r = await media.shots(FILE, { count: 3, width: 320, outDir: path.join(DATA, 'shots') });
    need(r.items.length === 3, '截图数量不对：' + r.items.length);
    r.items.forEach(function (it) {
      need(it.bytes > 0, '截图是空的：' + it.name);
      need(it.at >= 0 && it.at <= 2, '截图时间不对：' + it.at);
    });
  });

  await check('截图宽高可读', async () => {
    const first = path.join(DATA, 'shots', 'shot-1.jpg');
    const p = await media.probe(first);
    need(p.video && p.video.width === 320 && p.video.height === 240, '截图宽高不对：' + JSON.stringify(p.video));
    need(p.video.codec === 'mjpeg', '截图编码不对：' + p.video.codec);
  });

  await check('bencode 基本类型与排序', async () => {
    need(media.bencode('spam').toString() === '4:spam', '字符串编码不对');
    need(media.bencode(42).toString() === 'i42e', '整数编码不对');
    need(media.bencode(['a', 1]).toString() === 'l1:ai1ee', '数组编码不对');
    need(media.bencode({ b: 2, a: 'x' }).toString() === 'd1:a1:x1:bi2ee', '字典键没排序');
  });

  await check('生成种子并可被 qb 解析', async () => {
    const t = await media.makeTorrent({ file: FILE, announce: 'http://tracker.example/announce', pieceLength: 16384 });
    need(t.buffer[0] === 0x64, '种子不是 bencode 字典');
    need(/^[0-9a-f]{40}$/.test(t.infohash), 'infohash 不对：' + t.infohash);
    need(t.pieceLength === 16384, 'piece length 不对：' + t.pieceLength);
    need(t.pieces === Math.ceil(t.size / 16384), 'piece 数量不对：' + t.pieces);
    const meta = qb.parseTorrent(t.buffer);
    need(meta.hash === t.infohash, 'qb 解析的 hash 不一致');
    need(meta.name === 'test.mp4', 'qb 解析的 name 不对：' + meta.name);
    need(meta.size === t.size, 'qb 解析的 size 不对：' + meta.size);
  });

  await check('种子 name 可覆盖', async () => {
    const t = await media.makeTorrent({ file: FILE, announce: 'http://tracker.example/announce', name: 'Custom.Name', pieceLength: 16384 });
    const meta = qb.parseTorrent(t.buffer);
    need(meta.name === 'Custom.Name', '自定义 name 不生效：' + meta.name);
  });

  await check('坏输入报错', async () => {
    let e1 = null;
    try { await media.makeTorrent({ file: FILE, announce: 'ftp://nope' }); } catch (e) { e1 = e; }
    need(e1 && /announce/.test(e1.message), 'ftp announce 没报错');
    let e2 = null;
    try { await media.probe(path.join(DATA, 'missing.mp4')); } catch (e) { e2 = e; }
    need(e2, '不存在的文件没报错');
  });
}

main().then(function () {
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}).catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});

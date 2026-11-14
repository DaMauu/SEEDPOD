/* 媒体与种子：ffprobe 取信息、ffmpeg 截图、纯 bencode 生成 .torrent。
   全部本地执行，不联网；调用方负责文件路径与权限。 */
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function run(cmd, args, opts) {
  return new Promise(function (resolve, reject) {
    execFile(cmd, args, Object.assign({ maxBuffer: 20 * 1024 * 1024, timeout: 60000 }, opts || {}), function (err, stdout, stderr) {
      if (err) {
        const msg = String((stderr || err.message || '')).replace(/\s+/g, ' ').slice(0, 240);
        reject(new Error(cmd + ' 失败：' + msg));
        return;
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return Math.floor(s / 3600) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60);
}
function resolutionLabel(h) {
  const n = Number(h) || 0;
  if (n >= 2000) return '2160p';
  if (n >= 1000) return '1080p';
  if (n >= 700) return '720p';
  if (n >= 500) return '576p';
  if (n >= 400) return '480p';
  return n ? n + 'p' : '';
}
function fpsOf(raw) {
  const m = /^(\d+)\/(\d+)$/.exec(String(raw || ''));
  if (!m || Number(m[2]) === 0) return 0;
  return Math.round(Number(m[1]) / Number(m[2]) * 1000) / 1000;
}
function bitDepthOf(pix) {
  const m = /p(\d{1,2})(?:le|be)?$/.exec(String(pix || ''));
  return m ? Number(m[1]) : 8;
}

async function probe(file) {
  const p = path.resolve(String(file || ''));
  const st = fs.statSync(p);
  if (!st.isFile()) throw new Error('不是文件：' + p);
  const r = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', p], { timeout: 30000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch (e) { throw new Error('ffprobe 输出不是 JSON'); }
  const fmt = j.format || {};
  const streams = Array.isArray(j.streams) ? j.streams : [];
  const videoRaw = streams.filter(function (s) { return s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic); })[0] || null;
  const audios = streams.filter(function (s) { return s.codec_type === 'audio'; }).map(function (s) {
    const tags = s.tags || {};
    return { codec: s.codec_name || '', profile: s.profile || '', channels: Number(s.channels) || 0,
      layout: s.channel_layout || '', bitRate: Number(s.bit_rate) || 0, language: tags.language || '', title: tags.title || '' };
  });
  const subs = streams.filter(function (s) { return s.codec_type === 'subtitle'; }).map(function (s) {
    const tags = s.tags || {};
    return { codec: s.codec_name || '', language: tags.language || '', title: tags.title || '',
      forced: !!(s.disposition && s.disposition.forced), default: !!(s.disposition && s.disposition.default) };
  });
  let video = null;
  if (videoRaw) {
    const side = Array.isArray(videoRaw.side_data_list) ? videoRaw.side_data_list.map(function (x) { return JSON.stringify(x); }).join(' ') : '';
    const transfer = videoRaw.color_transfer || '';
    let hdr = '';
    if (/dovi|dolby vision/i.test(side)) hdr = 'DoVi';
    else if (transfer === 'smpte2084') hdr = 'HDR10';
    else if (transfer === 'arib-std-b67') hdr = 'HLG';
    else if (videoRaw.color_primaries === 'bt2020' && transfer) hdr = 'HDR';
    video = {
      codec: videoRaw.codec_name || '', profile: videoRaw.profile || '',
      width: Number(videoRaw.width) || 0, height: Number(videoRaw.height) || 0,
      resolution: resolutionLabel(videoRaw.height), pixFmt: videoRaw.pix_fmt || '',
      bitDepth: bitDepthOf(videoRaw.pix_fmt), bitRate: Number(videoRaw.bit_rate) || 0,
      fps: fpsOf(videoRaw.avg_frame_rate || videoRaw.r_frame_rate), hdr: hdr,
      colorTransfer: transfer, colorPrimaries: videoRaw.color_primaries || ''
    };
  }
  const duration = Number(fmt.duration) || 0;
  const audioTxt = audios.length ? (audios[0].codec.toUpperCase() + (audios[0].channels ? ' ' + audios[0].channels + 'ch' : '')) : '';
  return {
    file: p, name: path.basename(p), size: Number(fmt.size) || st.size, duration: duration,
    durationText: fmtDuration(duration), bitrate: Number(fmt.bit_rate) || 0, format: fmt.format_name || '',
    video: video, audios: audios, subtitles: subs,
    summary: [video && video.resolution, video && video.codec, audioTxt].filter(Boolean).join(' · ')
  };
}

async function shots(file, opts) {
  const o = Object.assign({ count: 4, width: 1280, quality: 3, outDir: '', prefix: 'shot', tonemap: false }, opts || {});
  const info = await probe(file);
  const dur = Number(info.duration) || 0;
  const dir = o.outDir ? path.resolve(o.outDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'pta-shots-'));
  fs.mkdirSync(dir, { recursive: true });
  const count = Math.max(1, Math.min(12, Number(o.count) || 4));
  const width = Math.max(160, Math.min(3840, Number(o.width) || 1280));
  let useTonemap = !!(o.tonemap || (info.video && info.video.hdr));
  const items = [];
  for (let i = 1; i <= count; i++) {
    const at = dur > 0 ? Math.min(Math.max(0, dur - 0.05), dur * i / (count + 1)) : 0;
    const outFile = path.join(dir, o.prefix + '-' + i + '.jpg');
    const plain = 'scale=' + width + ':-2';
    const tone = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,' + plain;
    const base = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.round(at * 1000) / 1000), '-i', info.file,
      '-frames:v', '1', '-q:v', String(Math.max(2, Math.min(10, Number(o.quality) || 3)))];
    try {
      await run('ffmpeg', base.concat(['-vf', useTonemap ? tone : plain, outFile]), { timeout: 60000 });
    } catch (e) {
      if (!useTonemap) throw e;
      useTonemap = false;
      await run('ffmpeg', base.concat(['-vf', plain, outFile]), { timeout: 60000 });
    }
    const st = fs.statSync(outFile);
    if (!st.size) throw new Error('截图是空文件：' + outFile);
    items.push({ path: outFile, name: path.basename(outFile), bytes: st.size, at: Math.round(at * 1000) / 1000 });
  }
  return { dir: dir, width: width, tonemap: useTonemap, items: items, probe: info };
}

function bencode(v) {
  if (Buffer.isBuffer(v)) return Buffer.concat([Buffer.from(v.length + ':'), v]);
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8');
    return Buffer.concat([Buffer.from(b.length + ':'), b]);
  }
  if (typeof v === 'number' && Number.isFinite(v)) return Buffer.from('i' + Math.floor(v) + 'e');
  if (Array.isArray(v)) return Buffer.concat([Buffer.from('l')].concat(v.map(bencode), [Buffer.from('e')]));
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    const parts = [Buffer.from('d')];
    keys.forEach(function (k) { parts.push(bencode(k), bencode(v[k])); });
    parts.push(Buffer.from('e'));
    return Buffer.concat(parts);
  }
  throw new Error('bencode 不支持的类型');
}

async function makeTorrent(opts) {
  const o = opts || {};
  const file = path.resolve(String(o.file || ''));
  const st = fs.statSync(file);
  if (!st.isFile()) throw new Error('目前只支持单文件种子');
  if (!/^https?:\/\//i.test(String(o.announce || ''))) throw new Error('announce 必须是 http/https');
  const pieceLength = Math.max(16384, Math.min(4 * 1024 * 1024, Number(o.pieceLength) || 262144));
  const buf = fs.readFileSync(file);
  if (!buf.length) throw new Error('文件是空的');
  const pieces = [];
  for (let i = 0; i < buf.length; i += pieceLength) {
    pieces.push(crypto.createHash('sha1').update(buf.slice(i, i + pieceLength)).digest());
  }
  const info = {
    length: buf.length,
    name: String(o.name || path.basename(file)),
    'piece length': pieceLength,
    pieces: Buffer.concat(pieces)
  };
  if (o.private !== false) info.private = 1;
  const torrent = {
    announce: String(o.announce),
    'created by': 'SEEDPOD',
    'creation date': Math.floor(Date.now() / 1000),
    info: info
  };
  const encoded = bencode(torrent);
  return {
    buffer: encoded, name: info.name, size: buf.length, pieceLength: pieceLength,
    pieces: pieces.length, infohash: crypto.createHash('sha1').update(bencode(info)).digest('hex'),
    announce: torrent.announce
  };
}

module.exports = { probe, shots, makeTorrent, bencode, resolutionLabel, fmtDuration };

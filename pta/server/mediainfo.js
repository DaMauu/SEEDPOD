/* MediaInfo / BDInfo 文本解析：纯函数，不联网，不调用外部工具。
   输入站点详情页里常见的 MediaInfo 或 BDInfo 文本，输出结构化摘要，
   供上传准备生成简介和面板预览。认不出就返回空 kind，不猜。 */
const sizeLib = require('./adapters/size');

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
function fieldValue(section, names) {
  const fields = section && section.fields ? section.fields : {};
  for (const name of names) {
    if (fields[name]) return fields[name];
    const key = Object.keys(fields).find(function (k) { return k.toLowerCase() === String(name).toLowerCase(); });
    if (key) return fields[key];
  }
  return '';
}
function resolutionLabel(h) {
  const n = Number(h) || 0;
  if (n >= 2000) return '2160p';
  if (n >= 1000) return '1080p';
  if (n >= 700) return '720p';
  if (n >= 500) return '576p';
  if (n >= 400) return '480p';
  return '';
}
function languageOf(s) {
  const t = String(s == null ? '' : s);
  if (/^(zh|chi|zho)$/i.test(t.trim()) || /Chinese|Mandarin|Cantonese|中文|国语|国配|粤语|粤配|简中|繁中|中字/i.test(t)) return 'zh';
  if (/^(en|eng)$/i.test(t.trim()) || /English|\bENG\b|英字/i.test(t)) return 'en';
  if (/^(ja|jpn)$/i.test(t.trim()) || /Japanese|日语|日語/i.test(t)) return 'ja';
  if (/^(ko|kor)$/i.test(t.trim()) || /Korean|韩语|韓語/i.test(t)) return 'ko';
  if (/^(fr|fra|fre)$/i.test(t.trim()) || /French|法语|法語/i.test(t)) return 'fr';
  if (/^(de|deu|ger)$/i.test(t.trim()) || /German|德语|德語/i.test(t)) return 'de';
  if (/^(es|spa)$/i.test(t.trim()) || /Spanish|西班牙语/i.test(t)) return 'es';
  return '';
}
function flagsOf(text) {
  const s = String(text == null ? '' : text);
  return {
    chineseSub: /中字|中文|简中|繁中|CHS|CHT|\bChinese\b|\bMandarin\b|\bCantonese\b/i.test(s),
    englishSub: /英字|\bEnglish\b|\bENG\b/i.test(s),
    mandarinAudio: /国语|国配|\bMandarin\b|\bChinese\b/i.test(s),
    cantoneseAudio: /粤语|粤配|\bCantonese\b/i.test(s),
    atmos: /\bAtmos\b/i.test(s),
    dovi: /Dolby\s*Vision|DoVi|\bDV\b/i.test(s),
    hdr10: /HDR10\+?/i.test(s),
    hdr: /HDR10|HDR10\+|Dolby\s*Vision|DoVi|HLG/i.test(s)
  };
}
function applyFlags(out) {
  const all = [
    out.title || '', out.label || '',
    out.video ? (out.video.raw || '') : '',
    (out.audio || []).map(function (a) { return a.raw || ''; }).join('\n'),
    (out.subtitle || []).map(function (s) { return s.raw || ''; }).join('\n')
  ].join('\n');
  const flags = flagsOf(all);
  flags.chineseSub = (out.subtitle || []).some(function (s) {
    return /Chinese|Mandarin|Cantonese|中字|中文|简中|繁中|CHS|CHT/i.test((s.raw || '') + ' ' + (s.title || '') + ' ' + (s.language || ''));
  });
  flags.englishSub = (out.subtitle || []).some(function (s) {
    return /English|\bENG\b|英字/i.test((s.raw || '') + ' ' + (s.title || '') + ' ' + (s.language || ''));
  });
  flags.mandarinAudio = (out.audio || []).some(function (a) {
    return /国语|国配|Mandarin|\bChinese\b|^zh$/i.test((a.raw || '') + ' ' + (a.title || '') + ' ' + (a.language || ''));
  });
  flags.cantoneseAudio = (out.audio || []).some(function (a) {
    return /粤语|粤配|Cantonese|^zh$/i.test((a.raw || '') + ' ' + (a.title || ''));
  });
  out.flags = flags;
}
function summaryOf(out) {
  const parts = [];
  if (out.video && out.video.resolution) parts.push(out.video.resolution);
  if (out.video && out.video.codec) parts.push(out.video.codec);
  if (out.video && out.video.hdr) parts.push(out.video.hdr);
  const a = (out.audio || [])[0];
  if (a && a.format) parts.push(a.format + (a.channelsText ? ' ' + a.channelsText : ''));
  if (a && a.atmos) parts.push('Atmos');
  if (out.flags && out.flags.chineseSub) parts.push('中字');
  const size = out.sizeText || out.size || out.discSize || '';
  if (size) parts.push(size);
  return parts.filter(Boolean).join(' · ').slice(0, 160);
}

const BD_LABELS = ['Disc Title', 'Disc Label', 'Disc Size', 'Protection', 'Playlist', 'Total Bitrate', 'Subtitles', 'Subtitle', 'Length', 'Video', 'Audio', 'Size']
  .sort(function (a, b) { return b.length - a.length; });
function normalizeBdinfo(raw) {
  let s = clean(raw);
  const labels = BD_LABELS.map(function (label) { return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
  s = s.replace(new RegExp('(^|[^\\n])[ \\t]*(' + labels + ')[ \\t]*:', 'gim'), function (_, prev, label) {
    return prev + '\n' + label + ':';
  });
  return s.replace(/\n{2,}/g, '\n');
}
function bdValue(line, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('^' + esc + '\\s*:\\s*(.+)$', 'i').exec(line);
  return m ? m[1].trim() : '';
}
function parseVideoLine(line) {
  const s = String(line || '');
  if (!s) return null;
  const v = { raw: s, codec: '', format: '', resolution: '', hdr: '', bitDepth: 0, fps: 0, width: 0, height: 0 };
  if (/HEVC|H\.?265/i.test(s)) v.codec = 'HEVC';
  else if (/AVC|H\.?264/i.test(s)) v.codec = 'AVC';
  else if (/VC-1/i.test(s)) v.codec = 'VC-1';
  else if (/MPEG-2/i.test(s)) v.codec = 'MPEG-2';
  else if (/AV1/i.test(s)) v.codec = 'AV1';
  const res = /\b(2160p|1080p|1080i|720p|576p|480p)\b/i.exec(s);
  if (res) v.resolution = res[1].toLowerCase();
  else if (/\b(4K|UHD)\b/i.test(s)) v.resolution = '2160p';
  if (/Dolby\s*Vision|DoVi/i.test(s)) v.hdr = 'DoVi';
  else if (/HDR10\+/i.test(s)) v.hdr = 'HDR10+';
  else if (/HDR10|\bHDR\b/i.test(s)) v.hdr = 'HDR10';
  else if (/\bHLG\b/i.test(s)) v.hdr = 'HLG';
  const bits = /(\d{1,2})\s*bits?/i.exec(s);
  if (bits) v.bitDepth = Number(bits[1]);
  const fps = /([\d.]+)\s*fps/i.exec(s);
  if (fps) v.fps = Number(fps[1]);
  const dim = /(\d{3,4})\s*[x×]\s*(\d{3,4})/i.exec(s);
  if (dim) { v.width = Number(dim[1]); v.height = Number(dim[2]); }
  return v;
}
function parseAudioLine(line) {
  const s = String(line || '');
  if (!s) return null;
  let format = '';
  if (/DTS-HD\s*Master\s*Audio/i.test(s)) format = 'DTS-HD MA';
  else if (/DTS-HD\s*High\s*Resolution/i.test(s)) format = 'DTS-HD HRA';
  else if (/DTS[- ]?X/i.test(s)) format = 'DTS:X';
  else if (/Dolby\s*TrueHD/i.test(s)) format = 'TrueHD';
  else if (/Dolby\s*Digital\s*Plus/i.test(s)) format = 'DD+';
  else if (/Dolby\s*Digital/i.test(s)) format = 'AC3';
  else if (/\bDTS\b/i.test(s)) format = 'DTS';
  else if (/\bLPCM\b/i.test(s)) format = 'LPCM';
  else if (/\bFLAC\b/i.test(s)) format = 'FLAC';
  else if (/\bAAC\b/i.test(s)) format = 'AAC';
  const ch = /(\d)\s*\.\s*(\d)/.exec(s);
  let channelsText = ch ? ch[1] + '.' + ch[2] : '';
  let channels = ch ? Number(ch[1]) + Number('0.' + ch[2]) : 0;
  if (!channelsText) {
    const n = /(\d)\s*channels?/i.exec(s);
    if (n) { channels = Number(n[1]); channelsText = channels === 6 ? '5.1' : channels === 8 ? '7.1' : channels === 2 ? '2.0' : channels === 1 ? '1.0' : String(channels); }
  }
  return { raw: s, format: format, commercial: '', channels: channels, channelsText: channelsText, layout: '', language: languageOf(s), title: '', atmos: /\bAtmos\b/i.test(s), bitrate: '' };
}
function parseSubtitleLine(line) {
  const s = String(line || '');
  if (!s) return null;
  return { raw: s, format: '', language: languageOf(s), title: '', forced: /forced|强制/i.test(s) };
}
function parseBdinfo(raw) {
  const text = normalizeBdinfo(raw);
  const out = { kind: 'bdinfo', title: '', label: '', discSize: '', discSizeBytes: 0, protection: '', playlist: '', size: '', sizeBytes: 0, sizeText: '', length: '', durationText: '', bitrate: '', videos: [], audios: [], subtitles: [], video: null, audio: [], subtitle: [], flags: {}, summary: '', raw: text.slice(0, 200000) };
  text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (line) {
    let v;
    if ((v = bdValue(line, 'Disc Title'))) out.title = v;
    else if ((v = bdValue(line, 'Disc Label'))) out.label = v;
    else if ((v = bdValue(line, 'Disc Size'))) { out.discSize = v; out.discSizeBytes = sizeLib.parseSize(v); }
    else if ((v = bdValue(line, 'Protection'))) out.protection = v;
    else if ((v = bdValue(line, 'Playlist'))) out.playlist = v;
    else if ((v = bdValue(line, 'Size'))) { out.size = v; out.sizeBytes = sizeLib.parseSize(v); }
    else if ((v = bdValue(line, 'Length'))) { out.length = v; out.durationText = v; }
    else if ((v = bdValue(line, 'Total Bitrate'))) out.bitrate = v;
    else if ((v = bdValue(line, 'Video'))) out.videos.push(v);
    else if ((v = bdValue(line, 'Audio'))) out.audios.push(v);
    else if ((v = bdValue(line, 'Subtitles')) || (v = bdValue(line, 'Subtitle'))) out.subtitles.push(v);
  });
  if (!out.label && out.title) out.label = out.title;
  out.sizeText = (out.sizeBytes || out.discSizeBytes) ? sizeLib.formatSize(out.sizeBytes || out.discSizeBytes) : (out.size || out.discSize);
  out.video = parseVideoLine(out.videos[0] || '');
  out.audio = out.audios.map(parseAudioLine).filter(Boolean);
  out.subtitle = out.subtitles.map(parseSubtitleLine).filter(Boolean);
  applyFlags(out);
  out.summary = summaryOf(out);
  return out;
}

const MI_HEADER = /^(General|Video|Audio(?:\s*#\d+)?|Text(?:\s*#\d+)?|Menu(?:\s*#\d+)?|Chapters?)\s*$/i;
function parseMediainfo(raw) {
  const text = clean(raw);
  const sections = [];
  let cur = null;
  text.split('\n').forEach(function (line) {
    const t = line.trim();
    if (!t) return;
    const h = MI_HEADER.exec(t);
    if (h) {
      cur = { name: h[1], base: h[1].replace(/\s*#\d+$/, ''), fields: {}, lines: [] };
      sections.push(cur);
      return;
    }
    if (!cur) return;
    cur.lines.push(t);
    const m = /^([^:]{1,60}?)\s*:\s*(.+)$/.exec(t);
    if (m) {
      const key = m[1].trim();
      if (!(key in cur.fields)) cur.fields[key] = m[2].trim();
    }
  });
  const out = { kind: 'mediainfo', sections: sections.map(function (s) { return s.name; }), title: '', label: '', size: '', sizeBytes: 0, sizeText: '', duration: '', durationText: '', bitrate: '', format: '', video: null, audio: [], subtitle: [], flags: {}, summary: '', raw: text.slice(0, 200000) };
  const gen = sections.find(function (s) { return s.base === 'General'; });
  if (gen) {
    out.format = fieldValue(gen, ['Format']);
    out.size = fieldValue(gen, ['File size', 'File size/String']);
    out.sizeBytes = sizeLib.parseSize(out.size);
    out.sizeText = out.sizeBytes ? sizeLib.formatSize(out.sizeBytes) : out.size;
    out.duration = fieldValue(gen, ['Duration']);
    out.durationText = out.duration;
    out.bitrate = fieldValue(gen, ['Overall bit rate']);
    out.title = fieldValue(gen, ['Title', 'Movie name', 'Unique ID']);
  }
  const vs = sections.filter(function (s) { return s.base === 'Video'; });
  if (vs.length) out.video = parseVideoSection(vs[0]);
  out.audio = sections.filter(function (s) { return s.base === 'Audio'; }).map(parseAudioSection).filter(Boolean);
  out.subtitle = sections.filter(function (s) { return s.base === 'Text'; }).map(parseTextSection).filter(Boolean);
  applyFlags(out);
  out.summary = summaryOf(out);
  return out;
}
function parseVideoSection(sec) {
  const codecId = fieldValue(sec, ['Codec ID']);
  const format = fieldValue(sec, ['Format']);
  const profile = fieldValue(sec, ['Format profile']);
  const hdrFormat = fieldValue(sec, ['HDR format']);
  const transfer = fieldValue(sec, ['Transfer characteristics']);
  const width = Number(String(fieldValue(sec, ['Width']) || '').replace(/[^\d]/g, '')) || 0;
  const height = Number(String(fieldValue(sec, ['Height']) || '').replace(/[^\d]/g, '')) || 0;
  const bitDepth = Number(String(fieldValue(sec, ['Bit depth']) || '').replace(/[^\d]/g, '')) || 0;
  const fps = Number(String(fieldValue(sec, ['Frame rate']) || '').replace(/[^\d.]/g, '')) || 0;
  let codec = '';
  if (/HEVC|H\.?265/i.test(format) || /V_MPEGH/i.test(codecId)) codec = 'HEVC';
  else if (/AVC|H\.?264/i.test(format) || /V_MPEG4\/ISO\/AVC/i.test(codecId)) codec = 'AVC';
  else if (/VC-1/i.test(format)) codec = 'VC-1';
  else if (/MPEG-2/i.test(format)) codec = 'MPEG-2';
  else if (/AV1/i.test(format)) codec = 'AV1';
  let hdr = '';
  if (/Dolby\s*Vision|DoVi/i.test(hdrFormat)) hdr = 'DoVi';
  else if (/HDR10\+/i.test(hdrFormat)) hdr = 'HDR10+';
  else if (/HDR10|SMPTE ST 2086/i.test(hdrFormat) || /PQ/i.test(transfer)) hdr = 'HDR10';
  else if (/HLG/i.test(transfer)) hdr = 'HLG';
  return { raw: sec.lines.join('\n').slice(0, 1000), codec: codec, format: format, profile: profile, width: width, height: height, resolution: resolutionLabel(height), bitDepth: bitDepth, fps: fps, hdr: hdr, hdrFormat: hdrFormat, transfer: transfer };
}
function parseAudioSection(sec) {
  const format = fieldValue(sec, ['Format']);
  const commercial = fieldValue(sec, ['Commercial name']);
  const codecId = fieldValue(sec, ['Codec ID']);
  const channels = Number(String(fieldValue(sec, ['Channel(s)']) || '').replace(/[^\d]/g, '')) || 0;
  const layout = fieldValue(sec, ['Channel layout']);
  const language = fieldValue(sec, ['Language']);
  const title = fieldValue(sec, ['Title']);
  const bitrate = fieldValue(sec, ['Bit rate']);
  const all = [format, commercial, codecId].join(' ');
  let fmt = '';
  if (/DTS XLL|DTS-HD Master/i.test(all)) fmt = 'DTS-HD MA';
  else if (/DTS-HD High/i.test(all)) fmt = 'DTS-HD HRA';
  else if (/DTS[- ]?X/i.test(all)) fmt = 'DTS:X';
  else if (/TrueHD/i.test(all)) fmt = 'TrueHD';
  else if (/E-AC-3|EAC3|Dolby Digital Plus/i.test(all)) fmt = 'DD+';
  else if (/AC-3|AC3|Dolby Digital/i.test(all)) fmt = 'AC3';
  else if (/DTS/i.test(all)) fmt = 'DTS';
  else if (/FLAC/i.test(all)) fmt = 'FLAC';
  else if (/LPCM|PCM/i.test(all)) fmt = 'LPCM';
  else if (/AAC/i.test(all)) fmt = 'AAC';
  let channelsText = '';
  if (channels === 6) channelsText = '5.1';
  else if (channels === 8) channelsText = '7.1';
  else if (channels === 2) channelsText = '2.0';
  else if (channels === 1) channelsText = '1.0';
  else if (channels) channelsText = String(channels);
  return { raw: sec.lines.join('\n').slice(0, 1000), format: fmt, commercial: commercial, channels: channels, channelsText: channelsText, layout: layout, language: languageOf(language), title: title, atmos: /\bAtmos\b/i.test(all + ' ' + title), bitrate: bitrate };
}
function parseTextSection(sec) {
  const language = fieldValue(sec, ['Language']);
  const title = fieldValue(sec, ['Title']);
  const forced = /^(yes|true|是)$/i.test(fieldValue(sec, ['Forced']));
  return { raw: sec.lines.join('\n').slice(0, 500), format: fieldValue(sec, ['Format']), language: languageOf(language + ' ' + title), title: title, forced: forced };
}

function parse(raw) {
  const text = clean(raw);
  if (!text) return { kind: '', summary: '', error: 'empty', raw: '' };
  if (/(^|\n)\s*Disc (Title|Label|Size)\s*:/i.test(text) || /(^|\n)\s*Playlist\s*:/i.test(text)) return parseBdinfo(text);
  if (/(^|\n)\s*(General|Video|Audio(?:\s*#\d+)?|Text(?:\s*#\d+)?|Menu)\s*$/mi.test(text) || /(^|\n)\s*Complete name\s*:/i.test(text)) return parseMediainfo(text);
  return { kind: '', summary: '', error: 'unrecognized', raw: text.slice(0, 200000) };
}
function toBBCode(parsed) {
  if (!parsed || !parsed.raw || (parsed.kind !== 'bdinfo' && parsed.kind !== 'mediainfo')) return '';
  const raw = String(parsed.raw).trim();
  if (/^(?:【(?:BDInfo|MediaInfo)】\s*)?\[(?:quote|code|hide)(?:=[^\]]*)?\]/i.test(raw)) return raw.slice(0, 20000);
  const label = parsed.kind === 'bdinfo' ? 'BDInfo' : 'MediaInfo';
  return ('【' + label + '】\n[quote]\n' + raw + '\n[/quote]').slice(0, 20000);
}

module.exports = { parse: parse, parseBdinfo: parseBdinfo, parseMediainfo: parseMediainfo, toBBCode: toBBCode, summaryOf: summaryOf, languageOf: languageOf };

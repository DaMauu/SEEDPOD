/* 发布标题解析：纯函数，不联网。输入种子标题，输出规范字段。
   只做确定性的文本解析；TMDB/豆瓣等外部元数据以后单独接，不在这里猜。 */

const CAT_CN = { movie: '电影', tv: '剧集', show: '综艺', anime: '动漫', doc: '纪录', music: '音乐', sport: '体育', other: '其他' };
const GROUP_STOP = /^(ray|rip|dl|web|avc|hevc|x26[45]|ma|hd|vision|atmos|dts|truehd|hdr|uhd|blu)$/i;

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/\.(mkv|mp4|m2ts|iso|ts|avi|wmv|mov)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function pad2(n) { return String(n).padStart(2, '0'); }
function seasonEpisode(p) {
  if (p.season && p.episode) return 'S' + pad2(p.season) + 'E' + pad2(p.episode);
  if (p.season) return 'S' + pad2(p.season);
  if (p.episode) return 'E' + pad2(p.episode);
  return '';
}

function parseRelease(raw) {
  const s = clean(raw);
  const out = { title: '', year: null, season: null, episode: null, resolution: '', source: '',
    codec: '', audio: '', group: '', hdr: [], tags: [], category: 'movie', catName: CAT_CN.movie };
  if (!s) return out;

  /* 年份：取最后一个 19xx/20xx，避免把片名里的 2049 当成发行年 */
  const years = [];
  const yre = /(?:^|[\s._\[\(-])((?:19|20)\d{2})(?=$|[\s._\]\)-])/g;
  let ym;
  while ((ym = yre.exec(s))) {
    years.push({ v: Number(ym[1]), i: ym.index + ym[0].indexOf(ym[1]) });
  }
  const yPick = years.length ? years[years.length - 1] : null;
  if (yPick) out.year = yPick.v;

  /* 季集：S01E02 / S01 / Season 1 / 第1季 / E02 / 01x02 / 动漫 - 1120 */
  let m = /\bS(\d{1,2})E(\d{1,3})\b/i.exec(s);
  if (m) { out.season = Number(m[1]); out.episode = Number(m[2]); }
  else {
    m = /\bS(\d{1,2})\b/i.exec(s); if (m) out.season = Number(m[1]);
    m = /\b(?:E|EP)(\d{1,3})\b/i.exec(s); if (m && out.episode == null) out.episode = Number(m[1]);
    m = /\bSeason[ .]?(\d{1,2})\b/i.exec(s); if (m && out.season == null) out.season = Number(m[1]);
    m = /第\s*(\d{1,2})\s*季/.exec(s); if (m && out.season == null) out.season = Number(m[1]);
    m = /\b(\d{1,2})x(\d{1,3})\b/.exec(s); if (m) { out.season = Number(m[1]); out.episode = Number(m[2]); }
  }
  if (out.episode == null && /\[[^\]]*(?:sub|ani|fansub)|动漫|动画|anime/i.test(s)) {
    m = /(?:^|[\s._-])-\s*(\d{1,4})(?=\s|\[|\(|$)/.exec(s);
    if (m) out.episode = Number(m[1]);
  }

  /* 分辨率 */
  m = /\b(2160p|1080p|1080i|720p|576p|480p)\b/i.exec(s);
  if (m) out.resolution = m[1].toLowerCase();
  else if (/\b4K\b|\bUHD\b/i.test(s)) out.resolution = '2160p';

  /* 来源 */
  if (/UHD[ .-]?Blu-?Ray/i.test(s)) out.source = 'UHD Blu-ray';
  else if (/Blu-?Ray|BluRay|BDRip/i.test(s)) out.source = 'Blu-ray';
  else if (/WEB[ .-]?DL/i.test(s)) out.source = 'WEB-DL';
  else if (/WEBRip/i.test(s)) out.source = 'WEBRip';
  else if (/HDTV/i.test(s)) out.source = 'HDTV';
  else if (/DVDRip/i.test(s)) out.source = 'DVDRip';
  else if (/BDMV|\.ISO\b/i.test(s)) out.source = 'BDMV';
  if (/REMUX/i.test(s)) out.source = (out.source ? out.source + ' ' : '') + 'Remux';

  /* 编码 */
  if (/HEVC|x265|H[ .]?265/i.test(s)) out.codec = 'HEVC';
  else if (/AVC|x264|H[ .]?264/i.test(s)) out.codec = 'AVC';
  else if (/VC-1/i.test(s)) out.codec = 'VC-1';
  else if (/MPEG-2/i.test(s)) out.codec = 'MPEG-2';
  else if (/AV1/i.test(s)) out.codec = 'AV1';

  /* 音轨：优先长匹配 */
  const audios = [
    /DTS[ .-]?HD[ .-]?MA(?:[ .]?\d\.\d)?/i,
    /DTS[ .-]?X(?:[ .]?\d\.\d)?/i,
    /TrueHD(?:[ .]?\d\.\d)?(?:[ .]?Atmos)?/i,
    /DTS(?:[ .]?\d\.\d)?/i,
    /EAC3|DDP(?:[ .]?\d\.\d)?/i,
    /AC3|DD(?:[ .]?\d\.\d)?/i,
    /FLAC(?:[ .]?\d\.\d)?/i,
    /LPCM(?:[ .]?\d\.\d)?/i,
    /AAC(?:[ .]?\d\.\d)?/i,
    /Atmos/i
  ];
  for (const re of audios) {
    m = re.exec(s);
    if (m) { out.audio = m[0].replace(/[ \-]+/g, ' ').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim(); break; }
  }

  /* HDR */
  if (/DoVi|Dolby[ .]?Vision|\bDV\b/i.test(s)) out.hdr.push('DoVi');
  if (/HDR10\+/i.test(s)) out.hdr.push('HDR10+');
  else if (/HDR10|\bHDR\b/i.test(s)) out.hdr.push('HDR10');
  if (/\bHLG\b/i.test(s)) out.hdr.push('HLG');

  /* 版本/标签 */
  const tags = [
    [/Director'?s[ .]?Cut/i, "Director's Cut"], [/Extended/i, 'Extended'], [/Uncut/i, 'Uncut'],
    [/Criterion/i, 'Criterion'], [/Remastered/i, 'Remastered'], [/修复版/i, '修复版'],
    [/国配/i, '国配'], [/粤语/i, '粤语'], [/中字/i, '中字'], [/简繁/i, '简繁'],
    [/\bDIY\b/i, 'DIY'], [/\bREPACK\b/i, 'REPACK'], [/\bPROPER\b/i, 'PROPER']
  ];
  tags.forEach(function (pair) { if (pair[0].test(s)) out.tags.push(pair[1]); });

  /* 制作组：最后一个 -GROUP，过滤 Blu-ray/DTS-HD 这类词 */
  const gm = /[-–]([A-Za-z0-9@._]{2,20})\s*$/.exec(s);
  if (gm && !GROUP_STOP.test(gm[1])) out.group = gm[1];

  /* 分类 */
  if (/动漫|动画|anime|\[[^\]]*(?:sub|ani|fansub)/i.test(s)) out.category = 'anime';
  else if (/综艺|variety/i.test(s)) out.category = 'show';
  else if (out.season != null || out.episode != null || /剧集|电视剧|series|episode/i.test(s)) out.category = 'tv';
  else if (/concert|演唱会|音乐会|音乐|music|live at|\bMV\b/i.test(s)) out.category = 'music';
  else if (/documentary|纪录片|纪录|docu/i.test(s)) out.category = 'doc';
  else if (/\bsport\b|体育|NBA|F1|UFC/i.test(s)) out.category = 'sport';
  out.catName = CAT_CN[out.category] || CAT_CN.other;

  /* 标题：去掉扩展名、括号、动漫集数，再在年份/季集/分辨率/来源/编码/音轨处截断 */
  let t = s.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\s+-\s+\d{1,4}.*$/, ' ');
  let cut = t.length;
  if (yPick && yPick.i < cut) cut = yPick.i;
  const cuts = [
    /\bS\d{1,2}(?:E\d{1,3})?\b/i, /\bSeason[ .]?\d{1,2}\b/i, /第\s*\d{1,2}\s*季/,
    /\b(?:2160p|1080p|1080i|720p|576p|480p)\b/i,
    /\b(?:UHD[ .-]?Blu-?Ray|Blu-?Ray|BluRay|BDRip|REMUX|WEB[ .-]?DL|WEBRip|HDTV|DVDRip|BDMV)\b/i,
    /\b(?:HEVC|AVC|x264|x265|H[ .]?264|H[ .]?265|VC-1|MPEG-2|AV1)\b/i,
    /\b(?:DTS|TrueHD|Atmos|EAC3|DDP|AC3|FLAC|LPCM|AAC)\b/i
  ];
  cuts.forEach(function (re) {
    const x = re.exec(t);
    if (x && x.index > 0 && x.index < cut) cut = x.index;
  });
  let title = t.slice(0, cut).replace(/[._]+/g, ' ').replace(/[-–]+$/g, '').replace(/\s+/g, ' ').trim();
  if (out.group && title.toLowerCase().endsWith(out.group.toLowerCase())) {
    title = title.slice(0, -out.group.length).replace(/[-–._\s]+$/g, '').trim();
  }
  out.title = title;
  return out;
}

function buildNames(item) {
  const it = item || {};
  const p = parseRelease(it.title);
  const se = seasonEpisode(p);
  const title = String(it.cn || p.title || it.title || '').trim();
  const releaseTitle = [p.title, p.year, se, p.resolution, p.source, p.codec, p.audio,
    p.hdr.join('+'), p.group].filter(Boolean).join('.').replace(/\s+/g, '.');
  const subtitle = [title, it.res || p.resolution, it.size].filter(Boolean).join(' · ');
  const desc = it.intro || [
    p.title + (p.year ? '（' + p.year + '）' : '') + (se ? ' ' + se : ''),
    [p.resolution, p.source, p.codec, p.audio].filter(Boolean).join(' '),
    p.group ? '制作组 ' + p.group : '',
    it.site ? '来源 ' + it.site : ''
  ].filter(Boolean).join('，') + '。';
  return { title: title, releaseTitle: releaseTitle, subtitle: subtitle, description: desc, parsed: p };
}

module.exports = { parseRelease, buildNames, CAT_CN };

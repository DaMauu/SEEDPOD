/* 全局预设：类型、搜索维度、发布字段只在这里写一份。
   站点 JSON 只存 key 和站点分类 ID，例如 movie -> 401。
   可选运行时覆盖：data/presets.json（不复制则不生成）。 */
const fs = require('fs');
const path = require('path');
const jsonFile = require('../../infra/json-file');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = path.join(__dirname, '..', '..', '..', 'pack', 'presets.preset.json');

/* 旧 key、中文名、常见写法都归一到同一套 key */
const ALIAS = {
  doc: 'documentary', documentary: 'documentary', '纪录': 'documentary', '纪录片': 'documentary',
  sport: 'sports', sports: 'sports', '体育': 'sports',
  book: 'ebook', books: 'ebook', ebook: 'ebook', '电子书': 'ebook',
  audiobook: 'audiobook', audiobooks: 'audiobook', '有声书': 'audiobook',
  show: 'variety', variety: 'variety', '综艺': 'variety',
  tvshow: 'variety', '电视剧': 'tv', series: 'tv', '剧集': 'tv',
  animation: 'anime', '动画': 'anime', '动漫': 'anime',
  film: 'movie', movies: 'movie', '电影': 'movie',
  '演唱会': 'concert', concert: 'concert', '演唱': 'concert',
  '音乐': 'music', music: 'music',
  mv: 'mv', '音乐短片': 'mv',
  '软件': 'software', software: 'software', app: 'software',
  '游戏': 'game', game: 'game', games: 'game',
  '短剧': 'short', short: 'short', shortdrama: 'short',
  '舞台演出': 'stage', stage: 'stage', '舞台': 'stage',
  '成人': 'adult', adult: 'adult',
  '原盘': 'full_disc', fulldisc: 'full_disc', full_disc: 'full_disc', bdmv: 'full_disc',
  remux: 'remux',
  '压制': 'encode', encode: 'encode',
  '图片': 'image', image: 'image', picture: 'image',
  '样品': 'sample', sample: 'sample',
  '预告': 'trailer', trailer: 'trailer',
  '其他': 'other', '其它': 'other', other: 'other', misc: 'other',
  '学习': 'other', study: 'other'
};

const DIM_ALIAS = {
  medium: {
    '原盘': 'full_disc', 'full disc': 'full_disc', fulldisc: 'full_disc', bdmv: 'full_disc', iso: 'full_disc',
    uhd: 'uhd_full_disc', 'uhd原盘': 'uhd_full_disc', '4k原盘': 'uhd_full_disc', 'blu-rayuhd': 'uhd_full_disc', blurayuhd: 'uhd_full_disc', '4kuhd': 'uhd_full_disc',
    '3d': '3d_full_disc', '3d原盘': '3d_full_disc',
    encode: 'encode', '压制': 'encode',
    'blu-ray': 'bluray', bluray: 'bluray', bd: 'bluray', bdrip: 'bluray',
    hddvd: 'hddvd', dvd: 'dvd', dvdrip: 'dvd', hdtv: 'hdtv',
    'web-dl': 'webdl', webdl: 'webdl', web: 'webdl', webrip: 'webrip', tvrip: 'tvrip', vhs: 'vhs', '其他': 'other'
  },
  resolution: { '4k': '2160p', '8k': '4320p' },
  codec: { h264: 'h264', 'h.264/avc/x264': 'h264', 'h264/avc/x264': 'h264', 'h.265/hevc/x265': 'h265', h265: 'h265', 'mpeg-2': 'mpeg2', mpeg2: 'mpeg2', 'vc-1': 'vc1', vc1: 'vc1', xvid: 'xvid', '其他': 'other', other: 'other' },
  audio: { 'dts-hd/dts': 'dts_hd', dtshd: 'dts_hd', dts: 'dts_hd', truehd: 'truehd', ac3: 'ac3', lpcm: 'lpcm', flac: 'flac', mp3: 'mp3', aac: 'aac', ape: 'ape', '其他': 'other', other: 'other' },
  discount: {
    '2x 50%': '2x_half', '2x50%': '2x_half', '2x50': '2x_half', '2x_half': '2x_half',
    '2x free': '2x_free', '2x免费': '2x_free', '2x 免费': '2x_free',
    '2x': '2x',
    '50%': 'half', '50': 'half', half: 'half',
    '30%': 'thirty', '30': 'thirty', thirty: 'thirty',
    free: 'free', '免费': 'free',
    normal: 'normal', none: 'normal', '普通': 'normal',
    featured: 'featured', sticky: 'featured', '置顶精选': 'featured'
  },
  restriction: {
    '禁转': 'no_repost', norepost: 'no_repost',
    '限转': 'limited_repost', limitedrepost: 'limited_repost',
    hr: 'hr',
    '独占': 'exclusive', exclusive: 'exclusive',
    diy: 'diy'
  }
};

function norm(x) {
  return String(x == null ? '' : x).trim();
}
function token(x) {
  return String(x == null ? '' : x).toLowerCase().replace(/[\s_.-]+/g, '');
}
function lower(x) {
  return norm(x).toLowerCase().replace(/[\s_-]+/g, '');
}

function makePresets(dataDir) {
  const dir = dataDir ? path.resolve(dataDir) : '';
  const runtimeFile = dir ? path.join(dir, 'presets.json') : '';
  let cache = null;
  let ensured = false;

  function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  }
  /* 首次启动：pack 里的模板复制成 data/presets.json；之后只读用户这份 */
  function ensure() {
    if (!runtimeFile || ensured) return false;
    ensured = true;
    if (fs.existsSync(runtimeFile)) return false;
    const base = readJson(DEFAULT_FILE);
    if (!base || typeof base !== 'object' || !base.types) return false;
    try { jsonFile.writeAtomic(runtimeFile, base, 0o600); cache = null; return true; }
    catch (e) { return false; }
  }
  function doc() {
    ensure();
    const file = runtimeFile && fs.existsSync(runtimeFile) ? runtimeFile : DEFAULT_FILE;
    let st = null;
    try { st = fs.statSync(file); } catch (e) { st = null; }
    if (cache && st && cache.file === file && cache.mtime === st.mtimeMs && cache.size === st.size) return cache.doc;
    const parsed = readJson(file);
    const base = parsed && typeof parsed === 'object' && parsed.types ? parsed : (readJson(DEFAULT_FILE) || {});
    cache = { file: file, mtime: st ? st.mtimeMs : 0, size: st ? st.size : 0, doc: base };
    return base;
  }

  function types() { return Object.assign({}, doc().types || {}); }
  function typeKeys() { return Object.keys(types()); }
  function keyOf(x) {
    const raw = norm(x);
    if (!raw) return '';
    const all = types();
    if (all[raw]) return raw;
    const low = raw.toLowerCase();
    if (all[low]) return low;
    if (ALIAS[raw]) return ALIAS[raw];
    if (ALIAS[low]) return ALIAS[low];
    const hit = Object.keys(all).filter(function (k) { return all[k] === raw; })[0];
    return hit || '';
  }
  function labelOf(x) {
    const k = keyOf(x);
    if (!k) return norm(x);
    return types()[k] || norm(x);
  }
  function keysOfList(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      const k = keyOf(x);
      if (k && out.indexOf(k) < 0) out.push(k);
    });
    return out;
  }
  function searchOptions(dim) {
    return Object.assign({}, ((doc().search || {})[dim]) || {});
  }
  function searchKeys(dim) { return Object.keys(searchOptions(dim)); }
  function searchLabel(dim, key) { return searchOptions(dim)[key] || norm(key); }
  function keyOfDim(dim, x) {
    const raw = norm(x);
    if (!raw) return '';
    const opts = searchOptions(dim);
    if (opts[raw]) return raw;
    const low = raw.toLowerCase();
    if (opts[low]) return low;
    const hitKey = Object.keys(opts).filter(function (k) { return opts[k] === raw; })[0];
    if (hitKey) return hitKey;
    const aliases = DIM_ALIAS[dim] || {};
    const t = token(raw);
    if (aliases[raw]) return aliases[raw];
    if (aliases[low]) return aliases[low];
    if (aliases[t]) return aliases[t];
    /* 站点会写成“Free（下载量不统计）”“2X 50%（...）”，按包含关系取最长命中 */
    const hits = Object.keys(aliases).filter(function (a) { return a.length >= 2 && raw.toLowerCase().indexOf(a) >= 0; });
    hits.sort(function (a, b) { return b.length - a.length; });
    if (hits.length) return aliases[hits[0]];
    if (dim === 'resolution') {
      const m = /(480|576|720|1080)[pi]/i.exec(raw);
      if (m) return m[0].toLowerCase();
      if (/2160|\b4k\b|uhd/i.test(raw)) return '2160p';
      if (/4320|\b8k\b/i.test(raw)) return '4320p';
    }
    return '';
  }
  function expandDim(dim, key) {
    const g = ((doc().groups || {})[dim] || {})[key];
    return Array.isArray(g) && g.length ? g.slice() : [key];
  }
  function expandDims(dim, keys) {
    const out = [];
    (Array.isArray(keys) ? keys : []).forEach(function (k) { expandDim(dim, k).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function labelsOfDim(dim, keys) {
    return (Array.isArray(keys) ? keys : []).map(function (k) { return searchLabel(dim, k); });
  }
  function publishFields() { return Object.assign({}, ((doc().publish || {}).fields) || {}); }
  function siteDefaults() { return JSON.parse(JSON.stringify((doc() || {}).site || {})); }

  return {
    FILE: DEFAULT_FILE, RUNTIME_FILE: runtimeFile, ensure: ensure, doc: doc, types: types, typeKeys: typeKeys, keyOf: keyOf, labelOf: labelOf,
    keysOfList: keysOfList, searchOptions: searchOptions, searchKeys: searchKeys,
    searchLabel: searchLabel, keyOfDim: keyOfDim, labelsOfDim: labelsOfDim, expandDim: expandDim, expandDims: expandDims, publishFields: publishFields, siteDefaults: siteDefaults
  };
}

module.exports = makePresets;
module.exports.makePresets = makePresets;
module.exports.ALIAS = ALIAS;
module.exports.DIM_ALIAS = DIM_ALIAS;

/* 副标题拼贴：影片名 | 地区+原盘 | 导演:… | 主演:… | [音频] [字幕]
   数据优先用豆影返回；音频/字幕语言从 BDInfo/MediaInfo 的 Audio/Subtitle 字段归一。 */
const LANG = {
  english: '英语', en: '英语', eng: '英语',
  chinese: '国语', mandarin: '国语', chi: '国语', zho: '国语', zh: '国语',
  cantonese: '粤语', yue: '粤语',
  japanese: '日语', jpn: '日语', ja: '日语',
  korean: '韩语', kor: '韩语', ko: '韩语',
  french: '法语', fra: '法语', fre: '法语', fr: '法语',
  german: '德语', deu: '德语', ger: '德语', de: '德语',
  spanish: '西班牙语', spa: '西班牙语', es: '西班牙语',
  italian: '意大利语', ita: '意大利语', it: '意大利语',
  russian: '俄语', rus: '俄语', ru: '俄语',
  portuguese: '葡萄牙语', por: '葡萄牙语', pt: '葡萄牙语',
  thai: '泰语', tha: '泰语', th: '泰语',
  hindi: '印地语', hin: '印地语', hi: '印地语',
  arabic: '阿拉伯语', ara: '阿拉伯语', ar: '阿拉伯语',
  dutch: '荷兰语', nld: '荷兰语', dut: '荷兰语', nl: '荷兰语',
  polish: '波兰语', pol: '波兰语', pl: '波兰语',
  turkish: '土耳其语', tur: '土耳其语', tr: '土耳其语',
  swedish: '瑞典语', swe: '瑞典语', sv: '瑞典语',
  danish: '丹麦语', dan: '丹麦语', da: '丹麦语',
  norwegian: '挪威语', nor: '挪威语', no: '挪威语',
  finnish: '芬兰语', fin: '芬兰语', fi: '芬兰语',
  czech: '捷克语', ces: '捷克语', cze: '捷克语', cs: '捷克语',
  hungarian: '匈牙利语', hun: '匈牙利语', hu: '匈牙利语',
  greek: '希腊语', ell: '希腊语', gre: '希腊语', el: '希腊语',
  hebrew: '希伯来语', heb: '希伯来语', he: '希伯来语',
  ukrainian: '乌克兰语', ukr: '乌克兰语', uk: '乌克兰语',
  vietnamese: '越南语', vie: '越南语', vi: '越南语',
  indonesian: '印尼语', ind: '印尼语', id: '印尼语',
  malay: '马来语', msa: '马来语', may: '马来语', ms: '马来语',
  latin: '拉丁语', lat: '拉丁语', la: '拉丁语'
};
const SHORT = {
  '国语': '国', '英语': '英', '粤语': '粤', '日语': '日', '韩语': '韩',
  '法语': '法', '德语': '德', '西班牙语': '西', '意大利语': '意', '俄语': '俄',
  '葡萄牙语': '葡', '泰语': '泰', '印地语': '印', '阿拉伯语': '阿'
};

function uniq(list) {
  const out = [];
  (list || []).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
  return out;
}
function langOf(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[._-]+/g, ' ');
  if (!s) return '';
  const word = s.split(/\s+/)[0];
  return LANG[s] || LANG[word] || '';
}
function parseLanguages(text) {
  const out = { audio: [], subtitle: [] };
  const src = String(text || '');
  let section = '';
  src.split(/\r?\n/).forEach(function (line) {
    const t = line.trim();
    if (!t) return;
    const sec = /^(Audio|Text|Subtitle|Subtitles|Menu)\b/i.exec(t);
    if (sec) section = /^audio/i.test(sec[1]) ? 'audio' : (/^menu/i.test(sec[1]) ? 'menu' : 'subtitle');
    const direct = /^(Audio|Subtitle|Subtitles)\s*:\s*(.+)$/i.exec(t);
    if (direct) {
      const kind = /^audio/i.test(direct[1]) ? 'audio' : 'subtitle';
      String(direct[2]).split(/\s*\/\s*/).forEach(function (x) {
        const l = langOf(x);
        if (l) out[kind].push(l);
      });
      return;
    }
    const lang = /^Language\s*:\s*(.+)$/i.exec(t);
    if (lang && (section === 'audio' || section === 'subtitle')) {
      const l = langOf(lang[1]);
      if (l) out[section].push(l);
    }
  });
  /* 标题/标签兜底：国语 粤语 中字 */
  if (!out.audio.length) {
    ['国语', '英语', '粤语', '日语', '韩语'].forEach(function (x) { if (src.indexOf(x) >= 0) out.audio.push(x); });
  }
  out.audio = uniq(out.audio);
  out.subtitle = uniq(out.subtitle);
  return out;
}
const ORDER = { '国语': 0, '粤语': 1, '英语': 2, '日语': 3, '韩语': 4, '法语': 5, '德语': 6 };
function langText(list, suffix) {
  const arr = uniq(list).sort(function (a, b) {
    return (ORDER[a] == null ? 99 : ORDER[a]) - (ORDER[b] == null ? 99 : ORDER[b]);
  });
  if (!arr.length) return '';
  if (suffix === '语') {
    if (arr.length === 1) return arr[0];
    return arr.map(function (x) { return SHORT[x] || x.replace(/语$/, ''); }).join('') + '语';
  }
  if (arr.length === 1) return arr[0] === '国语' ? '中字' : (SHORT[arr[0]] || arr[0].replace(/语$/, '')) + '字';
  return arr.map(function (x) { return x === '国语' ? '国' : (SHORT[x] || x.replace(/语$/, '')); }).join('') + '字';
}
function isFullDisc(item) {
  const it = item || {};
  if (it.fullDisc === true) return true;
  const text = [it.medium, it.title, it.res].filter(Boolean).join(' ');
  return /原盘|full\s*disc|bdmv|\biso\b/i.test(text) && !/remux|diy/i.test(text);
}
function zhName(raw) {
  const s = String(raw || '').replace(/\([^)]*\)/g, '').trim();
  if (!s) return '';
  const lead = /^([\u4e00-\u9fa5][\u4e00-\u9fa5·\-—－]*)/.exec(s);
  if (lead && lead[1].length >= 2) return lead[1];
  const zh = s.match(/[\u4e00-\u9fa5·]{2,}/g);
  if (zh && zh.length) return zh.sort(function (a, b) { return b.length - a.length; })[0];
  return '';
}
function nameList(list) {
  return (Array.isArray(list) ? list : []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
}
function pickNames(list, count) {
  const all = nameList(list);
  const zh = all.map(zhName).filter(Boolean);
  const en = all.filter(function (x) { return !zhName(x); });
  const out = [];
  zh.forEach(function (x) { if (out.length < count && out.indexOf(x) < 0) out.push(x); });
  if (out.length < count) en.forEach(function (x) { if (out.length < count && out.indexOf(x) < 0) out.push(x); });
  return out.slice(0, count);
}
function composeSubtitle(item, meta) {
  const it = item || {};
  const m = meta || {};
  const title = String(m.title || it.cn || it.subtitle || '').trim() || String(it.title || '').split(/\s{2,}|\./)[0];
  const parts = [title].filter(Boolean);
  if (isFullDisc(it)) {
    const region = String(it.region || m.region || '').trim();
    if (region) parts.push(region + '原盘');
  }
  const dir = pickNames(m.directors, 1)[0];
  if (dir) parts.push('导演:' + dir);
  const cast = pickNames(m.cast, 3);
  if (cast.length) parts.push('主演:' + cast.join('/'));
  const media = parseLanguages(it.bdinfo || it.mediainfo || '');
  const audio = langText(media.audio, '语');
  const sub = langText(media.subtitle, '字');
  if (audio) parts.push('[' + audio + ']');
  if (sub) parts.push('[' + sub + ']');
  return parts.join(' | ').slice(0, 300);
}
module.exports = { parseLanguages, composeSubtitle, isFullDisc, pickNames, langText };

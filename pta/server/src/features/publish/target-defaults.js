/* 目标站必填下拉的默认值：按源条目的地区/语言/媒介去对站点选项，
   而不是永远取第一个非零项（否则好莱坞片会被填成“大陆”）。纯函数、不联网。 */

/* 地区/媒介默认值：按源条目的地区、语言、媒介去对站点选项，而不是永远取第一项。 */
const REGION_HINTS = [
  ['HKG', /香港|港产|港版|粤语|粵語|cantonese|hkg/i],
  ['TWN', /台湾|台灣|台版|台配|taiwan|twn/i],
  ['CHN', /大陆|内地|中国|国产|國產|国配|国语|普通话|mandarin|china|chn/i],
  ['JPN', /日本|日版|日语|日語|japanese|jpn/i],
  ['KOR', /韩国|韓國|韩版|韩语|韓語|korean|kor/i],
  ['IND', /印度|印度语|hindi|ind/i],
  ['ENG', /美国|美國|英国|英國|欧美|歐美|英美|英语|英語|english|usa|uk|eng|加拿大|澳大利亚|澳洲|新西兰|瑞典|挪威|丹麦|芬兰|冰岛|法国|德国|意大利|西班牙|荷兰|比利时|奥地利|瑞士|波兰|俄罗斯/i]
];
const REGION_SET = ['CHN', 'HKG', 'TWN', 'ENG', 'KOR', 'JPN', 'IND'];
const MEDIA_SET = ['UHD', 'BLURAY', 'REMUX', 'HDTV', 'WEBDL', 'WEBRIP', 'ENCODE', 'DVD', 'HDDVD'];
function languageHints(item) {
  const out = [];
  const med = (item.prepared && item.prepared.media) || item.media || null;
  if (med && Array.isArray(med.audio)) {
    med.audio.forEach(function (a) {
      const lang = String((a && a.language) || '').toLowerCase();
      if (lang) out.push(lang);
    });
  }
  return out;
}
/* 源站简介里的“制 片 / 产 地 / 语 言”字段最准，优先按它判地区 */
function regionFromDetail(item) {
  const raw = String(item.descrBb || item.descr || '');
  if (!raw) return '';
  const field = /(?:制\s*片|产\s*地|國\s*家|国\s*家|地\s*区)[\s:：*·]*([^\n\r|]{1,40})/.exec(raw);
  if (field && field[1]) {
    for (const pair of REGION_HINTS) if (pair[1].test(field[1])) return pair[0];
  }
  const lang = /语\s*言[\s:：*·]*([^\n\r|]{1,30})/.exec(raw);
  if (lang && lang[1]) {
    for (const pair of REGION_HINTS) if (pair[1].test(lang[1])) return pair[0];
  }
  return '';
}
function regionCodeOf(item) {
  const detail = regionFromDetail(item);
  if (detail) return detail;
  const text = [item.region, item.language, item.audio, item.title]
    .concat(languageHints(item)).filter(Boolean).join(' ');
  for (const pair of REGION_HINTS) if (pair[1].test(text)) return pair[0];
  return '';
}
const MEDIA_HINTS = [
  ['HDDVD', /hddvd/i],
  ['REMUX', /remux/i],
  ['UHD', /ultra\s*hd|\buhd\b|\b4k\b|2160p/i],
  ['WEBDL', /web-?dl/i],
  ['WEBRIP', /web-?rip/i],
  ['HDTV', /hdtv/i],
  ['DVD', /\bdvd/i],
  ['BLURAY', /blu-?ray|bdrip|brrip|bdmv|full\s*disc/i],
  ['ENCODE', /encode|x264|x265|h\.?26[45]/i]
];
function mediaCodeOf(item) {
  const text = [item.title, item.res, item.medium, item.source].filter(Boolean).join(' ');
  for (const pair of MEDIA_HINTS) if (pair[1].test(text)) return pair[0];
  return '';
}
const OPTION_HINTS = [
  ['HDDVD', /hddvd/i],
  ['REMUX', /remux/i],
  ['UHD', /ultra\s*hd|\buhd\b|\b4k\b|2160p/i],
  ['WEBDL', /web-?dl/i],
  ['WEBRIP', /web-?rip/i],
  ['HDTV', /hdtv/i],
  ['DVD', /\bdvd/i],
  ['BLURAY', /blu-?ray|\bbd\s*discs?\b/i],
  ['ENCODE', /encode/i]
];
/* 站点写法不同：Mainland→CHN、Western→ENG、BD Discs→BLURAY */
const CODE_ALIAS = {
  MAINLAND: 'CHN', CHINA: 'CHN', CN: 'CHN',
  HK: 'HKG', TW: 'TWN',
  WESTERN: 'ENG', WEST: 'ENG', USA: 'ENG', UK: 'ENG',
  KOREA: 'KOR', KR: 'KOR', JP: 'JPN', JA: 'JPN', IN: 'IND',
  '4K': 'UHD', '2160P': 'UHD'
};
function optionCode(label) {
  const str = String(label || '');
  const paren = /\(([^)]*)\)/.exec(str);
  if (paren) {
    const codes = String(paren[1]).split(/[,，\s]+/).map(function (x) { return x.toUpperCase(); }).filter(Boolean);
    if (codes.length) {
      const c = codes[0];
      return CODE_ALIAS[c] || c;
    }
  }
  for (const pair of OPTION_HINTS) if (pair[1].test(str)) return pair[0];
  return '';
}
function betterDefault(opts, item) {
  const codes = opts.map(function (o) { return optionCode(o.label); });
  const regionCount = codes.filter(function (c) { return REGION_SET.indexOf(c) >= 0; }).length;
  const mediaCount = codes.filter(function (c) { return MEDIA_SET.indexOf(c) >= 0; }).length;
  let want = '';
  if (regionCount >= 2) want = regionCodeOf(item);
  else if (mediaCount >= 2) want = mediaCodeOf(item);
  if (!want) return '';
  const idx = codes.indexOf(want);
  return idx >= 0 ? String(opts[idx].value) : '';
}

module.exports = { regionCodeOf: regionCodeOf, regionFromDetail: regionFromDetail, mediaCodeOf: mediaCodeOf, optionCode: optionCode, betterDefault: betterDefault };

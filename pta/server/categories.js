/* 站点分类 → 库内用途。纯函数，生成站点包和 UI 建议共用一套规则。 */

const PURPOSES = [
  { v: 'movie', label: '电影' },
  { v: 'tv', label: '剧集' },
  { v: 'doc', label: '纪录片' },
  { v: 'anime', label: '动漫' },
  { v: 'music', label: '音乐' },
  { v: 'sport', label: '体育' },
  { v: 'game', label: '游戏' },
  { v: 'book', label: '电子书' },
  { v: 'software', label: '软件' },
  { v: 'adult', label: '成人' },
  { v: 'other', label: '其他' }
];

/* 顺序：先具体类型，再影视大类，最后 other。 */
const RULES = [
  ['anime', /(动漫|動漫|动画|動畫|番剧|番劇|剧场版|劇場版|anime|animation|cartoon)/i],
  ['doc', /(纪录|記錄|纪录片|紀錄片|documentar|docs?\b|docu\b)/i],
  ['sport', /(体育|體育|赛事|賽事|sport|nba|nfl|足球|篮球|籃球|网球|網球)/i],
  ['adult', /(\bxxx\b|adult|18\+|amateur|softcore|hardcore|hentai|成人|色情|情色)/i],
  ['music', /(音乐|音樂|无损|無損|演唱会|演唱會|演唱|ost\b|classical|muzica|\bmv\b|music|concert|audio|flac|mp3|lossless|音轨|音軌|音频|音頻|opera|戏曲|戲曲|曲艺|曲藝)/i],
  ['book', /(电子书|電子書|书籍|書籍|图书|圖書|杂志|雜誌|资料|資料|有声书|有聲書|学习|學習|教程|漫画|漫畫|轻小说|輕小說|画集|畫集|画册|畫冊|阅听|閱聽|教学|教學|book|ebook|audiobook|comic|magazine|tutorial|manga|light.?novel|art.?book)/i],
  ['game', /(游戏|遊戲|jocuri|game|playstation|nintendo|xbox|\bps[2-5]\b|\bpc\s*games?\b|anbernic|batocera|coinops|emulation|roms?\b|arcade)/i],
  ['software', /(软件|軟體|software|apps?\b|applications?\b|programs?\b|programe|mobile|android|linux|windows|macos|\bmac\b|tools?\b|utilities|office|imagini)/i],
  ['tv', /(剧集|劇集|电视剧|電視劇|连续剧|連續劇|短剧|短劇|美剧|美劇|英剧|英劇|日剧|日劇|韩剧|韓劇|国产剧|國產劇|综艺|綜藝|episode|series|\btv\b|tv.?hd|hdtv|tv.?sd|shows?\b|sitcom|anime.?series)/i],
  ['movie', /(电影|電影|影视|影視|影片|filme?|movie|blu-?ray|uhd|4k|1080p|720p|remux|web-?dl|dvd-?r|dvdrip|bdrip|rips?\b|untouched|encoded|sdr|hdr|action|horror|comedy|drama|sci-?fi|thriller|romance|animation)/i],
  ['other', /(其他|其它|misc|others?\b|all\b|categories|pack|unknown|pre-?release)/i]
];

function suggest(label) {
  const s = String(label == null ? '' : label).replace(/[\s\u3000]+/g, '');
  if (!s) return { purpose: 'other', confidence: 'low', matched: '' };
  for (const r of RULES) {
    if (r[1].test(s)) return { purpose: r[0], confidence: r[0] === 'other' ? 'low' : 'high', matched: String(r[1]) };
  }
  return { purpose: 'other', confidence: 'low', matched: '' };
}

function labelOf(purpose) {
  const hit = PURPOSES.filter(function (p) { return p.v === purpose })[0];
  return hit ? hit.label : '其他';
}

module.exports = { PURPOSES: PURPOSES, RULES: RULES, suggest: suggest, labelOf: labelOf };

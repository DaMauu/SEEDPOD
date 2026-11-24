/* 分类政策：把站点分类名归一到流程页的「类型」。
   只做纯映射，不发请求；抓取和流程页共用，避免两边规则不一致。 */
const TYPE_RULES = [
  ['电影', /电影|movie|film/i],
  ['剧集', /剧集|电视剧|tv\s*series|tv\s*shows?|series|episode/i],
  ['综艺', /综艺|variety/i],
  ['动漫', /动漫|动画|anime|animation/i],
  ['纪录片', /纪录|documentary|docu/i],
  ['演唱会', /演唱会|concert/i],
  ['MV', /(^|[^a-z])mv([^a-z]|$)|音乐短片|music\s*video/i],
  ['音乐', /音乐|music|音频|audio/i],
  ['体育', /体育|sport/i],
  ['有声书', /有声书|audiobook|audio\s*book/i],
  ['电子书', /电子书|ebook|book/i],
  ['软件', /软件|software|app/i],
  ['学习', /学习|study|教育|tutorial/i],
  ['短剧', /短剧|short\s*drama/i],
  ['舞台演出', /舞台|stage/i],
  ['游戏', /游戏|game|playstation|xbox|nintendo/i],
  ['成人', /成人|adult|18\+/i],
  ['图片', /图片|picture|image|photo/i],
  ['样品', /样品|sample/i],
  ['预告', /预告|trailer/i],
  ['原盘', /原盘|full\s*disc|bdmv/i],
  ['Remux', /remux/i],
  ['压制', /压制|encode/i],
  ['其他', /其他|其它|other|misc/i]
];

function typeOf(label) {
  const s = String(label == null ? '' : label).replace(/\s+/g, '');
  for (const pair of TYPE_RULES) {
    if (pair[1].test(String(label == null ? '' : label)) || pair[1].test(s)) return pair[0];
  }
  return '';
}

/* 流程页 ① 抓取卡里的「类型」选择 */
function selectedTypesOf(flow) {
  const groups = flow && flow.sets && flow.sets.fetch;
  const rows = Array.isArray(groups) && Array.isArray(groups[0]) ? groups[0] : [];
  const row = rows.filter(function (r) { return r && r.t === '类型'; })[0];
  return row && Array.isArray(row.sel) ? row.sel.map(String).filter(Boolean) : [];
}

/* 按类型过滤站点分类；返回命中的类型和没匹配到的类型。 */
function filterCatsByTypes(cats, types) {
  const want = (types || []).map(String).filter(Boolean);
  if (!want.length) return { cats: cats || [], matched: [], unmatched: [] };
  const allowed = [];
  const matched = new Set();
  (cats || []).forEach(function (c) {
    const label = String((c && (c.label || c.purpose)) || '');
    const t = typeOf(label);
    if (want.indexOf(t) >= 0 || (label && want.indexOf(label) >= 0)) {
      allowed.push(c);
      if (t) matched.add(t);
    }
  });
  const unmatched = want.filter(function (t) { return !matched.has(t); });
  return { cats: allowed, matched: Array.from(matched), unmatched: unmatched };
}

module.exports = { TYPE_RULES, typeOf, selectedTypesOf, filterCatsByTypes };

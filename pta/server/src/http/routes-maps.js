/* 站点映射总表接口：读/写站点 publish.catMap，按上传表单自动识别大分类。 */
const { toSimplified } = require('../features/presets/zh');

const CAT = [
  ['电影', /电影|movie|film|影片|影\s*片|cinema/i],
  ['剧集', /剧集|电视剧|^电视$|tv\s*series|series|tv\s*packs?|^tv$|drama|star\s*plus|zee\s*tv|sab\s*tv|&tv|life\s*ok|dangal|star\s*bharat|ishara|shemaroo|jio\s*tv|colors|sony|mtv/i],
  ['综艺', /综艺|tv\s*show|variety/i],
  ['动漫', /动漫|动画|anime|animation|漫画|comics?|manga|\bova\b/i],
  ['纪录片', /纪录|documentary|docu|\bdoc\b|docs/i],
  ['演唱会', /演唱会|concert/i],
  ['音乐短片', /music\s*video|音乐短片|\bmv\b/i],
  ['音乐', /音乐|music|音频|音轨|专辑|原声|单曲|精选|混音|访谈|样带|重混音|\balbum\b|\bsingle\b|\bremix\b|\bost\b|soundtrack|\blive\s*album\b|bootleg|compilation|interview|\bflac\b|\bmp3\b|mixtape|\bdemo\b|hq\s*audio|\baudio\b|classical|ghazal|instrumental|muzica|manele|videoclip|klipek|lossless|dance/i],
  ['体育', /体育|sport|nba|nfl|mlb|nhl|ufc|mma|f1|formula|soccer|basket|football|tennis|golf|rugby|cricket|hockey|wrestling|boxing|cycling|racing|motogp|nascar|volleyball|handball|snooker|billiard|bowling|chess|darts|gymnastic|athletic|swimming|weightlifting|climbing|crossfit|baseball|softball|sailing|surfing|skate|ski|archery|fencing|rowing|equestrian|league|derby|cup|open/i],
  ['游戏', /游戏|game|playstation|ps[2-5]\b|xbox|nintendo|wii|rom\s*packs?|jocuri|játékok/i],
  ['软件', /软件|software|app|program|programok|programe|linux|mac|windows|android|mobile|0day/i],
  ['有声书', /有声书|audiobook|audio\s*book/i],
  ['电子书', /电子书|ebook|e-book|book|书籍|小说/i],
  ['短剧', /短剧|short/i],
  ['舞台演出', /舞台|stage|perf\b|戏曲|曲艺|opera/i],
  ['成人', /xxx|adult|softcore|18\+|erotic|hentai|porn/i],
  ['图片', /image|imagini|pics|pictures|wallpaper/i],
  ['其他', /其他|其它|other|misc|unknown|待定|uncategorised|all\s*categories|choose|select|^[-—]+$/i]
];

/* 题材/类型标签：动作、惊悚、恐怖、喜剧、剧情…… 不是内容分类，不能自动写 publish.catMap */
const GENRE = /动作|惊悚|恐怖|喜剧|剧情|科幻|战争|犯罪|悬疑|爱情|同性|西部|邪典|文艺|粉红|奇幻|冒险|灾难|武侠|古装|家庭|儿童|歌舞|传记|历史|音乐剧|短片|情色|戈尔|gore|action|thriller|horror|comedy|drama|sci-?fi|war|crime|mystery|romance|gay|western|cult|literary|fantasy|adventure|family|kids|musical|short|erotic/i;
const CONTENT = /电影|movie|film|剧集|电视剧|tv\s*series|动漫|动画|anime|animation|纪录|documentary|音乐|music|电子书|ebook|有声书|audiobook|体育|sport|游戏|game|软件|software|图片|image|成人|adult|其他|other/i;
function looksGenre(options) {
  const list = (Array.isArray(options) ? options : []).filter(function (o) { return o && String(o.value) !== '' && String(o.value) !== '0'; });
  if (list.length < 3) return false;
  const onlyGenre = list.filter(function (o) {
    const label = toSimplified(String(o.label || ''));
    return GENRE.test(label) && !CONTENT.test(label);
  }).length;
  return onlyGenre >= 2;
}

function cleanMap(obj, max) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  Object.keys(obj).slice(0, max || 200).forEach(function (k) {
    const key = String(k || '').trim(); const val = String(obj[k] == null ? '' : obj[k]).trim();
    if (key && val) out[key] = val;
  });
  return out;
}
function pickField(fields, names, labelRe) {
  const list = Array.isArray(fields) ? fields : [];
  return list.filter(function (f) {
    if (names.indexOf(String(f.name || '').toLowerCase()) >= 0) return true;
    return labelRe && labelRe.test(toSimplified(String(f.label || '')));
  })[0] || null;
}

function squeezeLabel(s) {
  /* 有些站把中文写成「电 影」「综 艺」，去掉汉字之间的空格再匹配 */
  return String(s || '').replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1');
}
function matchCatsDetailed(options, aliases) {
  const list = (Array.isArray(options) ? options : []).filter(function (o) { return o && String(o.value) !== '' && String(o.value) !== '0'; });
  const out = {};
  const notes = [];
  const choices = [];
  const used = {};
  const aliasMap = aliases && typeof aliases === 'object' ? aliases : {};
  const typeNames = CAT.map(function (p) { return p[0]; });
  list.forEach(function (o) {
    const display = String(o.label || '');
    const raw = toSimplified(display);
    const squeezed = squeezeLabel(raw);
    const alias = Object.keys(aliasMap).filter(function (k) { return squeezeLabel(toSimplified(k)) === squeezed; })[0];
    const aliasType = alias && typeNames.indexOf(String(aliasMap[alias])) >= 0 ? String(aliasMap[alias]) : '';
    if (aliasType) {
      used[String(o.value)] = true;
      if (out[aliasType] == null) out[aliasType] = String(o.value);
      return;
    }
    const hits = [];
    CAT.forEach(function (pair) {
      if (!pair[1].test(raw) && !pair[1].test(squeezed)) return;
      const exact = raw.trim() === pair[0] || squeezed.trim() === pair[0];
      hits.push({ type: pair[0], score: exact ? 3 : 1 });
    });
    if (!hits.length) return;
    const max = Math.max.apply(null, hits.map(function (x) { return x.score; }));
    const top = hits.filter(function (x) { return x.score === max; });
    const id = String(o.value);
    used[id] = true;
    /* 一个上传页 option 只落一个库内类型；组合标签按 CAT 顺序取更具体的那个，
       不把同一个目标站 ID 复制到多个库内类型（搜索分类 ID 和发布分类 ID 是两套命名空间）。 */
    const chosen = top[0].type;
    if (out[chosen] == null) out[chosen] = id;
    if (top.length > 1) {
      notes.push(display + ' → ' + chosen + '（命中 ' + top.map(function (x) { return x.type }).join('/') + '，按优先级）');
      choices.push({ label: display, value: id, chosen: chosen, types: top.map(function (x) { return x.type; }) });
    }
  });
  const unmatched = list.filter(function (o) { return !used[String(o.value)]; }).map(function (o) { return String(o.label || o.value); });
  return { cat: out, ambiguous: [], notes: notes, choices: choices, unmatched: unmatched };
}
function matchCats(options) { return matchCatsDetailed(options).cat; }

module.exports = function (app, ctx) {
  const { DATA_DIR, ok, bad } = ctx;
  const target = require('../features/publish/target').makeTarget(ctx);
  const siteStore = require('../features/sites/store')(DATA_DIR);
  const presets = require('../features/presets/store')(DATA_DIR);

  app.get('/api/maps', async () => {
    const sites = {};
    const summary = {};
    siteStore.list().forEach(function (s) {
      const cat = {};
      Object.keys(s.publish.catMap || {}).forEach(function (k) { cat[presets.labelOf(k) || k] = String(s.publish.catMap[k]); });
      const team = (s.publish.valueMaps && s.publish.valueMaps.team) || {};
      if (Object.keys(cat).length || Object.keys(team).length || s.publish.form) {
        sites[s.host] = { cat: cat, team: team, form: s.publish.form || null };
        summary[s.host] = { cat: Object.keys(cat).length, team: Object.keys(team).length };
      }
    });
    return ok({ sites: sites, summary: summary });
  });

  app.put('/api/maps/:host', async (req, reply) => {
    try {
      const host = String(req.params.host || '').toLowerCase();
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(host)) throw new Error('站点名不合法');
      const body = req.body || {};
      const saved = { cat: cleanMap(body.cat), team: cleanMap(body.team) };
      if (body.form && typeof body.form === 'object') saved.form = body.form;
      const cur = siteStore.get(host);
      if (cur) {
        const publish = Object.assign({}, cur.publish, {
          valueMaps: { team: saved.team || {} },
          form: saved.form || null
        });
        /* 总表里手填的中文分类名先归一成 key，才能覆盖已有映射 */
        const catMap = Object.assign({}, publish.catMap || {});
        Object.keys(saved.cat || {}).forEach(function (k) {
          const key = presets.keyOf(k) || k;
          if (!presets.types()[key]) return;
          catMap[key] = saved.cat[k];
        });
        publish.catMap = catMap;
        if (body.labels && typeof body.labels === 'object' && !Array.isArray(body.labels)) {
          const allowed = {};
          CAT.forEach(function (p) { allowed[p[0]] = true; });
          const labels = Object.assign({}, (publish.detect && publish.detect.labels) || {});
          Object.keys(body.labels).slice(0, 200).forEach(function (k) { const t = String(body.labels[k] || ''); if (allowed[t]) labels[String(k).slice(0, 80)] = t; });
          publish.detect = Object.assign({}, publish.detect || {}, { labels: labels });
        }
        siteStore.save(host, { publish: publish }, ctx.db);
      }
      return ok({ host: host, map: saved });
    } catch (e) {
      return bad(reply, 'BAD_HOST', String(e && e.message || e).slice(0, 120), 400);
    }
  });

  app.post('/api/maps/:host/detect', async (req, reply) => {
    const host = String(req.params.host || '').toLowerCase();
    const d = await target.detectUploadForm(host);
    if (!d.ok) return bad(reply, d.code, d.message, d.http || 400);
    const fields = d.data.fields || [];
    const catField = pickField(fields, ['type', 'category', 'type_id', 'category_id', 'cat'], /类型|分类|category/i);
    const teamField = pickField(fields, ['team', 'team_id', 'group', 'group_id'], /制作组|制作团队|小组|team|group/i);
    const catOptions = catField ? (catField.options || []).map(function (o) { return { value: String(o.value), label: o.label }; }) : [];
    const teamOptions = teamField ? (teamField.options || []).map(function (o) { return { value: String(o.value), label: o.label }; }) : [];
    const rec = siteStore.get(host);
    const siteAliases = (rec && rec.publish && rec.publish.detect && rec.publish.detect.labels) || {};
    const genre = looksGenre(catOptions);
    const catResult = genre ? { cat: {}, ambiguous: [], notes: [], choices: [], unmatched: [] } : matchCatsDetailed(catOptions, siteAliases);
    const selects = {};
    const defaults = {};
    const uploadFields = {};
    fields.forEach(function (f) {
      if (!f || !f.name) return;
      uploadFields[String(f.name)] = String(f.template || '');
      if (Array.isArray(f.options) && f.options.length) selects[String(f.name)] = f.options.map(function (o) { return { value: String(o.value), label: String(o.label || o.value) } });
      if (f.value) defaults[String(f.name)] = String(f.value);
    });
    const form = {
      at: new Date().toISOString(),
      catField: catField ? catField.name : '',
      teamField: teamField ? teamField.name : '',
      catOptions: catOptions,
      teamOptions: teamOptions,
      selects: selects,
      defaults: defaults
    };
    return ok({
      host: host,
      detected: { catField: form.catField, teamField: form.teamField },
      cat: catResult.cat,
      ambiguous: catResult.ambiguous,
      notes: catResult.notes || [],
      choices: catResult.choices || [],
      siteAliases: siteAliases,
      unmatched: catResult.unmatched,
      fieldKind: genre ? 'genre' : 'category',
      catOptions: catOptions,
      teamOptions: teamOptions,
      form: form,
      upload: { path: String(d.data.path || ''), formPath: String(d.data.formPath || ''), fileField: String(d.data.fileField || ''), fields: uploadFields }
    });
  });
};

module.exports._test = { matchCats, matchCatsDetailed, squeezeLabel, pickField, looksGenre, CAT, GENRE, CONTENT };

/* 站点映射总表接口：读/写站点 publish.catMap，按上传表单自动识别大分类。 */

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
    return labelRe && labelRe.test(String(f.label || ''));
  })[0] || null;
}

function squeezeLabel(s) {
  /* 有些站把中文写成「电 影」「综 艺」，去掉汉字之间的空格再匹配 */
  return String(s || '').replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1');
}
function matchCats(options) {
  const out = {};
  const list = (Array.isArray(options) ? options : []).filter(function (o) { return o && String(o.value) !== '' && String(o.value) !== '0'; });
  CAT.forEach(function (pair) {
    const hit = list.filter(function (o) {
      const label = String(o.label || '');
      return pair[1].test(label) || pair[1].test(squeezeLabel(label));
    })[0];
    if (hit) out[pair[0]] = String(hit.value);
  });
  return out;
}

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
    const form = {
      at: new Date().toISOString(),
      catField: catField ? catField.name : '',
      teamField: teamField ? teamField.name : '',
      catOptions: catOptions,
      teamOptions: teamOptions
    };
    return ok({
      host: host,
      detected: { catField: form.catField, teamField: form.teamField },
      cat: matchCats(catOptions),
      catOptions: catOptions,
      teamOptions: teamOptions,
      form: form
    });
  });
};

module.exports._test = { matchCats, squeezeLabel, pickField, CAT };

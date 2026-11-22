/* 站点映射总表接口：读/写 data/site-maps.json，按上传表单自动识别分类。 */
const siteMaps = require('./site-maps');

const CAT = [
  ['电影', /电影|movie|film|影片|影\s*片|cinema/i],
  ['剧集', /剧集|电视剧|^电视$|tv\s*series|series|tv\s*packs?|^tv$|drama|star\s*plus|zee\s*tv|sab\s*tv|&tv|life\s*ok|dangal|star\s*bharat|ishara|shemaroo|jio\s*tv|colors|sony|mtv/i],
  ['动漫', /动漫|动画|anime|animation|漫画|comics?|manga|\bova\b/i],
  ['综艺', /综艺|tv\s*show|variety/i],
  ['纪录片', /纪录|documentary|docu|\bdoc\b|docs/i],
  ['音乐', /音乐|music|音乐短片|演唱会?|音频|音轨|专辑|原声|单曲|精选|混音|访谈|样带|重混音|\bmv\b|\bep\b|\balbum\b|\bsingle\b|\bremix\b|\bost\b|soundtrack|\blive\s*album\b|bootleg|compilation|interview|\bflac\b|\bmp3\b|mixtape|\bdemo\b|hq\s*audio|\baudio\b|classical|ghazal|instrumental|muzica|manele|videoclip|klipek|lossless|dance/i],
  ['体育', /体育|sport|nba|nfl|mlb|nhl|ufc|mma|f1|formula|soccer|basket|football|tennis|golf|rugby|cricket|hockey|wrestling|boxing|cycling|racing|motogp|nascar|volleyball|handball|snooker|billiard|bowling|chess|darts|gymnastic|athletic|swimming|weightlifting|climbing|crossfit|baseball|softball|sailing|surfing|skate|ski|archery|fencing|rowing|equestrian|league|derby|cup|open/i],
  ['电子书', /电子书|ebook|e-book|book|有声书|audiobook/i],
  ['软件', /软件|software|app|program|programok|programe|linux|mac|windows|android|mobile|0day/i],
  ['学习', /学习|study|教育|tutorial|教\s*学/i],
  ['短剧', /短剧|short/i],
  ['舞台演出', /舞台|stage|perf\b|concert/i],
  ['游戏', /游戏|game|playstation|ps[2-5]\b|xbox|nintendo|wii|rom\s*packs?|jocuri|játékok/i],
  ['成人', /xxx|adult|softcore|18\+|erotic|hentai|porn/i],
  ['原盘', /untouched|full\s*disc|blu-?ray\s*iso|bd\/dvd\s*iso|\biso\b|4k\s*ultra\s*hd|\bbdmv\b|\b(?:bd|dvd)\s*iso\b/i],
  ['Remux', /remux/i],
  ['压制', /encode|x264|x265|hdtv|webrip|web-rips?|dvdrip|rips?\b|sdrips|divx|xvid|upscaled/i],
  ['图片', /image|imagini|pics|pictures|wallpaper/i],
  ['样品', /sample|sampler/i],
  ['预告', /trailer|preview|teaser/i],
  ['其他', /其他|其它|other|misc|图片|unknown|待定|uncategorised|all\s*categories|choose|select|^[-—]+$/i]
];

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
  const target = require('./target').makeTarget(ctx);
  const siteStore = require('./site-store')(DATA_DIR);

  app.get('/api/maps', async () => {
    const all = siteMaps.readAll(DATA_DIR);
    return ok({ sites: all.sites, summary: siteMaps.summary(DATA_DIR) });
  });

  app.put('/api/maps/:host', async (req, reply) => {
    try {
      const host = String(req.params.host || '').toLowerCase();
      const saved = siteMaps.setHost(DATA_DIR, host, req.body || {});
      const cur = siteStore.get(host);
      if (cur) {
        const publish = Object.assign({}, cur.publish, {
          catLabels: saved.cat || {},
          valueMaps: { team: saved.team || {} },
          form: saved.form || null
        });
        /* catMap 保留 purpose 键，同时补 label 键，发布计划两种都能匹配 */
        publish.catMap = Object.assign({}, publish.catMap || {}, saved.cat || {});
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

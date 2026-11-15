/* 站点映射总表接口：读/写 data/site-maps.json，按上传表单自动识别分类。 */
const siteMaps = require('./site-maps');

const CAT = [
  ['电影', /电影|movie|film/i],
  ['剧集', /剧集|电视剧|tv\s*series|series|tv\s*packs?/i],
  ['动漫', /动漫|动画|anime|animation|漫画|comics?/i],
  ['综艺', /综艺|tv\s*show|variety/i],
  ['纪录片', /纪录|documentary|docu/i],
  ['音乐', /音乐|music|音乐短片|演唱会?|音频|\bmv\b/i],
  ['体育', /体育|sport/i],
  ['电子书', /电子书|ebook|e-book|book|有声书|audiobook/i],
  ['软件', /软件|software|app/i],
  ['学习', /学习|study|教育|tutorial/i],
  ['短剧', /短剧|short/i],
  ['舞台演出', /舞台|stage/i],
  ['游戏', /游戏|game|playstation|xbox|nintendo|rom\s*packs?|android/i],
  ['其他', /其他|其它|other|misc|图片/i]
];

function pickField(fields, names, labelRe) {
  const list = Array.isArray(fields) ? fields : [];
  return list.filter(function (f) {
    if (names.indexOf(String(f.name || '').toLowerCase()) >= 0) return true;
    return labelRe && labelRe.test(String(f.label || ''));
  })[0] || null;
}

function matchCats(options) {
  const out = {};
  const list = (Array.isArray(options) ? options : []).filter(function (o) { return o && String(o.value) !== '' && String(o.value) !== '0'; });
  CAT.forEach(function (pair) {
    const hit = list.filter(function (o) { return pair[1].test(String(o.label || '')); })[0];
    if (hit) out[pair[0]] = String(hit.value);
  });
  return out;
}

module.exports = function (app, ctx) {
  const { DATA_DIR, ok, bad } = ctx;
  const target = require('./target').makeTarget(ctx);

  app.get('/api/maps', async () => {
    const all = siteMaps.readAll(DATA_DIR);
    return ok({ sites: all.sites, summary: siteMaps.summary(DATA_DIR) });
  });

  app.put('/api/maps/:host', async (req, reply) => {
    try {
      const saved = siteMaps.setHost(DATA_DIR, req.params.host, req.body || {});
      return ok({ host: String(req.params.host).toLowerCase(), map: saved });
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

module.exports._test = { matchCats, pickField, CAT };

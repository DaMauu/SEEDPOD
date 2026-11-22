/* 上传计划：字段映射、标签、BDInfo/MediaInfo、必填下拉默认值。 */
const flowConfig = require('./src/features/settings/flow-config');
const meta = require('./meta');
const targetDefaults = require('./target-defaults');
const mediainfo = require('./mediainfo');
const { composeSubtitle, expand, hideContent, stripHide, infoFieldKey, descrFieldKey } = require('./target-html');

function makePlan(deps) {
  const resolve = deps.resolve;
  const ctx = deps.ctx;
  const one = deps.one;
  const cookieStore = require('./src/features/sites/credentials')(ctx.DATA_DIR);
  const presets = require('./src/features/presets/store')(ctx.DATA_DIR);
  const TAG_BLOCK = /^(禁转|限转|禁止转载|禁止转发|官方|应求)$/;

  function tagList(item) {
    if (!flowConfig.on(flowConfig.read(ctx), '自动勾选标签', true)) return [];
    const raw = item && item.tags;
    let list = Array.isArray(raw) ? raw : String(raw == null ? '' : raw).split(/[,，、\s]+/);
    list = list.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
    if (!list.length) {
      try { list = meta.parseRelease(String((item && item.title) || '')).tags || []; } catch (e) { list = []; }
    }
    return list.filter(function (x, i, a) { return !TAG_BLOCK.test(x) && a.indexOf(x) === i; });
  }

  function vars(item) {
    const res = String(item.res || '');
    const size = String(item.size || '');
    return {
      tags: tagList(item).join(','),
      title: String(item.title || '').replace(/\s+/g, ' ').trim(),
      subtitle: composeSubtitle(item),
      description: String(item.descrBb || item.intro || [item.title, res ? res + ' 原盘' : '', item.site ? '来源 ' + item.site : ''].filter(Boolean).join('，') + '。'),
      catId: String(item.catId || ''),
      category: String(item.cat || item.catId || ''),
      source: String(item.source || ''),
      codec: String(item.codec || ''),
      resolution: res,
      region: String(item.region || ''),
      language: String(item.language || ''),
      bdinfo: String(item.bdinfo || '').slice(0, 60000),
      mediainfo: String(item.mediainfo || '').slice(0, 60000),
      audio: String(item.audio || ''),
      team: String(item.team || item.group || ''),
      anonymous: (item.anonymous !== undefined ? !!item.anonymous : flowConfig.on(flowConfig.read(ctx), '默认匿名', false)) ? '1' : '0',
      anonymousYes: (item.anonymous !== undefined ? !!item.anonymous : flowConfig.on(flowConfig.read(ctx), '默认匿名', false)) ? 'yes' : '',
      typeId: String(item.typeId || ''),
      resolutionId: String(item.resolutionId || ''),
      year: String(item.year || ''),
      imdb: String(item.imdb || ''),
      shots: String((item.shots || []).length),
      bitrate: String(item.bitrate || ''),
      releaseType: String(item.releaseType || '')
    };
  }

  function plan(host, item) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包，提交不了', http: 400 };
    const v = vars(item);
    if (!v.catId) {
      /* 分类映射：全局 key（movie）→ 中文名（电影）→ 本站 401；也允许直接写站点分类 */
      let raw = String(item.cat || item.catName || item.category || '').trim();
      if (!raw && item.catalogId) {
        try {
          const crow = one('SELECT data FROM catalog WHERE id = ?', item.catalogId);
          const cd = crow ? (ctx.jparse ? ctx.jparse(crow.data) : JSON.parse(crow.data)) : null;
          raw = String((cd && (cd.catName || cd.category || cd.cat)) || '').trim();
        } catch (e) { raw = ''; }
      }
      if (!raw) {
        try { const p = meta.parseRelease(item.title); raw = String(p.catName || p.category || '').trim(); } catch (e) { raw = ''; }
      }
      const normKey = function (x) { return String(x || '').toLowerCase().replace(/[\s._-]+/g, ''); };
      const generic = presets.keyOf(raw);
      const keys = [raw];
      if (generic) keys.push(generic, presets.labelOf(generic));
      const catKeys = Object.keys(t.catMap || {});
      let mapped = null;
      for (const k of keys) {
        if (!k) continue;
        if (t.catMap[k] != null) { mapped = t.catMap[k]; break; }
        const hit = catKeys.filter(function (x) { return normKey(x) === normKey(k); })[0];
        if (hit && t.catMap[hit] != null) { mapped = t.catMap[hit]; break; }
        const nk = normKey(k);
        const fuzzy = catKeys.filter(function (x) { const nx = normKey(x); return nx.length >= 2 && (nx.indexOf(nk) >= 0 || nk.indexOf(nx) >= 0); })[0];
        if (fuzzy && t.catMap[fuzzy] != null) { mapped = t.catMap[fuzzy]; break; }
      }
      /* 数字源分类不能直通目标站：必须经过目标站 catMap/类型映射，否则会把源站 413 当目标站 413 */
      if (mapped != null) v.catId = String(mapped);
    }
    const fields = {};
    Object.keys(t.upload.fields || {}).forEach(function (k) {
      const val = expand(t.upload.fields[k], v);
      if (val !== '') fields[k] = val;
    });
    const tags = tagList(item);
    const tagFields = [];
    const tagMap = t.tagMap || {};
    tags.forEach(function (label) {
      const field = String(tagMap[label] || '');
      if (!/^[a-z][a-z0-9_]{0,30}$/i.test(field)) return;
      if (fields[field] !== undefined) return;
      fields[field] = t.tagValue || 'yes';
      tagFields.push(field);
    });
    const warnings = [];
    const notes = [];
    /* 源站单独的 BDInfo/MediaInfo 框，或简介里的 [hide=bdinfo]/[hide=mediainfo]：
       目标站有专用字段就填字段，并把简介里的重复块去掉。 */
    const bdKey = infoFieldKey(t.upload.fields, 'bdinfo');
    const miKey = infoFieldKey(t.upload.fields, 'mediainfo');
    const descrKey = descrFieldKey(t.upload.fields);
    const ex = mediainfo.extractFromBbcode(item.descrBb || item.intro || '');
    let srcBd = String(item.bdinfo || '').trim();
    if (mediainfo.isWeakMedia(srcBd)) srcBd = (ex.bdinfo && ex.bdinfo.raw) || hideContent(item.descrBb || item.intro, 'bdinfo') || '';
    let srcMi = String(item.mediainfo || '').trim();
    if (mediainfo.isWeakMedia(srcMi)) srcMi = (ex.mediainfo && ex.mediainfo.raw) || hideContent(item.descrBb || item.intro, 'mediainfo') || '';
    let descrLive = descrKey ? String(fields[descrKey] || '') : '';
    if (bdKey && srcBd) {
      fields[bdKey] = srcBd;
      if (descrLive) { descrLive = stripHide(descrLive, 'bdinfo'); fields[descrKey] = descrLive; }
    }
    if (miKey && srcMi) {
      fields[miKey] = srcMi;
      if (descrLive) { descrLive = stripHide(descrLive, 'mediainfo'); fields[descrKey] = descrLive; }
    }
    /* 目标站没有专用字段：把源站单独的 BDInfo/MediaInfo 补成 hide 块，别丢信息 */
    if (descrKey && descrLive) {
      if (!bdKey && srcBd && !/\[hide=bdinfo\]/i.test(descrLive)) {
        descrLive = (descrLive.trim() + '\n\n[hide=bdinfo]\n' + srcBd + '\n[/hide]').slice(0, 60000);
        fields[descrKey] = descrLive;
      }
      if (!miKey && srcMi && !/\[hide=mediainfo\]/i.test(descrLive)) {
        descrLive = (descrLive.trim() + '\n\n[hide=mediainfo]\n' + srcMi + '\n[/hide]').slice(0, 60000);
        fields[descrKey] = descrLive;
      }
    }
    /* 制作组：只认数字 id 或站点映射，组名直接塞下拉会填错 */
    const teamRaw = String(v.team || '').trim();
    const teamMap = (t.valueMaps && t.valueMaps.team) || {};
    if (teamRaw) {
      if (/^\d+$/.test(teamRaw)) fields.team_sel = teamRaw;
      else if (teamMap[teamRaw] != null) fields.team_sel = String(teamMap[teamRaw]);
      else { delete fields.team_sel; warnings.push('制作组「' + teamRaw + '」没映射到目标站，发布前需要手选'); }
    }
    if (!v.catId) warnings.push('目标站分类没映射，请到「站点映射」补上');
    /* 必填下拉没映射时：先按源地区/媒介对选项，再退站点默认值，避免“你必须选择地区” */
    const REQUIRED = ['type', 'source_sel', 'team_sel', 'standard_sel', 'codec_sel', 'audiocodec_sel', 'medium_sel'];
    const defaults = (t.form && t.form.defaults) || {};
    const selects = (t.form && t.form.selects) || {};
    REQUIRED.forEach(function (k) {
      if (fields[k] !== undefined) return;
      const opts = selects[k];
      let auto = '';
      if (Array.isArray(opts) && opts.length) auto = targetDefaults.betterDefault(opts, item);
      if (auto) {
        fields[k] = auto;
        notes.push(k);
        return;
      }
      if (defaults[k] != null && defaults[k] !== '') {
        fields[k] = String(defaults[k]);
        notes.push(k);
      }
    });
    /* 下拉值必须在站点选项里；不在就按标签纠正，纠不了留空 */
    Object.keys(fields).forEach(function (k) {
      const opts = selects[k];
      if (!Array.isArray(opts) || !opts.length) return;
      const vals = opts.map(function (o) { return String(o.value); });
      if (vals.indexOf(String(fields[k])) >= 0) return;
      const byLabel = opts.filter(function (o) { return String(o.label || '') === String(fields[k]); })[0];
      if (byLabel) { fields[k] = String(byLabel.value); return; }
      notes.push(k);
      delete fields[k];
    });
    /* 给预览用的可读标签：把数字 id 翻回站点选项文字，不额外请求站点 */
    const labels = {};
    const reverse = function (map, val) {
      return Object.keys(map || {}).filter(function (k) { return String(map[k]) === String(val); })[0] || '';
    };
    ['type', 'cat', 'category', 'source_sel', 'team_sel', 'medium_sel', 'standard_sel', 'codec_sel', 'audiocodec_sel'].forEach(function (k) {
      if (fields[k] === undefined) return;
      const opts = selects[k];
      if (Array.isArray(opts)) {
        const hit = opts.filter(function (o) { return String(o.value) === String(fields[k]); })[0];
        if (hit && hit.label) { labels[k] = String(hit.label); return; }
      }
      if (k === 'type' || k === 'cat' || k === 'category') {
        const key = reverse(t.catMap, fields[k]);
        labels[k] = key ? (presets.labelOf(key) || key) : '';
      } else if (k === 'team_sel') labels[k] = reverse((t.valueMaps && t.valueMaps.team) || {}, fields[k]);
    });
    const uv = Object.assign({}, v, { title: encodeURIComponent(v.title) });
    const hasCookie = cookieStore.has(t.host);
    const fieldCount = Object.keys(fields).length;
    if (!hasCookie) warnings.push('目标站没有 cookie');
    if (!t.upload.path) warnings.push('目标站没有上传地址');
    if (!fieldCount) warnings.push('目标站上传字段为空');
    if (!t.verify.path) warnings.push('目标站没有回查地址');
    return { ok: true, data: {
      host: t.host, engine: t.engine, url: t.base + t.upload.path, method: 'POST',
      fileField: t.upload.fileField, fields: fields,
      tags: tags, tagFields: tagFields, labels: labels,
      autoActions: (function () {
        const f = flowConfig.read(ctx);
        return [
          flowConfig.on(f, '上传前清洗 tracker', true)
            ? '上传前把 tracker 换成目标站通用 announce（源站 tracker 不保留）'
            : '不清洗 tracker：按源种直传，目标站可能拒',
          flowConfig.on(f, '发布后抓权威种子', true)
            ? '发布后自动抓目标站权威种子落盘'
            : '发布后不抓权威种子',
          flowConfig.on(f, '辅种跳过校验', true)
            ? '辅种时 qB skip_checking，复用源种保存路径'
            : '辅种时会完整校验'
        ];
      })(),
      anonymous: !!item.anonymous,
      verifyUrl: t.base + expand(t.verify.path || '', uv),
      hasCookie: hasCookie, ready: !!(hasCookie && t.upload.path && fieldCount),
      warnings: warnings, notes: notes
    } };
  }

  return { plan: plan };
}

module.exports = { makePlan };

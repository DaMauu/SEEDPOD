/* 目标站提交与回查：引擎是代码，站点是数据。
   表单映射优先读 data/site-pack.json 的 upload，其次 data/site-defs/<host>.json 的 uploadMap；
   没有映射就停下，不猜。真提交必须显式打开 realPublish。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const form = require('./form');
const adapters = require('./adapters');
const sitePack = require('./site-pack');
const siteMaps = require('./site-maps');
const meta = require('./meta');
const { makeQb } = require('./qb');
const torrentClean = require('./torrent-clean');
const match = require('./match');
const targetDefaults = require('./target-defaults');
const flowConfig = require('./flow-config');
const { makeRequestQueue } = require('./request-queue');

const ENGINES = {
  nexusphp: {
    uploadPath: '/takeupload.php',
    formPath: '/upload.php',
    fileField: 'file',
    verifyPath: '/torrents.php?search={title}',
    fields: {
      name: '{title}', small_descr: '{subtitle}', descr: '{description}', type: '{catId}',
      source_sel: '{source}', codec_sel: '{codec}', standard_sel: '{resolution}',
      audiocodec_sel: '{audio}', team_sel: '{team}', uplver: '{anonymousYes}'
    }
  },
  unit3d: {
    uploadPath: '/torrents/create',
    formPath: '/torrents/create',
    fileField: 'torrent',
    verifyPath: '/torrents?search={title}',
    fields: {
      name: '{title}', description: '{description}', category_id: '{catId}',
      type_id: '{typeId}', resolution_id: '{resolutionId}', anonymous: '{anonymous}'
    }
  },
  gazelle: {
    uploadPath: '/upload.php',
    formPath: '/upload.php',
    fileField: 'file_input',
    verifyPath: '/torrents.php?searchstr={title}',
    fields: {
      title: '{title}', group_description: '{description}', release_desc: '{description}',
      category: '{catId}', media: '{source}', format: '{codec}', bitrate: '{bitrate}',
      release_type: '{releaseType}'
    }
  }
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function safeHost(host) { return /^[a-z0-9][a-z0-9.-]*$/i.test(String(host || '')); }
function catMapOf(p, def, built) {
  const out = {};
  const b = built && built.catMap;
  if (b && !Array.isArray(b) && typeof b === 'object') Object.assign(out, b);
  const raw = (p && p.catMap) || (def && def.catMap);
  if (Array.isArray(raw)) {
    raw.forEach(function (x) {
      if (x && x.id != null && x.purpose) out[x.purpose] = String(x.id);
    });
  } else if (raw && typeof raw === 'object') {
    Object.assign(out, raw);
  }
  return out;
}

function makeTarget(ctx) {
  const { DATA_DIR, one, db } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const qb = makeQb(DATA_DIR);
  const packPath = path.join(DATA_DIR, 'site-pack.json');
  const defDir = path.join(DATA_DIR, 'site-defs');

  function readPack() {
    const p = readJson(packPath);
    return p && p.sites && typeof p.sites === 'object' ? p : { version: 1, sites: {} };
  }
  function readDef(host) { return readJson(path.join(defDir, host + '.json')); }

  function cookieOf(host) {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', host);
    if (!r || !r.cookie) return { err: '这个站还没有 cookie，先在站点页导入' };
    try { return { cookie: secretbox.decrypt(r.cookie, KEYRING.key) }; }
    catch (e) { return { err: 'cookie 解不开，请重新导入' }; }
  }

  function resolve(host) {
    if (!safeHost(host)) return null;
    const pack = readPack();
    const p = (pack.sites || {})[host] || {};
    const def = readDef(host) || {};
    const built = sitePack.siteOf(host) || {};
    const engine = String(p.engine || def.engine || built.engine || '').toLowerCase();
    const base = String(p.base || def.base || built.base || '').replace(/\/+$/, '');
    const e = ENGINES[engine];
    if (!engine || !base || !e) return null;
    const pm = p.upload || def.uploadMap || built.upload || {};
    const upload = {
      path: String(pm.path || e.uploadPath),
      formPath: String(pm.formPath || e.formPath || pm.path || e.uploadPath),
      fileField: String(pm.fileField || e.fileField),
      fields: Object.assign({}, e.fields, (built.upload && built.upload.fields) || {}, pm.fields || {})
    };
    const verify = Object.assign({ path: e.verifyPath }, built.verify || {}, p.verify || def.verify || {});
    const maps = siteMaps.getHost(DATA_DIR, host);
    const valueMaps = Object.assign({}, (built.valueMaps || {}), (p.valueMaps || def.valueMaps || {}));
    valueMaps.team = Object.assign({}, valueMaps.team || {}, maps.team);
    return { host: host, engine: engine, base: base, upload: upload, verify: verify,
      catMap: Object.assign({}, catMapOf(p, def, built), maps.cat),
      tagMap: Object.assign({}, built.tagMap || {}, (p.tagMap || def.tagMap || {})),
      tagValue: String(p.tagValue || def.tagValue || built.tagValue || 'yes'),
      form: maps.form || null,
      valueMaps: valueMaps };
  }

  /* 目标站请求队列：所有站共用一个队列，一次只发一个请求，默认间隔 8 秒（±20% 抖动）。
     查重、详情、上传、回查、权威种、删除都走这里，不设次数上限。 */
  const requestQueue = makeRequestQueue(ctx);
  async function throttle(host) {
    if (!host) return { ok: false, code: 'NO_HOST', message: '没有目标站', http: 400 };
    await requestQueue.wait();
    return { ok: true };
  }

  function list() {
    const pack = readPack();
    const hosts = new Set(Object.keys(pack.sites || {}));
    try {
      fs.readdirSync(defDir).forEach(function (f) {
        if (/\.json$/.test(f)) hosts.add(f.replace(/\.json$/, ''));
      });
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    const bundled = sitePack.load();
    if (bundled.ok) Object.keys(bundled.pack.sites || {}).forEach(function (h) { hosts.add(h); });
    const out = [];
    hosts.forEach(function (host) {
      const t = resolve(host);
      if (!t) return;
      const c = one('SELECT cookie FROM credentials WHERE host = ?', host);
      const hasCookie = !!(c && c.cookie);
      const srow = one('SELECT data FROM sites WHERE host = ?', host);
      let sd = null;
      if (srow) { try { sd = JSON.parse(srow.data) || {}; } catch (e) { sd = {}; } }
      out.push({ host: host, engine: t.engine, base: t.base, hasCookie: hasCookie,
        enabled: !sd || sd.enabled !== false,
        ready: !!(hasCookie && t.upload.path && t.upload.fields && Object.keys(t.upload.fields).length),
        uploadPath: t.upload.path, verifyPath: t.verify.path });
    });
    return out.sort(function (a, b) { return a.host.localeCompare(b.host); });
  }

  /* 来源站标签：优先用条目里的 tags；没有就从标题推（国配/粤语/中字/DIY 这类）。
     禁转/限转只表示来源站限制，不往目标站勾，避免把自己锁死。 */
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

  /* 副标题：只用源副标题或中文名，不拼分辨率和体积 */
  function composeSubtitle(item) {
    return String(item && (item.subtitle || item.cn) || '').trim().slice(0, 200);
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
  function expand(s, v) {
    return String(s == null ? '' : s).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
      return v[k] != null ? String(v[k]) : '';
    }).slice(0, 20000);
  }

  function plan(host, item) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包，提交不了', http: 400 };
    const v = vars(item);
    if (!v.catId) {
      /* 分类映射以中文为准：movie → 电影 → 本站 401；也允许直接写中文分类 */
      const ALIAS = {
        movie: ['电影'], tv: ['剧集', '电视剧'], anime: ['动漫', '动画'], show: ['综艺'],
        doc: ['纪录', '纪录片'], music: ['音乐', 'MV', '音乐短片', '舞台演出'],
        sport: ['体育'], book: ['电子书', '书'], software: ['软件'], study: ['学习'],
        game: ['游戏'], other: ['其他', '其它']
      };
      const raw = String(item.cat || '').trim();
      const keys = [raw].concat(ALIAS[raw.toLowerCase()] || []);
      let mapped = null;
      for (const k of keys) { if (k && t.catMap[k] != null) { mapped = t.catMap[k]; break; } }
      if (mapped != null) v.catId = String(mapped);
      else if (/^\d+$/.test(raw)) v.catId = raw;
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
    /* 制作组：只认数字 id 或站点映射，组名直接塞下拉会填错 */
    const teamRaw = String(v.team || '').trim();
    const teamMap = (t.valueMaps && t.valueMaps.team) || {};
    if (teamRaw) {
      if (/^\d+$/.test(teamRaw)) fields.team_sel = teamRaw;
      else if (teamMap[teamRaw] != null) fields.team_sel = String(teamMap[teamRaw]);
      else { delete fields.team_sel; warnings.push('制作组 ' + teamRaw + ' 没映射到站点 id，已留空'); }
    }
    if (!v.catId) warnings.push('分类没映射，type 留空');
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
        warnings.push('必填字段 ' + k + ' 按源信息选 ' + auto);
        return;
      }
      if (defaults[k] != null && defaults[k] !== '') {
        fields[k] = String(defaults[k]);
        warnings.push('必填字段 ' + k + ' 用默认值 ' + defaults[k]);
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
      warnings.push('字段 ' + k + ' 的值不在站点选项里，已留空');
      delete fields[k];
    });
    const uv = Object.assign({}, v, { title: encodeURIComponent(v.title) });
    const c = one('SELECT cookie FROM credentials WHERE host = ?', t.host);
    const hasCookie = !!(c && c.cookie);
    const fieldCount = Object.keys(fields).length;
    if (!hasCookie) warnings.push('没有 cookie');
    if (!t.upload.path) warnings.push('没有上传地址');
    if (!fieldCount) warnings.push('上传字段为空');
    if (!t.verify.path) warnings.push('没有回查地址');
    return { ok: true, data: {
      host: t.host, engine: t.engine, url: t.base + t.upload.path, method: 'POST',
      fileField: t.upload.fileField, fields: fields,
      tags: tags, tagFields: tagFields,
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
      warnings: warnings
    } };
  }

  function torrentMeta(buf) { return qb.parseTorrent(buf); }

  async function fetchSourceTorrent(item) {
    const gate = await throttle(item && item.site);
    if (!gate.ok) return { err: gate.message || gate.code || '来源站请求受限' };
    /* 列表页给的下载地址常是 download.php?id=…，按来源站 base 补成绝对地址 */
    let dlUrl = String(item.downloadUrl || '');
    if (dlUrl && !/^https?:\/\//i.test(dlUrl)) {
      const def = resolve(item.site);
      if (def && def.base) {
        try { dlUrl = new URL(dlUrl, def.base + '/').toString(); } catch (e) { /* 留原样 */ }
      }
    }
    if (!/^https?:\/\//i.test(dlUrl)) return { err: '条目没有下载地址' };
    /* 来源站停用就不抓，避免对停用站发真实请求 */
    if (item.site) {
      const row = one('SELECT data FROM sites WHERE host = ?', String(item.site).toLowerCase());
      let sd = null;
      if (row) { try { sd = JSON.parse(row.data) || {}; } catch (e) { sd = {}; } }
      if (sd && sd.enabled === false) return { err: '来源站已停用：' + item.site };
    }
    const c = cookieOf(item.site);
    if (c.err) return { err: '来源站没有 cookie，取不到种子' };
    let res;
    try {
      res = await fetch(dlUrl, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { err: '下载种子失败：' + String(e && e.message || e).slice(0, 120) };
    }
    if (res.status !== 200) return { err: '下载种子返回 ' + res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { err: '种子是空文件' };
    if (buf.length > 10 * 1024 * 1024) return { err: '种子超过 10MB' };
    if (buf[0] !== 0x64) return { err: '下载到的是网页，不是种子' };
    return { buf: buf };
  }

  function detailsFrom(text, base) {
    const m = /(?:href|location)["']?\s*[:=]\s*["']([^"']*(?:details\.php\?id=\d+|\/torrents?\/\d+)[^"']*)["']/i.exec(text) ||
      /(details\.php\?id=\d+|\/torrents?\/\d+)/i.exec(text);
    if (!m) return '';
    const u = m[1];
    if (/^https?:\/\//i.test(u)) return u;
    try { return new URL(u, base + '/').toString(); } catch (e) { return ''; }
  }

  async function submit(host, item, buf, opts) {

    const gate = await throttle(host);
    if (!gate.ok) return gate;
    const p = opts && opts.plan ? { ok: true, data: opts.plan } : plan(host, item);
    if (!p.ok) return p;
    const meta = torrentMeta(buf);
    if (!meta.hash) return { ok: false, code: 'BAD_TORRENT', message: '种子解析不出 infohash', http: 400 };
    if (opts && opts.dryRun !== false) {
      return { ok: true, data: Object.assign({}, p.data, { dryRun: true, sent: false, torrent: meta }) };
    }
    if (!ctx.allowReal('realPublish')) {
      return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true 再试', http: 409 };
    }
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };

    const form = new FormData();
    Object.keys(p.data.fields).forEach(function (k) { form.append(k, p.data.fields[k]); });
    form.append(p.data.fileField, new Blob([buf], { type: 'application/x-bittorrent' }), String(item.title || 'upload').slice(0, 60) + '.torrent');

    let res;
    try {
      res = await fetch(p.data.url, {
        method: 'POST',
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        body: form, redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上：' + String(e && e.message || e).slice(0, 120), http: 502 };
    }
    const text = await res.text().catch(function () { return ''; });
    const location = res.headers.get('location') || '';
    const origin = (function () { try { return new URL(p.data.url).origin; } catch (e) { return p.data.url; } })();
    const successText = /上传成功|发布成功|种子已|success|torrent.{0,20}(uploaded|created)/i.test(text);
    const whereRaw = location || (successText ? detailsFrom(text, origin) : '') || '';
    const where = /^https?:\/\//i.test(whereRaw) ? whereRaw
      : (function () { try { return new URL(whereRaw, origin + '/').toString(); } catch (e) { return ''; } })();
    const loginHit = /takelogin\.php|name=["']?username|请先登录|not\s+authorized|login/i.test(text) && !/logout|上传成功|success/i.test(text);
    if (res.status >= 400 || loginHit) {
      return { ok: false, code: loginHit ? 'LOGIN_REQUIRED' : 'UPLOAD_REJECTED',
        message: loginHit ? '目标站要重新登录，cookie 可能失效'
          : ('目标站返回 ' + res.status + (text ? '：' + text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '')),
        http: 502, data: { status: res.status } };
    }
    const uncertain = !where && !successText;
    const hintText = textOf(text);
    const hi = hintText.search(/上传失败|上传成功|发布成功|错误|Error/i);
    const responseHint = (hi >= 0 ? hintText.slice(hi) : hintText).slice(0, 300);
    return { ok: true, data: {
      dryRun: false, sent: true, status: res.status, url: p.data.url, detailsUrl: where,
      infohash: meta.hash, torrent: meta, fields: Object.keys(p.data.fields), uncertain: uncertain,
      responseHint: responseHint,
      message: uncertain ? '提交返回 200，但没拿到详情页/成功提示，需人工确认' : '已提交到目标站'
    } };
  }

  async function verify(host, item, buf, opts) {

    const gate = await throttle(host);
    if (!gate.ok) return gate;
    const p = plan(host, item);
    if (!p.ok) return p;
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const meta = buf ? torrentMeta(buf) : { hash: '', name: '' };
    const url = (opts && opts.url) || p.data.verifyUrl;
    let res;
    try {
      res = await fetch(url, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow', signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上', http: 502 };
    }
    const text = await res.text().catch(function () { return ''; });
    const norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    const title = norm(item.title);
    const hash = String((opts && opts.hash) || meta.hash || '').toLowerCase();
    const isDetails = /details\.php\?id=\d+|\/torrents?\/\d+/i.test(url);
    let found = false;
    let matchedTitle = '';
    let matchedUrl = '';
    let rows = 0;
    if (res.status === 200 && isDetails) {
      found = !!(title && norm(text).indexOf(title) >= 0) || !!(hash && text.toLowerCase().indexOf(hash) >= 0);
      if (found) matchedUrl = url;
    } else if (res.status === 200) {
      const list = adapters.parseList(text, p.data.engine);
      rows = list.length;
      const hit = list.filter(function (r) {
        const d = norm(r.detailsUrl + ' ' + r.downloadUrl);
        if (hash && d.indexOf(hash) >= 0) return true;
        if (title && norm(r.title).indexOf(title) >= 0) return true;
        try {
          const cmp = match.compare(item, { title: r.title, size: r.size || '', res: r.res || '', year: r.year || 0, infohash: r.infohash || '' });
          return cmp.same && cmp.score >= 50;
        } catch (e) { return false; }
      })[0];
      found = !!hit;
      matchedTitle = hit ? String(hit.title || '').slice(0, 200) : '';
      matchedUrl = hit && hit.detailsUrl ? String(hit.detailsUrl) : '';
    }
    return { ok: true, data: {
      found: found, url: url, status: res.status, title: found ? (matchedTitle || item.title) : '', detailsUrl: matchedUrl,
      infohash: meta.hash, rows: rows, mode: isDetails ? 'details' : 'search',
      message: found ? '目标站列表里找到这个种子' : '目标站列表里没找到这个种子'
    } };
  }

  /* 手动识别目标站上传页：只发一次 GET，不提交、不重试；必须已有 cookie。 */
  function attrsOf(tag) {
    const out = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m;
    while ((m = re.exec(String(tag || '')))) out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
    return out;
  }
  function textOf(html) {
    return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }
  function parseDeleteForm(html) {
    const forms = [];
    const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let m;
    while ((m = re.exec(String(html || '')))) forms.push({ attrs: attrsOf(m[1]), body: m[2] });
    const f = forms.filter(function (x) { return /delete\.php/i.test(String(x.attrs.action || '')) || /reason/i.test(x.body); })[0];
    if (!f) return null;
    const hidden = {}, submit = [], radios = [], reasonFields = [];
    let current = null;
    const tagRe = /<(input|textarea)\b([^>]*)>/gi;
    let tm;
    while ((tm = tagRe.exec(f.body))) {
      const tag = String(tm[1] || '').toLowerCase();
      const a = attrsOf(tm[2]);
      if (!a.name) continue;
      const type = String(a.type || 'text').toLowerCase();
      if (tag === 'input' && type === 'hidden') hidden[a.name] = a.value || '';
      if (tag === 'input' && type === 'submit') submit.push({ name: a.name, value: a.value || '' });
      if (tag === 'input' && type === 'radio' && /^reason_?type$/i.test(a.name)) {
        current = { name: a.name, value: String(a.value || ''), index: tm.index, reasonFields: [], reasonIdx: [] };
        radios.push(current);
      } else if ((tag === 'textarea' && /reason/i.test(a.name)) || (tag === 'input' && (type === 'text' || type === '') && /^reason/i.test(a.name))) {
        const ri = reasonFields.length;
        reasonFields.push(a.name);
        if (current) { current.reasonFields.push(a.name); current.reasonIdx.push(ri); }
      }
    }
    radios.forEach(function (r, i) {
      const end = i + 1 < radios.length ? radios[i + 1].index : f.body.length;
      r.label = textOf(f.body.slice(r.index, end)).slice(0, 120);
    });
    return {
      action: f.attrs.action || 'delete.php', hidden: hidden, submit: submit,
      radioName: radios.length ? radios[0].name : '', radios: radios,
      reasonFields: reasonFields, reasonField: reasonFields[0] || ''
    };
  }
  async function checkDeletedOnSite(t, id, headers) {
    let deleted = false, checkStatus = 0, hint = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chk = await fetch(t.base + '/details.php?id=' + encodeURIComponent(id), { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
        checkStatus = chk.status;
        const text = await chk.text().catch(function () { return ''; });
        hint = textOf(text).slice(0, 200);
        deleted = chk.status === 404 || /该种子曾被[\s\S]{0,120}删除|种子已被删除|该种子已删除|无效的种子|种子不存在|没有该ID的种子|not\s+found|没有找到/i.test(text);
      } catch (e) { checkStatus = 0; }
      if (deleted || attempt === 1) break;
      await new Promise(function (r) { setTimeout(r, 1200); });
    }
    return { deleted: deleted, checkStatus: checkStatus, hint: hint };
  }
  async function deleteTorrent(host, spec, opts) {

    const gate = await throttle(host);
    if (!gate.ok) return gate;
    const o = opts || {};
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const raw = String((spec && (spec.id || spec.url)) || spec || '').trim();
    let id = /^\d+$/.test(raw) ? raw : '';
    if (!id) {
      const mm = /(?:details\.php\?id=|\/torrents?\/)(\d+)/i.exec(raw);
      if (mm) id = mm[1];
    }
    if (!id) return { ok: false, code: 'BAD_TORRENT_ID', message: '需要种子 id 或 details.php?id=... 详情链接', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (o.check) {
      const chkRes = await checkDeletedOnSite(t, id, headers);
      return { ok: true, data: Object.assign({ dryRun: true, check: true, sent: false, id: id, reason: String(o.reason || '测试').slice(0, 500), reasonType: String(o.reasonType || '其他') }, chkRes) };
    }
    let edit;
    try {
      edit = await fetch(t.base + '/edit.php?id=' + encodeURIComponent(id), { headers: headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    } catch (e) {
      return { ok: false, code: 'TARGET_UNREACHABLE', message: '目标站连不上', http: 502 };
    }
    if (edit.status >= 300 && edit.status < 400) return { ok: false, code: 'LOGIN_REQUIRED', message: '编辑页跳转了，cookie 可能已失效', http: 401 };
    if (edit.status !== 200) return { ok: false, code: 'HTTP_' + edit.status, message: '编辑页返回 ' + edit.status, http: 502 };
    const html = await edit.text().catch(function () { return ''; });
    const form = parseDeleteForm(html);
    if (!form) return { ok: false, code: 'NO_DELETE_FORM', message: '编辑页没找到删除表单', http: 422 };
    const wantLabel = String(o.reasonType || '其他');
    let radio = form.radios.filter(function (r) { return r.label.indexOf(wantLabel) >= 0 || (wantLabel === '其他' && /其他|other/i.test(r.label)); })[0] || null;
    if (!radio && /^\d+$/.test(wantLabel)) radio = form.radios.filter(function (r) { return r.value === wantLabel; })[0] || null;
    const reason = String(o.reason || '测试').slice(0, 500);
    if (!form.reasonField && !radio) return { ok: false, code: 'NO_DELETE_REASON', message: '删除表单没有原因字段，先人工确认', http: 422 };
    const plan = {
      id: id, action: form.action, reasonType: radio ? radio.value : '', reasonTypeLabel: radio ? radio.label.replace(/\s+/g, ' ').slice(0, 40) : '',
      reasonField: form.reasonField, reason: reason, fields: Object.keys(form.hidden)
    };
    if (o.dryRun !== false) return { ok: true, data: Object.assign({ dryRun: true, sent: false }, plan) };
    if (!ctx.allowReal('realPublish')) return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true 再试', http: 409 };
    const body = new URLSearchParams();
    Object.keys(form.hidden).forEach(function (k) { body.set(k, form.hidden[k]); });
    if (radio) body.set(form.radioName, radio.value);
    const selectedIdx = radio && radio.reasonIdx && radio.reasonIdx.length ? radio.reasonIdx : [0];
    form.reasonFields.forEach(function (n, i) { body.append(n, selectedIdx.indexOf(i) >= 0 ? reason : ''); });
    form.submit.forEach(function (b) { if (b.name) body.set(b.name, b.value); });
    let res;
    try {
      res = await fetch(new URL(form.action, t.base + '/').toString(), {
        method: 'POST', headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded' }, headers),
        body: body.toString(), redirect: 'manual', signal: AbortSignal.timeout(30000)
      });
    } catch (e) {
      return { ok: false, code: 'DELETE_UNREACHABLE', message: '删除请求发不出去', http: 502 };
    }
    if (res.status >= 400) return { ok: false, code: 'DELETE_REJECTED', message: '删除请求返回 ' + res.status, http: 502 };
    const chkRes = await checkDeletedOnSite(t, id, headers);
    const deleted = chkRes.deleted;
    const data = Object.assign({ dryRun: false, sent: true, status: res.status, location: !!res.headers.get('location'), deleted: deleted, checkStatus: chkRes.checkStatus }, plan);
    if (!deleted) return { ok: false, code: 'DELETE_UNCONFIRMED', message: '删除请求已提交，但详情页仍能打开，请人工确认', http: 502, data: data };
    return { ok: true, data: data };
  }

  function downloadLinksFromDetails(text, base) {
    const safe = String(text || '').replace(/&amp;/g, '&');
    const raw = [];
    const patterns = [
      /(?:href|src)=["']([^"']*(?:download\.php\?[^"']*?\bid=\d+|torrents?\.php\?action=download[^"']*|torrents?\/download\/\d+|\/download\/\d+)[^"']*)["']/gi,
      /(download\.php\?[^"'\s<>]*?\bid=\d+[^"'\s<>]*)/gi
    ];
    patterns.forEach(function (re) {
      let m;
      while ((m = re.exec(safe))) if (m[1]) raw.push(m[1]);
    });
    const seen = {};
    const out = [];
    raw.forEach(function (x) {
      try {
        const u = new URL(x, base + '/');
        if (!/^https?:$/i.test(u.protocol)) return;
        const key = u.toString();
        if (seen[key]) return;
        seen[key] = true;
        out.push(key);
      } catch (e) {}
    });
    return out;
  }
  async function discoverAnnounce(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost) return { ok: false, code: 'BAD_BASE', message: '站点 base 不合法', http: 400 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    const pages = ['/usercp.php', '/usercp.php?action=personal'];
    let uid = '';
    try {
      const idx = await fetch(t.base + '/index.php', { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const html = await idx.text().catch(function () { return ''; });
      const m = /userdetails\.php\?id=(\d+)/i.exec(html);
      if (m) uid = m[1];
    } catch (e) {}
    if (uid) pages.push('/userdetails.php?id=' + uid);
    for (const path of pages) {
      let res;
      try { res = await fetch(t.base + path, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(15000) }); }
      catch (e) { continue; }
      if (res.status !== 200) continue;
      const html = await res.text().catch(function () { return ''; });
      if (/takelogin\.php|login\.php|请先登录/i.test(html)) continue;
      const safe = html.replace(/&amp;/g, '&');
      const m = /(https?:\/\/[^\s"'<>]+\/announce\.php\?[^\s"'<>]*passkey=[A-Za-z0-9]+|announce\.php\?[^\s"'<>]*passkey=[A-Za-z0-9]+)/i.exec(safe);
      if (m) {
        const raw = m[1];
        try {
          const u = new URL(raw, t.base + '/');
          if (u.hostname.toLowerCase() !== baseHost && !u.hostname.toLowerCase().endsWith('.' + baseHost)) continue;
          return { ok: true, data: { announce: u.toString(), source: path } };
        } catch (e) {}
      }
      const pk = /passkey=([A-Za-z0-9]{16,64})/i.exec(safe);
      if (pk) return { ok: true, data: { announce: t.base + '/announce.php?passkey=' + pk[1], source: path } };
    }
    return { ok: false, code: 'NO_ANNOUNCE', message: '没找到目标站 announce/passkey；可用 --announce 显式指定', http: 409 };
  }

  function candidateKind(url) {
    return /[?&]passkey=/i.test(String(url || '')) ? 'passkey' : 'generic';
  }
  function cachedTargetCandidates(host) {
    const dir = path.join(DATA_DIR, 'torrents');
    let files;
    try { files = fs.readdirSync(dir); } catch (e) { return []; }
    const prefix = String(host).replace(/[^a-z0-9.-]/gi, '_') + '-';
    const out = [];
    files.filter(function (f) { return f.indexOf(prefix) === 0 && /\.torrent$/i.test(f); })
      .map(function (f) { try { return { f: f, m: fs.statSync(path.join(dir, f)).mtimeMs }; } catch (e) { return null; } })
      .filter(Boolean).sort(function (a, b) { return b.m - a.m; })
      .forEach(function (x) {
        try {
          const a = torrentClean.announceOf(fs.readFileSync(path.join(dir, x.f)));
          if (a) out.push({ source: 'cached-target-torrent', kind: candidateKind(a), hasPasskey: candidateKind(a) === 'passkey', announce: a });
        } catch (e) {}
      });
    return out;
  }
  function uploadPageCandidates(html, base) {
    const safe = String(html || '').replace(/&amp;/g, '&');
    const raw = [];
    const patterns = [
      /(?:href|src)=["']([^"']*announce[^"']*)["']/gi,
      /(https?:\/\/[^\s"'<>]+\/announce[^\s"'<>]*)/gi,
      /(announce\.php\?[^\s"'<>]*)/gi
    ];
    patterns.forEach(function (re) {
      let m;
      while ((m = re.exec(safe))) if (m[1]) raw.push(m[1]);
    });
    const seen = {};
    const out = [];
    raw.forEach(function (x) {
      try {
        const u = new URL(x, base + '/');
        if (!/^https?:$/i.test(u.protocol)) return;
        const key = u.toString();
        if (seen[key]) return;
        seen[key] = true;
        out.push({ source: 'upload-page', kind: candidateKind(key), hasPasskey: candidateKind(key) === 'passkey', announce: key });
      } catch (e) {}
    });
    return out;
  }

  async function announceCandidates(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    const all = cachedTargetCandidates(host);
    const formPath = t.upload.formPath || t.upload.path;
    try {
      const res = await fetch(t.base + formPath, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (res.status === 200) {
        const html = await res.text().catch(function () { return ''; });
        if (!/takelogin\.php|login\.php|请先登录/i.test(html)) {
          uploadPageCandidates(html, t.base).forEach(function (x) {
            if (!all.some(function (y) { return y.announce === x.announce; })) all.push(x);
          });
        }
      }
    } catch (e) {}
    const u = await discoverAnnounce(host);
    if (u.ok) {
      const kind = candidateKind(u.data.announce);
      if (!all.some(function (y) { return y.announce === u.data.announce; })) {
        all.push({ source: 'usercp', kind: kind, hasPasskey: kind === 'passkey', announce: u.data.announce });
      }
    }
    if (!all.length) return { ok: false, code: 'NO_ANNOUNCE', message: '没找到目标站 announce/passkey；可用 --announce 显式指定', http: 409 };
    return { ok: true, data: { host: host, baseHost: baseHost, candidates: all } };
  }

  /* 读目标站详情页的媒介/副标题/简介/标签，用于查重时判断原盘/DIY/限转 */
  async function fetchDetailsInfo(host, detailsUrl) {

    const gate = await throttle(host);
    if (!gate.ok) return gate;
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有站点定义' };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err };
    let pageUrl;
    try { pageUrl = new URL(detailsUrl, t.base + '/').toString(); } catch (e) { return { ok: false, code: 'BAD_DETAILS_URL', message: '详情地址不合法' }; }
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const pageHost = (function () { try { return new URL(pageUrl).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost || (pageHost !== baseHost && !pageHost.endsWith('.' + baseHost))) return { ok: false, code: 'BAD_DETAILS_HOST', message: '详情页域名不一致' };
    let page;
    try { page = await fetch(pageUrl, { headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
    catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上' }; }
    if (page.status !== 200) return { ok: false, code: 'DETAILS_HTTP_' + page.status, message: '详情页返回 ' + page.status };
    const html = await page.text().catch(function () { return ''; });
    const d = adapters.parseDetail(html);
    return { ok: true, data: {
      url: pageUrl, subtitle: d.subtitle || '', descr: d.descr || '', descrBb: d.descrBb || '',
      tags: d.tags || '', medium: d.medium || '', category: d.category || '',
      region: d.region || '', language: d.language || '', poster: d.poster || '',
      sizeText: d.sizeText || '', sizeBytes: d.sizeBytes || 0, pageTitle: d.pageTitle || ''
    } };
  }

  async function fetchDetailsTorrent(host, detailsUrl) {

    const gate = await throttle(host);
    if (!gate.ok) return gate;
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有引擎或私有站点包', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 409 };
    let pageUrl;
    try { pageUrl = new URL(detailsUrl, t.base + '/').toString(); } catch (e) { return { ok: false, code: 'BAD_DETAILS_URL', message: '详情地址不合法', http: 400 }; }
    const baseHost = (function () { try { return new URL(t.base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    const pageHost = (function () { try { return new URL(pageUrl).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!baseHost || (pageHost !== baseHost && !pageHost.endsWith('.' + baseHost))) return { ok: false, code: 'BAD_DETAILS_HOST', message: '详情页域名和站点不一致，为免 cookie 外泄先停下', http: 400 };
    const headers = { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    let page;
    try { page = await fetch(pageUrl, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
    catch (e) { return { ok: false, code: 'DETAILS_UNREACHABLE', message: '详情页连不上', http: 502 }; }
    if (page.status !== 200) return { ok: false, code: 'DETAILS_HTTP_' + page.status, message: '详情页返回 ' + page.status, http: 502 };
    const html = await page.text().catch(function () { return ''; });
    if (/takelogin\.php|login\.php|请先登录/i.test(html)) return { ok: false, code: 'LOGIN_REQUIRED', message: '详情页要重新登录，cookie 可能失效', http: 401 };
    const links = downloadLinksFromDetails(html, t.base);
    if (!links.length) return { ok: false, code: 'NO_DOWNLOAD_LINK', message: '详情页没找到下载种子链接', http: 422 };
    /* 详情页一个间隔，下载种子再一个间隔 */
    const gate2 = await throttle(host);
    if (!gate2.ok) return gate2;
    let last = '';
    for (const link of links.slice(0, 8)) {
      const dlHost = (function () { try { return new URL(link).hostname.toLowerCase(); } catch (e) { return ''; } })();
      if (dlHost !== baseHost && !dlHost.endsWith('.' + baseHost)) { last = 'BAD_DOWNLOAD_HOST'; continue; }
      let res;
      try { res = await fetch(link, { headers: headers, redirect: 'follow', signal: AbortSignal.timeout(30000) }); }
      catch (e) { last = 'DOWNLOAD_UNREACHABLE'; continue; }
      if (res.status !== 200) { last = 'DOWNLOAD_HTTP_' + res.status; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 10 * 1024 * 1024) { last = buf.length ? 'TORRENT_TOO_LARGE' : 'EMPTY_TORRENT'; continue; }
      if (buf[0] !== 0x64) { last = 'NOT_TORRENT'; continue; }
      const meta = torrentMeta(buf);
      if (!meta.hash) { last = 'BAD_TORRENT'; continue; }
      return { ok: true, data: { buf: buf, meta: meta, downloadUrl: link, pageUrl: pageUrl } };
    }
    return { ok: false, code: last || 'NO_TORRENT', message: '详情页下载链接里没有可用种子', http: 502 };
  }

  async function detectUploadForm(host) {
    const t = resolve(host);
    if (!t) return { ok: false, code: 'NO_TARGET_DEF', message: '这个站还没有上传页配置', http: 400 };
    const c = cookieOf(host);
    if (c.err) return { ok: false, code: 'NO_COOKIE', message: c.err, http: 400 };
    let baseHost = '';
    try { baseHost = new URL(t.base).hostname.toLowerCase(); } catch (e) { return { ok: false, code: 'BAD_BASE', message: '站点 base 不是合法地址', http: 400 }; }
    const wantHost = String(host || '').toLowerCase();
    if (baseHost !== wantHost && !baseHost.endsWith('.' + wantHost)) {
      return { ok: false, code: 'BAD_BASE', message: '上传页域名和站点域名不一致，为免 cookie 外泄先停下', http: 400 };
    }
    if (!/^https?:/i.test(t.base)) return { ok: false, code: 'BAD_BASE', message: '站点 base 必须是 http/https', http: 400 };
    const formPath = t.upload.formPath || t.upload.path;
    const url = t.base + formPath;
    let res;
    try {
      res = await fetch(url, {
        headers: { cookie: c.cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      return { ok: false, code: 'DETECT_FAILED', message: e && e.name === 'TimeoutError' ? '上传页请求超时' : '上传页请求失败', http: 502 };
    }
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, code: 'LOGIN_REQUIRED', message: '上传页跳转了，cookie 可能已失效', http: 401 };
    }
    if (res.status !== 200) return { ok: false, code: 'HTTP_' + res.status, message: '上传页返回 ' + res.status, http: 502 };
    const html = await res.text().catch(function () { return ''; });
    if (!html) return { ok: false, code: 'EMPTY_PAGE', message: '上传页是空的', http: 502 };
    if (html.length > 2 * 1024 * 1024) return { ok: false, code: 'TOO_LARGE', message: '上传页超过 2MB，先截取表单部分', http: 413 };
    if (/takelogin\.php|login\.php|请先登录|sign in/i.test(html)) {
      return { ok: false, code: 'LOGIN_REQUIRED', message: '上传页看起来是登录页，cookie 可能已失效', http: 401 };
    }
    const forms = form.parse(html);
    if (!forms.length) return { ok: false, code: 'NO_FORM', message: '没识别到上传表单，可以继续手工编辑字段表', http: 422 };
    const withFile = forms.filter(function (x) { return !!x.fileField; })
      .sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; });
    const f = withFile[0] || forms.slice().sort(function (a, b) { return (b.fields || []).length - (a.fields || []).length; })[0];
    return { ok: true, data: { url: url, path: t.upload.path, formPath: formPath, formCount: forms.length, fileField: f.fileField || '', fields: f.fields, forms: forms } };
  }

  return { list: list, resolve: resolve, plan: plan, submit: submit, verify: verify, detectUploadForm: detectUploadForm,
    deleteTorrent: deleteTorrent, fetchDetailsInfo: fetchDetailsInfo, discoverAnnounce: discoverAnnounce, announceCandidates: announceCandidates, fetchDetailsTorrent: fetchDetailsTorrent, fetchSourceTorrent: fetchSourceTorrent, torrentMeta: torrentMeta, cookieOf: cookieOf };
}

module.exports = { makeTarget, ENGINES };

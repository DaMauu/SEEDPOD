/* 目标站提交与回查：引擎是代码，站点是数据。
   表单映射优先读 data/site-pack.json 的 upload，其次 data/site-defs/<host>.json 的 uploadMap；
   没有映射就停下，不猜。真提交必须显式打开 realPublish。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const sitePack = require('./site-pack');
const siteMaps = require('./site-maps');
const { makeQb } = require('./qb');
const { makeDiscovery } = require('./target-discovery');
const { makePlan } = require('./target-plan');
const { makeSubmit } = require('./target-submit');
const { makeTargetPages } = require('./target-pages');
const { makeRequestQueue } = require('./request-queue');
const { catMapOf, composeSubtitle, expand, hideContent, stripHide, infoFieldKey, descrFieldKey,
  attrsOf, textOf, isDeletedPageText, parseDeleteForm, downloadLinksFromDetails } = require('./target-html');

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
    try { return { cookie: secretbox.decrypt(r.cookie, KEYRING) }; }
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

  const { discoverAnnounce, announceCandidates } = makeDiscovery({ resolve: resolve, cookieOf: cookieOf, dataDir: DATA_DIR });
  const { plan } = makePlan({ resolve: resolve, ctx: ctx, one: one });
  const { torrentMeta, deleteTorrent, fetchDetailsInfo, fetchDetailsTorrent, detectUploadForm } = makeTargetPages({ resolve: resolve, cookieOf: cookieOf, throttle: throttle, ctx: ctx, qb: qb });
  const { submit, verify, fetchSourceTorrent } = makeSubmit({ throttle: throttle, resolve: resolve, plan: plan, cookieOf: cookieOf, one: one, ctx: ctx, torrentMeta: torrentMeta, textOf: textOf, downloadLinksFromDetails: downloadLinksFromDetails, isDeletedPageText: isDeletedPageText });

  /* 目标站请求队列：所有站共用一个队列，一次只发一个请求，默认间隔 8 秒（±20% 抖动）。
     查重、详情、上传、回查、权威种、删除都走这里，不设次数上限。 */
  const requestQueue = makeRequestQueue(ctx);
  async function throttle(host, kind) {
    if (!host) return { ok: false, code: 'NO_HOST', message: '没有目标站', http: 400 };
    await requestQueue.wait(kind === 'search' ? 'search' : 'write');
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
  /* 副标题：只用源副标题或中文名，不拼分辨率和体积 */


  /* Unit3D 各站字段名不统一：bdinfo / bd_info / disc_info / video_info / media_info / mi_info
     都认；站点包直接把 {bdinfo}/{mediainfo} 塞进别的字段时，也按模板内容认。 */







  /* 手动识别目标站上传页：只发一次 GET，不提交、不重试；必须已有 cookie。 */




  /* 读目标站详情页的媒介/副标题/简介/标签，用于查重时判断原盘/DIY/限转 */



  return { list: list, resolve: resolve, plan: plan, submit: submit, verify: verify, detectUploadForm: detectUploadForm,
    deleteTorrent: deleteTorrent, fetchDetailsInfo: fetchDetailsInfo, discoverAnnounce: discoverAnnounce, announceCandidates: announceCandidates, fetchDetailsTorrent: fetchDetailsTorrent, fetchSourceTorrent: fetchSourceTorrent, torrentMeta: torrentMeta, cookieOf: cookieOf };
}

module.exports = { makeTarget, ENGINES };

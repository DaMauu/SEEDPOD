/* 目标站提交与回查：引擎是代码，站点是数据。
   表单映射优先读 data/site-pack.json 的 upload，其次 data/site-defs/<host>.json 的 uploadMap；
   没有映射就停下，不猜。真提交必须显式打开 realPublish。 */
const { makeQb } = require('./qb');
const { makeDiscovery } = require('./target-discovery');
const { makePlan } = require('./target-plan');
const { makeSubmit } = require('./target-submit');
const { makeTargetPages } = require('./target-pages');
const { makeRequestQueue } = require('./request-queue');
const urlGuard = require('./url-guard');
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
  const cookieStore = require('./src/features/sites/credentials')(DATA_DIR);
  const siteStore = require('./src/features/sites/store')(DATA_DIR);
  const qb = makeQb(DATA_DIR);

  function cookieOf(host) {
    const c = cookieStore.get(host);
    if (c.err === 'NO_COOKIE') return { err: '这个站还没有 cookie，先在站点页导入' };
    if (c.err) return { err: 'cookie 解不开，请重新导入' };
    return { cookie: c.cookie };
  }

  function resolveFrom(host, rec) {
    if (!rec) return null;
    const engine = String(rec.engine || '').toLowerCase();
    const base = String(rec.base || '').replace(/\/+$/, '');
    const e = ENGINES[engine];
    if (!engine || !base || !e) return null;
    const baseHost = (function () { try { return new URL(base).hostname.toLowerCase(); } catch (e) { return ''; } })();
    if (!urlGuard.isLocalHost(baseHost) && !urlGuard.baseOk(host, base)) return null;
    const pm = rec.upload || {};
    const upload = {
      path: String(pm.path || e.uploadPath),
      formPath: String(pm.formPath || e.formPath || pm.path || e.uploadPath),
      fileField: String(pm.fileField || e.fileField),
      fields: Object.assign({}, e.fields, pm.fields || {})
    };
    const verify = Object.assign({ path: e.verifyPath }, rec.verify || {});
    return { host: host, engine: engine, base: base, upload: upload, verify: verify,
      catMap: rec.catMap || {}, tagMap: rec.tagMap || {}, tagValue: String(rec.tagValue || 'yes'),
      form: rec.form || null, valueMaps: rec.valueMaps || {} };
  }
  function resolve(host) {
    if (!safeHost(host)) return null;
    return resolveFrom(host, siteStore.targetDef(host));
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
    const cookies = {};
    cookieStore.list().forEach(function (c) { cookies[c.host] = true; });
    return siteStore.list().map(function (rec) {
      const pub = rec.publish || {};
      const t = resolveFrom(rec.host, {
        engine: rec.engine, base: rec.url && rec.url.base,
        upload: pub.upload, verify: pub.verify,
        catMap: Object.assign({}, pub.catMap || {}),
        tagMap: pub.tagMap, tagValue: pub.tagValue,
        form: pub.form, valueMaps: pub.valueMaps
      });
      if (!t) return null;
      const hasCookie = !!cookies[rec.host];
      return { host: rec.host, engine: t.engine, base: t.base, hasCookie: hasCookie,
        enabled: rec.settings.enabled !== false,
        hidden: rec.settings.hidden === true,
        ready: !!(hasCookie && t.upload.path && t.upload.fields && Object.keys(t.upload.fields).length),
        uploadPath: t.upload.path, verifyPath: t.verify.path };
    }).filter(Boolean).sort(function (a, b) { return a.host.localeCompare(b.host); });
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

/* 图床管道：把队列里的 data URL 截图上传到配置的图床，返回可写进简介的链接。
   默认只演练；真上传由调用方显式 allowReal，并且只接受已验证的 custom/local 接口。
   Pixhost / Imgbox 暂只做计划，不拿未验证的接口去真传。 */
const { providerKey, defaultProvider, configFor, dataUrlOf } = require('./imagehost-config');
const { processShots, uploadOne, sleep, _ssoLogin, _webUpload } = require('./imagehost-upload');
const urlGuard = require('./src/infra/url-guard');
const { safeFetch } = require('./src/infra/safe-http');
const { isPrivateUrl, isBlacklisted, looksDirect, ogImageFromHtml, resolveImageSource, extractImages, isLikelyThumb, originalFromThumb, readMirrorCache, writeMirrorCache, isOurImageHost, escapeRe, replaceDescription } = require('./imagehost-source');

/* 源站 BBCode 里的远程图片：下载后转存图床，替换成图床链接。
   只处理 [img]http(s)://...[/img]；失败保留外链，不阻断发布。 */

/* 把图床页面解析成原图直链；失败返回空。直接图片原样返回。 */


/* 同一张源图只传一次：源 URL → 图床 URL 持久化到 meta，跨条目复用 */


async function mirrorDescriptionInner(description, opts) {
  const o = opts || {};
  const mode = String(o.mode || '转存到图床');
  const items = extractImages(description);
  if (!items.length) return { ok: true, code: 'NO_REMOTE_IMAGES', total: 0, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };
  if (mode !== '转存到图床') return { ok: true, code: 'IMAGE_MODE_KEEP', total: items.length, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };
  if (o.dryRun !== false) return { ok: true, code: 'IMAGE_DRY_RUN', dryRun: true, total: items.length, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };
  if (!o.allowReal) return { ok: false, code: 'REAL_IMAGES_DISABLED', total: items.length, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };
  const provider = providerKey(o.provider || '');
  const cfg = configFor(provider);
  if (!cfg.verified) return { ok: false, code: 'IMAGE_HOST_UNVERIFIED', total: items.length, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };
  if (!/^https?:\/\//i.test(cfg.endpoint)) return { ok: false, code: 'IMAGE_HOST_NOT_CONFIGURED', total: items.length, uploaded: 0, failed: 0, skipped: 0, removed: 0, description: String(description || '') };

  const cache = readMirrorCache();
  const map = Object.assign({}, cache, o.known || {});
  const cacheNew = {};
  const remove = new Set();
  const pageByImg = {};
  const wrapRe = /\[url=([^\]]+)\]\s*\[img([^\]]*)\]\s*(https?:\/\/[^\s\[\]]+)\s*\[\/img\]\s*\[\/url\]/gi;
  let wm;
  while ((wm = wrapRe.exec(String(description || '')))) pageByImg[wm[3].trim()] = wm[1].trim();
  let uploaded = 0, failed = 0, skipped = 0, lastError = '';
  for (let i = 0; i < items.length; i++) {
    const url = items[i].url;
    /* 缓存命中也是“没重传”，计入 skipped，保证 total = uploaded + failed + skipped */
    if (map[url]) { skipped++; continue; }
    if (isPrivateUrl(url, o.allowPrivate === true)) {
      failed++; lastError = '内网地址不抓';
      if (isBlacklisted(url)) remove.add(url);
      continue;
    }
    if (i > 0) await sleep(o.delayMs == null ? 800 : o.delayMs);
    let resolved = null;
    const page = pageByImg[url] || '';
    try {
      /* 有 [url=图床页面] 且图是缩略图/页面时，优先从页面拿原图 */
      if (page && (isLikelyThumb(url) || !looksDirect(url))) {
        resolved = await resolveImageSource(page, {
          allowPrivate: o.allowPrivate === true, timeoutMs: o.timeoutMs,
          referer: o.referer
        });
      }
      if (!resolved || !resolved.ok) {
        const target = (!looksDirect(url) && isLikelyThumb(url)) ? originalFromThumb(url) : url;
        resolved = await resolveImageSource(target, {
          allowPrivate: o.allowPrivate === true, timeoutMs: o.timeoutMs,
          referer: page || o.referer, headers: page ? { referer: page } : {}
        });
        if (resolved.ok && page) resolved.page = page;
      }
    } catch (e) { resolved = { err: String(e && e.message || e) }; }
    if (!resolved.ok) {
      failed++; lastError = resolved.err || '图床页面解析失败';
      if (isBlacklisted(url)) remove.add(url);
      continue;
    }
    const direct = resolved.direct;
    {
      const dg = await urlGuard.assertPublicHttp(direct, { allowPrivate: o.allowPrivate === true });
      if (!dg.ok) { failed++; lastError = dg.err; continue; }
    }
    if (isOurImageHost(direct)) {
      map[url] = direct;
      if (resolved.page) map[resolved.page] = direct;
      if (page) map[page] = direct;
      cacheNew[url] = direct;
      skipped++;
      continue;
    }
    try {
      const res = await safeFetch(direct, {
        allowPrivate: o.allowPrivate === true,
        headers: Object.assign({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          (resolved.page || o.referer) ? { referer: resolved.page || String(o.referer) } : {}),
        timeoutMs: o.timeoutMs || 20000, maxBytes: 5 * 1024 * 1024
      });
      if (!res.ok) throw new Error('图片返回 HTTP ' + res.status);
      if (isPrivateUrl(res.url, o.allowPrivate === true)) throw new Error('图片跳转到内网地址');
      const dg = await urlGuard.assertPublicHttp(res.url, { allowPrivate: o.allowPrivate === true });
      if (!dg.ok) throw new Error(dg.err);
      const type = String(res.headers.get('content-type') || '').toLowerCase();
      if (type && type.indexOf('image/') !== 0) throw new Error('不是图片：' + type.slice(0, 40));
      if ((Number(res.headers.get('content-length')) || 0) > 5 * 1024 * 1024) throw new Error('图片超过 5MB');
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('图片是空文件');
      const mime = type || 'image/jpeg';
      const ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('webp') >= 0 ? 'webp' : (mime.indexOf('gif') >= 0 ? 'gif' : 'jpg'));
      const up = await uploadOne({ name: 'mirror-' + (i + 1) + '.' + ext, url: 'data:' + mime + ';base64,' + buf.toString('base64') }, cfg, { retries: o.retries == null ? 1 : o.retries, delayMs: 300 });
      if (!up.ok) throw new Error(up.error || '图床上传失败');
      map[url] = up.url;
      if (resolved.page) map[resolved.page] = up.url;
      if (page) map[page] = up.url;
      cacheNew[url] = up.url;
      uploaded++;
    } catch (e) {
      failed++;
      lastError = String(e && e.message || e).slice(0, 120);
      if (isBlacklisted(url) || isBlacklisted(direct)) remove.add(url);
    }
  }

  let out = String(description || '');
  /* 只替换图片地址；[img=300x300]、[url]、[center] 等标签原样保留 */
  Object.keys(map).forEach(function (old) {
    out = out.split(old).join(map[old]);
  });
  remove.forEach(function (old) {
    out = out.replace(new RegExp('\\[img[^\\]]*\\]\\s*' + escapeRe(old) + '\\s*\\[\\/img\\]', 'gi'), '');
    out = out.split(old).join('');
  });
  /* 兜底：最终简介里不允许再出现黑名单图床 */
  out = out.replace(/\[img[^\]]*\]\s*(https?:\/\/[^\s\[\]]+)\s*\[\/img\]/gi, function (tag, u) {
    return isBlacklisted(u) ? '' : tag;
  });
  out = out.replace(/\[url=[^\]]+\]\s*\[\/url\]/gi, '');

  if (Object.keys(cacheNew).length) writeMirrorCache(Object.assign({}, cache, cacheNew));
  return {
    ok: uploaded > 0 || (failed === 0 && skipped >= 0),
    code: failed === 0 ? 'IMAGES_MIRRORED' : (uploaded || skipped ? 'IMAGES_MIRRORED_PARTIAL' : 'IMAGES_MIRROR_FAILED'),
    total: items.length, uploaded: uploaded, failed: failed, skipped: skipped, removed: remove.size,
    message: lastError, description: out, map: map
  };
}


/* 图床转存串行化：同一批/并发调用共享同一轮，后到者命中前一轮写入的缓存 */
let MIRROR_QUEUE = Promise.resolve();
function mirrorDescription(description, opts) {
  const run = function () { return mirrorDescriptionInner(description, opts); };
  const p = MIRROR_QUEUE.then(run, run);
  MIRROR_QUEUE = p.catch(function () { /* 前一轮失败不挡后一轮 */ });
  return p;
}

module.exports = { process: processShots, _ssoLogin: _ssoLogin, _webUpload: _webUpload, replaceDescription: replaceDescription, mirrorDescription: mirrorDescription, extractImages: extractImages, isPrivateUrl: isPrivateUrl, isBlacklisted: isBlacklisted, looksDirect: looksDirect, isLikelyThumb: isLikelyThumb, originalFromThumb: originalFromThumb, isOurImageHost: isOurImageHost, resolveImageSource: resolveImageSource, ogImageFromHtml: ogImageFromHtml, providerKey: providerKey, defaultProvider: defaultProvider, configFor: configFor, dataUrlOf: dataUrlOf };

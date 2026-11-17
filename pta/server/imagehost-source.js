/* 图源解析 / 缩略图还原 / 简介替换 / 镜像缓存：不负责上传。 */
const path = require('path');
const { openDB } = require('./db');

function isPrivateUrl(raw, allowPrivate) {
  if (allowPrivate) return false;
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return true; }
  if (!/^https?:$/.test(u.protocol)) return true;
  const h = u.hostname.toLowerCase();
  if (!h || h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  const m = /^172\.(\d+)\./.exec(h);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (h.indexOf(':') >= 0) return true;
  return false;
}

/* 猫站图床 wiki 黑名单：最终简介里不能出现这些域名。
   覆盖 imgur/imgbb/smms/路过/流浪/Audiences/picgd/Z4A/Ubits/Gifyu。 */
const BLACKLIST_HOSTS = [
  'imgur.com', 'i.imgur.com',
  'imgbb.com', 'ibb.co', 'i.ibb.co',
  'smms.app', 'sm.ms', 's2.loli.net',
  'imgse.com', 'p.sda1.dev', 'i.duan.red',
  'picgd.com', 'z4a.net', 'cache.ubits.club', 'gifyu.com'
];

function hostOfUrl(raw) {
  try { return new URL(String(raw || '')).hostname.toLowerCase(); } catch (e) { return ''; }
}

function isBlacklisted(raw) {
  const h = hostOfUrl(raw);
  return !!h && BLACKLIST_HOSTS.some(function (x) { return h === x || h.endsWith('.' + x); });
}

function looksDirect(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  if (/\.(?:jpe?g|png|gif|webp|avif|bmp)(?:$|[?#])/i.test(u.pathname + u.search)) return true;
  const h = u.hostname.toLowerCase();
  return /(^|\.)(i\.ibb\.co|i\.imgur\.com|s2\.loli\.net|p\.sda1\.dev|i\.duan\.red|cache\.ubits\.club|img\d*\.pixhost\.to|images\d*\.imgbox\.com|i\.postimg\.cc|img\.pterclub\.net)$/i.test(h);
}

function ogImageFromHtml(html, baseUrl) {
  const s2 = String(html || '');
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<img[^>]+id=["']image["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+id=["']image["']/i
  ];
  for (const re of patterns) {
    const m = re.exec(s2);
    if (!m) continue;
    try { return new URL(m[1], baseUrl).toString(); } catch (e) { /* next */ }
  }
  return '';
}

async function resolveImageSource(raw, opts) {
  const o = opts || {};
  const url = String(raw || '').trim();
  if (!/^https?:\/\//i.test(url)) return { err: '不是 http/https 图片地址' };
  if (isPrivateUrl(url, o.allowPrivate === true)) return { err: '内网地址不抓' };
  if (looksDirect(url)) return { ok: true, direct: url, page: '' };
  let res;
  try {
    res = await fetch(url, {
      headers: Object.assign({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        accept: 'text/html,image/*,*/*' }, o.headers || {}),
      redirect: 'follow', signal: AbortSignal.timeout(o.timeoutMs || 20000)
    });
  } catch (e) { return { err: '图床页面连不上' }; }
  if (!res.ok) return { err: '图床页面返回 HTTP ' + res.status };
  if (isPrivateUrl(res.url, o.allowPrivate === true)) return { err: '图床页面跳转到内网' };
  const type = String(res.headers.get('content-type') || '').toLowerCase();
  if (type.indexOf('image/') === 0) return { ok: true, direct: res.url, page: url };
  const html = await res.text().catch(function () { return ''; });
  const direct = ogImageFromHtml(html, res.url || url);
  if (!direct) return { err: '图床页面里没找到原图直链' };
  if (isPrivateUrl(direct, o.allowPrivate === true)) return { err: '原图直链是内网地址' };
  return { ok: true, direct: direct, page: url };
}

function extractImages(description) {
  const out = [];
  const seen = new Set();
  function add(url) {
    const u = String(url || '').trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u });
  }
  const text = String(description || '');
  const re = /\[img[^\]]*\]\s*(https?:\/\/[^\s\[\]]+)\s*\[\/img\]/gi;
  let m;
  while ((m = re.exec(text))) add(m[1]);
  /* Unit3D 的 [comparison] 里是裸图片 URL，不是 [img] */
  const comp = /\[comparison[^\]]*\]([\s\S]*?)\[\/comparison\]/gi;
  while ((m = comp.exec(text))) {
    (m[1].match(/https?:\/\/[^\s\[\]]+/g) || []).forEach(add);
  }
  return out;
}

function isLikelyThumb(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return false; }
  const h = u.hostname.toLowerCase();
  const p = u.pathname;
  return /(^|\.)thumbs?\d*\./i.test(h)
    || /\/thumbs?\//i.test(p)
    || /_(?:t|thumb|small)\.(?:jpe?g|png|gif|webp)$/i.test(p)
    || /[a-z0-9]t\.(?:jpe?g|png|gif|webp)$/i.test(p);
}

function originalFromThumb(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return raw; }
  let h = u.hostname.toLowerCase();
  let p = u.pathname;
  /* imgbox：thumbsN → imagesN，_t → _o */
  if (/(^|\.)thumbs?\d*\.imgbox\.com$/i.test(h)) h = h.replace(/thumbs?(\d*)/i, 'images$1');
  p = p.replace(/_t(\.(?:jpe?g|png|gif|webp))$/i, '_o$1');
  /* imgur：abc t.jpg → abc.jpg */
  p = p.replace(/([a-z0-9])t(\.(?:jpe?g|png|gif|webp))$/i, '$1$2');
  /* 通用 /thumb/ 与 _thumb */
  p = p.replace(/\/thumbs?\//i, '/').replace(/_thumb(\.(?:jpe?g|png|gif|webp))$/i, '$1');
  /* pixhost：tN.pixhost.to/thumbs/ → imgN.pixhost.to/images/ */
  if (/(^|\.)t\d*\.pixhost\.to$/i.test(h)) { h = h.replace(/^t/i, 'img'); p = p.replace(/^\/thumbs\//i, '/images/'); }
  u.hostname = h;
  u.pathname = p;
  return u.toString();
}

function mirrorDb() {
  const dir = path.resolve(require('./env').read('DATA_DIR', 'PTA_DATA') || path.join(__dirname, '..', '..', 'data'));
  try { return { db: openDB(path.join(dir, 'seedpod.db')), dir: dir }; } catch (e) { return null; }
}

function readMirrorCache() {
  const h = mirrorDb();
  if (!h) return {};
  try {
    const row = h.db.prepare("SELECT v FROM meta WHERE k = 'image-mirror-cache'").get();
    h.db.close();
    const j = JSON.parse(row ? row.v : 'null');
    return j && typeof j === 'object' ? j : {};
  } catch (e) { try { h.db.close(); } catch (e2) { /* 忽略：失败不影响主流程 */ } return {}; }
}

function writeMirrorCache(map) {
  const h = mirrorDb();
  if (!h) return;
  try {
    const keys = Object.keys(map);
    const out = {};
    keys.slice(-800).forEach(function (k) { out[k] = map[k]; });
    h.db.prepare("INSERT INTO meta(k, v) VALUES('image-mirror-cache', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(JSON.stringify(out));
    h.db.close();
  } catch (e) { try { h.db.close(); } catch (e2) { /* 忽略：失败不影响主流程 */ } }
}

function isOurImageHost(raw) {
  const h = hostOfUrl(raw);
  return h === 'img.pterclub.net' || h === 's3.pterclub.net';
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function replaceDescription(description, links) {
  let out = String(description == null ? '' : description);
  const list = Array.isArray(links) ? links.filter(function (x) { return x && x.url; }) : [];
  if (!list.length) return out.slice(0, 60000);
  out = out.replace(/\[img\]data:image\/[^\[\]]+\[\/img\]/gi, '').trim();
  const block = list.map(function (x) { return '[img]' + x.url + '[/img]'; }).join('\n');
  if (block && out.indexOf(block) < 0) out = out ? out + '\n\n' + block : block;
  return out.slice(0, 60000);
}

module.exports = { isPrivateUrl, BLACKLIST_HOSTS, hostOfUrl, isBlacklisted, looksDirect, ogImageFromHtml, resolveImageSource, extractImages, isLikelyThumb, originalFromThumb, readMirrorCache, writeMirrorCache, isOurImageHost, escapeRe, replaceDescription };

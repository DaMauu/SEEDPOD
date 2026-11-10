/* 从站点首页的导航里找「种子列表页」该是哪条路径。纯解析，不发请求。
   返回按可信度排好序的候选路径，最多 3 条；认不出来就返回空数组。
   只在拿不到列表（404 / 页面被顶掉 / 没有样本）时用，配合「一页一次 GET」的配额。 */

function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&nbsp;/gi, ' ');
}

/* 明显不是种子列表的入口：账号、规则、论坛、上传、登录之类 */
const DECOY = /(login|logout|signup|register|takelogin|usercp|userdetails|user\.php|donate|rules|faq|wiki|help|staff|forums?|viewtopic|chat|invite|upload|takeupload|mybonus|messages?|pm\.php|rss|api\/|opensearch|favicon|\.css|\.js$|\.png|\.jpg)/i;

/* 值得当种子页的路径特征 */
const GOOD_HREF = /(^|\/)(torrents?(\.php)?|browse(\.php)?|torrents\.php|list\.php)/i;
const GOOD_TEXT = /(种子|資源|资源|种子列表|torrents?|browse|磁力|downloads?|list)/i;

function normPath(href) {
  let h = decode(href).trim();
  if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h) || /^mailto:/i.test(h)) return '';
  try {
    const u = new URL(h, 'https://placeholder.invalid/');
    let p = u.pathname || '/';
    if (p.length > 80) return '';
    return p;
  } catch (e) { return ''; }
}

function scoreFor(path, text) {
  let score = 0;
  if (GOOD_HREF.test(path)) score += 3;
  if (/^\/torrents?\.php$/i.test(path)) score += 3;
  if (/^\/torrents?\/?$/i.test(path)) score += 3;
  if (/^\/browse(\.php)?\/?$/i.test(path)) score += 2;
  if (/torrent/i.test(path)) score += 1;
  if (GOOD_TEXT.test(text)) score += 3;
  if (/(种子|資源|资源|torrents?|browse)/i.test(text)) score += 1;
  if (path.split('/').filter(Boolean).length > 2) score -= 2;      /* 深层页面多半不是列表 */
  if (DECOY.test(path) || DECOY.test(text)) score -= 6;
  return score;
}

/* html：首页源码；limit：最多给几条候选 */
function findTorrentLinks(html, limit) {
  const src = String(html || '');
  const out = [];
  const seenPath = {};
  const seenUrl = {};
  const re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi;
  let m;
  while ((m = re.exec(src))) {
    const href = decode(m[1]);
    const text = String(m[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (seenUrl[href]) continue;
    seenUrl[href] = 1;
    const path = normPath(href);
    if (!path || path === '/') continue;
    const key = path.toLowerCase();
    if (seenPath[key]) continue;
    const s = scoreFor(path, text);
    if (s <= 0) continue;
    seenPath[key] = 1;
    out.push({ path: path, text: text.slice(0, 40), score: s, href: href });
  }
  out.sort(function (a, b) { return b.score - a.score; });
  /* 只要前几条，并且分数太低的不算候选 */
  return out.filter(function (x) { return x.score >= 4; }).slice(0, limit || 3);
}

/* 在已知试过的路径之外挑一条最像种子页的 */
function pickBrowsePath(html, tried) {
  const triedList = (tried || []).map(function (p) { return String(p).toLowerCase().replace(/\/+$/, '') || '/'; });
  const cands = findTorrentLinks(html, 5);
  for (const c of cands) {
    const key = c.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (triedList.indexOf(key) < 0) return c;
  }
  return null;
}

module.exports = { findTorrentLinks: findTorrentLinks, pickBrowsePath: pickBrowsePath, scoreFor: scoreFor };

/* 外部元数据：无 key 用 Wikipedia，公共接口；有 key 用 TMDB。
   只读公开 API；不复制 UA/upbrr 的代码、配置或 key。 */
const DEFAULT_WIKI = 'https://zh.wikipedia.org/w/api.php';
const DEFAULT_TMDB = 'https://api.themoviedb.org/3';
const DEFAULT_DOUBAN = 'https://movie.douban.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

/* 外部接口缓存与礼貌间隔：同一 URL 6 小时内只打一次，同域名请求至少隔 800ms。
   设置 PTA_META_CACHE=0 可关缓存，PTA_META_MIN_GAP 可改间隔（毫秒）。 */
const CACHE = new Map();
const CACHE_TTL = 6 * 3600 * 1000;
const CACHE_MAX = 300;
const HOST_LAST = new Map();
const MIN_GAP = Math.max(0, Number(process.env.PTA_META_MIN_GAP == null ? 800 : process.env.PTA_META_MIN_GAP) || 0);
const CACHE_ON = String(process.env.PTA_META_CACHE || '1') !== '0';

function cacheGet(key) {
  if (!CACHE_ON) return null;
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { CACHE.delete(key); return null; }
  return JSON.parse(hit.body);
}
function cacheSet(key, value) {
  if (!CACHE_ON) return;
  if (CACHE.size >= CACHE_MAX) { const first = CACHE.keys().next().value; if (first !== undefined) CACHE.delete(first); }
  CACHE.set(key, { at: Date.now(), body: JSON.stringify(value) });
}
async function polite(url) {
  if (!MIN_GAP) return;
  let host = '';
  try { host = new URL(url).host.toLowerCase(); } catch (e) { host = ''; }
  if (!host || host === '127.0.0.1' || host === 'localhost' || host.indexOf('127.0.0.1:') === 0) return;
  const last = HOST_LAST.get(host) || 0;
  const wait = Math.max(0, MIN_GAP - (Date.now() - last));
  if (wait) await new Promise(function (r) { setTimeout(r, wait); });
  HOST_LAST.set(host, Date.now());
}
async function getJson(url, timeout, headers) {
  const cached = cacheGet('GET ' + url);
  if (cached) return cached;
  await polite(url);
  const r = await fetch(url, { headers: Object.assign({ 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' }, headers || {}), signal: AbortSignal.timeout(timeout || 10000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  cacheSet('GET ' + url, j);
  return j;
}
function tmdbKey(key) { return String(key || process.env.TMDB_API_KEY || '').trim(); }
function tmdbBase() { return String(process.env.PTA_TMDB_API || DEFAULT_TMDB).replace(/\/+$/, ''); }
function doubanBase() { return String(process.env.PTA_DOUBAN_API || DEFAULT_DOUBAN).replace(/\/+$/, ''); }
function douyingBase() { return String(process.env.PTA_DOUYING_API || 'https://doubaninfo.com').replace(/\/+$/, ''); }
function wikiBase(lang) {
  return process.env.PTA_WIKI_API || ('https://' + lang + '.wikipedia.org/w/api.php');
}

async function wikiSearch(title, year, lang, type) {
  const base = wikiBase(lang);
  const hint = lang === 'zh' ? (type === 'tv' ? '电视剧' : '电影') : (type === 'tv' ? 'TV series' : 'film');
  const q = [title, year, hint].filter(Boolean).join(' ');
  const sj = await getJson(base + '?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json&utf8=1&srlimit=5');
  const hits = ((sj.query && sj.query.search) || []).filter(function (x) {
    return !/可以指|可能指|may refer to|disambiguation/i.test(String(x.snippet || ''));
  });
  const hit = hits[0] || ((sj.query && sj.query.search) || [])[0];
  if (!hit) return null;
  const ej = await getJson(base + '?action=query&prop=extracts&exintro=1&explaintext=1&pageids=' + encodeURIComponent(hit.pageid) + '&format=json&utf8=1');
  const pages = (ej.query && ej.query.pages) || {};
  const page = pages[hit.pageid] || pages[Object.keys(pages)[0]] || {};
  const name = page.title || hit.title || title;
  return {
    source: 'wikipedia', lang: lang, pageId: hit.pageid,
    title: name, year: Number(year) || null,
    overview: String(page.extract || '').trim(),
    url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(name)
  };
}

async function wikipedia(title, year, type) {
  for (const lang of ['zh', 'en']) {
    try {
      const r = await wikiSearch(title, year, lang, type);
      if (r && r.overview && !/可以指|可能指|may refer to|disambiguation/i.test(r.overview)) return r;
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  }
  return null;
}

/* 豆瓣只走公开的搜索联想接口（详情页有反爬），拿条目、年份、海报、别名；
   剧情简介交给 Wikipedia，两者都不需要 key。 */
async function doubanSearch(title, year) {
  const base = doubanBase();
  const list = await getJson(base + '/j/subject_suggest?q=' + encodeURIComponent(String(title || '').trim()), 10000, { referer: base + '/' });
  const rows = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.url; });
  const want = String(year || '');
  const hit = (want && rows.filter(function (x) { return String(x.year || '') === want; })[0]) || rows[0] || null;
  if (!hit) return null;
  return {
    source: 'douban', id: String(hit.id || ''), title: String(hit.title || title),
    year: Number(hit.year) || Number(year) || null,
    poster: String(hit.img || ''), url: String(hit.url || '').split('?')[0],
    subtitle: String(hit.sub_title || '')
  };
}

/* 豆影（DoubanInfo）网页请求：POST /api.php 不需要 key，返回豆瓣/IMDb/TMDB 合并后的 JSON。
   网页前端就是用这个接口；我们只取字段，自己拼 BBCode。 */
async function postForm(url, fields, timeout) {
  const body = new URLSearchParams();
  Object.keys(fields || {}).forEach(function (k) { body.set(k, String(fields[k] == null ? '' : fields[k])); });
  const key = 'POST ' + url + '\n' + body.toString();
  const cached = cacheGet(key);
  if (cached) return cached;
  await polite(url);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'user-agent': UA, referer: douyingBase() + '/', origin: douyingBase(),
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-requested-with': 'XMLHttpRequest'
    },
    body: body.toString(), signal: AbortSignal.timeout(timeout || 20000)
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status);
  cacheSet(key, t);
  return t;
}

function splitList(v) {
  if (Array.isArray(v)) return v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
  return String(v == null ? '' : v).split(/\s*\/\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
}

async function douying(title, year) {
  const raw = [title, year].filter(Boolean).join(' ');
  const text = await postForm(douyingBase() + '/api.php', { url: raw }, 20000);
  if (/^(错误|获取.*失败)/.test(text)) throw new Error(text.slice(0, 80));
  let j = null;
  try { j = JSON.parse(text); } catch (e) { throw new Error('豆影返回不是 JSON'); }
  const rows = (j && Array.isArray(j.results) ? j.results : []).filter(function (x) {
    return x && x.success !== false && (x.chinese_title || x.title);
  });
  const want = String(year || '');
  const hit = (want && rows.filter(function (x) { return String(x.year || '') === want; })[0]) ||
    rows.slice().sort(function (a, b) { return (Number(b._affix_score) || 0) - (Number(a._affix_score) || 0); })[0];
  if (!hit) return null;
  const mainTitle = String(hit.chinese_title || hit.title || title);
  const aliases = splitList(hit.aka).filter(function (x) { return x !== mainTitle; });
  return {
    source: 'douying', id: String(hit.sid || ''),
    title: mainTitle,
    originalTitle: String(hit.original_title || ''),
    year: Number(hit.year) || Number(year) || null,
    overview: String(hit.summary || '').trim(),
    poster: String(hit.poster || hit.cover || ''),
    url: hit.sid ? 'https://movie.douban.com/subject/' + hit.sid + '/' : '',
    aliases: aliases,
    subtitle: [mainTitle].concat(aliases.slice(0, 2)).join(' / ').slice(0, 200),
    directors: splitList(hit.director), writers: splitList(hit.writer),
    cast: splitList(hit.cast), genre: splitList(hit.genre),
    region: String(hit.region || ''), language: String(hit.language || ''),
    releaseDate: String(hit.release_date || ''), runtime: String(hit.runtime || hit.duration || ''),
    imdbId: String(hit.imdb_id || ''), imdbRating: String(hit.imdb_rating || ''), imdbVotes: String(hit.imdb_votes || ''),
    doubanRating: String(hit.douban_rating || ''), doubanVotes: String(hit.douban_votes || ''),
    awards: splitList(hit.awards)
  };
}

function douyingSubtitle(d) {
  if (!d) return '';
  const names = [d.title].concat((d.aliases || []).filter(function (x) { return x && x !== d.title; })).slice(0, 3);
  return names.join(' / ').slice(0, 200);
}

function douyingBbcode(d) {
  if (!d) return '';
  const lines = [];
  if (d.poster) lines.push('[img]' + d.poster + '[/img]', '');
  const push = function (k, v) { if (v) lines.push('◎' + k + '　' + v); };
  push('译　名', (d.aliases || []).slice(0, 8).join(' / '));
  push('片　名', d.originalTitle || '');
  push('年　代', d.year || '');
  push('产　地', d.region);
  push('类　别', (d.genre || []).join(' / '));
  push('语　言', d.language);
  push('上映日期', d.releaseDate);
  push('IMDb', [d.imdbRating, d.imdbId].filter(Boolean).join(' · '));
  push('豆瓣评分', d.doubanRating ? d.doubanRating + (d.doubanVotes ? ' (' + d.doubanVotes + '人评价)' : '') : '');
  push('片　长', d.runtime);
  push('导　演', (d.directors || []).join(' / '));
  push('编　剧', (d.writers || []).join(' / '));
  push('主　演', (d.cast || []).slice(0, 8).join(' / '));
  if (d.overview) lines.push('', '◎简　介', '', d.overview);
  if ((d.awards || []).length) {
    lines.push('', '◎获奖情况', '');
    (d.awards || []).slice(0, 6).forEach(function (x) { lines.push('　　' + x); });
  }
  return lines.join('\n').trim().slice(0, 20000);
}

async function web(title, year, type) {
  let dy = null, db = null, wiki = null;
  try { dy = await douying(title, year); } catch (e) { dy = null; }
  try { db = await doubanSearch(title, year); } catch (e) { db = null; }
  try { wiki = await wikipedia(title, (dy && dy.year) || (db && db.year) || year, type); } catch (e) { wiki = null; }
  if (dy) {
    return Object.assign({}, dy, {
      source: 'web', via: 'douying',
      overview: dy.overview || (wiki && wiki.overview) || '',
      bbcode: douyingBbcode(dy),
      subtitle: douyingSubtitle(dy)
    });
  }
  if (!db && !wiki) return null;
  return {
    source: 'web', via: db ? 'douban+wiki' : 'wiki',
    title: (wiki && wiki.title) || (db && db.title) || title,
    year: (db && db.year) || (wiki && wiki.year) || Number(year) || null,
    overview: (wiki && wiki.overview) || '',
    poster: (db && db.poster) || '',
    url: (db && db.url) || (wiki && wiki.url) || '',
    aliases: db && db.subtitle && db.subtitle !== db.title ? [db.subtitle] : [],
    subtitle: (db && db.title) || '',
    bbcode: ''
  };
}

async function tmdb(title, year, type, key, castLimit) {
  const k = tmdbKey(key);
  if (!k) return { skipped: true, reason: 'no_key' };
  const kind = type === 'tv' ? 'tv' : 'movie';
  const base = tmdbBase();
  const search = base + '/search/' + kind + '?api_key=' + encodeURIComponent(k) + '&language=zh-CN&query=' + encodeURIComponent(title) + (year ? '&year=' + encodeURIComponent(year) : '');
  const sj = await getJson(search);
  const hit = ((sj.results) || [])[0];
  if (!hit) return null;
  const detail = base + '/' + kind + '/' + encodeURIComponent(hit.id) + '?api_key=' + encodeURIComponent(k) + '&language=zh-CN&append_to_response=credits';
  const d = await getJson(detail);
  const date = String(d.release_date || d.first_air_date || '');
  const credits = d.credits || {};
  const castMax = Math.max(1, Math.min(20, Number(castLimit) || 8));
  return {
    source: 'tmdb', id: hit.id,
    title: d.title || d.name || hit.title || title,
    originalTitle: d.original_title || d.original_name || '',
    year: Number(date.slice(0, 4)) || Number(year) || null,
    overview: String(d.overview || '').trim(),
    poster: d.poster_path ? ('https://image.tmdb.org/t/p/w500' + d.poster_path) : '',
    directors: (credits.crew || []).filter(function (x) { return x.job === 'Director'; }).map(function (x) { return x.name; }),
    cast: (credits.cast || []).slice(0, castMax).map(function (x) { return x.name; }),
    url: 'https://www.themoviedb.org/' + kind + '/' + hit.id
  };
}

async function fetchMeta(opts) {
  const b = opts || {};
  const title = String(b.title || '').trim();
  if (!title) return { ok: false, code: 'BAD_TITLE', message: '标题不能为空', http: 400 };
  const provider = ['tmdb', 'wikipedia', 'douban', 'douying', 'web'].indexOf(String(b.provider || '')) >= 0 ? String(b.provider) : (tmdbKey() ? 'tmdb' : 'web');
  try {
    if (provider === 'tmdb') {
      const r = await tmdb(title, b.year, b.type, b.key, b.castLimit);
      if (r && r.skipped) return { ok: false, code: 'NO_TMDB_KEY', message: '没有配置 TMDB API key（环境变量 TMDB_API_KEY）', http: 400 };
      if (!r) return { ok: false, code: 'NOT_FOUND', message: 'TMDB 没查到这部片', http: 404 };
      if (b.requireYear && b.year && r.year && Number(r.year) !== Number(b.year)) {
        return { ok: false, code: 'YEAR_MISMATCH', message: '年份不一致：请求 ' + b.year + '，结果 ' + r.year, http: 422 };
      }
      return { ok: true, provider: 'tmdb', data: r };
    }
    let r;
    if (provider === 'douban') r = await doubanSearch(title, b.year);
    else if (provider === 'douying') {
      const dy = await douying(title, b.year);
      r = dy ? Object.assign({}, dy, { bbcode: douyingBbcode(dy), subtitle: douyingSubtitle(dy) }) : null;
    }
    else if (provider === 'web') r = await web(title, b.year, b.type);
    else r = await wikipedia(title, b.year, b.type);
    if (!r) return { ok: false, code: 'NOT_FOUND', message: (provider === 'wikipedia' ? 'Wikipedia' : provider === 'douban' ? '豆瓣' : '公开网页') + ' 没查到这部片', http: 404 };
    if (b.requireYear && b.year && r.year && Number(r.year) !== Number(b.year)) {
      return { ok: false, code: 'YEAR_MISMATCH', message: '年份不一致：请求 ' + b.year + '，结果 ' + r.year, http: 422 };
    }
    return { ok: true, provider: provider, data: r };
  } catch (e) {
    return { ok: false, code: 'UPSTREAM_FAILED', message: String(e && e.message || e).slice(0, 160), http: 502 };
  }
}

function providers() {
  return { wikipedia: true, tmdb: !!tmdbKey(), douban: true, douying: true, web: true };
}

module.exports = { fetchMeta, providers, wikipedia, tmdb, doubanSearch, douying, douyingBbcode, douyingSubtitle, web };

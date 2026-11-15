/* 外部元数据：无 key 用 Wikipedia，公共接口；有 key 用 TMDB。
   只读公开 API；不复制 UA/upbrr 的代码、配置或 key。 */
const DEFAULT_WIKI = 'https://zh.wikipedia.org/w/api.php';
const DEFAULT_TMDB = 'https://api.themoviedb.org/3';
const DEFAULT_DOUBAN = 'https://movie.douban.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

function getJson(url, timeout, headers) {
  return fetch(url, { headers: Object.assign({ 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' }, headers || {}), signal: AbortSignal.timeout(timeout || 10000) })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
}
function tmdbKey(key) { return String(key || process.env.TMDB_API_KEY || '').trim(); }
function tmdbBase() { return String(process.env.PTA_TMDB_API || DEFAULT_TMDB).replace(/\/+$/, ''); }
function doubanBase() { return String(process.env.PTA_DOUBAN_API || DEFAULT_DOUBAN).replace(/\/+$/, ''); }
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

async function web(title, year, type) {
  let db = null, wiki = null;
  try { db = await doubanSearch(title, year); } catch (e) { db = null; }
  try { wiki = await wikipedia(title, (db && db.year) || year, type); } catch (e) { wiki = null; }
  if (!db && !wiki) return null;
  return {
    source: 'web',
    title: (wiki && wiki.title) || (db && db.title) || title,
    year: (db && db.year) || (wiki && wiki.year) || Number(year) || null,
    overview: (wiki && wiki.overview) || '',
    poster: (db && db.poster) || '',
    url: (db && db.url) || (wiki && wiki.url) || '',
    aliases: db && db.subtitle && db.subtitle !== db.title ? [db.subtitle] : []
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
  const provider = ['tmdb', 'wikipedia', 'douban', 'web'].indexOf(String(b.provider || '')) >= 0 ? String(b.provider) : (tmdbKey() ? 'tmdb' : 'web');
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
  return { wikipedia: true, tmdb: !!tmdbKey(), douban: true, web: true };
}

module.exports = { fetchMeta, providers, wikipedia, tmdb, doubanSearch, web };

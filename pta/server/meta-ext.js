/* 外部元数据：无 key 用 Wikipedia，公共接口；有 key 用 TMDB。
   只读公开 API；不复制 UA/upbrr 的代码、配置或 key。 */
const DEFAULT_WIKI = 'https://zh.wikipedia.org/w/api.php';
const DEFAULT_TMDB = 'https://api.themoviedb.org/3';

function getJson(url, timeout) {
  return fetch(url, { signal: AbortSignal.timeout(timeout || 10000) }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}
function tmdbKey(key) { return String(key || process.env.TMDB_API_KEY || '').trim(); }
function tmdbBase() { return String(process.env.PTA_TMDB_API || DEFAULT_TMDB).replace(/\/+$/, ''); }
function wikiBase(lang) {
  return process.env.PTA_WIKI_API || ('https://' + lang + '.wikipedia.org/w/api.php');
}

async function wikiSearch(title, year, lang) {
  const base = wikiBase(lang);
  const q = [title, year].filter(Boolean).join(' ');
  const sj = await getJson(base + '?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json&utf8=1&srlimit=5');
  const hit = ((sj.query && sj.query.search) || [])[0];
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

async function wikipedia(title, year) {
  for (const lang of ['zh', 'en']) {
    try {
      const r = await wikiSearch(title, year, lang);
      if (r && r.overview) return r;
    } catch (e) {}
  }
  return null;
}

async function tmdb(title, year, type, key) {
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
  return {
    source: 'tmdb', id: hit.id,
    title: d.title || d.name || hit.title || title,
    originalTitle: d.original_title || d.original_name || '',
    year: Number(date.slice(0, 4)) || Number(year) || null,
    overview: String(d.overview || '').trim(),
    poster: d.poster_path ? ('https://image.tmdb.org/t/p/w500' + d.poster_path) : '',
    directors: (credits.crew || []).filter(function (x) { return x.job === 'Director'; }).map(function (x) { return x.name; }),
    cast: (credits.cast || []).slice(0, 8).map(function (x) { return x.name; }),
    url: 'https://www.themoviedb.org/' + kind + '/' + hit.id
  };
}

async function fetchMeta(opts) {
  const b = opts || {};
  const title = String(b.title || '').trim();
  if (!title) return { ok: false, code: 'BAD_TITLE', message: '标题不能为空', http: 400 };
  const provider = b.provider === 'tmdb' || b.provider === 'wikipedia' ? b.provider : (tmdbKey() ? 'tmdb' : 'wikipedia');
  try {
    if (provider === 'tmdb') {
      const r = await tmdb(title, b.year, b.type, b.key);
      if (r && r.skipped) return { ok: false, code: 'NO_TMDB_KEY', message: '没有配置 TMDB API key（环境变量 TMDB_API_KEY）', http: 400 };
      if (!r) return { ok: false, code: 'NOT_FOUND', message: 'TMDB 没查到这部片', http: 404 };
      return { ok: true, provider: 'tmdb', data: r };
    }
    const r = await wikipedia(title, b.year);
    if (!r) return { ok: false, code: 'NOT_FOUND', message: 'Wikipedia 没查到这部片', http: 404 };
    return { ok: true, provider: 'wikipedia', data: r };
  } catch (e) {
    return { ok: false, code: 'UPSTREAM_FAILED', message: String(e && e.message || e).slice(0, 160), http: 502 };
  }
}

function providers() {
  return { wikipedia: true, tmdb: !!tmdbKey() };
}

module.exports = { fetchMeta, providers, wikipedia, tmdb };

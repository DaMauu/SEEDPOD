/* 元数据夹具：本地 mock Wikipedia / TMDB，不联网。 */
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { fetchMeta, providers } = require(path.join(ROOT, 'server', 'meta-ext.js'));
const results = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function listen(handler) {
  return new Promise(function (resolve) {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', function () { resolve({ server: s, base: 'http://127.0.0.1:' + s.address().port }); });
  });
}

async function main() {
  const mock = await listen(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('content-type', 'application/json');
    if (u.pathname.endsWith('/w/api.php')) {
      if (u.searchParams.get('list') === 'search') {
        res.end(JSON.stringify({ query: { search: [{ pageid: 1, title: 'The Matrix' }] } }));
      } else {
        res.end(JSON.stringify({ query: { pages: { 1: { pageid: 1, title: 'The Matrix', extract: 'A hacker learns the truth.' } } } }));
      }
      return;
    }
    if (u.pathname === '/3/search/movie') {
      res.end(JSON.stringify({ results: [{ id: 603, title: 'The Matrix' }] }));
      return;
    }
    if (u.pathname === '/3/movie/603') {
      res.end(JSON.stringify({ id: 603, title: 'The Matrix', original_title: 'The Matrix', release_date: '1999-03-31',
        overview: 'A hacker learns the truth.', poster_path: '/abc.jpg',
        credits: { crew: [{ job: 'Director', name: 'Lana Wachowski' }, { job: 'Director', name: 'Lilly Wachowski' }], cast: [{ name: 'Keanu Reeves' }] } }));
      return;
    }
    res.statusCode = 404; res.end('{}');
  });

  process.env.PTA_WIKI_API = mock.base + '/w/api.php';
  process.env.PTA_TMDB_API = mock.base + '/3';
  process.env.TMDB_API_KEY = 'test-key';

  await check('TMDB 有 key：搜索 + 详情', async function () {
    const r = await fetchMeta({ title: 'The Matrix', year: 1999 });
    need(r.ok && r.provider === 'tmdb', '没走 TMDB：' + JSON.stringify(r));
    need(r.data.title === 'The Matrix' && r.data.year === 1999, '标题/年份不对');
    need(r.data.overview.indexOf('hacker') >= 0, '简介不对');
    need(r.data.directors.length === 2 && r.data.cast[0] === 'Keanu Reeves', '导演/演员不对');
  });

  await check('Wikipedia 无 key：搜索 + 摘要', async function () {
    const r = await fetchMeta({ title: 'The Matrix', provider: 'wikipedia' });
    need(r.ok && r.provider === 'wikipedia', '没走 Wikipedia：' + JSON.stringify(r));
    need(r.data.title === 'The Matrix' && r.data.overview.indexOf('hacker') >= 0, '摘要不对');
  });

  await check('providers 只回 bool，不回 key', async function () {
    const p = providers();
    need(p.wikipedia === true && p.tmdb === true, 'providers 不对：' + JSON.stringify(p));
    need(!('key' in p), 'providers 泄露 key');
  });

  await check('无 key 时 TMDB 明确报错', async function () {
    delete process.env.TMDB_API_KEY;
    const r = await fetchMeta({ title: 'The Matrix', provider: 'tmdb' });
    need(r.ok === false && r.code === 'NO_TMDB_KEY', '没报 NO_TMDB_KEY：' + JSON.stringify(r));
    need(providers().tmdb === false, 'provider 仍显示有 key');
  });

  await check('空标题被拒', async function () {
    const r = await fetchMeta({ title: '' });
    need(r.ok === false && r.code === 'BAD_TITLE', '空标题没拒');
  });

  mock.server.close();
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});

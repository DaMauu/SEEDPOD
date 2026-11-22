/* 元数据夹具：本地 mock Wikipedia / TMDB，不联网。 */
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { fetchMeta, providers, doubanSearch, douying } = require(path.join(ROOT, 'server', 'meta-ext.js'));
const { makeMetaFill } = require(path.join(ROOT, 'server', 'meta-fill.js'));
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

let redirectedTo = 0;
let imgHits = 0;

async function main() {
  const mock = await listen(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('content-type', 'application/json');
    if (u.pathname.indexOf('/redirect') === 0) {
      res.statusCode = 302;
      res.setHeader('location', '/followed');
      res.end();
      return;
    }
    if (u.pathname === '/followed') { redirectedTo++; res.end('{}'); return; }
    if (u.pathname.indexOf('/img/') === 0) { imgHits++; res.writeHead(200, { 'content-type': 'image/png' }); res.end('x'); return; }
    if (u.pathname.endsWith('/w/api.php')) {
      if (u.searchParams.get('list') === 'search') {
        res.end(JSON.stringify({ query: { search: [{ pageid: 1, title: 'The Matrix' }] } }));
      } else {
        res.end(JSON.stringify({ query: { pages: { 1: { pageid: 1, title: 'The Matrix', extract: 'A hacker learns the truth.' } } } }));
      }
      return;
    }
    if (u.pathname === '/api.php' && req.method === 'POST') {
      let body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        const q = new URLSearchParams(body).get('url') || '';
        if (/NoDouying/i.test(q)) { res.end(JSON.stringify({ status: 'ok', results: [] })); return; }
        res.end(JSON.stringify({ status: 'ok', results: [{ success: true, sid: '1292052', chinese_title: '黑客帝国', original_title: 'The Matrix', year: '1999',
          aka: ['矩阵', '22世纪杀人网络'], summary: 'A hacker learns the truth.', poster: 'https://img.example/db.jpg',
          director: ['Lana Wachowski'], writer: ['Lana Wachowski'], cast: ['Keanu Reeves'], genre: ['动作'], region: '美国', language: '英语',
          release_date: '1999-03-31', runtime: '136分钟', imdb_id: 'tt0133093', imdb_rating: '8.7', douban_rating: '9.1', douban_votes: '600000', awards: ['测试奖'] }] }));
      });
      return;
    }
    if (u.pathname === '/j/subject_suggest') {
      res.end(JSON.stringify([{ id: '1292052', title: 'The Matrix', year: '1999', img: 'https://img.example/m.jpg', url: 'https://movie.douban.com/subject/1292052/?suggest=x', sub_title: '黑客帝国' }]));
      return;
    }
    if (u.pathname === '/3/search/movie') {
      res.end(JSON.stringify({ results: [{ id: 603, title: 'The Matrix' }] }));
      return;
    }
    if (u.pathname === '/3/movie/603') {
      res.end(JSON.stringify({ id: 603, title: 'The Matrix', original_title: 'The Matrix', release_date: '1999-03-31',
        overview: 'A hacker learns the truth.', poster_path: '/abc.jpg',
        credits: { crew: [{ job: 'Director', name: 'Lana Wachowski' }, { job: 'Director', name: 'Lilly Wachowski' }], cast: [{ name: 'Keanu Reeves' }, { name: 'Laurence Fishburne' }] } }));
      return;
    }
    res.statusCode = 404; res.end('{}');
  });

  process.env.PTA_WIKI_API = mock.base + '/w/api.php';
  process.env.PTA_TMDB_API = mock.base + '/3';
  process.env.PTA_DOUBAN_API = mock.base;
  process.env.PTA_DOUYING_API = mock.base;
  process.env.TMDB_API_KEY = 'test-key';
  process.env.PTA_META_CACHE = '0';
  process.env.PTA_META_MIN_GAP = '0';

  await check('TMDB 有 key：搜索 + 详情', async function () {
    const r = await fetchMeta({ title: 'The Matrix', year: 1999 });
    need(r.ok && r.provider === 'tmdb', '没走 TMDB：' + JSON.stringify(r));
    need(r.data.title === 'The Matrix' && r.data.year === 1999, '标题/年份不对');
    need(r.data.overview.indexOf('hacker') >= 0, '简介不对');
    need(r.data.directors.length === 2 && r.data.cast[0] === 'Keanu Reeves', '导演/演员不对');
  });

  await check('主演数量与年份一致规则', async function () {
    const one = await fetchMeta({ title: 'The Matrix', year: 1999, castLimit: 1 });
    need(one.ok && one.data.cast.length === 1, '主演数量没按规则裁剪：' + JSON.stringify(one.data && one.data.cast));
    const bad = await fetchMeta({ title: 'The Matrix', year: 2000, requireYear: true });
    need(bad.ok === false && bad.code === 'YEAR_MISMATCH', '年份不一致没拦住：' + JSON.stringify(bad));
    const ok = await fetchMeta({ title: 'The Matrix', year: 2000, requireYear: false });
    need(ok.ok && ok.data.year === 1999, '关闭年份校验后不该拦：' + JSON.stringify(ok));
  });

  await check('Wikipedia 无 key：搜索 + 摘要', async function () {
    const r = await fetchMeta({ title: 'The Matrix', provider: 'wikipedia' });
    need(r.ok && r.provider === 'wikipedia', '没走 Wikipedia：' + JSON.stringify(r));
    need(r.data.title === 'The Matrix' && r.data.overview.indexOf('hacker') >= 0, '摘要不对');
  });

  await check('豆影无 key：搜索 + 副标题 + BBCode 拼贴', async function () {
    const r = await fetchMeta({ title: 'The Matrix', year: 1999, provider: 'douying' });
    need(r.ok && r.provider === 'douying', '没走豆影：' + JSON.stringify(r));
    need(r.data.subtitle === '黑客帝国 / 矩阵 / 22世纪杀人网络', '副标题拼贴不对：' + r.data.subtitle);
    need(/\[img\]https:\/\/img\.example\/db\.jpg\[\/img\]/.test(r.data.bbcode), '海报没进 BBCode');
    need(/◎译　名/.test(r.data.bbcode) && /◎主　演/.test(r.data.bbcode) && /◎简　介/.test(r.data.bbcode), 'BBCode 字段不全');
    need(r.data.bbcode.indexOf('A hacker learns the truth.') >= 0, '简介没进 BBCode');
  });

  await check('无 key 网页模式默认走豆影', async function () {
    const r = await fetchMeta({ title: 'The Matrix', year: 1999, provider: 'web' });
    need(r.ok && r.provider === 'web' && r.data.via === 'douying', '没走豆影：' + JSON.stringify({ via: r.data && r.data.via }));
    need(String(r.data.poster).indexOf('img.example') >= 0, '海报没拿到：' + r.data.poster);
    need(String(r.data.bbcode).indexOf('◎片　名') >= 0, '没拼 BBCode');
  });

  await check('豆影没结果时回退豆瓣 + Wikipedia', async function () {
    const r = await fetchMeta({ title: 'NoDouying Matrix', year: 1999, provider: 'web' });
    need(r.ok && r.data.via === 'douban+wiki', '没回退：' + JSON.stringify({ via: r.data && r.data.via }));
    need(String(r.data.poster).indexOf('img.example/m.jpg') >= 0, '豆瓣海报没拿到');
    need(String(r.data.overview).indexOf('hacker') >= 0, 'Wikipedia 简介没拿到');
  });

  await check('元数据接口 302 时明确报错且不跟随', async function () {
    const prevD = process.env.PTA_DOUBAN_API;
    const prevY = process.env.PTA_DOUYING_API;
    redirectedTo = 0;
    process.env.PTA_DOUBAN_API = mock.base + '/redirect';
    try {
      let err = '';
      try { await doubanSearch('The Matrix', 1999); } catch (e) { err = String(e && e.message || e); }
      need(/跳转/.test(err), '豆瓣 302 没报错：' + err);
    } finally { process.env.PTA_DOUBAN_API = prevD; }
    process.env.PTA_DOUYING_API = mock.base + '/redirect';
    try {
      let err = '';
      try { await douying('The Matrix', 1999); } catch (e) { err = String(e && e.message || e); }
      need(/跳转/.test(err), '豆影 302 没报错：' + err);
    } finally { process.env.PTA_DOUYING_API = prevY; }
    need(redirectedTo === 0, '302 之后仍跟了过去：' + redirectedTo);
  });

  await check('简介回填不抓源简介里的远程图片', async function () {
    imgHits = 0;
    const mf = makeMetaFill({ one: function () { return { v: '{}' }; } });
    const src = '本地简介\n[img]http://127.0.0.1:' + mock.base.split(':').pop() + '/img/keep.png[/img]';
    const item = { title: 'The Matrix', year: 1999, intro: src, descrBb: src };
    const r = await mf.fillMeta(item);
    need(r.ok === true, '简介回填失败：' + JSON.stringify(r));
    need(item.descrBb.indexOf('/img/keep.png') >= 0, '源截图被丢了');
    need(imgHits === 0, '简介回填去抓了远程图片：' + imgHits);
  });

  await check('providers 只回 bool，不回 key', async function () {
    const p = providers();
    need(p.wikipedia === true && p.tmdb === true && p.douban === true && p.douying === true && p.web === true, 'providers 不对：' + JSON.stringify(p));
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

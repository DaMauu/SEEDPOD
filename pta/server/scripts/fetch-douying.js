/* 命令行直取豆影：不走面板 UI，用于核对 IMDb/豆瓣 ID 或片名。
   用法：
     node pta/scripts/fetch-douying.js tt7736104
     node pta/scripts/fetch-douying.js --title "鬼网" --year 2017
     node pta/scripts/fetch-douying.js tt7736104 --raw
*/
const metaExt = require('../src/features/media/meta-ext');

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const query = arg('--title', argv.filter(function (x) { return !/^--/.test(x) && !/^\d{4}$/.test(x); })[0] || '');
const year = arg('--year', '');
const raw = argv.includes('--raw');
if (!query) {
  console.error('用法：node pta/scripts/fetch-douying.js tt7736104 [--raw]');
  process.exit(2);
}
(async function () {
  const r = await metaExt.fetchMeta({ title: query, year: year || null, type: 'movie', provider: 'douying' });
  if (!r.ok) {
    console.error(r.code + '：' + r.message);
    process.exit(1);
  }
  const d = r.data || {};
  if (raw) {
    process.stdout.write(String(d.bbcode || ''));
    return;
  }
  console.log(JSON.stringify({
    title: d.title || '', originalTitle: d.originalTitle || '', year: d.year || null,
    region: d.region || '', language: d.language || '',
    directors: d.directors || [], cast: d.cast || [],
    aliases: d.aliases || [], imdbId: d.imdbId || '',
    overview: d.overview || '', bbcodeLength: String(d.bbcode || '').length
  }, null, 2));
})().catch(function (e) {
  console.error('请求失败：' + String(e && e.message || e).slice(0, 160));
  process.exit(1);
});

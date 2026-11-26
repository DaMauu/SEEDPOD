/* 把 cookies.tmp.json 里的 cookie 加密写进 v2 的 data/cookies.json。
   用法：PTA_DATA=<数据目录> PTA_SECRET_FILE=<密钥文件> node scripts/load-cookies.js <cookies.json>
   也支持 PTA_SECRET=<密钥>；没有显式密钥时只读数据目录 .secret，不自动新建。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const makeCookieStore = require(path.join(ROOT, 'pta', 'server', 'src', 'features', 'sites', 'credentials'));
const { openDB } = require(path.join(ROOT, 'pta', 'server', 'src', 'infra', 'db'));
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(ROOT, 'pta', 'data'));

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.log('用法：PTA_DATA=<数据目录> PTA_SECRET_FILE=<密钥文件> node scripts/load-cookies.js <cookies.json>');
  process.exit(1);
}

const incoming = JSON.parse(fs.readFileSync(src, 'utf8'));
const db = openDB(path.join(DATA_DIR, 'seedpod.db'));
const store = makeCookieStore(DATA_DIR);
const items = Array.isArray(incoming) ? incoming : Object.keys(incoming).map(function (host) { return { host: host, cookie: incoming[host] }; });
const r = store.importMany(items, db);
db.close();
console.log('imported ' + r.saved + ' hosts, skipped ' + r.skipped + ', total=' + store.list().length);

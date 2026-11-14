/* 把 cookies.tmp.json 里的 cookie 加密写进 v2 的 SQLite 凭据表。
   用法：PTA_DATA=<数据目录> PTA_SECRET_FILE=<密钥文件> node scripts/load-cookies.js <cookies.json>
   也支持 PTA_SECRET=<密钥>；没有显式密钥时只读数据目录 .secret，不自动新建。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = require(path.join(ROOT, 'pta', 'server', 'secretbox.js'));
const { openDB } = require(path.join(ROOT, 'pta', 'server', 'db.js'));
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(ROOT, 'pta', 'data'));

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.log('用法：PTA_DATA=<数据目录> PTA_SECRET_FILE=<密钥文件> node scripts/load-cookies.js <cookies.json>');
  process.exit(1);
}

let key = null, source = '';
if (process.env.PTA_SECRET) {
  key = box.parseKey(process.env.PTA_SECRET);
  source = 'env';
} else if (process.env.PTA_SECRET_FILE) {
  try { key = box.parseKey(fs.readFileSync(process.env.PTA_SECRET_FILE, 'utf8')); source = 'secret-file'; } catch (e) {}
} else {
  const local = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(local)) {
    try { key = box.parseKey(fs.readFileSync(local, 'utf8')); source = 'file'; } catch (e) {}
  }
}
if (!key) {
  console.error('找不到可用密钥：设置 PTA_SECRET_FILE / PTA_SECRET，或确认数据目录 .secret 存在；不会自动新建，避免写坏现有凭据。');
  process.exit(2);
}

const incoming = JSON.parse(fs.readFileSync(src, 'utf8'));
const db = openDB(path.join(DATA_DIR, 'seedpod.db'));

const upsert = db.prepare(
  'INSERT INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?) ' +
  'ON CONFLICT(host) DO UPDATE SET cookie = excluded.cookie, updated_at = excluded.updated_at'
);

let n = 0;
for (const host of Object.keys(incoming)) {
  const cookie = String(incoming[host] || '');
  if (!cookie) continue;
  upsert.run(host, box.encrypt(cookie, key), new Date().toISOString());
  n++;
}
const total = db.prepare('SELECT COUNT(*) AS n FROM credentials').get().n;
console.log('imported ' + n + ' hosts, key source=' + source + ', total=' + total);

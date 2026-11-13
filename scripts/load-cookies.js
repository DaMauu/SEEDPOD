/* 把 cookies.tmp.json 里的 cookie 加密写进 v2 的 SQLite 凭据表（在服务器上跑，用自己的密钥）。
   用法：PTA_DATA=/opt/seedpod/data node scripts/load-cookies.js /path/to/cookies.json */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const box = require(path.join(ROOT, 'pta', 'server', 'secretbox.js'));
const { openDB } = require(path.join(ROOT, 'pta', 'server', 'db.js'));
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(ROOT, 'pta', 'data'));
/* 密钥已移出 data 时，默认用服务器上的独立密钥文件 */
if (!process.env.PTA_SECRET && !process.env.PTA_SECRET_FILE && fs.existsSync('/etc/seedpod.secret')) {
  process.env.PTA_SECRET_FILE = '/etc/seedpod.secret';
}

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.log('用法：node scripts/load-cookies.js <cookies.json>'); process.exit(1); }
const incoming = JSON.parse(fs.readFileSync(src, 'utf8'));
const key = box.loadKey(DATA_DIR);
const db = openDB(path.join(DATA_DIR, 'seedpod.db'));

const upsert = db.prepare(
  'INSERT INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?) ' +
  'ON CONFLICT(host) DO UPDATE SET cookie = excluded.cookie, updated_at = excluded.updated_at'
);

let n = 0;
for (const host of Object.keys(incoming)) {
  const cookie = String(incoming[host] || '');
  if (!cookie) continue;
  upsert.run(host, box.encrypt(cookie, key.key), new Date().toISOString());
  n++;
}
const total = db.prepare('SELECT COUNT(*) AS n FROM credentials').get().n;
console.log('imported ' + n + ' hosts, key source=' + key.source + ', total=' + total);
